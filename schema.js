/* Field definitions, validation and date helpers. No DOM access here. */
(function (g) {
  'use strict';
  const VH = (g.VH = g.VH || {});

  VH.STATUSES = [
    'Student', 'College Student', 'Dependent', 'Designated Activities',
    'Engineer/Specialist in Humanities/International Services', 'Skilled Labor',
    'Highly Skilled Professional', 'Specified Skilled Worker', 'Intra-company Transferee',
    'Business Manager', 'Researcher', 'Instructor', 'Professor', 'Cultural Activities',
    'Spouse or Child of Japanese National', 'Spouse or Child of Permanent Resident', 'Long-Term Resident'
  ];
  VH.TARGET_STATUSES = VH.STATUSES.filter(function (s) { return s !== 'Student' && s !== 'College Student'; });

  // hint = chain of label regexes (case-insensitive) used to auto-detect where the answer goes.
  // Each step must appear after the previous one in reading order. opts: last / below.
  const F = {
    nationality: { key: 'nationality', no: '1', label: 'Nationality / Region', type: 'text', upper: true,
      bn: 'পাসপোর্টে লেখা দেশ, যেমন BANGLADESH', hint: [{ rx: 'nationality' }] },
    dob: { key: 'dob', no: '2', label: 'Date of birth', type: 'date', check: 'dob',
      bn: 'পাসপোর্ট অনুযায়ী জন্মতারিখ', hint: [{ rx: 'date of birth' }] },
    family: { key: 'family', no: '3', label: 'Family name (surname)', type: 'text', upper: true, check: 'name',
      bn: 'পাসপোর্টের Surname। ইংরেজি বড় হাতের অক্ষরে', hint: [{ rx: 'family name' }] },
    given: { key: 'given', no: '3', label: 'Given name(s)', type: 'text', upper: true, check: 'name',
      bn: 'পাসপোর্টের Given name', hint: [{ rx: 'given name' }] },
    sex: { key: 'sex', no: '4', label: 'Sex', type: 'select', options: ['Male', 'Female'],
      bn: 'পুরুষ = Male, মহিলা = Female', hint: [{ rx: '\\bsex\\b' }] },
    birthplace: { key: 'birthplace', no: '5', label: 'Place of birth', type: 'text', upper: true,
      bn: 'জন্মস্থান: শহর/জেলা ও দেশ', hint: [{ rx: 'place of birth' }] },
    marital: { key: 'marital', no: '6', label: 'Marital status', type: 'select', options: ['Married', 'Single'],
      bn: 'বিবাহিত = Married, অবিবাহিত = Single', hint: [{ rx: 'marital status' }] },
    occupation: { key: 'occupation', no: '7', label: 'Occupation', type: 'text',
      bn: 'বর্তমান পেশা, যেমন Student', hint: [{ rx: 'occupation' }] },
    homeaddr: { key: 'homeaddr', no: '8', label: 'Home town / city in home country', type: 'text', full: true, upper: true,
      bn: 'নিজ দেশের বাড়ির শহর/জেলা', hint: [{ rx: 'home town|city in home' }] },
    jpaddr: { key: 'jpaddr', no: '9', label: 'Address in Japan', type: 'text', full: true,
      bn: 'রেসিডেন্স কার্ডের ঠিকানা অনুযায়ী জাপানের ঠিকানা', hint: [{ rx: 'address in japan' }] },
    tel: { key: 'tel', no: '9', label: 'Telephone number', type: 'tel', check: 'tel',
      bn: 'জাপানের ফোন নম্বর (থাকলে)', hint: [{ rx: 'address in japan' }, { rx: 'tele?phone' }] },
    mobile: { key: 'mobile', no: '9', label: 'Mobile phone number', type: 'tel', check: 'tel',
      bn: 'জাপানের মোবাইল নম্বর', hint: [{ rx: 'address in japan' }, { rx: 'mobile|cellular' }] },
    passno: { key: 'passno', no: '10', label: 'Passport number', type: 'text', upper: true, check: 'passport',
      bn: 'পাসপোর্টের নম্বর', hint: [{ rx: 'passport' }, { rx: 'number' }] },
    passexp: { key: 'passexp', no: '10', label: 'Passport expiry date', type: 'date', check: 'future',
      bn: 'পাসপোর্টের মেয়াদ শেষের তারিখ', hint: [{ rx: 'passport' }, { rx: 'date of expiration' }] },
    status: { key: 'status', no: '11', label: 'Current status of residence', type: 'combo', options: VH.STATUSES,
      bn: 'রেসিডেন্স কার্ডে লেখা বর্তমান ভিসা (Student)',
      hint: [{ rx: '^(?!.*desired).*status of residence' }] },
    period: { key: 'period', no: '11', label: 'Current period of stay', type: 'text',
      bn: 'কার্ডের মেয়াদ, যেমন 1 year 3 months',
      hint: [{ rx: '^(?!.*desired).*status of residence' }, { rx: 'period of stay' }] },
    stayexp: { key: 'stayexp', no: '11', label: 'Expiry date of period of stay', type: 'date', check: 'future',
      bn: 'রেসিডেন্স কার্ডের মেয়াদ শেষের তারিখ',
      hint: [{ rx: '^(?!.*desired).*status of residence' }, { rx: 'date of expiration' }] },
    rcno: { key: 'rcno', no: '12', label: 'Residence card number', type: 'text', upper: true, check: 'rc',
      bn: 'কার্ডের ১২ অক্ষরের নম্বর: ২ অক্ষর + ৮ সংখ্যা + ২ অক্ষর', hint: [{ rx: 'residence card number' }] },
    newstatus: { key: 'newstatus', no: '13', label: 'Desired status of residence', type: 'combo', options: VH.TARGET_STATUSES,
      bn: 'যে ভিসায় যেতে চান, যেমন Engineer/Specialist in Humanities/International Services',
      hint: [{ rx: 'desired status of residence' }] },
    newperiod: { key: 'newperiod', no: '13', label: 'Desired period of stay', type: 'text',
      bn: 'চাওয়া মেয়াদ, যেমন 1 year (ইমিগ্রেশন অন্য মেয়াদ দিতে পারে)',
      hint: [{ rx: 'desired status of residence' }, { rx: 'period of stay' }] },
    desired: { key: 'desired', no: '13', label: 'Desired length of extension', type: 'text',
      bn: 'কত মেয়াদের জন্য বাড়াতে চান', hint: [{ rx: 'desired length' }] },
    reasonChange: { key: 'reason', no: '14', label: 'Reason for change of status of residence', type: 'textarea', full: true,
      bn: 'কেন ভিসা বদলাতে চান, যেমন: To work at (company) after graduating',
      hint: [{ rx: 'reason for change' }] },
    reasonExt: { key: 'reason', no: '14', label: 'Reason for extension', type: 'textarea', full: true,
      bn: 'কেন মেয়াদ বাড়াতে চান', hint: [{ rx: 'reason for' }] },
    crim: { key: 'crim', no: '15', label: 'Criminal record (Japan or overseas, incl. traffic violations)', type: 'select', options: ['No', 'Yes'],
      bn: 'ট্রাফিক জরিমানা সহ কোনো শাস্তি থাকলে Yes', hint: [{ rx: 'criminal record' }] },
    crimdetail: { key: 'crimdetail', no: '15', label: 'Details of the record', type: 'text', full: true,
      showIf: { key: 'crim', value: 'Yes' }, bn: 'কী ধরনের শাস্তি, কবে', hint: null },
    empname: { key: 'empname', no: '-', label: 'Employer / company name', type: 'text', note: true, hint: null },
    empaddr: { key: 'empaddr', no: '-', label: 'Employer address', type: 'text', full: true, note: true, hint: null },
    emptel: { key: 'emptel', no: '-', label: 'Employer telephone', type: 'tel', note: true, hint: null },
    empjob: { key: 'empjob', no: '-', label: 'Job title / duties', type: 'text', note: true, hint: null },
    empstart: { key: 'empstart', no: '-', label: 'Employment start date', type: 'date', note: true, hint: null },
    empsalary: { key: 'empsalary', no: '-', label: 'Monthly salary (JPY)', type: 'text', note: true, hint: null }
  };

  const BASE = [
    { title: 'Personal details', fields: ['nationality', 'dob', 'family', 'given', 'sex', 'birthplace', 'marital', 'occupation', 'homeaddr'] },
    { title: 'Address in Japan', fields: ['jpaddr', 'tel', 'mobile'] },
    { title: 'Passport', fields: ['passno', 'passexp'] },
    { title: 'Current status of residence', fields: ['status', 'period', 'stayexp', 'rcno'] }
  ];

  VH.sections = function (mode) {
    const out = BASE.map(function (s) { return { title: s.title, fields: s.fields.map(function (k) { return F[k]; }) }; });
    if (mode === 'change') {
      out.push({ title: 'What you are applying for', fields: ['newstatus', 'newperiod', 'reasonChange', 'crim', 'crimdetail'].map(function (k) { return F[k]; }) });
      out.push({ title: 'New workplace (notes for part 2 and your employer’s forms)',
        fields: ['empname', 'empaddr', 'emptel', 'empjob', 'empstart', 'empsalary'].map(function (k) { return F[k]; }) });
    } else {
      out.push({ title: 'What you are applying for', fields: ['desired', 'reasonExt', 'crim', 'crimdetail'].map(function (k) { return F[k]; }) });
    }
    return out;
  };

  VH.FAMILY = [
    { key: 'rel', label: 'Relationship', type: 'text', hint: [{ rx: 'relationship', last: true, below: true }] },
    { key: 'name', label: 'Name', type: 'text', upper: true, hint: [{ rx: '(^|\\s)name\\s*$', last: true, below: true }] },
    { key: 'dob', label: 'Date of birth', type: 'date', hint: [{ rx: 'date of birth', last: true, below: true }] },
    { key: 'nat', label: 'Nationality / Region', type: 'text', upper: true, hint: [{ rx: 'nationality', last: true, below: true }] },
    { key: 'live', label: 'Residing with you', type: 'select', options: ['Yes', 'No'], hint: [{ rx: 'residing', last: true, below: true }] },
    { key: 'work', label: 'Workplace / School', type: 'text', hint: [{ rx: 'employment|school|workplace', last: true, below: true }] },
    { key: 'rc', label: 'Residence card number', type: 'text', upper: true, hint: [{ rx: 'residence card number', last: true, below: true }] }
  ];

  VH.FULLNAME = { key: 'fullname', no: '3', label: 'Full name in ONE box (family + given)', type: 'text', derived: true, hint: null };

  // Every field that can be written into the official Excel, for the cell-map table.
  VH.mapFields = function (mode) {
    const list = [];
    VH.sections(mode).forEach(function (s) {
      s.fields.forEach(function (f) { if (!f.note && f.key !== 'crimdetail') list.push(f); });
    });
    list.push(VH.FULLNAME);
    VH.FAMILY.forEach(function (f) { list.push({ key: 'fam.' + f.key, fam: f.key, no: '16', label: 'Family table: ' + f.label,
      type: f.type, hint: f.hint }); });
    return list;
  };

  VH.knownKeys = (function () {
    const set = {};
    Object.keys(F).forEach(function (k) { set[F[k].key] = true; });
    return set;
  })();
  VH.familyKeys = VH.FAMILY.map(function (f) { return f.key; });

  /* ---------- validation: returns '' when fine, otherwise a short warning ---------- */
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  VH.validate = function (f, v) {
    v = (v || '').trim();
    if (!v) return '';
    switch (f.check) {
      case 'rc': return /^[A-Z]{2}\d{8}[A-Z]{2}$/.test(v) ? '' : 'Usually 2 letters + 8 digits + 2 letters (e.g. AB12345678CD).';
      case 'passport': return /^[A-Z0-9]{6,12}$/.test(v) ? '' : 'Passport numbers are usually 6–12 letters/digits with no spaces.';
      case 'tel': return /^[0-9+\-\s()]{7,20}$/.test(v) ? '' : 'Use digits, +, - and spaces only.';
      case 'name': return /^[A-Z][A-Z\s'.\-]*$/.test(v) ? '' : 'Use English capital letters as written in your passport.';
      case 'future': return v >= todayISO() ? '' : 'This date is in the past. Check it.';
      case 'dob': return v > todayISO() ? 'Date of birth is in the future.' : '';
      default: return '';
    }
  };

  /* ---------- dates ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  VH.dateParts = function (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  };
  VH.fmtDate = function (iso, style) {
    const p = VH.dateParts(iso);
    if (!p) return iso || '';
    const dd = String(p.d).padStart(2, '0'), mm = String(p.m).padStart(2, '0');
    if (style === 'dmy') return dd + '/' + mm + '/' + p.y;
    if (style === 'text') return p.d + ' ' + MON[p.m - 1] + ' ' + p.y;
    return p.y + '-' + mm + '-' + dd;
  };
})(window);
