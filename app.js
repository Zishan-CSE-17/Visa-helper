/* Japan Visa Form Helper: UI and application logic. Everything runs in the browser. */
(function () {
  'use strict';
  const VH = window.VH;
  const $ = function (s) { return document.querySelector(s); };
  const STORE = 'visa-helper-v1', MAPSTORE = 'visa-map-v2';

  /* ---------- tiny DOM helper (always textContent, never innerHTML) ---------- */
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) e.append(c); });
    return e;
  }

  /* ---------- storage ---------- */
  function readJSON(key, fallback) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function normalize(d) {
    const out = { f: {}, fam: [], mode: 'change', opts: { dateFmt: 'iso', bn: true } };
    if (!d || typeof d !== 'object') return out;
    if (d.f && typeof d.f === 'object') Object.keys(d.f).forEach(function (k) {
      if (VH.knownKeys[k] && typeof d.f[k] === 'string') out.f[k] = d.f[k].slice(0, 600);
    });
    if (Array.isArray(d.fam)) out.fam = d.fam.slice(0, 6).filter(function (m) { return m && typeof m === 'object'; }).map(function (m) {
      const o = {};
      VH.familyKeys.forEach(function (k) { if (typeof m[k] === 'string') o[k] = m[k].slice(0, 200); });
      return o;
    });
    if (d.mode === 'extension') out.mode = 'extension';
    if (d.opts && typeof d.opts === 'object') {
      if (['iso', 'dmy', 'text'].indexOf(d.opts.dateFmt) >= 0) out.opts.dateFmt = d.opts.dateFmt;
      if (d.opts.bn === false) out.opts.bn = false;
    }
    return out;
  }
  function cleanMaps(m) {
    const out = { change: {}, extension: {} };
    ['change', 'extension'].forEach(function (mode) {
      if (m && m[mode] && typeof m[mode] === 'object') Object.keys(m[mode]).forEach(function (k) {
        if (typeof m[mode][k] === 'string' && /^[\w.]+$/.test(k)) out[mode][k] = m[mode][k].slice(0, 200);
      });
    });
    return out;
  }

  let data = normalize(readJSON(STORE, null));
  let userMaps = cleanMaps(readJSON(MAPSTORE, null));
  let preset = { change: {}, extension: {} };
  let tpl = null, origBuf = null, fileName = '';
  const guessCache = {};

  /* ---------- toasts and status chip ---------- */
  function toast(msg, kind) {
    const t = h('div', { class: 'toast ' + (kind || ''), role: kind === 'err' ? 'alert' : null, text: msg });
    $('#toasts').append(t);
    setTimeout(function () { t.remove(); }, kind === 'err' ? 9000 : 4500);
  }
  function setChip(text, bad) {
    const c = $('#saveChip');
    c.textContent = text;
    c.classList.toggle('bad', !!bad);
  }
  let warnedStorage = false;
  let saveTimer = null;
  function hhmm() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function doSave() {
    saveTimer = null;
    if (writeJSON(STORE, data)) setChip('Saved ' + hhmm());
    else {
      setChip('Not saved', true);
      if (!warnedStorage) {
        warnedStorage = true;
        toast('Your browser is blocking storage (private mode?). Use "Save my data" so you do not lose your answers.', 'err');
      }
    }
    renderSheet();
  }
  function scheduleSave() {
    setChip('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 300);
  }
  window.addEventListener('pagehide', function () { if (saveTimer) { clearTimeout(saveTimer); doSave(); } });

  /* ---------- form ---------- */
  function makeControl(f, value, id, onValue) {
    let c;
    if (f.type === 'select') {
      c = h('select', { id: id }, [h('option', { value: '', text: 'Select…' })].concat(
        f.options.map(function (o) { return h('option', { value: o, text: o }); })));
    } else if (f.type === 'textarea') {
      c = h('textarea', { id: id, rows: 3, maxlength: 600 });
    } else if (f.type === 'combo') {
      c = h('input', { id: id, type: 'text', list: 'dl_' + f.key, autocomplete: 'off', maxlength: 200 });
    } else {
      c = h('input', { id: id, type: f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text', autocomplete: 'off',
        spellcheck: 'false', autocapitalize: f.upper ? 'characters' : 'off', inputmode: f.type === 'tel' ? 'tel' : null, maxlength: 200 });
    }
    c.value = value || '';
    if (f.upper) c.classList.add('upper');
    c.addEventListener('input', function () {
      if (f.upper) {
        const s = c.selectionStart, e = c.selectionEnd, u = c.value.toUpperCase();
        if (u !== c.value) { c.value = u; try { c.setSelectionRange(s, e); } catch (x) { /* ignore */ } }
      }
      onValue(c.value);
    });
    c.addEventListener('change', function () { onValue(c.value); });
    return c;
  }

  function fieldBlock(f, value, id, onValue) {
    const msg = h('div', { class: 'msg', id: id + '_msg' });
    const c = makeControl(f, value, id, function (v) {
      onValue(v);
      msg.textContent = VH.validate(f, v);
      c.classList.toggle('warn', !!msg.textContent);
    });
    c.setAttribute('aria-describedby', id + '_msg' + (f.bn ? ' ' + id + '_help' : ''));
    msg.textContent = VH.validate(f, value);
    if (msg.textContent) c.classList.add('warn');
    return h('div', { class: 'field' + (f.full ? ' full' : ''), 'data-key': f.key }, [
      h('label', { for: id }, [f.no && f.no !== '-' ? h('span', { class: 'no', text: 'Item ' + f.no }) : null, f.label]),
      c,
      f.bn ? h('div', { class: 'help', id: id + '_help', lang: 'bn', text: f.bn }) : null,
      msg
    ]);
  }

  function ensureDatalists() {
    if ($('#dl_status')) return;
    [['status', VH.STATUSES], ['newstatus', VH.TARGET_STATUSES]].forEach(function (p) {
      document.body.append(h('datalist', { id: 'dl_' + p[0] }, p[1].map(function (o) { return h('option', { value: o }); })));
    });
  }

  function visibleFields() {
    const out = [];
    VH.sections(data.mode).forEach(function (s) {
      s.fields.forEach(function (f) {
        if (f.showIf && data.f[f.showIf.key] !== f.showIf.value) return;
        if (!f.note) out.push(f);
      });
    });
    return out;
  }
  function applyConditions() {
    VH.sections(data.mode).forEach(function (s) {
      s.fields.forEach(function (f) {
        if (!f.showIf) return;
        const w = document.querySelector('#form [data-key="' + f.key + '"]');
        if (w) w.hidden = data.f[f.showIf.key] !== f.showIf.value;
      });
    });
  }
  function updateProgress() {
    const fs = visibleFields();
    const done = fs.filter(function (f) { return (data.f[f.key] || '').trim() !== ''; }).length;
    const pct = fs.length ? Math.round(100 * done / fs.length) : 0;
    $('#bar').style.setProperty('--p', pct + '%');
    $('.progress').setAttribute('aria-valuenow', String(pct));
    $('#progText').textContent = done + ' of ' + fs.length + ' answers filled';
  }
  function onFieldChange() { scheduleSave(); applyConditions(); updateProgress(); }

  function renderForm() {
    ensureDatalists();
    const root = $('#form');
    root.textContent = '';
    VH.sections(data.mode).forEach(function (sec) {
      const grid = h('div', { class: 'grid' });
      sec.fields.forEach(function (f) {
        grid.append(fieldBlock(f, data.f[f.key] || '', 'f_' + f.key, function (v) { data.f[f.key] = v; onFieldChange(); }));
      });
      root.append(h('section', { class: 'group' }, [h('h3', { text: sec.title }), grid]));
    });
    applyConditions();
    updateProgress();
    renderFamily();
    renderSheet();
  }

  function renderFamily() {
    const box = $('#famBox');
    box.textContent = '';
    data.fam.forEach(function (m, i) {
      const grid = h('div', { class: 'grid' });
      VH.FAMILY.forEach(function (f) {
        grid.append(fieldBlock(f, m[f.key] || '', 'fam_' + i + '_' + f.key, function (v) { data.fam[i][f.key] = v; scheduleSave(); }));
      });
      box.append(h('div', { class: 'fam' }, [
        h('div', { class: 'famhead' }, [
          h('strong', { text: 'Family member ' + (i + 1) }),
          h('button', { type: 'button', class: 'btn small outline-danger', text: 'Remove', onclick: function () {
            data.fam.splice(i, 1); scheduleSave(); renderFamily();
          } })
        ]),
        grid
      ]));
    });
    $('#btnAddFam').hidden = data.fam.length >= 6;
  }

  /* ---------- printable data sheet ---------- */
  function rowsForList() {
    const out = [];
    VH.sections(data.mode).forEach(function (s) {
      s.fields.forEach(function (f) {
        if (f.showIf && data.f[f.showIf.key] !== f.showIf.value) return;
        const v = f.type === 'date' ? VH.fmtDate(data.f[f.key], data.opts.dateFmt) : (data.f[f.key] || '');
        out.push([f.no === '-' ? '' : f.no, f.label, v]);
      });
    });
    return out;
  }
  function titleOf() { return data.mode === 'change' ? 'Application for Change of Status of Residence' : 'Application for Extension of Period of Stay'; }
  function renderSheet() {
    const s = $('#sheet');
    s.textContent = '';
    s.append(h('h1', { text: titleOf() + ': applicant data' }),
      h('p', { class: 'note', text: 'Item numbers match the official ISA form (applicant, part 1). Copy these values into the official form.' }));
    const tbody = h('tbody');
    rowsForList().forEach(function (r) {
      tbody.append(h('tr', null, [h('td', { class: 'no', text: r[0] }), h('td', { class: 'item', text: r[1] }), h('td', { text: r[2] })]));
    });
    s.append(h('table', null, [h('thead', null, [h('tr', null, ['No.', 'Item', 'Your entry'].map(function (t) { return h('th', { text: t }); }))]), tbody]));
    s.append(h('h2', { text: 'Item 16: Family members in Japan' }));
    if (!data.fam.length) { s.append(h('p', { text: 'None entered.' })); return; }
    const fb = h('tbody');
    data.fam.forEach(function (m) {
      fb.append(h('tr', null, VH.FAMILY.map(function (f) {
        return h('td', { text: f.type === 'date' ? VH.fmtDate(m[f.key], data.opts.dateFmt) : (m[f.key] || '') });
      })));
    });
    s.append(h('table', null, [h('thead', null, [h('tr', null, VH.FAMILY.map(function (f) { return h('th', { text: f.label }); }))]), fb]));
  }

  /* ---------- downloads ---------- */
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  /* ---------- cell map ---------- */
  function getGuess(mode) {
    if (!tpl) return {};
    if (!guessCache[mode]) guessCache[mode] = tpl.guess(VH.mapFields(mode));
    return guessCache[mode];
  }
  function effectiveMap(mode) {
    const out = {}, gs = getGuess(mode), um = userMaps[mode] || {}, pr = preset[mode] || {};
    VH.mapFields(mode).forEach(function (f) {
      if (Object.prototype.hasOwnProperty.call(um, f.key)) out[f.key] = um[f.key];
      else out[f.key] = pr[f.key] || (gs[f.key] && gs[f.key].spec) || '';
    });
    return out;
  }

  /* Returns { cls, msg } describing what a cell-map entry will do. */
  function describe(f, spec) {
    if (!spec) return { cls: '', msg: tpl && getGuess(data.mode)[f.key] ? 'Skipped' : 'No match found. Type the cell if the form has this box.' };
    const p = VH.parseSpec(spec);
    if (p.kind === 'error') return { cls: 'err', msg: p.msg };
    if (p.kind === 'options') {
      let worst = { cls: 'ok', msg: 'Marks the chosen option with ○' };
      Object.keys(p.opts).forEach(function (k) {
        const r = tpl.inspect(p.opts[k].sheet, p.opts[k].ref);
        if (!r.ok) worst = { cls: r.warn ? 'warn' : 'err', msg: k + ': ' + r.msg };
      });
      return worst;
    }
    if (p.targets.length > 1 && f.type !== 'date') return { cls: 'err', msg: 'Use a single cell for this item' };
    if (p.targets.length !== 1 && p.targets.length !== 3) return { cls: 'err', msg: 'Use 1 cell, or 3 cells (year,month,day)' };
    let res = { cls: 'ok', msg: p.targets.length === 3 ? 'Year, month and day boxes' : 'Ready' };
    p.targets.forEach(function (t) {
      const r = tpl.inspect(t.sheet, t.ref);
      if (!r.ok) res = { cls: r.warn ? 'warn' : 'err', msg: r.msg };
      else if (res.cls === 'ok' && p.targets.length === 1) res = { cls: 'ok', msg: r.msg };
    });
    return res;
  }

  function renderMap() {
    const wrap = $('#mapWrap');
    wrap.hidden = !tpl;
    $('#btnFill').disabled = !tpl;
    $('#btnTest').disabled = !tpl;
    if (!tpl) return;
    const mode = data.mode, eff = effectiveMap(mode), gs = getGuess(mode), rows = $('#mapRows');
    rows.textContent = '';
    const fields = VH.mapFields(mode), statusEls = [];
    fields.forEach(function (f) {
      const id = 'm_' + f.key.replace(/\./g, '_');
      const stat = h('div', { class: 'mstat' });
      const input = h('input', { id: id, type: 'text', value: eff[f.key] || '', placeholder: 'e.g. C5', autocomplete: 'off',
        spellcheck: 'false', 'aria-describedby': id + '_s' });
      stat.id = id + '_s';
      function upd() {
        const spec = input.value.trim(), d = describe(f, spec);
        stat.className = 'mstat ' + d.cls;
        stat.textContent = d.msg + (gs[f.key] && spec === gs[f.key].spec ? ' · found near “' + gs[f.key].label.slice(0, 40) + '”' : '');
        updateMapSummary();
      }
      input.addEventListener('input', function () {
        userMaps[mode] = userMaps[mode] || {};
        userMaps[mode][f.key] = input.value.trim();
        writeJSON(MAPSTORE, userMaps);
        upd();
      });
      statusEls.push(upd);
      rows.append(h('div', { class: 'maprow' }, [
        h('label', { for: id }, [f.no && f.no !== '-' ? h('span', { class: 'no', text: 'Item ' + f.no }) : null, f.label]),
        input, stat
      ]));
    });
    statusEls.forEach(function (u) { u(); });
  }
  function updateMapSummary() {
    if (!tpl) return;
    const eff = effectiveMap(data.mode), fields = VH.mapFields(data.mode);
    let ready = 0, issues = 0;
    fields.forEach(function (f) {
      if (!eff[f.key]) return;
      const d = describe(f, eff[f.key]);
      if (d.cls === 'ok') ready++; else if (d.cls) issues++;
    });
    $('#mapSummary').textContent = ready + ' of ' + fields.length + ' boxes matched' + (issues ? ' · ' + issues + ' need a look' : '');
  }

  /* ---------- fill ---------- */
  function mapKeyValue(f) {
    if (f.key === 'fullname') return [data.f.family, data.f.given].filter(Boolean).join(' ');
    return data.f[f.key] || '';
  }

  async function runFill(test) {
    if (!tpl) return;
    const btn = test ? $('#btnTest') : $('#btnFill');
    btn.disabled = true;
    try {
      const t = await VH.openTemplate(origBuf.slice(0));
      const eff = effectiveMap(data.mode), overwrite = $('#chkOverwrite').checked;
      const rep = { written: 0, skipped: [], empty: [] };
      function put(sheet, ref, text, label) {
        const r = t.setText(sheet, ref, text, { overwrite: overwrite });
        if (r.ok) rep.written++; else rep.skipped.push(label + ': ' + r.reason);
      }
      VH.mapFields(data.mode).forEach(function (f) {
        const spec = eff[f.key];
        if (!spec) return;
        const p = VH.parseSpec(spec);
        if (p.kind === 'error') { rep.skipped.push(f.label + ': ' + p.msg); return; }
        if (f.fam) {
          if (p.kind !== 'cells' || p.targets.length !== 1) { rep.skipped.push(f.label + ': use one cell (first row of the table)'); return; }
          const tg = p.targets[0], start = VH.parseAddr(tg.ref), step = t.rowStep(tg.sheet, tg.ref);
          if (test) { put(tg.sheet, tg.ref, '[' + f.label.replace('Family table: ', '') + ']', f.label); return; }
          if (!data.fam.length) { rep.empty.push(f.label); return; }
          data.fam.forEach(function (m, i) {
            const raw = m[f.fam];
            if (!raw) return;
            const text = f.type === 'date' ? VH.fmtDate(raw, data.opts.dateFmt) : raw;
            put(tg.sheet, VH.addrOf(start.col, start.row + i * step), text, f.label + ' #' + (i + 1));
          });
          return;
        }
        const raw = mapKeyValue(f);
        if (!test && !raw) { rep.empty.push(f.label); return; }
        if (p.kind === 'options') {
          Object.keys(p.opts).forEach(function (k) {
            if (test || k === raw.toLowerCase()) put(p.opts[k].sheet, p.opts[k].ref, '○', f.label + ' (' + k + ')');
          });
          if (!test && !p.opts[raw.toLowerCase()]) rep.skipped.push(f.label + ': no cell given for "' + raw + '"');
          return;
        }
        if (p.targets.length === 3) {
          const parts = test ? { y: 'Year', m: 'Mon', d: 'Day' } : VH.dateParts(raw);
          if (!parts) { rep.skipped.push(f.label + ': enter a full date'); return; }
          [parts.y, parts.m, parts.d].forEach(function (v, i) { put(p.targets[i].sheet, p.targets[i].ref, String(v), f.label); });
          return;
        }
        if (p.targets.length !== 1) { rep.skipped.push(f.label + ': use one cell'); return; }
        put(p.targets[0].sheet, p.targets[0].ref, test ? '[' + f.label + ']' : (f.type === 'date' ? VH.fmtDate(raw, data.opts.dateFmt) : raw), f.label);
      });
      showReport(rep, test);
      if (!rep.written) { toast('Nothing was written. Check the cell map below.', 'err'); return; }
      const blob = await t.save();
      download(blob, (test ? 'test-' : 'filled-') + (fileName || 'form.xlsx'));
      toast(test ? 'Test file downloaded. Open it to see where each answer goes.' : 'Filled Excel downloaded.', 'ok');
    } catch (e) {
      toast('Could not fill the file: ' + (e && e.message ? e.message : e), 'err');
    } finally {
      btn.disabled = !tpl;
    }
  }

  function showReport(rep, test) {
    const box = $('#report');
    box.textContent = '';
    box.hidden = false;
    box.append(h('p', { class: 'rep-main', text: (test ? 'Test: ' : '') + 'Wrote ' + rep.written + ' cell' + (rep.written === 1 ? '' : 's') + '.' }));
    function list(title, items, cls) {
      if (!items.length) return;
      box.append(h('details', { class: cls, open: cls === 'warn' }, [
        h('summary', { text: title + ' (' + items.length + ')' }),
        h('ul', null, items.map(function (t) { return h('li', { text: t }); }))
      ]));
    }
    list('Skipped, please check', rep.skipped, 'warn');
    list('Left empty because you have not answered yet', rep.empty, '');
    box.append(h('p', { class: 'hint', text: 'Still do by hand in Excel: photo, signature, and any circles or ticks not handled above.' }));
  }

  async function loadTemplate(file) {
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      toast(/\.xls$/i.test(file.name) ? 'This is an old .xls file. Open it in Excel, choose Save As → .xlsx, then choose that file.' : 'Please choose the Excel (.xlsx) form.', 'err');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const t = await VH.openTemplate(buf.slice(0));
      tpl = t; origBuf = buf; fileName = file.name.replace(/^.*[\\/]/, '');
      Object.keys(guessCache).forEach(function (k) { delete guessCache[k]; });
      $('#xlsName').textContent = fileName + ' · ' + t.sheets.length + ' sheet' + (t.sheets.length === 1 ? '' : 's') + ' (' + t.sheetNames().join(', ') + ')';
      $('#report').hidden = true;
      renderMap();
      $('.mapdetails').open = true;
      toast('Excel form loaded. Check the matched boxes, then download.', 'ok');
    } catch (e) {
      tpl = null; origBuf = null;
      $('#xlsName').textContent = 'No file chosen.';
      renderMap();
      toast('Could not read that file: ' + e.message, 'err');
    }
  }

  /* ---------- wiring ---------- */
  function applyOpts() {
    document.body.classList.toggle('bn-off', !data.opts.bn);
    $('#bnToggle').checked = data.opts.bn;
    $('#dateFmt').value = data.opts.dateFmt;
    $('#mode').value = data.mode;
  }

  function wire() {
    $('#mode').addEventListener('change', function (e) { data.mode = e.target.value; scheduleSave(); renderForm(); renderMap(); });
    $('#dateFmt').addEventListener('change', function (e) { data.opts.dateFmt = e.target.value; scheduleSave(); });
    $('#bnToggle').addEventListener('change', function (e) { data.opts.bn = e.target.checked; document.body.classList.toggle('bn-off', !data.opts.bn); scheduleSave(); });
    $('#btnAddFam').addEventListener('click', function () { data.fam.push({}); scheduleSave(); renderFamily(); });
    $('#xlsIn').addEventListener('change', function (e) { const f = e.target.files[0]; if (f) loadTemplate(f); e.target.value = ''; });
    $('#btnFill').addEventListener('click', function () { runFill(false); });
    $('#btnTest').addEventListener('click', function () { runFill(true); });
    $('#btnReset').addEventListener('click', function () { userMaps[data.mode] = {}; writeJSON(MAPSTORE, userMaps); renderMap(); toast('Cell map reset to auto-detect.'); });
    $('#btnMapSave').addEventListener('click', function () {
      const o = {}; o[data.mode] = effectiveMap(data.mode);
      download(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' }), 'mapping-' + data.mode + '.json');
    });
    $('#mapLoad').addEventListener('change', function (e) {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      f.text().then(function (txt) {
        const j = JSON.parse(txt), m = cleanMaps(j.change || j.extension ? j : (function () { const o = {}; o[data.mode] = j; return o; })());
        ['change', 'extension'].forEach(function (k) { Object.assign(userMaps[k], m[k]); });
        writeJSON(MAPSTORE, userMaps); renderMap(); toast('Cell map loaded.', 'ok');
      }).catch(function () { toast('That is not a valid cell map file.', 'err'); });
    });

    $('#btnXlsx').addEventListener('click', async function () {
      try {
        const main = [['No.', 'Item', 'Your entry']].concat(rowsForList());
        const fam = [VH.FAMILY.map(function (f) { return f.label; })].concat(data.fam.map(function (m) {
          return VH.FAMILY.map(function (f) { return f.type === 'date' ? VH.fmtDate(m[f.key], data.opts.dateFmt) : (m[f.key] || ''); });
        }));
        const blob = await VH.writeXlsx([
          { name: 'Applicant data', widths: [6, 52, 48], rows: main },
          { name: 'Item 16 Family', widths: [18, 24, 14, 18, 14, 26, 22], rows: fam }
        ]);
        download(blob, (data.mode === 'change' ? 'change-of-status' : 'extension') + '-data-' + stamp() + '.xlsx');
      } catch (e) { toast('Could not create the Excel file: ' + e.message, 'err'); }
    });
    $('#btnPdf').addEventListener('click', function () { renderSheet(); window.print(); });
    $('#btnSave').addEventListener('click', function () {
      download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'visa-data-' + stamp() + '.json');
    });
    $('#fileLoad').addEventListener('change', function (e) {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      f.text().then(function (txt) {
        const j = JSON.parse(txt);
        if (!j || typeof j !== 'object' || typeof j.f !== 'object') throw new Error('bad');
        data = normalize(j); applyOpts(); scheduleSave(); renderForm(); renderMap();
        toast('Your data was loaded.', 'ok');
      }).catch(function () { toast('That is not a valid saved data file.', 'err'); });
    });
    $('#btnClear').addEventListener('click', function () {
      if (!window.confirm('Delete everything you entered on this device? This cannot be undone.')) return;
      data = normalize({ mode: data.mode, opts: data.opts }); scheduleSave(); renderForm(); renderMap();
      toast('All answers cleared.');
    });

    let deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('#btnInstall').hidden = false; });
    $('#btnInstall').addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt(); deferred = null; $('#btnInstall').hidden = true;
    });
  }

  /* ---------- start ---------- */
  applyOpts();
  wire();
  renderForm();
  renderMap();
  setChip(readJSON(STORE, null) ? 'Loaded' : 'Ready');

  fetch('mapping.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
    preset = cleanMaps(j); if (tpl) renderMap();
  }).catch(function () { /* no preset map: fine */ });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode is optional */ });
  }
})();
