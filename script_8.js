
/* ===== PLATFORM PATCH v17: student login fix, profile dock, editable credentials, conversion copy ===== */
(function(){
  if (window.__platformPatchV17Ready) return;
  window.__platformPatchV17Ready = true;
  const $ = (id) => document.getElementById(id) || window.__safeNullElement;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const toast = (msg,type='info') => typeof window.toast === 'function' ? window.toast(msg,type) : alert(msg);
  const normalizeLogin = (s) => String(s||'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9._-]/g,'');
  async function sha256(text){ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text||''))); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  const supa = () => window.supabaseClient;

  function getSessionProfile(){
    try { return JSON.parse(localStorage.getItem('student_profile_cache') || 'null'); } catch(_) { return null; }
  }
  function setStudentProfile(profile){
    if (!profile || !profile.id) return false;
    window.state = window.state || {};
    window.state.studentProfile = profile;
    window.state.user = { id:'student-local-' + profile.id, email:profile.email || '', student_local:true };
    localStorage.setItem('student_session_id', profile.id);
    localStorage.setItem('student_profile_cache', JSON.stringify(profile));
    document.body.classList.add('is-logged','is-student');
    document.body.classList.remove('is-admin','is-parent');
    updateProfileDock();
    return true;
  }

  window.studentLoginByName = async function(login, password){
    const p_login_name = normalizeLogin(login);
    const p_password_hash = await sha256(password);
    if (!p_login_name || !password) throw new Error('Введите логин и пароль ученика.');
    let lastError = null;
    const attempts = [
      () => supa().rpc('student_login_full_v17', { p_login_name, p_password_hash }),
      () => supa().rpc('student_login_by_password_v17', { p_login_name, p_password_hash }),
      () => supa().rpc('student_login_by_password_v16', { p_login_name, p_password_hash }),
      () => supa().rpc('student_login_by_password', { p_login_name, p_password_hash })
    ];
    for (const run of attempts) {
      try {
        const {data,error} = await run();
        if (error) { lastError = error; continue; }
        if (data) {
          const profile = typeof data === 'object' && !Array.isArray(data)
            ? data
            : { id:data };
          if (!profile.name && profile.id) {
            // Старый RPC вернул только id; пробуем публичную security-definer функцию профиля.
            const r = await supa().rpc('student_profile_by_id_v17', { p_student_id: profile.id });
            if (!r.error && r.data) Object.assign(profile, r.data);
          }
          if (!profile.id || !profile.name) throw new Error('Карточка ученика не найдена. Выполните SQL v17 и проверьте, что доступ создан через новую форму.');
          setStudentProfile(profile);
          if (typeof window.loadStudentData === 'function') await window.loadStudentData().catch(()=>{});
          toast('Вход выполнен', 'success');
          window.setPage?.('studentCabinet');
          return;
        }
      } catch(e){ lastError = e; }
    }
    const msg = lastError?.message || 'Неверный логин или пароль.';
    if (/function .*does not exist|Could not find the function|schema cache/i.test(msg)) throw new Error('В Supabase не выполнен SQL из v17. Выполните supabase_platform_v17_final.sql.');
    throw new Error(msg);
  };

  window.restoreStudentSession = async function(){
    const cached = getSessionProfile();
    if (cached?.id && !document.body.classList.contains('is-admin')) {
      setStudentProfile(cached);
      return true;
    }
    return false;
  };

  function ensureProfileDock(){
    let dock = $('profileDockV17');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'profileDockV17';
      dock.className = 'profile-dock';
      dock.innerHTML = '<span class="profile-name" id="profileDockName">Гость</span><button class="btn small soft login-mini" id="profileDockLogin" type="button"><i class="fa-solid fa-user-lock"></i> Личный кабинет</button><button class="btn small soft profile-mini" id="profileDockProfile" type="button"><i class="fa-solid fa-user"></i> Профиль</button><button class="btn small red logout-mini" id="profileDockLogout" type="button"><i class="fa-solid fa-right-from-bracket"></i> Выйти</button>';
      document.body.appendChild(dock);
    }
    $('profileDockLogin')?.addEventListener('click', () => window.setPage?.('login'));
    $('profileDockProfile')?.addEventListener('click', () => window.setPage?.(document.body.classList.contains('is-student') ? 'studentCabinet' : 'teacherCabinet'));
    $('profileDockLogout')?.addEventListener('click', async () => {
      try { await window.supabaseClient?.auth?.signOut?.(); } catch(_) {}
      localStorage.removeItem('student_session_id'); localStorage.removeItem('student_profile_cache'); localStorage.removeItem('platform_current_page');
      window.state = window.state || {}; window.state.user = null; window.state.studentProfile = null;
      document.body.classList.remove('is-logged','is-admin','is-student','is-parent');
      updateProfileDock(); toast('Вы вышли из профиля','success'); window.setPage?.('home');
    });
    return dock;
  }
  function updateProfileDock(){
    const dock = ensureProfileDock();
    const logged = document.body.classList.contains('is-logged') || !!localStorage.getItem('student_session_id');
    const name = window.state?.studentProfile?.name || window.state?.profile?.name || window.state?.user?.email || 'Гость';
    dock.classList.toggle('is-logged', !!logged);
    const n = $('profileDockName'); if (n) n.textContent = logged ? name : 'Гость';
    const top = $('topLoginCabinetBtn');
    if (top) {
      top.innerHTML = logged ? '<i class="fa-solid fa-user"></i><span>Мой профиль</span>' : '<i class="fa-solid fa-user-lock"></i><span>Личный кабинет</span>';
      top.onclick = (e) => { e.preventDefault(); window.setPage?.(logged ? (document.body.classList.contains('is-student') ? 'studentCabinet' : 'teacherCabinet') : 'login'); };
    }
    document.querySelectorAll('aside.sidebar .sidebar-login-card, aside.sidebar [data-page="login"].nav-btn').forEach(el => el.remove());
  }
  window.updateProfileButtonsV16 = updateProfileDock;

  async function updateStudentLogin(studentId, loginName){
    const p_student_id = studentId, p_login_name = normalizeLogin(loginName);
    const {error} = await supa().rpc('teacher_update_student_login_v17', { p_student_id, p_login_name });
    if (error) throw error;
  }
  async function getCreds(ids){
    if (!ids?.length) return [];
    const attempts = [
      () => supa().rpc('list_student_credentials_for_teacher_v18', { p_student_ids: ids }),
      () => supa().rpc('list_student_credentials_for_teacher_v17', { p_student_ids: ids }),
      () => supa().rpc('list_student_credentials_for_teacher_v16', { p_student_ids: ids }),
      () => supa().rpc('list_student_credentials_for_teacher', { p_student_ids: ids })
    ];
    for (const run of attempts){ try{ const {data,error}=await run(); if(!error && Array.isArray(data)) return data; }catch(_){} }
    return [];
  }

  const oldRenderStudents = window.renderTeacherStudentsFunctional;
  if (typeof oldRenderStudents === 'function') {
    window.renderTeacherStudentsFunctional = async function(){
      await oldRenderStudents();
      const mount = $('teacherStudentsMount');
      if (!mount) return;
      const students = window.state?.students || [];
      const creds = await getCreds(students.map(s=>s.id).filter(Boolean));
      const byId = Object.fromEntries(creds.map(c => [c.student_id, c]));
      const list = $('v15StudentsList');
      if (list) {
        list.querySelectorAll('[data-v15-edit-student]').forEach(btn => btn.insertAdjacentHTML('afterend', ` <button class="btn small soft" data-v17-edit-login="${btn.dataset.v15EditStudent}">Логин</button>`));
        list.querySelectorAll('.v15-student-card').forEach(card => {
          const resetBtn = card.querySelector('[data-v15-reset-pass]');
          const id = resetBtn?.dataset.v15ResetPass;
          if (!id) return;
          const c = byId[id] || {};
          if (!card.querySelector('.v17-login-panel')) {
            card.insertAdjacentHTML('beforeend', `<div class="v17-login-panel"><strong>Данные для входа</strong><div class="grid-2"><div><span class="muted">Логин</span><br><code>${esc(c.login_name || 'не создан')}</code></div><div><span class="muted">Статус доступа</span><br><span class="status ${c.is_active ? 'approved':'pending'}">${c.is_active ? 'активен':'выключен'}</span></div></div><div class="v18-password-box"><span class="muted">Актуальный пароль</span><br><code>${esc(c.current_password || c.password_plain || 'не сохранён; задайте новый')}</code></div><p class="muted">Пароль отображается только преподавателю. Ученик может поменять его в своём ЛК, и карточка обновится.</p></div>`);
          }
        });
      }
      const top = mount.querySelector('.panel h3');
      if (top && !mount.querySelector('.v17-dashboard-strip')) {
        const active = students.filter(s => String(s.status||'active') === 'active').length;
        top.closest('.teacher-tool-grid')?.insertAdjacentHTML('beforebegin', `<div class="v17-dashboard-strip"><div class="v17-metric"><strong>${students.length}</strong><span>учеников в базе</span></div><div class="v17-metric"><strong>${active}</strong><span>активных</span></div><div class="v17-metric"><strong>${creds.length}</strong><span>доступов создано</span></div><div class="v17-metric"><strong>${students.filter(s=>s.yandex_folder_url).length}</strong><span>папок Яндекс</span></div></div>`);
      }
    };
  }

  document.addEventListener('click', async (e) => {
    const editLogin = e.target.closest('[data-v17-edit-login]');
    if (editLogin) {
      e.preventDefault(); e.stopImmediatePropagation();
      const id = editLogin.dataset.v17EditLogin;
      const current = (await getCreds([id]))[0]?.login_name || '';
      const next = prompt('Новый логин ученика', current);
      if (next === null) return;
      try { await updateStudentLogin(id, next); toast('Логин обновлён: ' + normalizeLogin(next), 'success'); await window.renderTeacherStudentsFunctional?.(); }
      catch(err){ toast('Не удалось обновить логин: ' + (err.message || err), 'error'); }
    }
  }, true);

  function polishCopy(){
    const why = $('page-whyMe');
    if (why && !why.dataset.v17copy) {
      why.dataset.v17copy = '1';
      const lead = why.querySelector('.lead');
      if (lead) lead.textContent = 'Подготовка строится как понятный маршрут: стартовый разбор уровня, персональный план, материалы в личной папке, домашние задания и регулярная обратная связь.';
      const h2 = why.querySelector('h2'); if (h2) h2.textContent = 'Почему ученикам удобно заниматься здесь';
      const cards = why.querySelectorAll('.why-card');
      const copy = [
        ['Стартовый разбор вместо хаоса','На первом этапе фиксируем цель, уровень и пробелы. После этого понятно, что учить сначала и как измерять прогресс.'],
        ['Материалы всегда под рукой','У каждого ученика есть личная папка с конспектами, задачами и ссылками — ничего не теряется в переписках.'],
        ['Прогресс виден в кабинете','Домашние задания, занятия, переносы и комментарии хранятся в ЛК, поэтому ученик и родитель видят процесс.'],
        ['Объяснение через смысл','Не заучиваем формулы вслепую: разбираем логику, типовые ошибки и короткие алгоритмы решения.'],
        ['Запись без переписок','Свободные слоты показываются на сайте. Заявка сначала получает статус ожидания, а после подтверждения слот исчезает из расписания.'],
        ['Прозрачная коммуникация','Вопросы, переносы и запросы ученика попадают преподавателю в уведомления, а не теряются.']
      ];
      cards.forEach((c,i)=>{ if(copy[i]){ c.querySelector('h3').textContent=copy[i][0]; c.querySelector('p').textContent=copy[i][1]; }});
    }
    const faq = $('page-faq');
    if (faq && !faq.dataset.v17copy) {
      faq.dataset.v17copy='1';
      const lead = faq.querySelector('.lead'); if (lead) lead.textContent='Коротко о старте, оплате, переносах и личном кабинете.';
      const panel = faq.querySelector('.panel');
      if (panel) panel.innerHTML = `
        <details class="faq-item" open><summary>Что происходит на первом занятии?</summary><p>Мы знакомимся, смотрим текущий уровень, цель и типичные ошибки. После этого я предлагаю понятный план: какие темы закрыть первыми, какой темп выбрать и какие материалы использовать.</p></details>
        <details class="faq-item"><summary>Это диагностика или обычный урок?</summary><p>Это короткий стартовый разбор и пробное занятие: ученик решает несколько заданий, я смотрю ход мысли и объясняю, с чего лучше начать подготовку.</p></details>
        <details class="faq-item"><summary>Когда появляется личный кабинет ученика?</summary><p>После подтверждения преподаватель создаёт ученику логин и пароль. В ЛК будут материалы, домашние задания, запросы на перенос и личная Яндекс-папка.</p></details>
        <details class="faq-item"><summary>Можно ли перенести занятие?</summary><p>Да. Ученик отправляет запрос из ЛК, преподаватель видит его в уведомлениях и подтверждает новое время.</p></details>
        <details class="faq-item"><summary>Как родитель видит результат?</summary><p>Через понятные маркеры: выполненные ДЗ, комментарии преподавателя, темы в работе, материалы и динамику по слабым местам.</p></details>
        <details class="faq-item"><summary>Как записаться?</summary><p>Выберите предмет, цель, формат и свободное время на странице записи. Слот станет потенциально занятым до подтверждения преподавателем.</p></details>`;
    }
  }

  function makeLinksTrulyOpenable(){
    const map = window.__pageToPathV17 || {
      home:'/', about:'/about', whyMe:'/why-me', parents:'/parents', services:'/services', schedule:'/booking', payment:'/payment', contacts:'/contacts', faq:'/faq', cases:'/cases', reviews:'/reviews', lessonExamples:'/examples', login:'/login', studentCabinet:'/student', teacherCabinet:'/teacher', teacherStudents:'/teacher/students', teacherMaterials:'/teacher/materials', teacherHomework:'/teacher/homework', teacherHomeworkReview:'/teacher/homework-review', teacherSchedule:'/teacher/schedule', teacherBookings:'/teacher/bookings', teacherNotifications:'/teacher/notifications', teacherFinance:'/teacher/finance', teacherPayments:'/teacher/payments', teacherContent:'/teacher/content'
    };
    document.querySelectorAll('aside.sidebar [data-page]').forEach(el => {
      if (el.tagName === 'A') { el.href = map[el.dataset.page] || '#'; return; }
      const a = document.createElement('a');
      a.className = el.className || 'nav-btn';
      a.dataset.page = el.dataset.page;
      a.href = map[el.dataset.page] || '#';
      a.innerHTML = el.innerHTML;
      el.replaceWith(a);
    });
  }

  window.addEventListener('error', (ev) => {
    const msg = ev.message || '';
    if (msg.includes("reading 'value'") || msg.includes('Карточка ученика не найдена')) {
      // Ошибки показываем через понятный toast, но не даём старому обработчику ломать страницу.
      ev.preventDefault();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', async () => { ensureProfileDock(); updateProfileDock(); polishCopy(); makeLinksTrulyOpenable(); await window.restoreStudentSession?.(); setTimeout(updateProfileDock, 200); });
  setTimeout(() => { ensureProfileDock(); updateProfileDock(); polishCopy(); makeLinksTrulyOpenable(); }, 800);
  setInterval(updateProfileDock, 2500);
})();
