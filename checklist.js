/* Document checklist: which papers to prepare for the immigration office. Ticks are saved on this device only. */
(function () {
  'use strict';
  const KEY = 'visa-helper-docs-v1';
  const GROUPS = [
    { id: 'me', title: 'You prepare', bn: 'আপনি নিজে তৈরি করবেন' },
    { id: 'emp', title: 'From your new employer', bn: 'নতুন কোম্পানি থেকে' },
    { id: 'school', title: 'From your school', bn: 'স্কুল/বিশ্ববিদ্যালয় থেকে' },
    { id: 'day', title: 'On the day', bn: 'আবেদনের দিন' }
  ];
  // m: 'change' | 'extension' | 'both'
  const ITEMS = [
    { id: 'passport', j: 'パスポート（旅券）', g: 'me', m: 'both', t: 'Passport (original)', bn: 'মূল পাসপোর্ট', n: 'You show it at the counter.' },
    { id: 'rc', j: '在留カード', g: 'me', m: 'both', t: 'Residence card (original)', bn: 'মূল রেসিডেন্স কার্ড', n: 'Bring the card itself, not only a copy.' },
    { id: 'form1', j: '在留資格変更許可申請書（申請人等作成用1）|在留期間更新許可申請書（申請人等作成用1）', g: 'me', m: 'both', t: 'Application form, applicant part 1 (printed and signed)', bn: 'এই সাইট দিয়ে পূরণ করা আবেদনপত্র, প্রিন্ট করে সই করা', n: 'Fill it with step 3 above. Add the photo and signature by hand.' },
    { id: 'form2', j: '申請人等作成用2（就労先の職種に応じた様式）', g: 'me', m: 'change', t: 'Applicant part 2 form for your new job type', bn: 'নতুন কাজের ধরন অনুযায়ী ২য় অংশের ফর্ম', n: 'For Engineer/Specialist in Humanities/International Services use the form for that status. Download it from the ISA page.' },
    { id: 'photo', j: '写真（縦4cm × 横3cm）', g: 'me', m: 'both', t: 'Photo, 4 cm tall × 3 cm wide, taken within the last 3 months', bn: '৪ সেমি × ৩ সেমি ছবি, গত ৩ মাসের মধ্যে তোলা', n: 'Front view, no hat, plain background. Write your name on the back.' },
    { id: 'resume', j: '履歴書', g: 'me', m: 'change', t: 'Resume (education and work history)', bn: 'পড়াশোনা ও কাজের তথ্যসহ জীবনবৃত্তান্ত', n: 'Any format. Make it match your documents exactly.' },
    { id: 'contract', j: '雇用契約書（または採用内定通知書）', g: 'emp', m: 'change', t: 'Employment contract or job offer letter', bn: 'চাকরির চুক্তিপত্র বা অফার লেটার', n: 'It must show job duties, contract period and salary.' },
    { id: 'registry', j: '登記事項証明書', g: 'emp', m: 'change', t: 'Company registry certificate (issued within 3 months)', bn: 'কোম্পানির রেজিস্ট্রি সনদ, ৩ মাসের মধ্যে তোলা', n: '' },
    { id: 'finance', j: '決算文書の写し（貸借対照表・損益計算書）', g: 'emp', m: 'change', t: 'Company financial statements (balance sheet, profit and loss)', bn: 'কোম্পানির আর্থিক বিবরণী', n: 'Some company categories send a tax summary instead. Your employer knows which.' },
    { id: 'brochure', j: '会社案内書（パンフレット）', g: 'emp', m: 'change', t: 'Company brochure or business description', bn: 'কোম্পানির ব্রোশিওর বা পরিচিতি', n: '' },
    { id: 'empforms', j: '所属機関等作成用の申請書類', g: 'emp', m: 'change', t: 'Employer’s part of the application forms', bn: 'ফর্মের কোম্পানির অংশ (কোম্পানি পূরণ করবে)', n: 'Ask the company which category (1 to 4) it is. The required papers depend on it.' },
    { id: 'grad', j: '卒業証明書（または卒業見込証明書）', g: 'school', m: 'change', t: 'Certificate of graduation, or of expected graduation (original)', bn: 'গ্র্যাজুয়েশন সনদ বা সম্ভাব্য গ্র্যাজুয়েশন সনদ (মূল)', n: 'Ask your school office early.' },
    { id: 'transcript', j: '成績証明書', g: 'school', m: 'change', t: 'Transcript (only if the office asks, often useful)', bn: 'ট্রান্সক্রিপ্ট (চাইলে লাগতে পারে)', n: 'It helps show your studies match the new job.' },
    { id: 'enroll', j: '在学証明書', g: 'school', m: 'extension', t: 'Certificate of enrollment', bn: 'স্কুলের ভর্তি/অধ্যয়নের সনদ', n: '' },
    { id: 'grades', j: '成績証明書', g: 'school', m: 'extension', t: 'Transcript of grades', bn: 'রেজাল্ট/ট্রান্সক্রিপ্ট', n: '' },
    { id: 'attend', j: '出席証明書', g: 'school', m: 'extension', t: 'Attendance record', bn: 'উপস্থিতির রেকর্ড', n: 'Low attendance is checked closely.' },
    { id: 'tuition', j: '学費納入証明書（授業料の領収書）', g: 'school', m: 'extension', t: 'Proof that tuition is paid', bn: 'ফি পরিশোধের রসিদ', n: '' },
    { id: 'funds', j: '経費支弁能力を証明する書類（預金残高証明書・奨学金証明書など）', g: 'me', m: 'extension', t: 'Proof you can pay your living costs (bank balance, scholarship, or sponsor’s documents)', bn: 'খরচ বহনের প্রমাণ: ব্যাংক ব্যালেন্স, বৃত্তি বা স্পনসরের কাগজ', n: 'If a sponsor pays, bring their income proof and a letter.' },
    { id: 'copies', j: '提出書類のコピー（写し）', g: 'day', m: 'both', t: 'Photocopies of everything you hand in', bn: 'জমা দেওয়া সব কাগজের ফটোকপি', n: 'Keep them for your records.' },
    { id: 'fee', j: '手数料納付書（収入印紙）', g: 'day', m: 'both', t: 'Fee (a revenue stamp, bought after approval)', bn: 'ফি (অনুমোদনের পর রেভিনিউ স্ট্যাম্প)', n: 'The amount has changed recently. Check the ISA page for the current fee.' },
    { id: 'time', j: '在留期間の満了日までに申請（満了日の3か月前から可能）', g: 'day', m: 'both', t: 'Apply before your period of stay ends (from 3 months before)', bn: 'মেয়াদ শেষ হওয়ার আগেই আবেদন করুন (৩ মাস আগে থেকে করা যায়)', n: '' }
  ];

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } }

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function render() {
    const box = document.getElementById('docList'), mode = document.getElementById('mode');
    if (!box) return;
    const m = mode && mode.value === 'extension' ? 'extension' : 'change', ticks = read();
    box.textContent = '';
    let total = 0, done = 0;
    GROUPS.forEach(function (g) {
      const items = ITEMS.filter(function (i) { return i.g === g.id && (i.m === 'both' || i.m === m); });
      if (!items.length) return;
      const sec = el('div', 'docgroup');
      sec.append(el('h3', '', g.title));
      sec.append(el('p', 'help', g.bn));
      items.forEach(function (i) {
        total++; if (ticks[i.id]) done++;
        const lab = el('label', 'docitem');
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = !!ticks[i.id];
        cb.addEventListener('change', function () { const t = read(); if (cb.checked) t[i.id] = 1; else delete t[i.id]; write(t); render(); });
        const body = el('span', 'docbody');
        body.append(el('span', 'doctitle', i.t));
        const jp = el('span', 'jp', (i.j || '').split('|')[m === 'extension' && i.j.indexOf('|') >= 0 ? 1 : 0]);
        jp.lang = 'ja'; body.append(jp);
        if (i.n) body.append(el('span', 'docnote', i.n));
        body.append(el('span', 'help', i.bn));
        lab.append(cb, body);
        sec.append(lab);
      });
      box.append(sec);
    });
    document.getElementById('docProg').textContent = done + ' of ' + total + ' ready';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const mode = document.getElementById('mode');
    if (mode) mode.addEventListener('change', render);
    const clr = document.getElementById('btnDocClear');
    if (clr) clr.addEventListener('click', function () { write({}); render(); });
    render();
  });
  if (document.readyState !== 'loading') { render(); }
})();
