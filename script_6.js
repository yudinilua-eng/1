
/* ===== PLATFORM PATCH v15: reliable student creation + UI polish ===== */
(function(){
  if (window.__platformPatchV15Ready) return;
  window.__platformPatchV15Ready = true;

  const $ = (id) => document.getElementById(id) || window.__safeNullElement;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const val = (id) => String($(id)?.value || '').trim();
  const supa = () => window.supabaseClient;
  const toast = (msg, type='success') => typeof window.toast === 'function' ? window.toast(msg, type) : alert(msg);
  const normalizeLogin = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9._-]/g,'');
  const randomPassword = (n=10) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  };
  async function sha256(text){
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    return btoa(unescape(encodeURIComponent(text)));
  }
  function autoLoginFromName(name){
    const translit = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ы':'y','э':'e','ю':'yu','я':'ya','ь':'','ъ':''};
    return normalizeLogin(String(name || '').toLowerCase().split('').map(ch => translit[ch] ?? ch).join('')).slice(0,28);
  }
  async function reloadTeacherData(){
    if (typeof window.loadTeacherData === 'function') await window.loadTeacherData();
    else if (typeof window.loadTeacherCabinet === 'function') await window.loadTeacherCabinet();
  }
  async function listCredsV15(ids){
    if (!ids?.length || !supa()) return [];
    const attempts = [
      () => supa().rpc('list_student_credentials_for_teacher_v15', { p_student_ids: ids }),
      () => supa().rpc('list_student_credentials_for_teacher', { p_student_ids: ids })
    ];
    for (const run of attempts) {
      try {
        const { data, error } = await run();
        if (!error && Array.isArray(data)) return data;
      } catch(_) {}
    }
    return [];
  }
  async function createStudentAccessV15(row){
    if (!supa()) throw new Error('Supabase не подключён. Проверьте ключи проекта.');
    const args = {
      p_name: row.name,
      p_login_name: row.login_name,
      p_password_hash: row.password_hash,
      p_password_plain: row.password_plain || null,
      p_email: row.email || null,
      p_subject: row.subject || null,
      p_telegram: row.telegram || null,
      p_yandex_folder_url: row.yandex_folder_url || null,
      p_notes: row.notes || null
    };
    const attempts = [
      () => supa().rpc('teacher_create_student_access_v18', args),
      () => supa().rpc('teacher_create_student_access_v17', args),
      () => supa().rpc('teacher_create_student_access_v15', args),
      () => supa().rpc('teacher_create_student_access', args)
    ];
    let lastError = null;
    for (const run of attempts) {
      try {
        const { data, error } = await run();
        if (!error) return data;
        lastError = error;
      } catch(e) { lastError = e; }
    }
    const msg = lastError?.message || String(lastError || 'неизвестная ошибка');
    if (/function .* does not exist|Could not find the function|schema cache/i.test(msg)) {
      throw new Error('В Supabase ещё не выполнен SQL из v15. Выполните supabase_student_create_v15.sql и обновите страницу.');
    }
    if (/Only teacher|not.*teacher|permission|policy|RLS|row-level/i.test(msg)) {
      throw new Error('Нет прав преподавателя. В таблице profiles у вашего пользователя должно быть role = admin или teacher. Детали: ' + msg);
    }
    throw new Error(msg);
  }
  async function resetPasswordV15(studentId, password){
    const hash = await sha256(password);
    const payload = { p_student_id: studentId, p_password_hash: hash, p_password_plain: password };
    const attempts = [
      () => supa().rpc('teacher_reset_student_password_v18', payload),
      () => supa().rpc('teacher_reset_student_password_v17', payload),
      () => supa().rpc('teacher_reset_student_password_v15', { p_student_id: studentId, p_password_hash: hash }),
      () => supa().rpc('teacher_reset_student_password', { p_student_id: studentId, p_password_hash: hash })
    ];
    let lastError;
    for (const run of attempts) {
      try { const {error} = await run(); if (!error) return; lastError = error; } catch(e){ lastError = e; }
    }
    throw new Error(lastError?.message || String(lastError));
  }

  window.renderTeacherStudentsFunctional = async function(){
    const mount = $('teacherStudentsMount');
    if (!mount) return;
    mount.innerHTML = '<div class="panel"><div class="empty">Загружаю учеников...</div></div>';
    await reloadTeacherData().catch(e => console.warn('teacher reload failed', e));
    const students = window.state?.students || [];
    const creds = await listCredsV15(students.map(s=>s.id).filter(Boolean));
    const credByStudent = Object.fromEntries(creds.map(c => [c.student_id, c]));

    mount.innerHTML = `
      <div class="teacher-tool-grid">
        <div class="panel">
          <h3>Создать ученика</h3>
          <div class="v15-form-note">Создаётся карточка ученика, личный логин, пароль и ссылка на его Яндекс-папку. Email больше не обязателен.</div>
          <form class="form-grid" id="v15AddStudentForm" autocomplete="off">
            <div class="field"><label>Имя ученика *</label><input id="v15StudentName" required placeholder="Иван Петров"></div>
            <div class="grid-2">
              <div class="field"><label>Логин для входа *</label><input id="v15StudentLogin" required placeholder="ivan_8class"></div>
              <div class="field"><label>Пароль *</label><input id="v15StudentPassword" required placeholder="можно сгенерировать"></div>
            </div>
            <div class="v15-inline-actions">
              <button class="btn small soft" type="button" id="v15GenerateLogin">Сделать логин из имени</button>
              <button class="btn small soft" type="button" id="v15GeneratePassword">Сгенерировать пароль</button>
            </div>
            <div class="grid-2">
              <div class="field"><label>Предмет / класс</label><input id="v15StudentSubject" placeholder="Математика, 8 класс"></div>
              <div class="field"><label>Telegram / контакт</label><input id="v15StudentTelegram" placeholder="@username"></div>
            </div>
            <div class="field"><label>Email, необязательно</label><input id="v15StudentEmail" type="email" placeholder="можно оставить пустым"></div>
            <div class="field"><label>Личная Яндекс-папка</label><input id="v15StudentYandex" placeholder="https://disk.yandex.ru/..."></div>
            <div class="field"><label>Заметки преподавателя</label><textarea id="v15StudentNotes" placeholder="цели, слабые места, договорённости"></textarea></div>
            <button class="btn" id="v15SubmitStudent" type="submit"><i class="fa-solid fa-user-plus"></i> Создать ученика и доступ</button>
          </form>
        </div>
        <div class="panel">
          <div class="v15-toolbar">
            <h3>Ученики <span class="cloud-sync-pill">${students.length}</span></h3>
            <button class="btn small soft" id="v15RefreshStudents" type="button">Обновить</button>
          </div>
          <div class="search-row"><input id="v15StudentSearch" placeholder="Поиск по имени, логину, предмету, Telegram"><select id="v15StudentStatus"><option value="">Все</option><option value="active">Активные</option><option value="pause">Пауза</option></select></div>
          <div class="v15-student-list" id="v15StudentsList"></div>
        </div>
      </div>`;

    const renderList = () => {
      const q = val('v15StudentSearch').toLowerCase();
      const status = val('v15StudentStatus');
      const filtered = students.filter(s => {
        const c = credByStudent[s.id] || {};
        const hay = `${s.name||''} ${s.email||''} ${s.subject||''} ${s.telegram||''} ${c.login_name||''}`.toLowerCase();
        return (!q || hay.includes(q)) && (!status || String(s.status || 'active') === status);
      });
      const list = $('v15StudentsList');
      if (!list) return;
      list.innerHTML = filtered.map(s => {
        const c = credByStudent[s.id] || {};
        return `<article class="learning-item v15-student-card">
          <div class="v15-card-head">
            <div><strong class="v15-student-name">${esc(s.name || 'Без имени')}</strong><div class="v15-meta">
              <span class="v15-chip v15-status"><i class="fa-solid fa-circle-check"></i>${esc(s.status || 'active')}</span>
              <span class="v15-chip"><i class="fa-solid fa-book"></i>${esc(s.subject || 'предмет не указан')}</span>
              <span class="v15-chip"><i class="fa-solid fa-key"></i>${esc(c.login_name || 'логин не создан')}</span>
            </div></div>
            <div class="v15-inline-actions">
              <button class="btn small soft" data-v15-copy-login="${esc(c.login_name || '')}">Скопировать логин</button>
              <button class="btn small soft" data-v15-reset-pass="${s.id}">Новый пароль</button>
            </div>
          </div>
          <p class="muted">${s.email ? esc(s.email) + ' · ' : ''}${s.telegram ? esc(s.telegram) : 'контакт не указан'}</p>
          ${s.yandex_folder_url ? `<a class="btn small soft" target="_blank" rel="noopener" href="${esc(s.yandex_folder_url)}"><i class="fa-solid fa-folder-open"></i> Открыть Яндекс-папку</a>` : '<p class="muted v15-warning v15-chip">Яндекс-папка не указана</p>'}
          ${s.notes ? `<p class="muted">Заметки: ${esc(s.notes)}</p>` : ''}
          <div class="row-actions">
            <button class="btn small soft" data-v15-edit-student="${s.id}">Изменить</button>
            <button class="btn small red" data-v15-delete-student="${s.id}">Удалить</button>
          </div>
        </article>`;
      }).join('') || '<div class="empty">Пока нет учеников. Создайте первого ученика слева.</div>';
    };
    renderList();

    $('v15StudentName')?.addEventListener('input', () => { if (!$('v15StudentLogin')?.value) $('v15StudentLogin').value = autoLoginFromName(val('v15StudentName')); });
    $('v15GenerateLogin')?.addEventListener('click', () => { $('v15StudentLogin').value = autoLoginFromName(val('v15StudentName')) || 'student_' + Math.floor(Math.random()*9999); });
    $('v15GeneratePassword')?.addEventListener('click', () => { $('v15StudentPassword').value = randomPassword(10); });
    $('v15StudentSearch')?.addEventListener('input', renderList);
    $('v15StudentStatus')?.addEventListener('change', renderList);
    $('v15RefreshStudents')?.addEventListener('click', () => window.renderTeacherStudentsFunctional());
  };

  document.addEventListener('submit', async function(e){
    const form = e.target;
    if (!form || form.id !== 'v15AddStudentForm') return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const btn = $('v15SubmitStudent');
    try {
      const login = normalizeLogin(val('v15StudentLogin'));
      const password = val('v15StudentPassword');
      if (!val('v15StudentName')) throw new Error('Укажите имя ученика.');
      if (login.length < 3) throw new Error('Логин должен быть не короче 3 символов.');
      if (password.length < 6) throw new Error('Пароль должен быть не короче 6 символов.');
      if (btn) { btn.disabled = true; btn.textContent = 'Создаю...'; }
      await createStudentAccessV15({
        name: val('v15StudentName'), login_name: login, password_hash: await sha256(password), password_plain: password,
        email: val('v15StudentEmail') || `${login}@student.local`, subject: val('v15StudentSubject'), telegram: val('v15StudentTelegram'),
        yandex_folder_url: val('v15StudentYandex') || null, notes: val('v15StudentNotes')
      });
      toast(`Ученик создан. Логин: ${login} · пароль: ${password}`, 'success');
      form.reset();
      await window.renderTeacherStudentsFunctional();
    } catch(err) {
      toast('Не удалось добавить ученика: ' + (err.message || err), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Создать ученика и доступ'; }
    }
  }, true);

  document.addEventListener('click', async function(e){
    const copy = e.target.closest('[data-v15-copy-login]');
    if (copy) { e.preventDefault(); const login = copy.dataset.v15CopyLogin; if (!login) return toast('У ученика пока нет логина', 'error'); await navigator.clipboard?.writeText(login).catch(()=>{}); toast('Логин скопирован: ' + login); return; }

    const reset = e.target.closest('[data-v15-reset-pass]');
    if (reset) { e.preventDefault(); e.stopImmediatePropagation(); const pass = prompt('Новый пароль', randomPassword(10)); if (!pass) return; try { await resetPasswordV15(reset.dataset.v15ResetPass, pass); toast('Новый пароль: ' + pass); await window.renderTeacherStudentsFunctional(); } catch(err){ toast('Не удалось сменить пароль: ' + (err.message || err), 'error'); } return; }

    const edit = e.target.closest('[data-v15-edit-student]');
    if (edit) { e.preventDefault(); e.stopImmediatePropagation(); const id = edit.dataset.v15EditStudent; const s = (window.state?.students || []).find(x => x.id === id); if (!s) return;
      const name = prompt('Имя ученика', s.name || ''); if (name === null) return;
      const subject = prompt('Предмет / курс', s.subject || '') ?? (s.subject || '');
      const telegram = prompt('Telegram / контакт', s.telegram || '') ?? (s.telegram || '');
      const yandex_folder_url = prompt('Ссылка на Яндекс-папку', s.yandex_folder_url || '') ?? (s.yandex_folder_url || '');
      const notes = prompt('Заметки', s.notes || '') ?? (s.notes || '');
      const { error } = await supa().from('student_profiles').update({ name, subject, telegram, yandex_folder_url, notes }).eq('id', id);
      if (error) return toast(error.message, 'error');
      toast('Карточка ученика обновлена'); await window.renderTeacherStudentsFunctional(); return;
    }

    const del = e.target.closest('[data-v15-delete-student]');
    if (del) { e.preventDefault(); e.stopImmediatePropagation(); if (!confirm('Удалить ученика и его логин?')) return;
      try {
        let res = await supa().rpc('teacher_delete_student_access', { p_student_id: del.dataset.v15DeleteStudent });
        if (res.error) throw res.error;
        toast('Ученик удалён'); await window.renderTeacherStudentsFunctional();
      } catch(err){ toast('Не удалось удалить: ' + (err.message || err), 'error'); }
      return;
    }
  }, true);

  // Мягкая страховка от старых обработчиков: не показываем одинаковые красные тосты пачками.
  const seenErrors = new Map();
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (!msg.includes("reading 'value'")) return;
    const now = Date.now(), last = seenErrors.get(msg) || 0;
    if (now - last < 2500) { event.preventDefault(); return; }
    seenErrors.set(msg, now);
  }, true);
})();
