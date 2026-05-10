
/* ===== PATCH v16: final routing, student login, stable sidebar, accessible logout ===== */
(function(){
  if (window.__platformPatchV16Ready) return;
  window.__platformPatchV16Ready = true;

  const $ = (id) => document.getElementById(id) || window.__safeNullElement;
  const toast = (msg, type='info') => typeof window.toast === 'function' ? window.toast(msg, type) : alert(msg);
  const normalizeLogin = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9._-]/g,'');
  const pageToPath = {
    home:'/', about:'/about', whyMe:'/why-me', parents:'/parents', services:'/services', schedule:'/booking', payment:'/payment', contacts:'/contacts',
    login:'/login', studentCabinet:'/student', parentCabinet:'/parent', teacherCabinet:'/teacher', teacherStudents:'/teacher/students', teacherMaterials:'/teacher/materials',
    teacherHomework:'/teacher/homework', teacherHomeworkReview:'/teacher/homework-review', teacherSchedule:'/teacher/schedule', teacherBookings:'/teacher/bookings',
    teacherNotifications:'/teacher/notifications', teacherFinance:'/teacher/finance', teacherPayments:'/teacher/payments', teacherContent:'/teacher/content',
    analytics:'/teacher/analytics', activityLog:'/teacher/activity', settings:'/teacher/settings', integrations:'/teacher/yandex-materials',
    library:'/library', quizzes:'/quizzes', cases:'/cases', lessonExamples:'/examples', reviews:'/reviews', faq:'/faq', rules:'/rules', today:'/today'
  };
  const pathToPage = Object.fromEntries(Object.entries(pageToPath).map(([p,path]) => [path,p]));
  pathToPage['/why']='whyMe';
  pathToPage['/booking']='schedule';
  const pathFor = (page) => pageToPath[page] || ('/' + String(page || 'home').replace(/([A-Z])/g,'-$1').toLowerCase());
  const pageForPath = () => pathToPage[location.pathname] || 'home';

  async function sha256(text){
    const data = new TextEncoder().encode(String(text || ''));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function addProfileQuickbar(){
    if ($('profileQuickbar')) return;
    const bar = document.createElement('div');
    bar.id = 'profileQuickbar';
    bar.innerHTML = '<button class="btn small soft" type="button" id="quickProfileBtn"><i class="fa-solid fa-user"></i> Мой профиль</button><button class="btn small red" type="button" id="quickLogoutBtn"><i class="fa-solid fa-right-from-bracket"></i> Выйти</button>';
    document.body.appendChild(bar);
  }

  function updateProfileButtonsV16(){
    const logged = document.body.classList.contains('is-logged') || !!localStorage.getItem('student_session_id');
    const isStudent = document.body.classList.contains('is-student') || !!localStorage.getItem('student_session_id');
    const top = $('topLoginCabinetBtn');
    if (top) {
      top.onclick = (e) => { e.preventDefault(); window.setPage?.(logged ? (isStudent ? 'studentCabinet' : 'teacherCabinet') : 'login'); };
      top.innerHTML = logged ? '<i class="fa-solid fa-user"></i><span>Мой профиль</span>' : '<i class="fa-solid fa-user-lock"></i><span>Войти в личный кабинет</span>';
    }
    document.querySelectorAll('.mobile-topbar [onclick*="login"]').forEach(btn => {
      btn.onclick = (e) => { e.preventDefault(); window.setPage?.(logged ? (isStudent ? 'studentCabinet' : 'teacherCabinet') : 'login'); };
      btn.innerHTML = logged ? '<i class="fa-solid fa-user"></i> Профиль' : '<i class="fa-solid fa-user-lock"></i> ЛК';
    });
    const profileBtn = $('quickProfileBtn');
    if (profileBtn) profileBtn.onclick = () => window.setPage?.(isStudent ? 'studentCabinet' : 'teacherCabinet');
  }

  async function logoutV16(){
    try { await window.supabaseClient?.auth?.signOut?.(); } catch(_) {}
    localStorage.removeItem('student_session_id');
    localStorage.removeItem('platform_current_page');
    window.state = window.state || {};
    window.state.user = null;
    window.state.studentProfile = null;
    document.body.classList.remove('is-logged','is-admin','is-student','is-parent');
    updateProfileButtonsV16();
    toast('Вы вышли из профиля', 'success');
    window.setPage?.('home');
  }

  async function loadStudentByIdV16(studentId){
    if (!studentId || !window.supabaseClient) return false;
    const { data, error } = await window.supabaseClient.from('student_profiles').select('*').eq('id', studentId).maybeSingle();
    if (error || !data) throw (error || new Error('Карточка ученика не найдена.'));
    window.state = window.state || {};
    window.state.studentProfile = data;
    window.state.user = { id:'student-local-' + data.id, email:data.email || '', student_local:true };
    document.body.classList.add('is-logged','is-student');
    document.body.classList.remove('is-admin','is-parent');
    updateProfileButtonsV16();
    if (typeof window.loadStudentData === 'function') await window.loadStudentData();
    return true;
  }

  window.restoreStudentSession = async function(){
    const studentId = localStorage.getItem('student_session_id');
    if (!studentId || document.body.classList.contains('is-admin')) return false;
    try { return await loadStudentByIdV16(studentId); }
    catch(e){ localStorage.removeItem('student_session_id'); console.warn('student session restore failed', e); return false; }
  };

  window.studentLoginByName = async function(login, password){
    const p_login_name = normalizeLogin(login);
    const p_password_hash = await sha256(password);
    if (!p_login_name || !password) throw new Error('Введите имя и пароль.');
    const attempts = [
      () => window.supabaseClient.rpc('student_login_by_password_v16', { p_login_name, p_password_hash }),
      () => window.supabaseClient.rpc('student_login_by_password', { p_login_name, p_password_hash })
    ];
    let studentId = null, lastError = null;
    for (const run of attempts) {
      try {
        const { data, error } = await run();
        if (!error && data) { studentId = data; break; }
        lastError = error;
      } catch(e){ lastError = e; }
    }
    if (!studentId) {
      const msg = lastError?.message || 'Неверное имя или пароль.';
      if (/function .*does not exist|Could not find the function|schema cache/i.test(msg)) {
        throw new Error('В Supabase не выполнен SQL из v16. Выполните supabase_student_login_routes_v16.sql.');
      }
      throw new Error(msg);
    }
    localStorage.setItem('student_session_id', studentId);
    await loadStudentByIdV16(studentId);
    toast('Вход выполнен', 'success');
    window.setPage?.('studentCabinet');
  };

  function enhanceNavigation(){
    // У меню должны быть настоящие ссылки, чтобы их можно было открыть в новой вкладке.
    document.querySelectorAll('aside.sidebar button.nav-btn[data-page]').forEach(btn => {
      const a = document.createElement('a');
      a.className = btn.className;
      a.dataset.page = btn.dataset.page;
      a.href = pathFor(btn.dataset.page);
      a.innerHTML = btn.innerHTML;
      a.setAttribute('role','link');
      btn.replaceWith(a);
    });
    document.querySelectorAll('[data-page]').forEach(el => {
      const page = el.dataset.page;
      if (!page) return;
      if (el.tagName === 'A') el.setAttribute('href', pathFor(page));
      el.setAttribute('title', 'Открыть: ' + pathFor(page));
    });
  }

  const previousSetPage = window.setPage;
  window.setPage = function(page){
    page = page || 'home';
    try {
      localStorage.setItem('platform_current_page', page);
      const nextPath = pathFor(page);
      if (location.pathname !== nextPath) history.pushState({ page }, '', nextPath);
    } catch(_) {}
    const result = typeof previousSetPage === 'function' ? previousSetPage(page) : undefined;
    setTimeout(() => {
      updateProfileButtonsV16();
      enhanceNavigation();
      document.querySelectorAll('aside.sidebar .menu-group').forEach(group => {
        const hasActive = !!group.querySelector('.nav-btn.active');
        group.classList.toggle('active-branch', hasActive);
        if (hasActive) group.open = true;
      });
    }, 30);
    return result;
  };

  document.addEventListener('click', function(e){
    const nav = e.target.closest('[data-page]');
    if (nav) {
      const page = nav.dataset.page;
      const href = pathFor(page);
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
        e.preventDefault();
        window.open(href, '_blank', 'noopener');
        return;
      }
      if (nav.tagName === 'A') e.preventDefault();
      e.stopPropagation();
      window.setPage?.(page);
      return;
    }
    if (e.target.closest('#quickLogoutBtn') || e.target.closest('#logoutBtn')) {
      e.preventDefault(); e.stopImmediatePropagation(); logoutV16();
    }
  }, true);

  window.addEventListener('popstate', () => {
    const page = pageForPath();
    if (typeof previousSetPage === 'function') previousSetPage(page);
    setTimeout(updateProfileButtonsV16, 50);
  });

  document.addEventListener('DOMContentLoaded', async () => {
    addProfileQuickbar();
    enhanceNavigation();
    await window.restoreStudentSession?.();
    updateProfileButtonsV16();
    const page = pageForPath();
    if (page && page !== 'home') window.setPage?.(page);
  });
  setTimeout(async () => {
    addProfileQuickbar();
    enhanceNavigation();
    await window.restoreStudentSession?.();
    updateProfileButtonsV16();
    const page = pageForPath();
    if (page && page !== (localStorage.getItem('platform_current_page') || '')) window.setPage?.(page);
  }, 700);
})();
