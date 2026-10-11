/* =========================================================
   PUCOP Tools — app.js
   Sections: 1 Config · 2 Utils · 3 Router · 4 Cover · 5 CGPA · 6 Admin · 7 Init
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 1. Config ---------- */
  const SUPABASE_URL = 'https://qdxpqptxszazsqmhskow.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeHBxcHR4c3phenNxbWhza293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzExMTQsImV4cCI6MjEwMTM0NzExNH0.vUK5oVdaCk5gOlI_UHiGhp604ZCqrHJYAlKFJCW-Tl4';
  const TOOLS = ['cover', 'cgpa'];
  const GRADES = [['A+', 4], ['A', 3.75], ['A-', 3.5], ['B+', 3.25], ['B', 3], ['B-', 2.75], ['C+', 2.5], ['C', 2.25], ['D', 2], ['F', 0]];
  const BORDERS = ['border-solid-black', 'border-double-black', 'border-dotted-black', 'border-dashed-black', 'border-groove-black', 'border-ridge-black', 'border-none'];

  /* ---------- 2. Utils ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);

  async function rest(table, method, body, query) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?apikey=${encodeURIComponent(SUPABASE_KEY)}${query ? '&' + query : ''}`;
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const ctrl = new AbortController(); opts.signal = ctrl.signal;
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, opts);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'API error ' + res.status); }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      throw e.name === 'AbortError' ? new Error('Request timed out') : e;
    } finally { clearTimeout(t); }
  }

  /* ---------- 3. Router (hash-based tabs) ---------- */
  function showTool(tool) {
    if (!TOOLS.includes(tool)) tool = 'cover';
    TOOLS.forEach((t) => { $('tool-' + t).hidden = t !== tool; });
    document.querySelectorAll('.side-item').forEach((li) => { li.classList.toggle('active', li.dataset.tool === tool); li.setAttribute('aria-selected', li.dataset.tool === tool); });
    const nm = tool === 'cgpa' ? 'CGPA calculator' : 'Cover page'; document.title = nm + ' | PUCOP Tools'; $('topTitle').textContent = nm; document.body.classList.remove('nav-open', 'side-open');
    $('mobileBar').hidden = tool !== 'cover'; layoutMotion();
    if (tool === 'cover') fitPreview();
  }
  function route() {
    const h = location.hash.replace('#', '');
    if (h === 'admin') return openAdmin();
    showTool(h);
  }
  function setPane(p) {
    $('tool-cover').dataset.pane = p;
    document.querySelectorAll('[data-pane-btn]').forEach((b) => b.classList.toggle('active', b.dataset.paneBtn === p));
    if (p === 'preview') fitPreview(); layoutMotion();
    window.scrollTo({ top: 0 });
  }
  function initNav() {
    window.addEventListener('hashchange', route);
    const sb = $('sidebar'); let st;
    const openSide = () => { clearTimeout(st); if (innerWidth > 1000) document.body.classList.add('side-open'); };
    const shutSide = () => { clearTimeout(st); st = setTimeout(() => document.body.classList.remove('side-open'), 220); };
    sb.addEventListener('mouseenter', openSide); sb.addEventListener('mouseleave', shutSide);
    sb.addEventListener('focusin', openSide); sb.addEventListener('focusout', (e) => { if (!sb.contains(e.relatedTarget)) shutSide(); });
    on('menuBtn', 'click', () => document.body.classList.add('nav-open'));
    on('sideScrim', 'click', () => document.body.classList.remove('nav-open'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });
    if (window.ResizeObserver) new ResizeObserver(() => fitPreview()).observe($('previewStage'));
    $('headerNav').addEventListener('keydown', (e) => {
      const i = TOOLS.indexOf(location.hash.replace('#', '')) < 0 ? 0 : TOOLS.indexOf(location.hash.replace('#', ''));
      const d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0; if (!d) return; e.preventDefault();
      const n = (i + d + TOOLS.length) % TOOLS.length; location.hash = TOOLS[n]; document.querySelector(`.side-item[data-tool="${TOOLS[n]}"]`).focus();
    });
    document.querySelectorAll('[data-pane-btn]').forEach((b) => b.addEventListener('click', () => setPane(b.dataset.paneBtn)));
  }
  let ft;
  function flash(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(ft); ft = setTimeout(() => t.classList.remove('show'), 2600); }
  const DRAFT = 'pucop-draft';
  const FIELDS = '.form-container input, .form-container select, .form-container textarea';
  function saveDraft() {
    try {
      const d = {};
      document.querySelectorAll(FIELDS).forEach((el) => { if (el.id && el.id !== 'submissionDate') d[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
      d._border = $('borderSelect').value;
      localStorage.setItem(DRAFT, JSON.stringify(d));
    } catch (e) { /* storage may be blocked */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (!d) return;
      Object.entries(d).forEach(([id, v]) => { const el = id[0] === '_' ? null : $(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else el.value = v; });
      if (d._border) setBorder(d._border);
      $('individualSection').hidden = $('isGroupReport').checked; $('groupSection').hidden = !$('isGroupReport').checked;
    } catch (e) { /* ignore */ }
  }

  /* ---------- 4. Cover page maker ---------- */
  // Value of a select that has an "Other" text box, with fallback.
  // "Other" custom departments always read "Department of ..."
  function deptName(t) { return /^department\s+of\s/i.test(t) ? t : 'Department of ' + t; }

  function pick(selectId, fallback) {
    const sel = $(selectId), other = $(selectId + '-other');
    const isOther = sel.value === 'Other';
    other.classList.toggle('show', isOther);
    if (!isOther) return sel.value || fallback;
    const t = other.value.trim();
    if (selectId === 'designation') return t || other.placeholder;
    return t ? deptName(t) : fallback;
  }

  function val(id, fallback) { const el = $(id); return el.value.trim() || el.placeholder.trim() || fallback; }


  function fmtDate() {
    const d = $('submissionDate').value;
    let date = new Date();
    if (d) { const [y, m, day] = d.split('-').map(Number); date = new Date(y, m - 1, day); }
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Template 2 ("Frame"): same form data, table-based layout.
  function renderFrame() {
    const dept = pick('department', 'Department of Computer Science & Engineering');
    const num = $('reportNumber').value.trim();
    $('tDept').textContent = dept;
    $('tType').textContent = $('reportType').value.toUpperCase();
    $('tNum').textContent = num ? 'NO. ' + num : ''; $('tNum').hidden = !num;
    $('tSub').textContent = $('reportTitle').value.trim();

    let by;
    if ($('isGroupReport').checked) {
      const m = parseMembers();
      by = m.length ? m.map((x, i) => ['MEMBER ' + String(i + 1).padStart(2, '0'), [x.name, x.id, x.section && 'Sec ' + x.section].filter(Boolean).join(' \u00b7 ')]) : [['MEMBER', '\u2014']];
    } else {
      by = [['NAME', val('studentName', 'MHB')], ['STUDENT ID', val('studentID', '252***038')], ['SECTION', val('section', '03')]];
    }
    const tdept = pick('teacherDept', dept);
    const fs = tdept.length > 32 ? Math.max(7, 10.5 * 32 / tdept.length).toFixed(1) : null;
    const groups = [
      ['COURSE<br>INFORMATION', [['COURSE TITLE', val('courseTitle', 'Calculus I')], ['COURSE CODE', val('courseCode', 'MAT123')]]],
      ['SUBMITTED TO', [['NAME', val('teacherName', 'Nafia Mollik')], ['DESIGNATION', pick('designation', 'Lecturer')], ['DEPARTMENT', tdept, fs], ['UNIVERSITY', 'Presidency University']]],
      ['SUBMITTED BY', by],
      ['SUBMISSION', [['DATE', fmtDate()]]]
    ];
    const total = groups.reduce((n, g) => n + g[1].length, 0);
    $('tplSheet').style.setProperty('--rh', Math.min(10, 118 / total) + 'mm');
    $('tBody').innerHTML = groups.map(([th, rows]) => rows.map(([l, v, f], i) =>
      `<tr>${i ? '' : `<th rowspan="${rows.length}">${th}</th>`}<td class="lab">${esc(l)}</td><td class="val"${f ? ` style="font-size:${f}pt"` : ''}>${esc(v)}</td></tr>`).join('')).join('');
  }

  function setTemplate(t) {
    const frame = t === 'frame';
    $('coverPage').hidden = frame; $('borderField').hidden = frame; $('tplSheet').hidden = !frame;
    document.querySelectorAll('[data-tpl]').forEach((b) => b.classList.toggle('active', b.dataset.tpl === t));
    try { localStorage.setItem('pucop-tpl', t); } catch (e) { /* storage may be blocked */ }
    fitPreview(); layoutMotion();
  }

  // Scale the fixed-size A4 sheet down to fit narrow screens.
  function fitPreview() {
    const stage = $('previewStage'), sc = $('sheetScaler');
    if (!stage || !stage.clientWidth) return;
    const s = Math.min(1, stage.clientWidth / sc.offsetWidth);
    sc.style.transform = `scale(${s})`;
    sc.style.marginLeft = Math.max(0, (stage.clientWidth - sc.offsetWidth * s) / 2) + 'px';
    stage.style.height = sc.offsetHeight * s + 'px';
  }

  function parseMembers() {
    return $('groupMembers').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const p = l.split(',').map((x) => x.trim());
      return { name: p[0] || '', id: p[1] || '', section: p[2] || '' };
    });
  }

  let hlOn = false;
  function updateCover() {
    const els = [...document.querySelectorAll('#coverPage [id], #tplSheet [id]')].filter((e) => e.id !== 'tBody');
    const before = els.map((e) => e.textContent);
    renderCover();
    if (hlOn) els.forEach((e, i) => { if (e.textContent !== before[i]) { e.classList.remove('hl'); void e.offsetWidth; e.classList.add('hl'); } });
    updateProgress();
  }
  function updateProgress() {
    const g = $('isGroupReport').checked;
    const ids = ['courseTitle', 'courseCode', 'teacherName'].concat(g ? [] : ['studentName', 'studentID', 'section']);
    let done = ids.filter((i) => $(i).value.trim()).length, total = ids.length;
    if (g) { total++; if (parseMembers().length) done++; }
    const ok = done === total;
    $('progBar').style.width = (done / total * 100) + '%';
    $('progText').textContent = ok ? 'Ready to print' : done + ' of ' + total + ' required';
    $('progText').classList.toggle('ok', ok);
    $('tabCoverMeta').textContent = done ? (ok ? 'Ready' : done + '/' + total) : ''; $('tabCoverMeta').classList.toggle('ok', ok);
    ['printBtn', 'printBtn2'].forEach((i) => $(i).classList.toggle('ready', ok));
  }
  function layoutMotion() {
    document.querySelectorAll('.seg').forEach((s) => {
      const a = s.querySelector('.active'); if (!a || !a.offsetWidth) return;
      s.style.setProperty('--x', a.offsetLeft + 'px'); s.style.setProperty('--w', a.offsetWidth + 'px');
    });
    const n = document.querySelector('.side-item.active'), nav = $('headerNav') || document.querySelector('.header-nav');
    if (n && nav) { nav.style.setProperty('--iy', (n.offsetTop - 8) + 'px'); nav.style.setProperty('--ih', n.offsetHeight + 'px'); }
  }
  let tw;
  function tween(el, to) {
    cancelAnimationFrame(tw);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to.toFixed(2); return; }
    const from = parseFloat(el.textContent) || 0, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); el.textContent = (from + (to - from) * e).toFixed(2); if (k < 1) tw = requestAnimationFrame(step); };
    tw = requestAnimationFrame(step);
  }
  function renderCover() {
    const dept = pick('department', 'Department of Computer Science & Engineering');
    const num = $('reportNumber').value.trim(), title = $('reportTitle').value.trim();
    $('pReportType').textContent = $('reportType').value + (num ? ' - ' + num : '');
    $('pReportTitle').textContent = title; $('pReportTitle').style.display = title ? 'block' : 'none';
    $('pDepartment').textContent = dept; $('pSubmittedDepartment').textContent = pick('teacherDept', dept);
    $('pCourseTitle').textContent = val('courseTitle', 'Calculus I');
    $('pCourseCode').textContent = val('courseCode', 'MAT123');
    $('pTeacherName').textContent = val('teacherName', 'Nafia Mollik');
    $('pDesignation').textContent = pick('designation', 'Lecturer');

    const by = $('pSubmittedByContent');
    if ($('isGroupReport').checked) {
      const m = parseMembers();
      by.innerHTML = m.length
        ? '<table class="group-members-table"><thead><tr><th style="width:40%">Name</th><th style="width:40%">ID</th><th style="width:20%">Section</th></tr></thead><tbody>' +
          m.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.id)}</td><td>${esc(x.section)}</td></tr>`).join('') + '</tbody></table>'
        : '<p><i>No team members added</i></p>';
    } else {
      by.innerHTML = `<p><b>${esc(val('studentName', 'MHB'))}</b></p><p>ID: <b>${esc(val('studentID', '252***038'))}</b></p><p>Section: <b>${esc(val('section', '03'))}</b></p>`;
    }

    $('pDate').textContent = fmtDate();
    renderFrame();
  }

  function validateCover() {
    document.querySelectorAll('#tool-cover .err').forEach((e) => e.remove());
    document.querySelectorAll('#tool-cover .invalid').forEach((el) => el.classList.remove('invalid'));
    let first = null, count = 0;
    const flag = (el, msg) => { count++; el.classList.add('invalid'); el.insertAdjacentHTML('afterend', `<small class="err">${msg}</small>`); first = first || el; };
    const need = (id, msg) => { if (!$(id).value.trim()) flag($(id), msg); };
    if ($('department').value === 'Other') need('department-other', 'Type your department');
    need('courseTitle', 'Add the course title'); need('courseCode', 'Add the course code');
    need('teacherName', "Add your teacher's name");
    if ($('teacherDept').value === 'Other') need('teacherDept-other', "Type the teacher's department");
    if ($('designation').value === 'Other') need('designation-other', 'Type the designation');
    if ($('isGroupReport').checked) { if (!parseMembers().length) flag($('groupMembers'), 'Add at least one team member'); }
    else { need('studentName', 'Add your name'); need('studentID', 'Add your student ID'); need('section', 'Add your section'); }
    if (count) {
      const d = first.closest('details'); if (d) d.open = true;
      setPane('edit'); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); first.focus({ preventScroll: true });
      flash(count + (count > 1 ? ' fields need' : ' field needs') + ' your attention');
    }
    return !count;
  }

  // Anonymous print counter (feeds the admin "Students" tab).
  function trackPrint() {
    const dept = $('department').value === 'Other' ? $('department-other').value.trim() : $('department').value;
    const save = (id, name) => {
      if (!id || !name) return;
      rest('rpc/increment_print_count', 'POST', { p_student_id: id, p_name: name, p_department: dept }).catch(() => {});
    };
    if ($('isGroupReport').checked) parseMembers().forEach((m) => save(m.id, m.name));
    else save($('studentID').value.trim(), $('studentName').value.trim());
  }

  function printCover() { if (validateCover()) { trackPrint(); window.print(); } }

  function setBorder(cls) {
    $('coverPage').classList.remove(...BORDERS); $('coverPage').classList.add(cls); $('borderSelect').value = cls;
  }

  function resetCover() {
    document.querySelectorAll('#tool-cover input[type=text], #tool-cover textarea, #tool-cover input[type=date]').forEach((el) => { el.value = ''; });
    document.querySelectorAll('#tool-cover select').forEach((s) => { s.selectedIndex = 0; });
    $('isGroupReport').checked = false; toggleGroup();
    document.querySelectorAll('#tool-cover .invalid').forEach((el) => el.classList.remove('invalid'));
    setBorder('border-solid-black'); try { localStorage.removeItem(DRAFT); } catch (e) { /* ignore */ }
    document.querySelectorAll('#tool-cover .err').forEach((e) => e.remove()); updateCover();
  }

  function toggleGroup() {
    const g = $('isGroupReport').checked;
    $('individualSection').hidden = g; $('groupSection').hidden = !g; updateCover();
  }

  function initCover() {
    document.querySelectorAll(FIELDS).forEach((c) => {
      const h = () => { c.classList.remove('invalid'); const n = c.nextElementSibling; if (n && n.classList.contains('err')) n.remove(); updateCover(); saveDraft(); };
      c.addEventListener('input', h); c.addEventListener('change', h);
    });
    on('isGroupReport', 'change', toggleGroup);
    on('printBtn', 'click', printCover); on('printBtn2', 'click', printCover);
    on('resetBtn', 'click', () => { if (confirm('Clear every field?')) resetCover(); });
    on('borderSelect', 'change', (e) => { setBorder(e.target.value); saveDraft(); });
    document.querySelectorAll('[data-tpl]').forEach((b) => b.addEventListener('click', () => setTemplate(b.dataset.tpl)));
    window.addEventListener('resize', () => { fitPreview(); layoutMotion(); });
    loadDraft(); updateCover();
    let saved = 'classic';
    try { saved = localStorage.getItem('pucop-tpl') || 'classic'; } catch (e) { /* ignore */ }
    setTemplate(saved === 'frame' ? 'frame' : 'classic'); hlOn = true;
  }

  /* ---------- 5. CGPA calculator ---------- */
  const gradeOpts = '<option value="">Grade</option>' + GRADES.map(([l, p]) => `<option value="${p}">${l} (${p.toFixed(2)})</option>`).join('');
  function addCourse() {
    const row = document.createElement('div'); row.className = 'course-row';
    row.innerHTML = `<input type="text" class="course-name" aria-label="Course name" placeholder="Course ${$('courses-container').children.length + 1}">` +
      `<input type="number" class="course-credits" aria-label="Credits" step="0.5" min="0" max="6" value="3"><select class="grade-select" aria-label="Grade">${gradeOpts}</select>` +
      '<button type="button" class="icon-btn" aria-label="Remove course">&times;</button>';
    $('courses-container').appendChild(row); return row;
  }
  function calcCGPA() {
    let points = 0, credits = 0;
    document.querySelectorAll('.course-row').forEach((r) => {
      const c = parseFloat(r.querySelector('.course-credits').value) || 0, g = parseFloat(r.querySelector('.grade-select').value);
      if (c > 0 && !isNaN(g)) { points += c * g; credits += c; }
    });
    const pc = parseFloat($('prevCredits').value) || 0, pg = parseFloat($('prevCGPA').value) || 0;
    if (!credits) {
      $('tabCgpaMeta').textContent = ''; cancelAnimationFrame(tw); $('gpaCircle').textContent = '\u2013'; $('ringVal').style.strokeDashoffset = 326.7; $('cumulativeResult').hidden = true;
      $('cgpaResult').innerHTML = '<p class="empty-state">Pick a grade for at least one course to see your GPA.</p>'; return;
    }
    const gpa = points / credits;
    $('tabCgpaMeta').textContent = gpa.toFixed(2); tween($('gpaCircle'), gpa); $('ringVal').style.strokeDashoffset = 326.7 * (1 - Math.min(gpa, 4) / 4);
    $('cgpaResult').innerHTML = `<dl><dt>Credits counted</dt><dd>${credits}</dd><dt>Grade points</dt><dd>${points.toFixed(2)}</dd></dl>`;
    const show = $('includePreviousCGPA').checked && pc > 0 && pg > 0;
    $('cumulativeResult').hidden = !show;
    if (show) tween($('cumulativeCGPA'), (pg * pc + points) / (pc + credits));
  }
  function resetCGPA() {
    $('courses-container').innerHTML = ''; for (let i = 0; i < 5; i++) addCourse().style.animationDelay = i * 60 + 'ms';
    $('includePreviousCGPA').checked = false; $('previousCGPASection').hidden = true; $('prevCredits').value = ''; $('prevCGPA').value = '';
    calcCGPA();
  }
  function copyResults() {
    if ($('gpaCircle').textContent.length > 1 === false) return flash('Add a grade first');
    let text = 'Semester GPA: ' + $('gpaCircle').textContent;
    if (!$('cumulativeResult').hidden) text += '\nCumulative CGPA: ' + $('cumulativeCGPA').textContent;
    navigator.clipboard.writeText(text).then(() => flash('Results copied')).catch(() => flash("Couldn't copy. Select the numbers instead."));
  }
  function initCGPA() {
    $('scaleList').textContent = GRADES.map(([l, p]) => `${l} = ${p.toFixed(2)}`).join('  \u00b7  ');
    on('includePreviousCGPA', 'change', () => { $('previousCGPASection').hidden = !$('includePreviousCGPA').checked; calcCGPA(); });
    on('addCourseBtn', 'click', () => addCourse().querySelector('input').focus());
    on('cgpaResetBtn', 'click', resetCGPA); on('copyBtn', 'click', copyResults);
    $('tool-cgpa').addEventListener('input', calcCGPA); $('tool-cgpa').addEventListener('change', calcCGPA);
    on('courses-container', 'click', (e) => { const b = e.target.closest('.icon-btn'); if (!b) return; if ($('courses-container').children.length > 1) { const r = b.parentNode; r.classList.add('leaving'); setTimeout(() => { r.remove(); calcCGPA(); }, 230); } else flash('Keep at least one course'); });
    resetCGPA();
  }

  /* ---------- 6. Admin (students) ---------- */
  let authed = false;

  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'admin-toast admin-toast-' + type; t.textContent = msg;
    $('adminToastContainer').appendChild(t); setTimeout(() => t.remove(), 3000);
  }
  function loginView(subtitle, mode) {
    $('adminLoginOverlay').hidden = false;
    $('adminLoginSubtitle').textContent = subtitle;
    $('adminSetPasswordForm').hidden = mode !== 'set';
    $('adminEnterPasswordForm').hidden = mode !== 'enter';
  }

  async function openAdmin() {
    $('admin-panel-overlay').classList.add('active');
    if (authed) return;
    loginView('Loading...', null);
    try {
      const data = await rest('admin_passwords', 'GET', null, 'select=id&limit=1');
      data && data.length ? loginView('Enter password to access', 'enter') : loginView('Set your admin password', 'set');
    } catch (e) { loginView('Connection error: ' + e.message, 'set'); toast(e.message, 'error'); }
  }
  function closeAdmin() {
    $('admin-panel-overlay').classList.remove('active');
    $('adminLoginOverlay').hidden = true; $('adminMainPanel').hidden = true;
    if (location.hash === '#admin') history.replaceState(null, '', location.pathname);
  }
  function enterPanel() { authed = true; $('adminLoginOverlay').hidden = true; $('adminMainPanel').hidden = false; loadStudents(); }

  async function setPassword() {
    const pw = $('adminNewPassword').value;
    if (pw.length < 4) return toast('Password must be at least 4 characters', 'error');
    if (pw !== $('adminConfirmPassword').value) return toast('Passwords do not match', 'error');
    try { await rest('admin_passwords', 'POST', { password: pw }); toast('Password set!', 'success'); enterPanel(); }
    catch (e) { toast(e.message, 'error'); }
  }
  async function login() {
    const pw = $('adminPassword').value;
    if (!pw) return toast('Please enter password', 'error');
    try {
      const data = await rest('admin_passwords', 'GET', null, 'select=password&limit=1');
      if (data && data[0] && data[0].password === pw) { toast('Logged in', 'success'); enterPanel(); }
      else toast('Incorrect password', 'error');
    } catch (e) { toast(e.message, 'error'); }
  }
  function logout() { authed = false; $('adminMainPanel').hidden = true; $('adminPassword').value = ''; openAdmin(); }

  async function loadStudents() {
    const s = encodeURIComponent($('studentSearch').value.trim());
    let q = 'select=*&order=created_at.desc';
    if (s) q += `&or=(student_id.ilike.*${s}*,name.ilike.*${s}*,department.ilike.*${s}*)`;
    try {
      const data = (await rest('students', 'GET', null, q)) || [];
      $('studentTableBody').innerHTML = data.length
        ? data.map((r) => `<tr><td>${esc(r.student_id)}</td><td>${esc(r.name)}</td><td>${esc(r.department)}</td><td><strong>${r.print_count || 0}</strong></td>` +
            `<td class="actions"><button class="admin-btn admin-btn-primary admin-btn-sm" data-edit="${esc(r.id)}"><i class="fas fa-edit"></i></button>` +
            `<button class="admin-btn admin-btn-danger admin-btn-sm" data-del="${esc(r.id)}"><i class="fas fa-trash"></i></button></td></tr>`).join('')
        : '<tr><td colspan="5" class="admin-empty">No students found</td></tr>';
    } catch (e) { toast(e.message, 'error'); }
  }
  async function saveStudent() {
    const id = $('studentEditId').value;
    const obj = { student_id: $('sStudentId').value.trim(), name: $('sName').value.trim(), department: $('sDepartment').value.trim() };
    if (!obj.student_id || !obj.name || !obj.department) return toast('All fields are required', 'error');
    try {
      if (id) { obj.updated_at = new Date().toISOString(); await rest('students', 'PATCH', obj, 'id=eq.' + encodeURIComponent(id)); toast('Student updated', 'success'); }
      else { await rest('students', 'POST', obj); toast('Student added', 'success'); }
      resetStudentForm(); loadStudents();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function editStudent(id) {
    try {
      const d = ((await rest('students', 'GET', null, 'select=*&limit=1&id=eq.' + encodeURIComponent(id))) || [])[0];
      if (!d) return toast('Student not found', 'error');
      $('studentEditId').value = d.id; $('sStudentId').value = d.student_id || ''; $('sName').value = d.name || '';
      $('sDepartment').value = d.department || ''; $('studentFormTitle').textContent = 'Edit Student';
    } catch (e) { toast(e.message, 'error'); }
  }
  async function deleteStudent(id) {
    if (!confirm('Delete this student?')) return;
    try { await rest('students', 'DELETE', null, 'id=eq.' + encodeURIComponent(id)); toast('Student deleted', 'success'); loadStudents(); }
    catch (e) { toast(e.message, 'error'); }
  }
  function resetStudentForm() {
    ['studentEditId', 'sStudentId', 'sName', 'sDepartment'].forEach((i) => { $(i).value = ''; });
    $('studentFormTitle').textContent = 'Add Student';
  }

  function initAdmin() {
    on('adminSetBtn', 'click', setPassword); on('adminLoginBtn', 'click', login);
    on('adminPassword', 'keydown', (e) => { if (e.key === 'Enter') login(); });
    on('adminCancelBtn', 'click', closeAdmin); on('adminCloseBtn', 'click', closeAdmin); on('adminLogoutBtn', 'click', logout);
    on('saveStudentBtn', 'click', saveStudent); on('resetStudentBtn', 'click', resetStudentForm);
    on('studentSearch', 'input', loadStudents);
    on('studentTableBody', 'click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) editStudent(b.dataset.edit); if (b.dataset.del) deleteStudent(b.dataset.del);
    });
  }

  /* ---------- 7. Init ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); openAdmin(); return; }
    if (e.key === 'Escape' && $('admin-panel-overlay').classList.contains('active')) closeAdmin();
    if (!e.ctrlKey || e.shiftKey || e.altKey) return;
    const coverOn = !$('tool-cover').hidden, cgpaOn = !$('tool-cgpa').hidden;
    const k = e.key.toLowerCase();
    if (k === 'p' && coverOn) { e.preventDefault(); printCover(); }
    else if (k === 'q' && coverOn) { e.preventDefault(); resetCover(); }
    else if (k === 'g' && cgpaOn) { e.preventDefault(); calcCGPA(); }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initNav(); initCover(); initCGPA(); initAdmin(); route();
  });
  window.addEventListener('load', () => { fitPreview(); layoutMotion(); requestAnimationFrame(() => document.body.classList.remove('preload')); }); if (document.fonts) document.fonts.ready.then(layoutMotion);
})();
