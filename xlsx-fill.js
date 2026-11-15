/*
 * Fills an existing .xlsx by editing the sheet XML inside the zip directly.
 * Everything we do not touch (drawings, form controls, validation, styles, print setup)
 * stays byte-identical, which round-tripping libraries cannot guarantee.
 */
(function (g) {
  'use strict';
  const VH = (g.VH = g.VH || {});
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';

  /* ---------- address helpers ---------- */
  function colToNum(s) { let n = 0; for (let i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64; return n; }
  function numToCol(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function parseAddr(a) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(String(a).trim());
    if (!m) return null;
    const col = colToNum(m[1].toUpperCase()), row = +m[2];
    return (col >= 1 && col <= 16384 && row >= 1 && row <= 1048576) ? { col: col, row: row } : null;
  }
  function addrOf(col, row) { return numToCol(col) + row; }
  function splitSheet(spec) {
    const i = spec.lastIndexOf('!');
    if (i < 0) return { sheet: null, ref: spec.trim() };
    let sh = spec.slice(0, i).trim();
    if (sh.length > 1 && sh[0] === "'" && sh[sh.length - 1] === "'") sh = sh.slice(1, -1).replace(/''/g, "'");
    return { sheet: sh, ref: spec.slice(i + 1).trim() };
  }

  VH.parseAddr = parseAddr; VH.addrOf = addrOf;

  /* Spec grammar: "C5"  |  "Sheet!C5"  |  "C5,E5,G5" (year,month,day)  |  "Male=E5;Female=G5" (mark chosen option with a circle) */
  VH.parseSpec = function (spec) {
    spec = String(spec || '').trim();
    if (!spec) return { kind: 'none' };
    if (spec.indexOf('=') >= 0) {
      const opts = {}, errs = [];
      spec.split(';').forEach(function (part) {
        if (!part.trim()) return;
        const j = part.indexOf('=');
        const name = j < 0 ? '' : part.slice(0, j).trim();
        const t = splitSheet(j < 0 ? '' : part.slice(j + 1));
        if (!name || !parseAddr(t.ref)) errs.push(part.trim()); else opts[name.toLowerCase()] = t;
      });
      return errs.length ? { kind: 'error', msg: 'Cannot read: ' + errs.join('; ') } : { kind: 'options', opts: opts };
    }
    const parts = spec.split(','), targets = [];
    let sheet = null;
    for (let i = 0; i < parts.length; i++) {
      const t = splitSheet(parts[i]);
      if (t.sheet !== null) sheet = t.sheet;
      if (!parseAddr(t.ref)) return { kind: 'error', msg: '"' + parts[i].trim() + '" is not a cell like C5' };
      targets.push({ sheet: sheet, ref: t.ref });
    }
    return { kind: 'cells', targets: targets };
  };

  /* ---------- XML helpers ---------- */
  function parseXml(str, what) {
    const doc = new DOMParser().parseFromString(str, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Cannot read ' + what);
    return doc;
  }
  function textOf(node) {
    let out = '';
    const ts = node.getElementsByTagNameNS(NS, 't');
    for (let i = 0; i < ts.length; i++) {
      let p = ts[i].parentNode, phonetic = false;
      while (p && p !== node) { if (p.localName === 'rPh') { phonetic = true; break; } p = p.parentNode; }
      if (!phonetic) out += ts[i].textContent;
    }
    return out;
  }
  function relTarget(baseDir, target) {
    if (target.charAt(0) === '/') return target.slice(1);
    const parts = (baseDir ? baseDir.split('/') : []).concat(target.split('/')), out = [];
    parts.forEach(function (p) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
    return out.join('/');
  }
  function dirOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function baseOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }
  function firstByTag(parent, name) { return parent.getElementsByTagNameNS(NS, name)[0] || null; }
  function childrenByTag(parent, name) {
    const out = [];
    for (let n = parent.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && n.localName === name) out.push(n);
    return out;
  }

  /* ---------- Template ---------- */
  function Template(zip) { this.zip = zip; this.sheets = []; this.shared = []; this.macro = false; this._labels = null; }

  VH.openTemplate = async function (buf) {
    if (typeof JSZip === 'undefined') throw new Error('The zip library did not load.');
    let zip;
    try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new Error('This is not a valid .xlsx file.'); }
    const t = new Template(zip);
    const ct = zip.file('[Content_Types].xml');
    t.macro = !!(ct && /macroEnabled/.test(await ct.async('string')));

    let wbPath = 'xl/workbook.xml';
    const rootRels = zip.file('_rels/.rels');
    if (rootRels) {
      const rd = parseXml(await rootRels.async('string'), '_rels/.rels');
      const rs = rd.getElementsByTagName('Relationship');
      for (let i = 0; i < rs.length; i++) {
        if (/officeDocument$/.test(rs[i].getAttribute('Type') || '')) wbPath = relTarget('', rs[i].getAttribute('Target'));
      }
    }
    const wbFile = zip.file(wbPath);
    if (!wbFile) throw new Error('This file has no workbook. Is it an Excel file?');
    const wbDoc = parseXml(await wbFile.async('string'), wbPath);
    const relsFile = zip.file(dirOf(wbPath) + '/_rels/' + baseOf(wbPath) + '.rels');
    const relMap = {};
    let sstPath = null;
    if (relsFile) {
      const rd = parseXml(await relsFile.async('string'), 'workbook relationships');
      const rs = rd.getElementsByTagName('Relationship');
      for (let i = 0; i < rs.length; i++) {
        const id = rs[i].getAttribute('Id'), tg = relTarget(dirOf(wbPath), rs[i].getAttribute('Target'));
        relMap[id] = tg;
        if (/sharedStrings$/.test(rs[i].getAttribute('Type') || '')) sstPath = tg;
      }
    }
    if (sstPath && zip.file(sstPath)) {
      const sd = parseXml(await zip.file(sstPath).async('string'), 'shared strings');
      const sis = sd.getElementsByTagNameNS(NS, 'si');
      for (let i = 0; i < sis.length; i++) t.shared.push(textOf(sis[i]));
    }
    const sheetEls = wbDoc.getElementsByTagNameNS(NS, 'sheet');
    for (let i = 0; i < sheetEls.length; i++) {
      const rid = sheetEls[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const path = relMap[rid];
      if (!path || !zip.file(path)) continue;
      const doc = parseXml(await zip.file(path).async('string'), 'sheet ' + sheetEls[i].getAttribute('name'));
      t.sheets.push(t._index({ name: sheetEls[i].getAttribute('name'), path: path, doc: doc, dirty: false,
        hidden: sheetEls[i].getAttribute('state') === 'hidden' }));
    }
    if (!t.sheets.length) throw new Error('No worksheets found in this file.');
    return t;
  };

  Template.prototype._index = function (sh) {
    sh.rows = new Map(); sh.cells = new Map(); sh.merges = [];
    const sd = firstByTag(sh.doc, 'sheetData');
    let rowNo = 0;
    if (sd) childrenByTag(sd, 'row').forEach(function (r) {
      rowNo = r.hasAttribute('r') ? +r.getAttribute('r') : rowNo + 1;
      sh.rows.set(rowNo, r);
      let colNo = 0;
      childrenByTag(r, 'c').forEach(function (c) {
        let a = c.getAttribute('r'), p = a && parseAddr(a);
        if (!p) { colNo += 1; a = addrOf(colNo, rowNo); } else colNo = p.col;
        sh.cells.set(a.toUpperCase(), c);
      });
    });
    const mcs = sh.doc.getElementsByTagNameNS(NS, 'mergeCell');
    for (let i = 0; i < mcs.length; i++) {
      const ref = (mcs[i].getAttribute('ref') || '').split(':');
      const a = parseAddr(ref[0]), b = parseAddr(ref[ref.length - 1]);
      if (a && b) sh.merges.push({ c1: a.col, r1: a.row, c2: b.col, r2: b.row });
    }
    return sh;
  };

  Template.prototype.sheetIndex = function (name) {
    if (name === null || name === undefined || name === '') return 0;
    let i = this.sheets.findIndex(function (s) { return s.name === name; });
    if (i < 0) i = this.sheets.findIndex(function (s) { return s.name.toLowerCase() === String(name).toLowerCase(); });
    return i;
  };
  Template.prototype.sheetNames = function () { return this.sheets.map(function (s) { return s.name; }); };

  function mergeOf(sh, col, row) {
    for (let i = 0; i < sh.merges.length; i++) {
      const m = sh.merges[i];
      if (col >= m.c1 && col <= m.c2 && row >= m.r1 && row <= m.r2) return m;
    }
    return { c1: col, r1: row, c2: col, r2: row };
  }
  Template.prototype._text = function (c) {
    if (!c) return '';
    const t = c.getAttribute('t');
    if (t === 's') { const v = firstByTag(c, 'v'); return v ? (this.shared[+v.textContent] || '') : ''; }
    if (t === 'inlineStr') { const is = firstByTag(c, 'is'); return is ? textOf(is) : ''; }
    const v = firstByTag(c, 'v');
    return v ? v.textContent : '';
  };
  Template.prototype._hasFormula = function (c) { return !!(c && firstByTag(c, 'f')); };
  Template.prototype._empty = function (sh, col, row) {
    const c = sh.cells.get(addrOf(col, row));
    return !c || (this._text(c).trim() === '' && !this._hasFormula(c));
  };

  /* Describe what is currently at a target, for the cell-map table. */
  Template.prototype.inspect = function (sheetName, ref) {
    const si = this.sheetIndex(sheetName);
    if (si < 0) return { ok: false, msg: 'Sheet "' + sheetName + '" not found' };
    const sh = this.sheets[si], p = parseAddr(ref);
    if (!p) return { ok: false, msg: 'Not a cell' };
    const m = mergeOf(sh, p.col, p.row), a = addrOf(m.c1, m.r1), c = sh.cells.get(a);
    if (this._hasFormula(c)) return { ok: false, msg: a + ' contains a formula and will be skipped' };
    const cur = this._text(c).trim();
    const prefix = a !== ref.toUpperCase().replace(/\$/g, '') ? 'merged cell, writes to ' + a + '. ' : '';
    if (cur) return { ok: false, warn: true, msg: prefix + 'Already contains "' + cur.replace(/\s+/g, ' ').slice(0, 40) + '"' };
    return { ok: true, msg: prefix + 'Empty, ready' };
  };
  Template.prototype.rowStep = function (sheetName, ref) {
    const si = this.sheetIndex(sheetName);
    if (si < 0) return 1;
    const p = parseAddr(ref);
    if (!p) return 1;
    const m = mergeOf(this.sheets[si], p.col, p.row);
    return m.r2 - m.r1 + 1;
  };

  /* ---------- auto-detect ---------- */
  Template.prototype._scanLabels = function () {
    if (this._labels) return this._labels;
    const out = [], self = this;
    this.sheets.forEach(function (sh, si) {
      sh.cells.forEach(function (c, a) {
        const text = self._text(c).trim();
        if (!text || text.length > 120 || firstByTag(c, 'f')) return;
        const p = parseAddr(a);
        out.push({ si: si, row: p.row, col: p.col, addr: a, text: text });
      });
    });
    out.sort(function (x, y) { return x.si - y.si || x.row - y.row || x.col - y.col; });
    this._labels = out;
    return out;
  };
  function after(a, b) { return a.si > b.si || (a.si === b.si && (a.row > b.row || (a.row === b.row && a.col > b.col))); }

  /* Normal items: the answer box to the right of the label. On the ISA forms the English label overflows
     across several empty single cells, and the real box is the first MERGED range after them. So we skip plain
     spacer cells until we reach a merged box, stopping at the next printed text.
     Table headers (below:true): first empty row under the header. */
  Template.prototype._target = function (hit, below) {
    const sh = this.sheets[hit.si], m = mergeOf(sh, hit.col, hit.row);
    function result(mm) { return { si: hit.si, addr: addrOf(mm.c1, mm.r1) }; }
    if (below) {
      const cell = mergeOf(sh, m.c1, m.r2 + 1);
      return this._empty(sh, cell.c1, cell.r1) ? result(cell) : null;
    }
    let col = m.c2 + 1, firstEmpty = null;
    for (let n = 0; n < 40 && col <= 16384; n++) {
      const cell = mergeOf(sh, col, m.r1);
      if (!this._empty(sh, cell.c1, cell.r1)) break;          // next printed label: stop
      if (cell.c2 > cell.c1) return result(cell);              // first merged box wins
      if (!firstEmpty) firstEmpty = cell;
      col = cell.c2 + 1;
    }
    return firstEmpty ? result(firstEmpty) : null;
  };

  /* Date boxes: the ISA forms print "Year / Month / Day" labels, with the number box just LEFT of each label. */
  Template.prototype._dateTargets = function (hit) {
    const sh = this.sheets[hit.si], m = mergeOf(sh, hit.col, hit.row), self = this;
    const labels = this._scanLabels().filter(function (l) {
      return l.si === hit.si && l.row >= m.r1 - 1 && l.row <= m.r2 + 1 && l.col > m.c2;
    });
    const rxs = [/(^|[\s\n])year\s*$/i, /(^|[\s\n])month\s*$/i, /(^|[\s\n])day\s*$/i];
    let prevCol = m.c2, out = [];
    for (let i = 0; i < 3; i++) {
      const l = labels.find(function (x) { return x.col > prevCol && x.text.length <= 14 && rxs[i].test(x.text); });
      if (!l) return null;
      const lm = mergeOf(sh, l.col, l.row);
      if (lm.c1 < 2) return null;
      const box = mergeOf(sh, lm.c1 - 1, l.row);
      if (!self._empty(sh, box.c1, box.r1)) return null;
      out.push((this.sheets.length > 1 ? sh.name + '!' : '') + addrOf(box.c1, box.r1));
      prevCol = lm.c2;
    }
    return out.join(',');
  };

  /* Returns { key: { spec, label } } for every field whose label chain was found. */
  Template.prototype.guess = function (fields) {
    const labels = this._scanLabels(), out = {}, self = this, multi = this.sheets.length > 1;
    fields.forEach(function (f) {
      if (!f.hint) return;
      let prev = null, hit = null;
      for (let i = 0; i < f.hint.length; i++) {
        const step = f.hint[i];
        let rx;
        try { rx = new RegExp(step.rx, 'is'); } catch (e) { return; }
        const cands = labels.filter(function (l) { return rx.test(l.text) && (!prev || after(l, prev)); });
        if (!cands.length) { hit = null; break; }
        hit = step.last ? cands[cands.length - 1] : cands[0];
        prev = hit;
      }
      if (!hit) return;
      if (f.type === 'select') return;   // circle options (Male/Female etc.): set by hand, a text guess lands in the wrong place
      const below = !!f.hint[f.hint.length - 1].below;
      if (f.type === 'date' && !below) {
        const ds = self._dateTargets(hit);
        if (ds) { out[f.key] = { spec: ds, label: hit.text.split(/\r?\n/).pop().trim() }; return; }
      }
      const tg = self._target(hit, below);
      if (!tg) return;
      out[f.key] = { spec: (multi ? self.sheets[tg.si].name + '!' : '') + tg.addr, label: hit.text.split(/\r?\n/).pop().trim() };
    });
    return out;
  };

  /* ---------- writing ---------- */
  Template.prototype._createCell = function (sh, col, row) {
    const doc = sh.doc, sd = firstByTag(doc, 'sheetData');
    let r = sh.rows.get(row);
    if (!r) {
      r = doc.createElementNS(NS, 'row');
      r.setAttribute('r', String(row));
      let before = null;
      const rows = childrenByTag(sd, 'row');
      for (let i = 0; i < rows.length; i++) { if (+rows[i].getAttribute('r') > row) { before = rows[i]; break; } }
      sd.insertBefore(r, before);
      sh.rows.set(row, r);
    }
    r.removeAttribute('spans');
    const c = doc.createElementNS(NS, 'c');
    c.setAttribute('r', addrOf(col, row));
    let before = null;
    const cs = childrenByTag(r, 'c');
    for (let i = 0; i < cs.length; i++) {
      const p = parseAddr(cs[i].getAttribute('r') || '');
      if (p && p.col > col) { before = cs[i]; break; }
    }
    r.insertBefore(c, before);
    sh.cells.set(addrOf(col, row), c);
    return c;
  };

  /* Returns { ok, cell } or { ok:false, reason }. */
  Template.prototype.setText = function (sheetName, ref, text, opts) {
    opts = opts || {};
    const si = this.sheetIndex(sheetName);
    if (si < 0) return { ok: false, reason: 'sheet "' + sheetName + '" not found' };
    const sh = this.sheets[si], p = parseAddr(ref);
    if (!p) return { ok: false, reason: '"' + ref + '" is not a cell' };
    const m = mergeOf(sh, p.col, p.row), a = addrOf(m.c1, m.r1);
    let c = sh.cells.get(a);
    if (this._hasFormula(c)) return { ok: false, reason: a + ' contains a formula' };
    const cur = this._text(c).trim();
    if (cur && !opts.overwrite) return { ok: false, reason: a + ' already contains "' + cur.replace(/\s+/g, ' ').slice(0, 30) + '"' };
    if (!c) c = this._createCell(sh, m.c1, m.r1);
    while (c.firstChild) c.removeChild(c.firstChild);
    c.setAttribute('t', 'inlineStr');
    const is = sh.doc.createElementNS(NS, 'is'), t = sh.doc.createElementNS(NS, 't');
    t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    t.textContent = String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    is.appendChild(t); c.appendChild(is);
    sh.dirty = true;
    return { ok: true, cell: (this.sheets.length > 1 ? sh.name + '!' : '') + a };
  };

  Template.prototype.save = async function () {
    const self = this;
    for (let i = 0; i < this.sheets.length; i++) {
      const sh = this.sheets[i];
      if (!sh.dirty) continue;
      let xml = new XMLSerializer().serializeToString(sh.doc);
      if (xml.indexOf('<?xml') !== 0) xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
      self.zip.file(sh.path, xml, { createFolders: false });
    }
    return this.zip.generateAsync({
      type: 'blob', compression: 'DEFLATE',
      mimeType: this.macro ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  };
})(window);
