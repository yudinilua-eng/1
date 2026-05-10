
/* ===== PLATFORM PATCH v10: real routes, notifications sync, null guards ===== */
(function(){
  if (window.__platformPatchV10Ready) return;
  window.__platformPatchV10Ready = true;

  const routeByPage = {
    home:'/', today:'/today', about:'/about', whyMe:'/why-me', parents:'/parents', services:'/services', schedule:'/booking', payment:'/payment', contacts:'/contacts',
    library:'/library', quizzes:'/quizzes', cases:'/cases', lessonExamples:'/examples', reviews:'/reviews', faq:'/faq', rules:'/rules', login:'/login',
    studentCabinet:'/student', teacherCabinet:'/teacher', teacherStudents:'/teacher/students', teacherMaterials:'/teacher/materials', teacherHomework:'/teacher/homework',
    teacherHomeworkReview:'/teacher/homework-review', teacherSchedule:'/teacher/schedule', teacherBookings:'/teacher/bookings', teacherNotifications:'/teacher/notifications',
    teacherFinance:'/teacher/finance', teacherPayments:'/teacher/payments', teacherContent:'/teacher/content', analytics:'/teacher/analytics', activityLog:'/teacher/activity',
    settings:'/teacher/settings', integrations:'/teacher/yandex-materials', parentCabinet:'/parent'
  };
  const pageByRoute = Object.fromEntries(Object.entries(routeByPage).map(([k,v])=>[v,k]));
  window.platformRouteByPage = routeByPage;

  function esc(v){return String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function id(x){return document.getElementById(x);}
  function toast(msg,type='info'){ return typeof window.toast==='function' ? window.toast(msg,type) : console.log(msg); }
  function currentPage(){ return document.querySelector('.page.active')?.id?.replace('page-','') || localStorage.getItem('last_page') || 'home'; }
  function humanStatus(status){
    return ({pending:'ожидает', approved:'одобрено', rejected:'отклонено', open:'свободно', booked:'забронировано', confirmed:'подтверждено', completed:'проведено', cancelled:'отменено', rescheduled:'перенесено'}[status] || status || '—');
  }
  function fmtDate(d){ try { return d ? new Date(d).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',weekday:'short'}) : '—'; } catch(_) { return d || '—'; } }

  // 1) Делает клики по меню настоящими переходами по URL. Vercel вернёт index.html, но адрес будет отдельным.
  function hardNavigateToPage(page){
    const url = routeByPage[page] || ('/' + page);
    try {
      if (location.pathname !== url) history.pushState({ page }, '', url);
      window.setPage?.(page);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch(_) {
      window.setPage?.(page);
    }
  }
  document.addEventListener('click', function(e){
    const dataPage = e.target.closest('[data-page]');
    if (dataPage?.dataset?.page) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      hardNavigateToPage(dataPage.dataset.page);
      return;
    }
    const inline = e.target.closest('[onclick*="setPage("]');
    if (inline) {
      const m = String(inline.getAttribute('onclick')||'').match(/setPage\(['"]([^'"]+)['"]\)/);
      if (m) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); hardNavigateToPage(m[1]); }
    }
  }, true);

  // 2) При открытии прямого URL показываем нужный раздел.
  function pageFromPath(){
    const clean = location.pathname.replace(/\/$/,'') || '/';
    return pageByRoute[clean] || pageByRoute['/' + clean.split('/').filter(Boolean).join('/')] || 'home';
  }
  const oldSetPage = window.setPage;
  if (typeof oldSetPage === 'function') {
    window.setPage = function(page){
      oldSetPage(page);
      localStorage.setItem('last_page', page);
      updateProfileButton();
      if (page === 'teacherNotifications') renderTeacherNotificationsPage();
      if (document.body.classList.contains('is-admin')) updateNotificationBadge();
    };
  }
  window.addEventListener('popstate', () => window.setPage?.(pageFromPath()));
  setTimeout(()=> window.setPage?.(pageFromPath()), 250);

  // 3) Кнопка ЛК превращается в «Мой профиль» после входа.
  function updateProfileButton(){
    const btn = id('topLoginCabinetBtn');
    if (!btn) return;
    const logged = document.body.classList.contains('is-admin') || document.body.classList.contains('is-student') || document.body.classList.contains('is-logged');
    if (!logged) {
      btn.innerHTML = '<i class="fa-solid fa-user-lock"></i> Войти в ЛК';
      btn.onclick = () => hardNavigateToPage('login');
      return;
    }
    const target = document.body.classList.contains('is-admin') ? 'teacherCabinet' : 'studentCabinet';
    btn.innerHTML = '<i class="fa-solid fa-user-check"></i> Мой профиль';
    btn.onclick = () => hardNavigateToPage(target);
  }
  setInterval(updateProfileButton, 1200);

  // 4) Центр уведомлений преподавателя: запросы учеников, заявки, присланные ДЗ, оплаты.
  function pendingItems(){
    const st = window.state || {};
    const requests = (st.requests || []).filter(r => (r.status || 'pending') === 'pending');
    const bookings = (st.bookingRequests || []).filter(r => (r.status || 'pending') === 'pending');
    const homework = (st.homework || []).filter(h => (h.is_done || h.answer_text || h.answer_file_url) && (h.grade_percent === null || h.grade_percent === undefined));
    const payments = (st.payments || []).filter(p => ['pending','ожидает',''].includes(String(p.status || 'pending')));
    return {requests, bookings, homework, payments, total: requests.length + bookings.length + homework.length + payments.length};
  }
  async function ensureTeacherData(){
    if (!document.body.classList.contains('is-admin')) return;
    if (typeof window.loadTeacherData === 'function') await window.loadTeacherData();
    else if (typeof window.loadTeacherCabinet === 'function') await window.loadTeacherCabinet();
  }
  async function updateNotificationBadge(){
    try { await ensureTeacherData(); } catch(_) {}
    const badge = id('teacherNotifyBadge'); if (!badge) return;
    const count = pendingItems().total;
    badge.textContent = String(count);
    badge.style.display = count ? 'inline-flex' : 'none';
  }
  window.updateNotificationBadge = updateNotificationBadge;

  window.renderTeacherNotificationsPage = async function(){
    if (!document.body.classList.contains('is-admin')) { window.setPage?.('login'); return; }
    await ensureTeacherData();
    const {requests, bookings, homework, payments, total} = pendingItems();
    const stats = id('teacherNotificationsStats');
    if (stats) stats.innerHTML = `
      <div class="stat"><strong>${total}</strong><span>новых уведомлений</span></div>
      <div class="stat"><strong>${requests.length}</strong><span>запросов учеников</span></div>
      <div class="stat"><strong>${homework.length}</strong><span>ДЗ на проверке</span></div>
      <div class="stat"><strong>${bookings.length}</strong><span>заявок на урок</span></div>`;
    const inbox = id('teacherNotificationsInbox');
    if (inbox) inbox.innerHTML = [
      ...requests.map(r=>`<article class="learning-item"><div class="top"><strong>Запрос: ${esc(r.type)}</strong><span class="status pending">${humanStatus(r.status)}</span></div><p class="muted">${esc(r.student_profiles?.name || '')} · ${fmtDate(r.created_at)}</p><p>${esc(r.message || '')}</p><div class="row-actions"><button class="btn small green" onclick="approveStudentRequest('${r.id}')">Одобрить</button><button class="btn small red" onclick="setRequestStatus('${r.id}','rejected')">Отклонить</button></div></article>`),
      ...bookings.map(b=>`<article class="learning-item"><div class="top"><strong>Заявка на занятие: ${esc(b.name || b.student_profiles?.name)}</strong><span class="status pending">${humanStatus(b.status)}</span></div><p>Контакт: ${esc(b.contact || b.email || '')}</p><p class="muted">${esc(b.direction || '')} · ${esc(b.format || '')}</p><div class="row-actions"><button class="btn small green" onclick="approveBookingRequest('${b.id}')">Подтвердить</button><button class="btn small red" onclick="rejectBookingRequest('${b.id}')">Отклонить</button></div></article>`),
      ...homework.map(h=>`<article class="learning-item"><div class="top"><strong>ДЗ на проверку: ${esc(h.title)}</strong><span class="status pending">на проверке</span></div><p class="muted">${esc(h.student_profiles?.name || '')} · ${esc(h.topics?.title || '')}</p>${h.answer_text?`<p>${esc(h.answer_text)}</p>`:''}<button class="btn small" onclick="gradeHomework('${h.id}')">Проверить</button></article>`),
      ...payments.map(p=>`<article class="learning-item"><div class="top"><strong>Оплата: ${esc(p.student_profiles?.name || 'ученик')}</strong><span class="status pending">${esc(p.status || 'pending')}</span></div><p>${Number(p.amount || 0).toLocaleString('ru-RU')} ₽ · ${esc(p.notes || '')}</p></article>`)
    ].join('') || '<div class="empty">Новых уведомлений нет</div>';
    const actions = id('teacherNotificationsActions');
    if (actions) actions.innerHTML = `
      <button class="btn" data-page="teacherSchedule">Открыть расписание</button>
      <button class="btn secondary" data-page="teacherHomeworkReview">Проверить ДЗ</button>
      <button class="btn secondary" data-page="teacherBookings">Заявки на занятия</button>
      <button class="btn soft" onclick="updateNotificationBadge(); renderTeacherNotificationsPage();">Обновить</button>`;
    updateNotificationBadge();
  };

  // 5) После одобрения/отклонения запросов сразу обновляем ЛК преподавателя и ученика.
  const oldApprove = window.approveStudentRequest;
  if (typeof oldApprove === 'function') {
    window.approveStudentRequest = async function(id){
      await oldApprove(id);
      await updateNotificationBadge();
      if (currentPage()==='teacherNotifications') await renderTeacherNotificationsPage();
    };
  }
  const oldSetRequest = window.setRequestStatus;
  if (typeof oldSetRequest === 'function') {
    window.setRequestStatus = async function(id,status){
      await oldSetRequest(id,status);
      await updateNotificationBadge();
      if (currentPage()==='teacherNotifications') await renderTeacherNotificationsPage();
    };
  }

  // 6) Realtime: переносы, сообщения, ДЗ и оплаты обновляются без ручной перезагрузки.
  setTimeout(function(){
    if (!window.supabaseClient || window.__platformRealtimeV10) return;
    window.__platformRealtimeV10 = true;
    try {
      window.supabaseClient.channel('platform-live-v10')
        .on('postgres_changes',{event:'*',schema:'public',table:'lesson_requests'}, async()=>{ if (document.body.classList.contains('is-admin')) await updateNotificationBadge(); if (currentPage()==='teacherNotifications') await renderTeacherNotificationsPage(); if (currentPage()==='studentCabinet' && typeof window.loadStudentCabinet==='function') await window.loadStudentCabinet(); })
        .on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'}, async()=>{ if (document.body.classList.contains('is-admin')) await updateNotificationBadge(); })
        .on('postgres_changes',{event:'*',schema:'public',table:'homework'}, async()=>{ if (document.body.classList.contains('is-admin')) await updateNotificationBadge(); if (currentPage()==='studentCabinet' && typeof window.loadStudentCabinet==='function') await window.loadStudentCabinet(); })
        .on('postgres_changes',{event:'*',schema:'public',table:'slots'}, async()=>{ if (currentPage()==='studentCabinet' && typeof window.loadStudentCabinet==='function') await window.loadStudentCabinet(); })
        .on('postgres_changes',{event:'*',schema:'public',table:'payments'}, async()=>{ if (document.body.classList.contains('is-admin')) await updateNotificationBadge(); if (currentPage()==='studentCabinet' && typeof window.loadStudentCabinet==='function') await window.loadStudentCabinet(); })
        .subscribe();
    } catch(e){ console.warn('Realtime v10 skipped', e); }
  }, 1800);

  // 7) Студенческий вход только через RPC: не читаем таблицу паролей напрямую, чтобы не ловить RLS.
  if (window.supabaseClient && typeof window.studentLoginByName === 'function') {
    const sha256 = async (text) => { const data = new TextEncoder().encode(String(text||'')); const hash = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join(''); };
    const normalizeLogin = (login) => String(login || '').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9._-]/g,'');
    window.studentLoginByName = async function(login,password){
      const p_login_name = normalizeLogin(login);
      const p_password_hash = await sha256(password);
      const {data,error} = await window.supabaseClient.rpc('student_login_by_password',{p_login_name,p_password_hash});
      if (error || !data) throw (error || new Error('Неверное имя или пароль.'));
      localStorage.setItem('student_session_id', data);
      if (typeof window.restoreStudentSession === 'function') await window.restoreStudentSession();
      toast('Вход выполнен','success');
      window.setPage?.('studentCabinet');
    };
  }

  updateProfileButton();
  setTimeout(updateNotificationBadge, 2000);
})();
