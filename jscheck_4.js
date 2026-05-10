
/* ===== PLATFORM PATCH v13: заявка -> потенциально занят, расширенные заявки, безопасные формы ===== */
(function(){
  if (window.__platformPatchV13Ready) return;
  window.__platformPatchV13Ready = true;

  const $ = (id) => document.getElementById(id) || window.__safeNullElement;
  const val = (id, fallback='') => { const el = $(id); return el && 'value' in el ? String(el.value ?? '').trim() : fallback; };
  const setVal = (id, value='') => { const el = $(id); if (el && 'value' in el) el.value = value ?? ''; };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const toast = (m,t='info') => typeof window.toast === 'function' ? window.toast(m,t) : console.log(m);
  const supa = () => window.supabaseClient;
  const st = () => window.state || {};
  const fmtDate = (d) => { try { return d ? new Date(String(d).includes('T') ? d : d + 'T00:00:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'short',weekday:'short'}) : '—'; } catch { return d || '—'; } };
  const human = (status) => ({ pending:'Ожидает подтверждения', approved:'Одобрено', rejected:'Отклонено', open:'Свободно', booked:'Забронировано', confirmed:'Подтверждено', completed:'Проведено', cancelled:'Отменено', rescheduled:'Перенесено' }[status] || status || '—');

  // Не показываем бесконечные красные тосты от старых обработчиков, если старого поля уже нет.
  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    if (msg.includes("Cannot read properties of null") && msg.includes("value")) {
      event.preventDefault();
      console.warn('Legacy null-value handler skipped:', msg);
    }
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.includes("Cannot read properties of null") && msg.includes("value")) {
      event.preventDefault();
      console.warn('Legacy null-value promise skipped:', msg);
    }
  }, true);

  async function refreshTeacher(page) {
    try {
      if (typeof window.loadTeacherData === 'function') await window.loadTeacherData();
      if (page && typeof window.renderTeacherPage === 'function') await window.renderTeacherPage(page);
      if (typeof window.updateNotificationBadge === 'function') await window.updateNotificationBadge();
    } catch (e) { console.warn('refreshTeacher skipped', e); }
  }

  // Публичное расписание: показываем open как свободные, pending как «потенциально занято», confirmed/booked не показываем.
  window.loadPublicSlots = async function(){
    const box = $('publicSlots');
    const calendar = $('calendarGrid');
    if (!box || !calendar || !supa()) return;

    box.innerHTML = '<div class="empty">Загружаю расписание...</div>';
    const { data, error } = await supa()
      .from('slots')
      .select('*, lesson_types(title, subject, price, duration)')
      .in('status', ['open','pending'])
      .order('date')
      .order('time');

    if (error) {
      box.innerHTML = `<div class="empty">Не удалось загрузить расписание: ${esc(error.message)}</div>`;
      return;
    }

    const selectedSubject = (window.wizardState?.subject) || localStorage.getItem('selected_subject') || 'Математика';
    const slots = (data || []).filter(slot => !selectedSubject || slot.lesson_types?.subject === selectedSubject || slot.lesson_types?.title?.includes(selectedSubject));
    const publicSlots = slots.filter(s => s.status === 'open');
    try { if (typeof window.renderCalendar === 'function') window.renderCalendar('calendarGrid', publicSlots, { publicMode:true }); } catch(e) { console.warn(e); }

    if (!slots.length) {
      box.innerHTML = '<div class="empty">Для выбранного предмета пока нет открытых слотов. Можно отправить заявку «согласую с преподавателем».</div>';
      return;
    }

    box.innerHTML = slots.map(slot => {
      const isPending = slot.status === 'pending';
      const price = Number(slot.price || slot.lesson_types?.price || 0).toLocaleString('ru-RU');
      return `<article class="slot-card ${isPending ? 'pending' : 'open'}">
        <strong>${fmtDate(slot.date)} · ${esc(slot.time)}</strong>
        <span class="status ${isPending ? 'pending' : 'open'}">${isPending ? 'Потенциально занят — ждёт подтверждения' : `Свободно · ${esc(slot.duration || slot.lesson_types?.duration || 60)} мин · ${price} ₽`}</span>
        <p class="muted">${esc(slot.lesson_types?.title || 'Индивидуальное занятие')}</p>
        ${isPending ? '<button class="btn small soft" disabled>На рассмотрении</button>' : `<button class="btn small" onclick="bookPublicSlot('${slot.id}')">Занять слот</button>`}
      </article>`;
    }).join('');
  };

  // Безопасные открытия модального окна заявки: не требуют авторизации и не падают без старых полей.
  window.bookPublicSlot = async function(slotId){
    setVal('bookingSlotId', slotId || '');
    setVal('bookingName', st().studentProfile?.name || '');
    setVal('bookingContact', st().user?.email || '');
    if (typeof window.fillBookingOptions === 'function') await window.fillBookingOptions();
    const subject = localStorage.getItem('selected_subject') || window.wizardState?.subject || 'Математика';
    setVal('bookingDirection', subject);
    const notice = $('bookingNoSlotNotice'); if (notice) notice.style.display = 'none';
    $('bookingModal')?.classList.add('active');
  };

  window.bookWithoutSlot = async function(){
    setVal('bookingSlotId', '');
    setVal('bookingName', st().studentProfile?.name || '');
    setVal('bookingContact', st().user?.email || '');
    if (typeof window.fillBookingOptions === 'function') await window.fillBookingOptions();
    setVal('bookingDirection', localStorage.getItem('selected_subject') || window.wizardState?.subject || 'Математика');
    const notice = $('bookingNoSlotNotice'); if (notice) notice.style.display = 'block';
    $('bookingModal')?.classList.add('active');
  };

  // Заменяем старый submit у заявки на безопасный: после заявки слот становится pending.
  function bindSafeBookingForm(){
    const form = $('bookingForm');
    if (!form || form.dataset.v13Bound === 'true') return;
    const clean = form.cloneNode(true);
    clean.dataset.v13Bound = 'true';
    form.replaceWith(clean);
    clean.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supa()) return toast('Supabase не подключён', 'error');
      const slotId = val('bookingSlotId');
      const name = val('bookingName');
      const contact = val('bookingContact');
      if (!name || !contact) return toast('Заполните имя и контакт', 'error');
      const direction = val('bookingDirection', localStorage.getItem('selected_subject') || window.wizardState?.subject || 'Математика');
      const format = val('bookingFormat', window.wizardState?.format || 'online');
      const message = [val('bookingMessage'), window.wizardState?.goal ? `Цель: ${window.wizardState.goal}` : ''].filter(Boolean).join('\n');

      if (slotId) {
        const { data: slot } = await supa().from('slots').select('status').eq('id', slotId).maybeSingle();
        if (slot && slot.status !== 'open') {
          toast('Этот слот уже на рассмотрении или занят. Выберите другое время.', 'error');
          await window.loadPublicSlots?.();
          return;
        }
      }

      const { data: created, error } = await supa().from('booking_requests').insert({
        slot_id: slotId || null,
        student_profile_id: st().studentProfile?.id || null,
        name, contact,
        email: st().user?.email || null,
        format, direction, message,
        status: 'pending'
      }).select('*').single();
      if (error) return toast('Не удалось отправить заявку: ' + error.message, 'error');

      if (slotId) {
        const { error: slotError } = await supa().from('slots').update({
          status: 'pending',
          student_name: name,
          student_contact: contact,
          student_profile_id: st().studentProfile?.id || null
        }).eq('id', slotId).eq('status','open');
        if (slotError) console.warn('slot pending update failed', slotError.message);
      }

      await supa().from('notification_events').insert({
        type: 'booking_request_created', channel:'site', status:'pending',
        payload: { request_id: created?.id, name, contact, slotId, format, direction, message }
      });

      $('bookingModal')?.classList.remove('active');
      clean.reset();
      toast(slotId ? 'Заявка отправлена. Слот временно отмечен как потенциально занятый.' : 'Заявка отправлена. Преподаватель предложит время.', 'success');
      await window.loadPublicSlots?.();
      if (document.body.classList.contains('is-admin')) await refreshTeacher('teacherBookings');
    });
  }
  bindSafeBookingForm();
  setTimeout(bindSafeBookingForm, 700);

  // Одобрение: подтверждённый слот исчезает из публичной записи. Отклонение: pending-слот снова открывается.
  window.approveBookingRequest = async function(id){
    if (!supa()) return;
    const req = (st().bookingRequests || []).find(x => String(x.id) === String(id)) || (await supa().from('booking_requests').select('*').eq('id',id).maybeSingle()).data;
    if (!req) return toast('Заявка не найдена', 'error');

    if (req.slot_id) {
      const { error: slotError } = await supa().from('slots').update({
        status:'confirmed',
        student_name: req.name || null,
        student_contact: req.contact || null,
        student_profile_id: req.student_profile_id || null
      }).eq('id', req.slot_id);
      if (slotError) return toast('Не удалось подтвердить слот: ' + slotError.message, 'error');
    }
    const { error } = await supa().from('booking_requests').update({ status:'approved' }).eq('id', id);
    if (error) return toast(error.message, 'error');
    await supa().from('notification_events').insert({ type:'booking_approved', channel:'site', status:'pending', payload:{ request_id:id, slot_id:req.slot_id, name:req.name, contact:req.contact } });
    toast('Заявка подтверждена. Слот убран из публичного расписания.', 'success');
    await refreshTeacher('teacherBookings');
    await window.loadPublicSlots?.();
  };

  window.rejectBookingRequest = async function(id){
    if (!supa()) return;
    const req = (st().bookingRequests || []).find(x => String(x.id) === String(id)) || (await supa().from('booking_requests').select('*').eq('id',id).maybeSingle()).data;
    const { error } = await supa().from('booking_requests').update({ status:'rejected' }).eq('id', id);
    if (error) return toast(error.message, 'error');
    if (req?.slot_id) {
      await supa().from('slots').update({ status:'open', student_name:null, student_contact:null, student_profile_id:null }).eq('id', req.slot_id).eq('status','pending');
    }
    toast('Заявка отклонена. Слот снова доступен.', 'success');
    await refreshTeacher('teacherBookings');
    await window.loadPublicSlots?.();
  };

  // Карточки заявок в ЛК преподавателя: больше информации + удобные действия.
  window.renderTeacherBookingsFunctional = async function(){
    if (typeof window.ensureTeacherData === 'function') await window.ensureTeacherData();
    else if (typeof window.loadTeacherData === 'function') await window.loadTeacherData();
    const mount = typeof window.teacherMount === 'function' ? window.teacherMount('teacherBookings') : $('teacherBookingsMount');
    if (!mount) return;
    const requests = (st().bookingRequests || []).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const pending = requests.filter(r => (r.status || 'pending') === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    mount.innerHTML = `<div class="stat-grid" style="margin-bottom:18px">
      <div class="stat"><strong>${requests.length}</strong><span>всего заявок</span></div>
      <div class="stat"><strong>${pending}</strong><span>ожидают решения</span></div>
      <div class="stat"><strong>${approved}</strong><span>подтверждены</span></div>
      <div class="stat"><strong>${rejected}</strong><span>отклонены</span></div>
    </div>
    <div class="panel"><div class="top-actions"><h3>Заявки на занятия</h3><button class="btn small soft" id="v13RefreshBookings">Обновить</button></div>
      <div class="item-list">${requests.map(r => {
        const slot = r.slots || (st().slots || []).find(s => String(s.id) === String(r.slot_id));
        const msg = r.message || '';
        return `<article class="learning-item request-card request-${esc(r.status || 'pending')}">
          <div class="top"><strong>${esc(r.name || r.student_profiles?.name || 'Новая заявка')}</strong><span class="status ${esc(r.status || 'pending')}">${human(r.status || 'pending')}</span></div>
          <div class="request-meta">
            <span><b>Контакт:</b> ${esc(r.contact || r.email || '—')}</span>
            <span><b>Направление:</b> ${esc(r.direction || '—')}</span>
            <span><b>Формат:</b> ${esc(r.format || '—')}</span>
            <span><b>Создана:</b> ${fmtDate(r.created_at)}</span>
            <span><b>Слот:</b> ${slot ? `${fmtDate(slot.date)} · ${esc(slot.time)} · ${esc(slot.lesson_types?.title || '')}` : (r.slot_id ? 'слот не найден' : 'без слота')}</span>
          </div>
          ${msg ? `<p class="request-message">${esc(msg).replace(/\n/g,'<br>')}</p>` : '<p class="muted">Комментарий не указан.</p>'}
          <div class="row-actions">
            ${(r.status || 'pending') === 'pending' ? `<button class="btn small green" data-cloud-approve-booking="${r.id}">Подтвердить</button><button class="btn small red" data-cloud-reject-booking="${r.id}">Отклонить</button>` : ''}
            ${r.contact ? `<a class="btn small soft" href="${String(r.contact).includes('@') ? 'mailto:' + esc(r.contact) : '#'}" ${String(r.contact).includes('@') ? '' : `onclick="navigator.clipboard?.writeText('${esc(r.contact)}'); toast('Контакт скопирован','success'); return false;"`}>Связаться</a>` : ''}
            <button class="btn small soft" onclick="navigator.clipboard?.writeText('${esc([r.name,r.contact,r.direction,r.format,msg].filter(Boolean).join(' | '))}'); toast('Заявка скопирована','success')">Скопировать</button>
          </div>
        </article>`;
      }).join('') || '<div class="empty">Заявок пока нет</div>'}</div></div>`;
    $('v13RefreshBookings')?.addEventListener('click', () => refreshTeacher('teacherBookings'));
  };

  // Ученические запросы безопасно отправляются и сразу видны преподавателю в уведомлениях.
  function bindSafeStudentRequestForm(){
    const form = $('studentRequestForm');
    if (!form || form.dataset.v13Bound === 'true') return;
    const clean = form.cloneNode(true);
    clean.dataset.v13Bound = 'true';
    form.replaceWith(clean);
    clean.addEventListener('submit', async (e) => {
      e.preventDefault();
      const student = st().studentProfile;
      if (!student) return toast('Войдите в ЛК ученика, чтобы отправить запрос.', 'info');
      const payload = {
        student_id: student.id,
        type: val('studentRequestType','question'),
        slot_id: val('studentRequestSlot') || null,
        requested_date: val('studentRequestNewDate') || null,
        requested_time: val('studentRequestNewTime') || null,
        message: val('studentRequestMessage'),
        status:'pending'
      };
      if (!payload.message) return toast('Напишите комментарий к запросу', 'error');
      const { error } = await supa().from('lesson_requests').insert(payload);
      if (error) return toast(error.message, 'error');
      await supa().from('notification_events').insert({ type:'student_request_created', channel:'site', status:'pending', payload:{ student:student.name, ...payload } });
      toast('Запрос отправлен преподавателю.', 'success');
      clean.reset();
      if (typeof window.loadStudentCabinet === 'function') await window.loadStudentCabinet();
      if (document.body.classList.contains('is-admin')) await refreshTeacher('teacherNotifications');
    });
  }
  bindSafeStudentRequestForm();
  setTimeout(bindSafeStudentRequestForm, 900);

  // При клике по закрытым разделам не «выкидываем» молча на авторизацию.
  const protectedPages = new Set(['teacherCabinet','teacherStudents','teacherMaterials','teacherHomework','teacherHomeworkReview','teacherSchedule','teacherBookings','teacherNotifications','teacherFinance','teacherPayments','teacherContent','analytics','activityLog','settings']);
  const prevSetPage = window.setPage;
  if (typeof prevSetPage === 'function' && !window.__v13SetPageWrapped) {
    window.__v13SetPageWrapped = true;
    window.setPage = function(page){
      if (protectedPages.has(page) && !document.body.classList.contains('is-admin')) {
        toast('Этот раздел доступен только преподавателю. Вы остались на текущей странице.', 'info');
        return;
      }
      if (page === 'studentCabinet' && !document.body.classList.contains('is-student') && !document.body.classList.contains('is-admin')) {
        toast('Войдите в ЛК ученика, чтобы открыть профиль.', 'info');
        return prevSetPage('login');
      }
      return prevSetPage(page);
    };
  }

  // Realtime: публичное расписание и заявки обновляются без перезагрузки.
  setTimeout(() => {
    if (!supa() || window.__v13RealtimeReady) return;
    window.__v13RealtimeReady = true;
    try {
      supa().channel('platform-v13-bookings')
        .on('postgres_changes',{event:'*',schema:'public',table:'slots'}, async()=>{ if ($('publicSlots')) await window.loadPublicSlots?.(); if (typeof window.loadStudentCabinet === 'function' && document.body.classList.contains('is-student')) await window.loadStudentCabinet(); })
        .on('postgres_changes',{event:'*',schema:'public',table:'booking_requests'}, async()=>{ if (document.body.classList.contains('is-admin')) { await refreshTeacher('teacherBookings'); if (typeof window.updateNotificationBadge === 'function') await window.updateNotificationBadge(); } })
        .on('postgres_changes',{event:'*',schema:'public',table:'lesson_requests'}, async()=>{ if (document.body.classList.contains('is-admin') && typeof window.updateNotificationBadge === 'function') await window.updateNotificationBadge(); if (document.body.classList.contains('is-student') && typeof window.loadStudentCabinet === 'function') await window.loadStudentCabinet(); })
        .subscribe();
    } catch(e) { console.warn('v13 realtime skipped', e); }
  }, 1600);

  // Немного стилей для новых карточек, если CSS ещё не обновлён.
  const style = document.createElement('style');
  style.textContent = `.slot-card.pending{border-color:#fbbf24;background:#fffbeb}.status.pending{background:#fef3c7;color:#92400e}.request-card{border-left:5px solid #dbeafe}.request-card.request-pending{border-left-color:#f59e0b}.request-card.request-approved{border-left-color:#22c55e}.request-card.request-rejected{border-left-color:#ef4444}.request-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px 14px;margin:10px 0;color:#475569}.request-message{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px}`;
  document.head.appendChild(style);
})();
