
/* ===== PLATFORM PATCH v11: cleanup legacy duplicates + stable student auth ===== */
(function(){
  if (window.__platformPatchV11Ready) return;
  window.__platformPatchV11Ready = true;

  const $ = (id) => document.getElementById(id) || window.__safeNullElement;
  const toast = (msg, type='info') => typeof window.toast === 'function' ? window.toast(msg, type) : alert(msg);
  const trim = (id) => String($(id)?.value || '').trim();

  function setStudentAuthMode(){
    if ($('authMode')) $('authMode').value = 'student_login';
    if ($('authLoginLabel')) $('authLoginLabel').textContent = 'Имя ученика';
    if ($('authEmail')) { $('authEmail').type = 'text'; $('authEmail').placeholder = 'например: ivan_8class'; }
    if ($('authSubmitBtn')) $('authSubmitBtn').textContent = 'Войти в ЛК ученика';
    $('loginTabBtn')?.classList.add('active');
    $('signupTabBtn')?.classList.remove('active');
    if ($('authMessage')) $('authMessage').textContent = 'Введите имя и пароль, которые выдал преподаватель.';
  }
  function setTeacherAuthMode(){
    if ($('authMode')) $('authMode').value = 'teacher_login';
    if ($('authLoginLabel')) $('authLoginLabel').textContent = 'Email преподавателя';
    if ($('authEmail')) { $('authEmail').type = 'email'; $('authEmail').placeholder = 'email преподавателя'; }
    if ($('authSubmitBtn')) $('authSubmitBtn').textContent = 'Войти как преподаватель';
    $('signupTabBtn')?.classList.add('active');
    $('loginTabBtn')?.classList.remove('active');
    if ($('authMessage')) $('authMessage').textContent = 'Вход преподавателя выполняется по email и паролю Supabase.';
  }

  async function loadStudentById(studentId){
    if (!studentId || !window.supabaseClient) return false;
    const { data, error } = await window.supabaseClient.from('student_profiles').select('*').eq('id', studentId).maybeSingle();
    if (error || !data) return false;
    window.state = window.state || {};
    window.state.studentProfile = data;
    window.state.user = { id: 'student-local-' + data.id, email: data.email || '', student_local: true };
    document.body.classList.add('is-logged','is-student');
    document.body.classList.remove('is-admin','is-parent');
    if (typeof window.loadStudentData === 'function') await window.loadStudentData();
    return true;
  }
  window.restoreStudentSession = async function(){
    const studentId = localStorage.getItem('student_session_id');
    if (!studentId || document.body.classList.contains('is-admin')) return false;
    return await loadStudentById(studentId);
  };

  document.addEventListener('click', function(e){
    if (e.target.closest('#loginTabBtn')) { e.preventDefault(); e.stopImmediatePropagation(); setStudentAuthMode(); }
    if (e.target.closest('#signupTabBtn')) { e.preventDefault(); e.stopImmediatePropagation(); setTeacherAuthMode(); }
    if (e.target.closest('#logoutBtn')) localStorage.removeItem('student_session_id');
  }, true);

  document.addEventListener('submit', async function(e){
    const form = e.target;
    if (!form || form.id !== 'authForm') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const mode = $('authMode')?.value || 'student_login';
      if (mode === 'teacher_login') {
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email: trim('authEmail'), password: trim('authPassword') });
        if (error) throw error;
        localStorage.removeItem('student_session_id');
        if (typeof window.initAuth === 'function') await window.initAuth();
        window.setPage?.('teacherCabinet');
        return;
      }
      if (typeof window.studentLoginByName !== 'function') throw new Error('Функция входа ученика ещё не загрузилась. Обновите страницу.');
      await window.studentLoginByName(trim('authEmail'), trim('authPassword'));
    } catch(err) {
      toast('Ошибка входа: ' + (err.message || err), 'error');
    }
  }, true);

  // На странице обзора не должно быть старых форм: они удалены из HTML, а этот слой страхует старый кэш браузера.
  const legacySelectors = ['#addStudentForm', '#addTopicForm', '#addMaterialForm', '#addHomeworkForm', '#createSlotForm', '#addPaymentForm', '#addStudentPackageForm'];
  function removeLegacyTeacherCabinetForms(){
    const teacher = $('page-teacherCabinet');
    if (!teacher) return;
    legacySelectors.forEach(sel => teacher.querySelector(sel)?.closest('.panel')?.remove());
  }
  document.addEventListener('DOMContentLoaded', () => { setStudentAuthMode(); removeLegacyTeacherCabinetForms(); });
  setTimeout(() => { setStudentAuthMode(); removeLegacyTeacherCabinetForms(); window.restoreStudentSession?.(); }, 400);
})();
