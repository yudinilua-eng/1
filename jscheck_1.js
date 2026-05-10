
    const SUPABASE_URL = 'https://uwmaflmxwyarctkbzwlr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bWFmbG14d3lhcmN0a2J6d2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjAwNDgsImV4cCI6MjA5Mzc5NjA0OH0.TfTvQk1CWavg8BM793OnA1ofA4hoH-RAI1D32BlpudY';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const state = {
      user: null,
      profile: null,
      studentProfile: null,
      students: [],
      topics: [],
      materials: [],
      homework: [],
      slots: [],
      requests: [],
      lessonTypes: [],
      subscriptions: [],
      packages: [],
      payments: [],
      lessonLogs: [],
      bookingRequests: [],
      activity: [],
      quizzes: [],
      quizQuestions: [],
      quizAttempts: [],
      siteSettings: {},
      parentProfile: null,
      reviews: [],
      cases: [],
      examples: []
    };

    // Делаем базовые объекты доступными для поздних функциональных патчей ЛК.
    window.supabaseClient = supabaseClient;
    window.state = state;

    const prices = { 60: 2000, 90: 3000 };
    const discounts = { 1: 0, 4: .03, 8: .05, 12: .10 };

    const __nullElement = {
      value: '', innerHTML: '', textContent: '', checked: false, disabled: false, files: [], dataset: {}, style: {},
      classList: { add(){}, remove(){}, toggle(){ return false; }, contains(){ return false; } },
      addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){}, focus(){}, reset(){}, click(){},
      closest(){ return null; }, matches(){ return false; }, replaceWith(){}, insertAdjacentHTML(){}, scrollIntoView(){},
      querySelector(){ return __nullElement; }, querySelectorAll(){ return []; }, setAttribute(){}, getAttribute(){ return null; }
    };
    window.__safeNullElement = __nullElement;
    window.safeEl = (id) => document.getElementById(id) || window.__safeNullElement;
    const $ = (id) => document.getElementById(id) || __nullElement;
    const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");



    window.__platformLastErrorToast = window.__platformLastErrorToast || new Map();
    function shouldShowErrorToast(msg) {
      msg = String(msg || 'ошибка');
      if (/reading 'value'|Cannot set properties of null|is not a function/i.test(msg)) return false;
      const now = Date.now();
      const last = window.__platformLastErrorToast.get(msg) || 0;
      if (now - last < 8000) return false;
      window.__platformLastErrorToast.set(msg, now);
      return true;
    }
    window.addEventListener('error', (event) => {
      const msg = event.message || event.error?.message || 'ошибка интерфейса';
      console.warn('Platform JS warning:', event.error || msg);
      if (shouldShowErrorToast(msg) && typeof toast === 'function') toast('Ошибка интерфейса: ' + msg, 'error');
    });
    window.addEventListener('unhandledrejection', (event) => {
      const msg = event.reason?.message || String(event.reason || 'неизвестная ошибка');
      console.warn('Platform async warning:', event.reason);
      if (shouldShowErrorToast(msg) && typeof toast === 'function') toast('Ошибка загрузки данных: ' + msg, 'error');
    });

    function byIdValue(id, fallback = '') {
      const el = $(id);
      return el ? el.value : fallback;
    }

    function relationBy(items, id) {
      return (items || []).find(x => String(x.id) === String(id)) || null;
    }

    async function safeQuery(label, builder, fallback = []) {
      try {
        const result = await builder;
        if (result.error) {
          console.warn(label + ' skipped:', result.error.message);
          if (!/does not exist|relationship|foreign key|permission denied|row-level security/i.test(result.error.message || '')) {
            toast('Supabase: ' + label + ' — ' + result.error.message, 'error');
          }
          return { data: fallback, error: result.error };
        }
        return result;
      } catch (err) {
        console.warn(label + ' failed:', err);
        if (!/Failed to fetch|NetworkError/i.test(err?.message || '')) toast('Supabase: ' + label + ' недоступно', 'error');
        return { data: fallback, error: err };
      }
    }

    function toast(message, type = 'info') {
      const wrap = $('toastWrap');
      if (!wrap) return console.log(message);
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      el.textContent = message;
      wrap.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        setTimeout(() => el.remove(), 180);
      }, 3600);
    }

    let activeModalSave = null;

    function openEditModal({ title, text = '', fields = [], onSave }) {
      $('editModalTitle').textContent = title;
      $('editModalText').textContent = text;
      $('editModalFields').innerHTML = fields.map(field => {
        const value = esc(field.value ?? '');
        if (field.type === 'textarea') {
          return `<div class="field"><label>${esc(field.label)}</label><textarea id="modal_${esc(field.name)}">${value}</textarea></div>`;
        }
        if (field.type === 'select') {
          return `<div class="field"><label>${esc(field.label)}</label><select id="modal_${esc(field.name)}">${(field.options || []).map(opt => `<option value="${esc(opt.value)}" ${String(opt.value) === String(field.value) ? 'selected' : ''}>${esc(opt.label)}</option>`).join('')}</select></div>`;
        }
        return `<div class="field"><label>${esc(field.label)}</label><input id="modal_${esc(field.name)}" type="${esc(field.type || 'text')}" value="${value}"></div>`;
      }).join('');
      activeModalSave = async () => {
        const values = {};
        fields.forEach(field => values[field.name] = $(`modal_${field.name}`).value);
        await onSave(values);
      };
      $('editModal').classList.add('active');
    }

    function closeEditModal() {
      $('editModal').classList.remove('active');
      activeModalSave = null;
    }

    $('editModalClose')?.addEventListener('click', closeEditModal);
    $('editModalCancel')?.addEventListener('click', closeEditModal);
    $('editModal')?.addEventListener('click', (e) => { if (e.target.id === 'editModal') closeEditModal(); });
    $('editModalForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeModalSave) return;
      try {
        await activeModalSave();
        closeEditModal();
        toast('Сохранено', 'success');
      } catch (err) {
        console.error(err);
        toast(err.message || 'Ошибка сохранения', 'error');
      }
    });

    async function openSecureFile(urlOrPath) {
      if (!urlOrPath) return;
      if (String(urlOrPath).startsWith('http')) {
        window.open(urlOrPath, '_blank');
        return;
      }
      const { data, error } = await supabaseClient.storage.from('lesson-files').createSignedUrl(urlOrPath, 60 * 10);
      if (error) return toast('Не удалось открыть файл: ' + error.message, 'error');
      window.open(data.signedUrl, '_blank');
    }

    async function uploadFileToStorage(file, folder = 'files') {
      if (!file) return '';
      const safeName = file.name.replace(/[^\w.\-а-яА-ЯёЁ]+/g, '_');
      const path = `${folder}/${Date.now()}_${safeName}`;
      const { error } = await supabaseClient.storage
        .from('lesson-files')
        .upload(path, file, { upsert: false });

      if (error) throw error;

      const { data } = supabaseClient.storage
        .from('lesson-files')
        .getPublicUrl(path);

      return data.publicUrl;
    }

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'short', weekday:'short' }) : '—';

    let calendarWeekStart = getMonday(new Date());

    function getMonday(date) {
      const d = new Date(date);
      const day = d.getDay() || 7;
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() - day + 1);
      return d;
    }

    function isoDate(date) {
      return date.toISOString().slice(0, 10);
    }

    // Teacher calendar state is initialized early so cabinet rendering never hits the temporal-dead-zone.
    var teacherCalendarWeekStart = getMonday(new Date());


    function addDays(date, days) {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }

    function renderCalendar(containerId, slots, { publicMode = false } = {}) {
      const grid = $(containerId);
      if (!grid) return;
      const days = Array.from({ length: 7 }, (_, i) => addDays(calendarWeekStart, i));
      const times = Array.from(new Set((slots || []).map(s => s.time))).sort();
      const fallbackTimes = ['10:00','12:00','15:00','16:30','18:00','19:30'];
      const rows = times.length ? times : fallbackTimes;

      grid.innerHTML = `<div class="calendar-cell calendar-head">Время</div>` +
        days.map(d => `<div class="calendar-cell calendar-head">${d.toLocaleDateString('ru-RU', { weekday:'short', day:'2-digit', month:'2-digit' })}</div>`).join('');

      rows.forEach(time => {
        grid.innerHTML += `<div class="calendar-cell calendar-time">${esc(time)}</div>`;
        days.forEach(day => {
          const date = isoDate(day);
          const daySlots = (slots || []).filter(s => s.date === date && s.time === time);
          grid.innerHTML += `<div class="calendar-cell">` + daySlots.map(s => `
            <span class="calendar-event ${humanStatus(s.status)}" ${publicMode && s.status === 'open' ? `onclick="bookPublicSlot('${s.id}')"` : ''}>
              ${esc(s.lesson_types?.title || 'Занятие')}<br>
              ${humanStatus(s.status)} · ${Number(s.price || s.lesson_types?.price || 0).toLocaleString('ru-RU')} ₽
            </span>
          `).join('') + `</div>`;
        });
      });
    }

    async function loadSiteSettings() {
      const { data } = await supabaseClient.from('site_settings').select('*');
      state.siteSettings = {};
      (data || []).forEach(row => state.siteSettings[row.key] = row.value);
      applySiteSettings();
      renderAchievements();
    }

    function applySiteSettings() {
      const s = state.siteSettings || {};
      if (s.teacher_name) document.querySelectorAll('.brand strong').forEach(el => el.textContent = s.teacher_name);
      if (s.hero_title) {
        const h1 = document.querySelector('#page-home h1');
        if (h1) h1.innerHTML = esc(s.hero_title).replace('Ильёй Юдиным', '<span>Ильёй Юдиным</span>');
      }
      if (s.hero_text) {
        const lead = document.querySelector('#page-home .lead');
        if (lead) lead.textContent = s.hero_text;
      }
    }



    function isLoggedInUI() {
      return !!state.user;
    }

    function prepareCabinetBranchBehavior() {
      document.querySelectorAll('.menu-group').forEach(group => {
        const hasCabinet = group.querySelector('[data-page="studentCabinet"], [data-page="teacherCabinet"], [data-page="parentCabinet"]');
        if (!hasCabinet || group.dataset.cabinetBehaviorReady === 'true') return;
        group.dataset.cabinetBranch = 'true';
        group.dataset.cabinetBehaviorReady = 'true';
        const summary = group.querySelector('summary');
        summary?.addEventListener('click', (e) => {
          if (!isLoggedInUI()) {
            e.preventDefault();
            e.stopPropagation();
            setPage('login');
            toast('Сначала войдите в личный кабинет.', 'info');
          }
        }, true);
      });
    }

    const teacherPanelMap = {
      teacherFinance: ['Типы занятий и цены', 'Абонементы', 'Выдать / продлить пакет ученику'],
      teacherPayments: ['Оплаты'],
      teacherStudents: ['Добавить ученика', 'Ученики'],
      teacherMaterials: ['Создать тему', 'Добавить материал'],
      teacherHomework: ['Выдать ДЗ', 'Домашние задания'],
      teacherHomeworkReview: ['Присланные Проверка ДЗ'],
      teacherSchedule: ['Создать слот', 'Календарь слотов преподавателя', 'Расписание преподавателя', 'Запросы учеников', 'Журнал занятия', 'Последние записи журнала'],
      teacherBookings: ['Заявки на занятия'],
      teacherContent: ['Публичные кейсы', 'Публичные примеры материалов', 'Отзывы на сайте', 'Список отзывов']
    };

    const teacherOriginalParents = new Map();

    function rememberTeacherPanel(panel) {
      if (teacherOriginalParents.has(panel)) return;
      teacherOriginalParents.set(panel, {
        parent: panel.parentNode,
        next: panel.nextSibling
      });
    }

    function restoreTeacherPanels() {
      teacherOriginalParents.forEach((pos, panel) => {
        if (!panel.isConnected || panel.parentNode?.classList?.contains('teacher-subpage-mount')) {
          if (pos.next && pos.next.parentNode === pos.parent) pos.parent.insertBefore(panel, pos.next);
          else pos.parent.appendChild(panel);
        }
      });
    }

    function moveTeacherPanels(page) {
      const titles = teacherPanelMap[page];
      if (!titles) return;
      const mount = document.getElementById(`${page}Mount`);
      if (!mount) return;
      mount.innerHTML = '';
      const allPanels = [...document.querySelectorAll('#page-teacherCabinet .panel, #page-teacherCabinet .cabinet-detail')];
      const moved = [];

      allPanels.forEach(el => {
        const title = (el.querySelector('h3')?.textContent || el.querySelector('summary')?.textContent || '').trim();
        if (titles.some(t => title.includes(t))) {
          rememberTeacherPanel(el);
          mount.appendChild(el);
          moved.push(el);
        }
      });

      if (!moved.length) {
        mount.innerHTML = '<div class="empty">Раздел будет доступен после загрузки ЛК преподавателя.</div>';
      }
    }

    async function loadTeacherSubpage(page) {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      await loadTeacherCabinet();
      restoreTeacherPanels();
      moveTeacherPanels(page);
      enhanceCabinetLayout();
      prepareCabinetBranchBehavior();
      initSmoothSidebarMenu();
    initSmoothSidebarMenu();
    }


    function initSmoothSidebarMenu() {
      const accordion = document.querySelector('.menu-accordion');
      if (!accordion || accordion.dataset.smoothReady === 'true') return;
      accordion.dataset.smoothReady = 'true';
      accordion.classList.add('menu-animated');

      document.querySelectorAll('.menu-group').forEach(group => {
        group.open = true;
        const summary = group.querySelector('summary');
        if (!summary) return;

        summary.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const isOpen = group.classList.contains('flyout-open');
          document.querySelectorAll('.menu-group.flyout-open').forEach(g => {
            if (g !== group && !g.classList.contains('active-branch')) g.classList.remove('flyout-open');
          });

          if (isOpen && !group.classList.contains('active-branch')) {
            group.classList.remove('flyout-open');
          } else {
            group.classList.add('flyout-open');
          }
        });
      });

      document.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar')) return;
        document.querySelectorAll('.menu-group.flyout-open').forEach(group => {
          if (!group.classList.contains('active-branch')) group.classList.remove('flyout-open');
        });
      });
    }

    function setPage(page) {
      if (page === 'library' && !document.body.classList.contains('is-admin') && !document.body.classList.contains('is-student')) {
        toast(currentLang === 'en' ? 'Library is available after login.' : 'Библиотека доступна после входа в ЛК.', 'info');
        page = 'login';
      }
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const pageEl = $('page-' + page);
      if (pageEl) pageEl.classList.add('active');
      document.querySelectorAll('.menu-group').forEach(g => g.classList.remove('active-branch'));
      document.querySelectorAll(`[data-page="${page}"]`).forEach(b => {
        b.classList.add('active');
        const group = b.closest('.menu-group');
        if (group) {
          group.classList.add('active-branch');
          group.open = true;
          group.classList.add('flyout-open');
        }
      });

      const cabinetPages = ['login','studentCabinet','parentCabinet','teacherCabinet','library','teacherStudents','teacherMaterials','teacherHomework','teacherHomeworkReview','teacherSchedule','teacherBookings','teacherFinance','teacherPayments','teacherContent'];
      if (cabinetPages.includes(page)) {
        document.querySelectorAll('.menu-group').forEach(group => {
          const hasCabinet = group.querySelector('[data-page="studentCabinet"], [data-page="parentCabinet"], [data-page="teacherCabinet"], [data-page="login"], [data-page="library"], [data-page="teacherStudents"], [data-page="teacherMaterials"], [data-page="teacherHomework"], [data-page="teacherSchedule"], [data-page="teacherFinance"], [data-page="teacherContent"]');
          if (hasCabinet) {
            group.classList.add('active-branch');
            group.open = true;
          }
        });
      }
      document.body.classList.remove('sidebar-open');
      if (page === 'schedule') resetBookingWizard();
      if (page === 'studentCabinet') loadStudentCabinet();
      if (page === 'teacherCabinet') loadTeacherCabinet();
      if (page === 'integrations') loadIntegrations();
      if (page === 'library') loadLibrary();
      if (page === 'quizzes') loadQuizzesPage();
      if (page === 'analytics') loadAnalytics();
      if (page === 'activityLog') loadActivityLogPage();
      if (page === 'parentCabinet') loadParentCabinet();
      if (page === 'today') loadTodayPage();
      if (page === 'settings') loadSettingsPage();
      if (['teacherStudents','teacherMaterials','teacherHomework','teacherHomeworkReview','teacherSchedule','teacherBookings','teacherFinance','teacherPayments','teacherContent'].includes(page)) loadTeacherSubpage(page);
      if (page === 'about') { renderAchievements(); }
      if (page === 'reviews') loadPublicReviews();
      if (page === 'cases') loadPublicCases();
      if (page === 'lessonExamples') loadPublicExamples();
    }

    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => setPage(el.dataset.page));
    });
    $('mobileMenuBtn')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));

    document.querySelectorAll('[data-action="language"]').forEach(btn => {
      btn.addEventListener('click', () => alert('Английскую версию можно вернуть отдельным словарём. В этой версии приоритет — кабинеты и управление.'));
    });

    async function initAuth() {
      const { data } = await supabaseClient.auth.getUser();
      state.user = data.user || null;

      document.body.classList.toggle('is-logged', !!state.user);

      if (!state.user) {
        document.body.classList.remove('is-admin', 'is-student');
        return;
      }

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .maybeSingle();

      state.profile = profile || null;
      const isAdmin = profile && profile.role === 'admin';
      document.body.classList.toggle('is-admin', isAdmin);

      const { data: student } = await supabaseClient
        .from('student_profiles')
        .select('*')
        .eq('email', state.user.email)
        .maybeSingle();

      state.studentProfile = student || null;
      document.body.classList.toggle('is-student', !!student && !isAdmin);

      const { data: parent } = await supabaseClient
        .from('parent_profiles')
        .select('*')
        .eq('email', state.user.email)
        .maybeSingle();

      state.parentProfile = parent || null;
      document.body.classList.toggle('is-parent', !!parent && !isAdmin);

      if (isAdmin) await loadTeacherData();
      if (student) await loadStudentData();
    }

    $('loginTabBtn')?.addEventListener('click', () => {
      $('authMode').value = 'login';
      $('authSubmitBtn').textContent = 'Войти';
      $('loginTabBtn').classList.add('active');
      $('signupTabBtn').classList.remove('active');
    });
    $('signupTabBtn')?.addEventListener('click', () => {
      $('authMode').value = 'signup';
      $('authSubmitBtn').textContent = 'Зарегистрироваться';
      $('signupTabBtn').classList.add('active');
      $('loginTabBtn').classList.remove('active');
    });

    $('authForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('authEmail').value.trim();
      const password = $('authPassword').value.trim();
      $('authMessage').textContent = '';

      if ($('authMode').value === 'signup') {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) return toast('Ошибка регистрации: ' + error.message, 'error');
        toast('Регистрация создана. Если включено подтверждение email — проверьте почту.', 'success');
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) return toast('Ошибка входа: ' + error.message, 'error');

      await initAuth();
      if (document.body.classList.contains('is-admin')) setPage('teacherCabinet');
      else if (document.body.classList.contains('is-student')) setPage('studentCabinet');
      else $('authMessage').textContent = 'Вы вошли, но карточка ученика не найдена. Попросите преподавателя добавить ваш email.';
    });

    $('logoutBtn')?.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      state.user = null; state.profile = null; state.studentProfile = null;
      document.body.classList.remove('is-logged','is-admin','is-student');
      setPage('home');
    });


    const I18N = {
      en: {
        "Сайт": "Site",
        "Учёба": "Study",
        "Кабинеты": "Accounts",
        "Управление": "Management",
        "Главная": "Home",
        "Сегодня": "Today",
        "Обо мне": "About",
        "Услуги и цены": "Services & prices",
        "Расписание": "Schedule",
        "Оплата": "Payment",
        "Контакты": "Contacts",
        "Библиотека": "Library",
        "Тесты": "Tests",
        "Правила": "Rules",
        "Вход / регистрация": "Login / sign up",
        "ЛК ученика": "Student account",
        "Кабинет родителя": "Parent account",
        "ЛК преподавателя": "Teacher account",
        "Аналитика": "Analytics",
        "История действий": "Activity log",
        "Настройки сайта": "Site settings",
        "Google-интеграции": "Google integrations",
        "Выйти": "Log out",
        "Математика, физика и химия с": "Math, Physics and Chemistry with",
        "Индивидуальные онлайн-занятия, расписание, материалы и личный кабинет ученика.": "One-to-one online lessons, schedule, materials and a student account.",
        "Онлайн · индивидуально · 60/90 минут": "Online · one-to-one · 60/90 minutes",
        "Забронировать занятие": "Book a lesson",
        "Посмотреть цены": "View prices",
        "Направления и цены": "Subjects & prices",
        "Математика": "Mathematics",
        "Физика": "Physics",
        "Химия": "Chemistry",
        "от 2000 ₽ / 60 мин": "from 1500 RUB / 60 min",
        "Алгебра, геометрия, школьная программа, подготовка к проверочным.": "Algebra, geometry, school curriculum and test preparation.",
        "Механика, электричество, молекулярная физика, термодинамика.": "Mechanics, electricity, molecular physics and thermodynamics.",
        "Общая, органическая и неорганическая химия, цепочки превращений.": "General, organic and inorganic chemistry, reaction chains.",
        "Управление учениками, темами, материалами и ДЗ": "Students, topics, materials and homework",
        "Личный кабинет ученика": "Student account",
        "Материалы, ДЗ, расписание, перенос занятия и продление занятий.": "Materials, homework, schedule, lesson rescheduling and package extension.",
        "Типы занятий и цены": "Lesson types & prices",
        "Абонементы": "Subscriptions",
        "Выдать / продлить пакет ученику": "Assign / extend a student package",
        "Оплаты": "Payments",
        "Добавить ученика": "Add student",
        "Создать тему": "Create topic",
        "Добавить материал": "Add material",
        "Выдать ДЗ": "Assign homework",
        "Создать слот": "Create slot",
        "Расписание преподавателя": "Teacher schedule",
        "Ученики": "Students",
        "Домашние задания": "All homework",
        "Запросы учеников": "Student requests",
        "Заявки на занятия": "Booking requests",
        "Журнал занятия": "Lesson journal",
        "Последние записи журнала": "Latest journal entries",
        "Материалы по темам": "Materials by topic",
        "Домашние задания": "Homework",
        "Моё расписание": "My schedule",
        "Мои пакеты занятий": "My lesson packages",
        "Журнал занятий": "Lesson journal",
        "Запросить перенос / продление": "Request reschedule / extension",
        "Обновить": "Refresh",
        "Финансы": "Finance",
        "Учебный процесс": "Learning process",
        "Расписание и записи": "Schedule & bookings",
        "Журнал и контроль": "Journal & tracking",
        "Профиль и доступ": "Profile & access",
        "Регулярность слота": "Slot recurrence",
        "Повтор": "Repeat",
        "Не повторять": "Do not repeat",
        "Каждую неделю": "Every week",
        "Раз в 2 недели": "Every 2 weeks",
        "Каждый месяц": "Every month",
        "Количество слотов": "Number of slots",
        "Или повторять до даты": "Or repeat until date",
        "Создать слот / серию": "Create slot / series",
        "Например: выберите «каждую неделю» и 12 слотов — система создаст расписание на 12 недель.": "Example: choose “every week” and 12 slots — the system will create a 12-week schedule.",
        "Нажмите на нужный предмет, чтобы перейти к записи на занятие.": "Click a subject to go to lesson booking.",
        "Создать слот": "Create slot",
        "Статус": "Status",
        "Открыт": "Open",
        "Закрыт": "Closed",
        "Отзывы": "Reviews",
        "Кейсы учеников": "Student cases",
        "Примеры файлов": "Example files",
        "Получить разбор / пробный урок": "Book / take diagnostics",
        "Записаться на диагностику": "Book a diagnostic lesson",
        "Выбрать направление": "Choose a subject",
        "Быстрый старт": "Quick start",
        "Выберите, что нужно ученику сейчас": "Choose what the student needs now",
        "Можно записаться на диагностику, посмотреть реальные кейсы или открыть примеры материалов с занятий.": "You can book a diagnostic lesson, view real cases or open lesson material examples.",
        "Записаться": "Book",
        "Выберите слот, формат и направление подготовки.": "Choose a slot, format and preparation direction.",
        "Что проходили, какие задачи решали и как менялся результат.": "What we studied, what tasks we solved and how the result changed.",
        "Скрипты, конспекты, задания и материалы с занятий.": "Scripts, notes, homework and lesson materials.",
        "Отзывы учеников и родителей": "Student and parent reviews",
        "Все отзывы": "All reviews",
        "Примеры файлов и материалов с занятий": "Examples of lesson files and materials",
        "Кейсы": "Cases",
        "Кейсы учеников": "Student cases",
        "Синхронизировать календарь": "Sync calendar",
        "Получить разбор / пробный урок": "Take a free diagnostic lesson",
        "Понятная подготовка по математике, физике и химии": "Clear preparation in Math, Physics and Chemistry",
        "Почему со мной": "Why me",
        "Почему стоит заниматься со мной": "Why choose me",
        "Сначала предмет, затем удобное время": "Choose a subject first, then time",
        "Согласовать с преподавателем": "Arrange with the teacher",
        "Не нашли подходящее время?": "No suitable time?",
        "Оставьте заявку без выбора времени — согласуем расписание лично.": "Leave a request without a slot — we will arrange the schedule personally.",
        "Бесплатный разбор результатов перед стартом": "Free diagnostic lesson before starting",
        "Родителям": "For parents",
        "FAQ": "FAQ",
        "Запись на бесплатную диагностику": "Book a free diagnostic lesson",
        "Дальше": "Next",
        "Назад": "Back",
        "Выбрать время ниже": "Choose a slot below",
        "Подтянуть оценки": "Improve grades",
        "Контрольная": "Test preparation",
        "Экзамен": "Exam",
        "Сложная тема": "Difficult topic",
        "Нужна диагностика": "Need diagnostics"
      }
    };

    let currentLang = localStorage.getItem('site_lang') || (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ru');
    document.documentElement.dataset.lang = currentLang;

    function translateNode(root = document.body) {
      const dict = I18N.en;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue.trim();
          if (!text || text.length > 120) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && ['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach(node => {
        if (!node.__ruText) node.__ruText = node.nodeValue;
        const originalTrim = node.__ruText.trim();
        const before = node.__ruText.match(/^\s*/)?.[0] || '';
        const after = node.__ruText.match(/\s*$/)?.[0] || '';
        if (currentLang === 'en' && dict[originalTrim]) node.nodeValue = before + dict[originalTrim] + after;
        if (currentLang === 'ru') node.nodeValue = node.__ruText;
      });
    }

    function setLanguage(lang) {
      currentLang = lang;
      localStorage.setItem('site_lang', lang);
      document.documentElement.dataset.lang = lang;
      translateNode();
      if ($('languageToggle')) $('languageToggle').innerHTML = `<i class="fa-solid fa-globe"></i> ${lang === 'ru' ? 'EN' : 'RU'}`;
      document.querySelectorAll('option').forEach(opt => {
        if (!opt.dataset.ruText) opt.dataset.ruText = opt.textContent;
        const key = opt.dataset.ruText.trim();
        opt.textContent = lang === 'en' && I18N.en[key] ? I18N.en[key] : opt.dataset.ruText;
      });
    }

    document.querySelector('[data-action="language"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLanguage(currentLang === 'ru' ? 'en' : 'ru');
      toast(currentLang === 'en' ? 'English enabled' : 'Русский язык включён', 'success');
    });

    window.goToBooking = function(subject) {
      localStorage.setItem('selected_subject', subject);
      wizardState.subject = subject || 'Математика';
      setPage('schedule');
      setTimeout(() => {
        updateWizardChoiceUI('subject', wizardState.subject);
        setWizardStep(2);
        document.getElementById('bookingWizard')?.scrollIntoView({ behavior:'smooth', block:'start' });
        toast(currentLang === 'en' ? `Continue booking for ${subject}` : `Продолжите запись: ${subject}`, 'success');
      }, 80);
    }

    function enhanceCabinetLayout() {
      ['teacherCabinet','studentCabinet','parentCabinet'].forEach(pageName => {
        const page = document.getElementById(`page-${pageName}`);
        if (!page || page.dataset.enhancedCabinet === 'true') return;

        const panels = [...page.querySelectorAll('.panel')].filter(panel => {
          return !panel.closest('.modal-card') && !panel.closest('.hero') && !panel.classList.contains('service-card');
        });

        panels.forEach((panel, idx) => {
          if (panel.closest('.cabinet-detail')) return;
          const h3 = panel.querySelector('h3');
          const title = h3 ? h3.textContent.trim() : `Раздел ${idx + 1}`;
          const details = document.createElement('details');
          details.className = 'cabinet-detail';
          details.open = idx < 2;
          details.dataset.title = title.toLowerCase();

          const summary = document.createElement('summary');
          summary.textContent = title;

          const body = document.createElement('div');
          body.className = 'cabinet-detail-body';

          panel.parentNode.insertBefore(details, panel);
          body.appendChild(panel);
          details.appendChild(summary);
          details.appendChild(body);
        });

        const nav = document.createElement('div');
        nav.className = 'cabinet-root-nav';

        const groups = pageName === 'teacherCabinet'
          ? [
              ['finance', currentLang === 'en' ? 'Finance' : 'Финансы', ['типы занятий', 'абонементы', 'пакет', 'оплаты']],
              ['learning', currentLang === 'en' ? 'Learning process' : 'Учебный процесс', ['ученика', 'тему', 'материал', 'дз', 'ученики', 'домашние']],
              ['schedule', currentLang === 'en' ? 'Schedule & bookings' : 'Расписание и записи', ['слот', 'расписание', 'заявки']],
              ['journal', currentLang === 'en' ? 'Journal & tracking' : 'Журнал и контроль', ['журнал', 'последние']]
            ]
          : [
              ['learning', currentLang === 'en' ? 'Learning' : 'Учёба', ['материалы', 'домашние', 'дз']],
              ['schedule', currentLang === 'en' ? 'Schedule' : 'Расписание', ['расписание', 'пакеты', 'журнал']],
              ['requests', currentLang === 'en' ? 'Requests' : 'Запросы', ['перенос', 'продление']]
            ];

        groups.forEach(([key, label, words], i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.className = i === 0 ? 'active' : '';
          btn.addEventListener('click', () => {
            nav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            page.querySelectorAll('.cabinet-detail').forEach(detail => {
              const t = detail.dataset.title || '';
              const match = words.some(w => t.includes(w));
              detail.style.display = match ? 'block' : 'none';
              if (match) detail.open = true;
            });
          });
          nav.appendChild(btn);
        });

        const head = page.querySelector('.section-head');
        head?.insertAdjacentElement('afterend', nav);
        nav.querySelector('button')?.click();
        page.dataset.enhancedCabinet = 'true';
      });
    }




    // Smooth sidebar menu is initialized by initSmoothSidebarMenu().

    function getSelectedSubject() {
      return localStorage.getItem('selected_subject') || document.querySelector('.subject-choice.active')?.dataset.subject || 'Математика';
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.subject-choice');
      if (!btn) return;
      document.querySelectorAll('.subject-choice').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('selected_subject', btn.dataset.subject);
      loadPublicSlots();
    });

    window.bookWithoutSlot = async function() {
      $('bookingSlotId').value = '';
      $('bookingName').value = state.studentProfile?.name || '';
      $('bookingContact').value = state.user?.email || '';
      await fillBookingOptions();
      $('bookingDirection').value = getSelectedSubject();
      $('bookingNoSlotNotice').style.display = 'block';
      $('bookingModal').classList.add('active');
    }



    teacherCalendarWeekStart = teacherCalendarWeekStart || getMonday(new Date());

    function teacherCalendarTimes() {
      const times = new Set(['10:00','12:00','15:00','16:30','18:00','19:30']);
      (state.slots || []).forEach(s => times.add(s.time));
      return [...times].sort();
    }

    function renderTeacherCalendarEditor() {
      const grid = $('teacherCalendarEditor');
      if (!grid) return;
      const days = Array.from({ length: 7 }, (_, i) => addDays(teacherCalendarWeekStart, i));
      const times = teacherCalendarTimes();

      grid.innerHTML = `<div class="calendar-cell calendar-head">Время</div>` +
        days.map(d => `<div class="calendar-cell calendar-head">${d.toLocaleDateString('ru-RU', { weekday:'short', day:'2-digit', month:'2-digit' })}</div>`).join('');

      times.forEach(time => {
        grid.innerHTML += `<div class="calendar-cell calendar-time">${esc(time)}</div>`;
        days.forEach(day => {
          const date = isoDate(day);
          const slots = (state.slots || []).filter(s => s.date === date && s.time === time);
          const content = slots.map(s => `
            <div class="slot-chip ${esc(s.status)}">
              <span>${esc(s.lesson_types?.title || 'Слот')}</span>
              <span>${humanStatus(s.status)} · ${Number(s.price || s.lesson_types?.price || 0).toLocaleString('ru-RU')} ₽</span>
              <div class="row-actions" style="margin-top:4px;">
                <button class="btn small soft" onclick="event.stopPropagation(); rescheduleSlot('${s.id}')">↔</button>
                <button class="btn small green" onclick="event.stopPropagation(); setSlotStatus('${s.id}','completed')">✓</button>
                <button class="btn small red" onclick="event.stopPropagation(); deleteSlot('${s.id}')">×</button>
              </div>
            </div>
          `).join('');
          grid.innerHTML += `<div class="calendar-cell" onclick="openQuickSlotModal('${date}','${time}')">${content || '<span class="calendar-add-hint">+ добавить слот</span>'}</div>`;
        });
      });
    }

    window.openQuickSlotModal = function(date, time) {
      $('quickSlotDate').value = date;
      $('quickSlotTime').value = time;
      $('slotQuickText').textContent = `Дата: ${date}, время: ${time}`;
      fillSelect('quickSlotLessonType', state.lessonTypes.filter(x => x.is_active), 'Выберите тип занятия', lt => `${lt.title} · ${lt.duration} мин · ${Number(lt.price || 0).toLocaleString('ru-RU')} ₽`);
      const lt = state.lessonTypes.find(x => x.is_active);
      if (lt) {
        $('quickSlotLessonType').value = lt.id;
        $('quickSlotDuration').value = lt.duration || 60;
        $('quickSlotPrice').value = lt.price || 2000;
      }
      $('slotQuickModal').classList.add('active');
    }

    $('slotQuickClose')?.addEventListener('click', () => $('slotQuickModal').classList.remove('active'));
    $('slotQuickModal')?.addEventListener('click', (e) => { if (e.target.id === 'slotQuickModal') $('slotQuickModal').classList.remove('active'); });

    $('quickSlotLessonType')?.addEventListener('change', () => {
      const lt = state.lessonTypes.find(x => x.id === $('quickSlotLessonType').value);
      if (!lt) return;
      $('quickSlotDuration').value = lt.duration || 60;
      $('quickSlotPrice').value = lt.price || 2000;
    });

    $('slotQuickForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('slots').insert({
        date: $('quickSlotDate').value,
        time: $('quickSlotTime').value,
        duration: Number($('quickSlotDuration').value),
        status: 'open',
        lesson_type_id: $('quickSlotLessonType').value,
        price: Number($('quickSlotPrice').value),
        currency: 'RUB'
      });
      if (error) return toast(error.message, 'error');
      $('slotQuickModal').classList.remove('active');
      toast('Слот добавлен', 'success');
      await loadTeacherCabinet();
    });

    $('teacherCalPrev')?.addEventListener('click', async () => { teacherCalendarWeekStart = addDays(teacherCalendarWeekStart, -7); renderTeacherCalendarEditor(); });
    $('teacherCalToday')?.addEventListener('click', async () => { teacherCalendarWeekStart = getMonday(new Date()); renderTeacherCalendarEditor(); });
    $('teacherCalNext')?.addEventListener('click', async () => { teacherCalendarWeekStart = addDays(teacherCalendarWeekStart, 7); renderTeacherCalendarEditor(); });

    function renderStudentHomeworkReminders() {
      const box = $('studentHomeworkReminders');
      if (!box) return;
      const now = new Date();
      const upcoming = (state.homework || [])
        .filter(h => !h.is_done)
        .sort((a,b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))
        .slice(0, 8);

      box.innerHTML = upcoming.map(h => {
        const deadline = h.deadline ? new Date(h.deadline + 'T23:59:00') : null;
        const diffDays = deadline ? Math.ceil((deadline - now) / 86400000) : null;
        const label = diffDays === null ? 'без срока' : diffDays < 0 ? `просрочено на ${Math.abs(diffDays)} дн.` : diffDays === 0 ? 'сегодня' : `осталось ${diffDays} дн.`;
        return `
          <article class="learning-item homework-reminder-card">
            <div class="top"><strong>${esc(h.title)}</strong><span class="status pending">${label}</span></div>
            <p class="muted">${esc(h.topics?.title || '')}</p>
            <button class="btn small soft" onclick="createHomeworkReminder('${h.id}')">Напомнить на почту/Telegram</button>
          </article>
        `;
      }).join('') || '<div class="empty">Срочных ДЗ нет</div>';
    }

    window.createHomeworkReminder = async function(homeworkId) {
      const hw = state.homework.find(h => h.id === homeworkId);
      if (!hw || !state.studentProfile) return;
      const { error } = await supabaseClient.from('notification_events').insert({
        type: 'homework_reminder',
        channel: 'email_telegram',
        status: 'pending',
        payload: {
          to: state.studentProfile.email,
          telegram: state.studentProfile.telegram || '',
          homework_id: homeworkId,
          title: hw.title,
          deadline: hw.deadline,
          student: state.studentProfile.name
        }
      });
      if (error) return toast(error.message, 'error');
      toast('Напоминание создано. Отправка будет выполнена через подключённый email/Telegram-сервис.', 'success');
    }

    $('sendHomeworkRemindersBtn')?.addEventListener('click', async () => {
      const pending = (state.homework || []).filter(h => !h.is_done);
      if (!pending.length) return toast('Нет невыполненных ДЗ.', 'info');
      const rows = pending.map(hw => ({
        type: 'homework_reminder',
        channel: 'email_telegram',
        status: 'pending',
        payload: {
          to: state.studentProfile.email,
          telegram: state.studentProfile.telegram || '',
          homework_id: hw.id,
          title: hw.title,
          deadline: hw.deadline,
          student: state.studentProfile.name
        }
      }));
      const { error } = await supabaseClient.from('notification_events').insert(rows);
      if (error) return toast(error.message, 'error');
      toast(`Создано напоминаний: ${rows.length}`, 'success');
    });


    const wizardState = { subject:'Математика', goal:'', format:'online' };
    let wizardStep = 1;
    let bookingSlotsLoadedFor = '';

    function updateWizardChoiceUI(field, value) {
      document.querySelectorAll(`[data-wizard-field="${field}"]`).forEach(el => {
        el.classList.toggle('active', el.dataset.value === value);
      });
    }

    function clearBookingSlotsUI() {
      const area = $('bookingScheduleArea');
      const calendar = $('calendarGrid');
      const list = $('publicSlots');
      if (area) area.style.display = 'none';
      if (calendar) calendar.innerHTML = '';
      if (list) list.innerHTML = '';
      bookingSlotsLoadedFor = '';
    }

    window.showBookingSchedule = async function(scroll = false) {
      const area = $('bookingScheduleArea');
      if (!area) return;
      area.style.display = 'block';
      localStorage.setItem('selected_subject', wizardState.subject || 'Математика');
      const cacheKey = `${wizardState.subject || ''}|${wizardState.format || ''}`;
      if (bookingSlotsLoadedFor !== cacheKey) {
        const list = $('publicSlots');
        if (list) list.innerHTML = '<div class="empty">Загружаю свободные слоты...</div>';
        await loadPublicSlots();
        bookingSlotsLoadedFor = cacheKey;
      }
      if (scroll) {
        setTimeout(() => area.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
      }
    }

    function setWizardStep(step) {
      wizardStep = Math.max(1, Math.min(5, step));
      document.querySelectorAll('.wizard-step').forEach(el => el.classList.toggle('active', Number(el.dataset.wizardStep) === wizardStep));
      document.querySelectorAll('.wizard-panel').forEach(el => el.classList.toggle('active', Number(el.dataset.wizardPanel) === wizardStep));
      if (wizardStep < 4) clearBookingSlotsUI();
      if (wizardStep === 4) showBookingSchedule(false);
    }

    function resetBookingWizard() {
      const savedSubject = localStorage.getItem('selected_subject') || wizardState.subject || 'Математика';
      wizardState.subject = savedSubject;
      wizardState.goal = wizardState.goal || '';
      wizardState.format = wizardState.format || 'online';
      updateWizardChoiceUI('subject', wizardState.subject);
      updateWizardChoiceUI('format', wizardState.format);
      clearBookingSlotsUI();
      setWizardStep(1);
    }

    window.wizardNext = function() {
      setWizardStep(wizardStep + 1);
    }

    window.wizardPrev = function() {
      setWizardStep(wizardStep - 1);
    }

    document.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-wizard-field]');
      if (!choice) return;
      const field = choice.dataset.wizardField;
      wizardState[field] = choice.dataset.value;
      choice.parentElement.querySelectorAll('[data-wizard-field]').forEach(x => x.classList.remove('active'));
      choice.classList.add('active');
      if (field === 'subject') {
        localStorage.setItem('selected_subject', choice.dataset.value);
      }
      if ((field === 'subject' || field === 'format') && wizardStep >= 4) {
        bookingSlotsLoadedFor = '';
        showBookingSchedule(false);
      }
    });

    function humanStatus(status) {
      const map = {
        pending:'Ожидает подтверждения',
        approved:'Подтверждено',
        rejected:'Отклонено',
        confirmed:'Подтверждено',
        completed:'Занятие проведено',
        rescheduled:'Перенесено',
        cancelled:'Отменено',
        open:'Свободно',
        closed:'Закрыто',
        booked:'Забронировано',
        active:'Активен',
        paid:'Оплачено'
      };
      return map[status] || status || '—';
    }

    async function loadPublicCases() {
      const box = document.getElementById('publicCasesList');
      if (!box) return;
      const { data, error } = await supabaseClient.from('student_cases').select('*').eq('is_published', true).order('created_at', { ascending:false });
      if (error) return;
      box.innerHTML = (data || []).map(c => `
        <article class="panel">
          <div class="card-icon"><i class="fa-solid fa-trophy"></i></div>
          <h3>${esc(c.title)}</h3>
          <p class="muted">${esc(c.subject || '')} ${c.grade ? '· ' + esc(c.grade) : ''}</p>
          <p><strong>До:</strong> ${esc(c.before_text || '')}</p>
          <p><strong>Что делали:</strong> ${esc(c.process_text || '')}</p>
          <p><strong>Результат:</strong> ${esc(c.result_text || '')}</p>
        </article>
      `).join('') || '<div class="empty">Кейсы скоро появятся.</div>';
    }

    async function loadPublicExamples() {
      const box = document.getElementById('publicExamplesList');
      if (!box) return;
      const { data, error } = await supabaseClient.from('lesson_examples').select('*').eq('is_published', true).order('created_at', { ascending:false });
      if (error) return;
      box.innerHTML = (data || []).map(x => `
        <article class="panel link-card">
          <div class="card-icon"><i class="fa-solid fa-file-lines"></i></div>
          <h3>${esc(x.title)}</h3>
          <p class="muted">${esc(x.subject || '')} · ${esc(x.type || '')}</p>
          <p>${esc(x.description || '')}</p>
          ${x.file_url ? `<a class="btn small soft" href="${esc(x.file_url)}" target="_blank">Открыть</a>` : ''}
        </article>
      `).join('') || '<div class="empty">Примеры скоро появятся.</div>';
    }

    async function loadPublicReviews() {
      const box = $('publicReviewsList');
      if (!box) return;
      const { data, error } = await supabaseClient
        .from('reviews')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending:false });

      if (error) {
        box.innerHTML = `<div class="empty">Отзывы пока недоступны: ${esc(error.message)}</div>`;
        return;
      }

      box.innerHTML = (data || []).map(r => `
        <article class="learning-item">
          <div class="top"><strong>${esc(r.author)}</strong><span class="status approved">${'★'.repeat(Number(r.rating || 5))}</span></div>
          <p>${esc(r.text)}</p>
          <p class="muted">${esc(r.source || '')}</p>
          <div class="row-actions">
            ${r.proof_url ? `<a class="btn small soft" href="${esc(r.proof_url)}" target="_blank">Подтверждение</a>` : ''}
            ${r.photo_url ? `<a class="btn small soft" href="${esc(r.photo_url)}" target="_blank">Фото</a>` : ''}
          </div>
        </article>
      `).join('') || '<div class="empty">Отзывы скоро появятся.</div>';
    }

    function renderAchievements() {
      const box = $('achievementsList');
      if (!box) return;
      const s = state.siteSettings || {};
      const profi = s.profi_url || '';
      const text = s.profi_achievements || 'Добавьте достижения, рейтинг и ссылку на Profi в настройках сайта.';
      box.innerHTML = `
        <article class="learning-item">
          <div class="top"><strong>Profi</strong><span class="status approved">подтверждения</span></div>
          <p>${esc(text)}</p>
          ${profi ? `<a class="btn small soft" href="${esc(profi)}" target="_blank">Открыть профиль Profi</a>` : ''}
        </article>
      `;
    }


    async function loadPublicSlots() {
      const box = $('publicSlots');
      const calendar = $('calendarGrid');
      if (!box || !calendar) return;
      const { data, error } = await supabaseClient.from('slots').select('*, lesson_types(title, subject, price, duration)').eq('status','open').order('date').order('time');
      if (error) { box.innerHTML = `<div class="empty">Не удалось загрузить слоты: ${esc(error.message)}</div>`; return; }
      const selectedSubject = wizardState.subject || getSelectedSubject();
      const filteredSlots = (data || []).filter(slot => !selectedSubject || slot.lesson_types?.subject === selectedSubject || slot.lesson_types?.title?.includes(selectedSubject));
      renderCalendar('calendarGrid', filteredSlots, { publicMode: true });
      if (!filteredSlots?.length) { box.innerHTML = '<div class="empty">Для выбранного предмета пока нет открытых слотов. Можно отправить заявку «согласую с преподавателем».</div>'; return; }
      box.innerHTML = filteredSlots.map(slot => `
        <article class="slot-card open">
          <strong>${fmtDate(slot.date)} · ${esc(slot.time)}</strong>
          <span class="status open">Свободно · ${esc(slot.duration)} мин · ${Number(slot.price || slot.lesson_types?.price || 0).toLocaleString('ru-RU')} ₽</span>
          <p class="muted">${esc(slot.lesson_types?.title) || 'Индивидуальное занятие'}</p>
          <button class="btn small" onclick="bookPublicSlot('${slot.id}')">Занять слот</button>
        </article>
      `).join('');
    }

    window.bookPublicSlot = async function(slotId) {
      $('bookingSlotId').value = slotId;
      $('bookingName').value = state.studentProfile?.name || '';
      $('bookingContact').value = state.user?.email || '';
      await fillBookingOptions();
      $('bookingDirection').value = getSelectedSubject();
      $('bookingNoSlotNotice').style.display = 'none';
      $('bookingModal').classList.add('active');
    }

    async function fillBookingOptions() {
      let types = state.lessonTypes || [];
      if (!types.length) {
        const { data } = await supabaseClient.from('lesson_types').select('*').eq('is_active', true).order('sort_order');
        types = data || [];
        state.lessonTypes = types;
      }
      const formats = [...new Set(types.map(t => t.format).filter(Boolean))];
      const directions = [...new Set(types.map(t => t.subject).filter(Boolean))];

      $('bookingFormat').innerHTML = formats.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('') || '<option value="online">online</option>';
      $('bookingDirection').innerHTML = directions.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('') || '<option value="Математика">Математика</option>';

      const selected = getSelectedSubject();
      if (selected && directions.includes(selected)) $('bookingDirection').value = selected;
    }

    $('bookingModalClose')?.addEventListener('click', () => $('bookingModal').classList.remove('active'));
    $('bookingModal')?.addEventListener('click', (e) => { if (e.target.id === 'bookingModal') $('bookingModal').classList.remove('active'); });

    $('bookingForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const slotId = $('bookingSlotId').value;
      const name = $('bookingName').value.trim();
      const contact = $('bookingContact').value.trim();

      const { error } = await supabaseClient.from('booking_requests').insert({
        slot_id: slotId || null,
        student_profile_id: state.studentProfile?.id || null,
        name,
        contact,
        email: state.user?.email || null,
        format: $('bookingFormat').value || wizardState.format,
        direction: $('bookingDirection').value || wizardState.subject,
        message: (($('bookingMessage').value.trim() || '') + (wizardState.goal ? `\nЦель: ${wizardState.goal}` : '')),
        status: 'pending'
      });

      if (error) return toast('Не удалось отправить заявку: ' + error.message, 'error');

      await supabaseClient.from('notification_events').insert({
        type: 'booking_request_created',
        channel: 'email',
        status: 'pending',
        payload: {
          to: state.siteSettings?.notification_email || 'bkmz.lby@mail.ru',
          name,
          contact,
          slotId,
          format: $('bookingFormat').value || wizardState.format,
          direction: $('bookingDirection').value || wizardState.subject,
          message: (($('bookingMessage').value.trim() || '') + (wizardState.goal ? `\nЦель: ${wizardState.goal}` : ''))
        }
      });

      $('bookingModal').classList.remove('active');
      e.target.reset();
      toast('Заявка на слот отправлена. Преподаватель подтвердит запись.', 'success');
      await loadPublicSlots();
    });

    $('calendarPrevWeek')?.addEventListener('click', async () => { calendarWeekStart = addDays(calendarWeekStart, -7); await loadPublicSlots(); });
    $('calendarToday')?.addEventListener('click', async () => { calendarWeekStart = getMonday(new Date()); await loadPublicSlots(); });
    $('calendarNextWeek')?.addEventListener('click', async () => { calendarWeekStart = addDays(calendarWeekStart, 7); await loadPublicSlots(); });

    $('contactForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('requests').insert({
        name: $('contactName').value.trim(),
        email: $('contactEmail').value.trim(),
        subject: $('contactSubject').value,
        message: $('contactMessage').value.trim()
      });
      if (error) return toast('Не удалось отправить заявку: ' + error.message, 'error');
      toast('Заявка отправлена.', 'success');
      e.target.reset();
    });

    function updateCalc() {
      const duration = Number($('calcDuration').value);
      const count = Number($('calcCount').value);
      const plan = $('calcPlan').value;
      const single = prices[duration] * count;
      const total = plan === 'package' ? Math.round(single * (1 - (discounts[count] || 0))) : single;
      const saving = single - total;
      $('calcResult').textContent = `Итого: ${total.toLocaleString('ru-RU')} ₽ · экономия: ${saving.toLocaleString('ru-RU')} ₽`;
    }
    ['calcDuration','calcCount','calcPlan'].forEach(id => $(id)?.addEventListener('change', updateCalc));
    $('payDemoBtn')?.addEventListener('click', async () => {
      if (!state.siteSettings || !Object.keys(state.siteSettings).length) await loadSiteSettings();
      const url = state.siteSettings?.payment_url;
      if (url) window.open(url, '_blank');
      else toast('Добавьте платёжную ссылку в настройках сайта.', 'info');
    });
    updateCalc();

    async function loadTeacherData() {
      const [students, topics, materials, homework, slots, requests, lessonTypes, subscriptions, packages, payments, lessonLogs, bookingRequests, activity, quizzes, quizQuestions, quizAttempts, reviews, cases, examples] = await Promise.all([
        safeQuery('ученики', supabaseClient.from('student_profiles').select('*').order('created_at', { ascending:false })),
        safeQuery('темы', supabaseClient.from('topics').select('*').order('created_at', { ascending:false })),
        safeQuery('материалы', supabaseClient.from('materials').select('*').order('created_at', { ascending:false })),
        safeQuery('домашние задания', supabaseClient.from('homework').select('*').order('created_at', { ascending:false })),
        safeQuery('слоты', supabaseClient.from('slots').select('*').order('date').order('time')),
        safeQuery('запросы учеников', supabaseClient.from('lesson_requests').select('*').order('created_at', { ascending:false })),
        safeQuery('типы занятий', supabaseClient.from('lesson_types').select('*').order('sort_order').order('created_at', { ascending:false })),
        safeQuery('абонементы', supabaseClient.from('subscriptions').select('*').order('lessons_count')),
        safeQuery('пакеты учеников', supabaseClient.from('student_packages').select('*').order('created_at', { ascending:false })),
        safeQuery('оплаты', supabaseClient.from('payments').select('*').order('created_at', { ascending:false })),
        safeQuery('журнал занятий', supabaseClient.from('lesson_logs').select('*').order('created_at', { ascending:false })),
        safeQuery('заявки на запись', supabaseClient.from('booking_requests').select('*').order('created_at', { ascending:false })),
        safeQuery('история действий', supabaseClient.from('activity_log').select('*').order('created_at', { ascending:false }).limit(50)),
        safeQuery('тесты', supabaseClient.from('quizzes').select('*').order('created_at', { ascending:false })),
        safeQuery('вопросы тестов', supabaseClient.from('quiz_questions').select('*').order('created_at')),
        safeQuery('попытки тестов', supabaseClient.from('quiz_attempts').select('*').order('created_at', { ascending:false })),
        safeQuery('отзывы', supabaseClient.from('reviews').select('*').order('created_at', { ascending:false })),
        safeQuery('кейсы', supabaseClient.from('student_cases').select('*').order('created_at', { ascending:false })),
        safeQuery('примеры работ', supabaseClient.from('lesson_examples').select('*').order('created_at', { ascending:false }))
      ]);

      state.students = students.data || [];
      state.topics = topics.data || [];
      state.lessonTypes = lessonTypes.data || [];
      state.subscriptions = subscriptions.data || [];

      state.materials = (materials.data || []).map(m => ({
        ...m,
        topics: relationBy(state.topics, m.topic_id),
        student_profiles: relationBy(state.students, m.student_id)
      }));

      state.homework = (homework.data || []).map(h => ({
        ...h,
        student_profiles: relationBy(state.students, h.student_id),
        topics: relationBy(state.topics, h.topic_id),
        lesson_types: relationBy(state.lessonTypes, h.lesson_type_id)
      }));

      state.slots = (slots.data || []).map(slot => ({
        ...slot,
        student_profiles: relationBy(state.students, slot.student_profile_id),
        lesson_types: relationBy(state.lessonTypes, slot.lesson_type_id)
      }));

      state.requests = (requests.data || []).map(r => ({
        ...r,
        student_profiles: relationBy(state.students, r.student_id)
      }));

      state.packages = (packages.data || []).map(p => ({
        ...p,
        student_profiles: relationBy(state.students, p.student_id),
        lesson_types: relationBy(state.lessonTypes, p.lesson_type_id),
        subscriptions: relationBy(state.subscriptions, p.subscription_id)
      }));

      state.payments = (payments.data || []).map(pay => ({
        ...pay,
        student_profiles: relationBy(state.students, pay.student_id),
        lesson_types: relationBy(state.lessonTypes, pay.lesson_type_id),
        student_packages: relationBy(state.packages, pay.package_id)
      }));

      state.lessonLogs = (lessonLogs.data || []).map(log => ({
        ...log,
        student_profiles: relationBy(state.students, log.student_id),
        slots: relationBy(state.slots, log.slot_id),
        lesson_types: relationBy(state.lessonTypes, log.lesson_type_id)
      }));

      state.bookingRequests = (bookingRequests.data || []).map(req => ({
        ...req,
        slots: relationBy(state.slots, req.slot_id),
        student_profiles: relationBy(state.students, req.student_profile_id)
      }));

      state.activity = activity.data || [];
      state.quizzes = (quizzes.data || []).map(q => ({
        ...q,
        topics: relationBy(state.topics, q.topic_id),
        student_profiles: relationBy(state.students, q.student_id)
      }));
      state.quizQuestions = quizQuestions.data || [];
      state.quizAttempts = (quizAttempts.data || []).map(a => ({
        ...a,
        quizzes: relationBy(state.quizzes, a.quiz_id),
        student_profiles: relationBy(state.students, a.student_id)
      }));
      state.reviews = reviews.data || [];
      state.cases = cases.data || [];
      state.examples = examples.data || [];
    }

    async function loadTeacherCabinet() {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      await loadTeacherData();
      renderTeacherCabinet();
    }

    function fillSelect(selectId, items, placeholder, getLabel) {
      const select = $(selectId);
      if (!select) return;
      select.innerHTML = placeholder ? `<option value="">${placeholder}</option>` : '';
      select.innerHTML += items.map(item => `<option value="${item.id}">${esc(getLabel(item))}</option>`).join('');
    }

    function renderTeacherCabinet() {
      fillSelect('materialTopicSelect', state.topics, 'Выберите тему', t => t.title);
      fillSelect('homeworkTopicSelect', state.topics, 'Выберите тему', t => t.title);
      fillSelect('materialStudentSelect', state.students, 'Для всех учеников', s => `${s.name} · ${s.email}`);
      fillSelect('homeworkStudentSelect', state.students, 'Выберите ученика', s => `${s.name} · ${s.email}`);
      fillSelect('slotLessonTypeSelect', state.lessonTypes.filter(x => x.is_active), 'Выберите тип занятия', lt => `${lt.title} · ${lt.duration} мин · ${Number(lt.price || 0).toLocaleString('ru-RU')} ₽`);
      fillSelect('packageStudentSelect', state.students, 'Выберите ученика', s => `${s.name} · ${s.email}`);
      fillSelect('packageLessonTypeSelect', state.lessonTypes.filter(x => x.is_active), 'Выберите тип занятия', lt => `${lt.title} · ${lt.duration} мин · ${Number(lt.price || 0).toLocaleString('ru-RU')} ₽`);
      fillSelect('packageSubscriptionSelect', state.subscriptions.filter(x => x.is_active !== false), 'Без абонемента / вручную', sub => `${sub.title || ('Абонемент на ' + sub.lessons_count)} · ${sub.lessons_count} зан. · скидка ${sub.discount_percent}%`);
      fillSelect('paymentStudentSelect', state.students, 'Выберите ученика', s => `${s.name} · ${s.email}`);
      fillSelect('paymentLessonTypeSelect', state.lessonTypes, 'Не привязывать', lt => `${lt.title} · ${Number(lt.price || 0).toLocaleString('ru-RU')} ₽`);
      fillSelect('paymentPackageSelect', state.packages, 'Не привязывать', p => `${p.student_profiles?.name || 'ученик'} · ${p.lesson_types?.title || 'пакет'} · ${p.lessons_used}/${p.lessons_total}`);
      fillSelect('logStudentSelect', state.students, 'Выберите ученика', s => `${s.name} · ${s.email}`);
      fillSelect('logSlotSelect', state.slots.filter(s => s.status === 'booked' || s.status === 'confirmed' || s.status === 'completed'), 'Выберите слот', s => `${fmtDate(s.date)} · ${s.time} · ${s.student_profiles?.name || s.student_name || 'ученик'}`);

      renderPricingBlocks();
      renderTeacherCalendarEditor();

      const q = $('studentSearch').value.toLowerCase();
      const f = $('studentFilter').value;
      const filtered = state.students.filter(s => (!q || `${s.name} ${s.email}`.toLowerCase().includes(q)) && (!f || (s.subject || '').includes(f)));
      $('studentsTable').innerHTML = filtered.map(s => {
        const hw = state.homework.filter(h => h.student_id === s.id);
        const done = hw.filter(h => h.is_done).length;
        return `<tr>
          <td><strong>${esc(s.name)}</strong><br><span class="muted">${esc(s.notes)}</span></td>
          <td>${esc(s.email)}</td>
          <td>${esc(s.subject) || '—'}</td>
          <td>${done} / ${hw.length}</td>
          <td>
            <button class="btn small soft" onclick="emailStudent('${esc(s.email)}','homework')">Письмо</button>
          </td>
        </tr>`;
      }).join('') || '<tr><td colspan="5">Ученики не найдены</td></tr>';

      renderCalendar('teacherCalendar', state.slots || []);
      $('teacherSlots').innerHTML = state.slots.map(slot => `
        <article class="slot-card ${humanStatus(slot.status)}">
          <strong>${fmtDate(slot.date)} · ${esc(slot.time)}</strong>
          <span class="status ${humanStatus(slot.status)}">${humanStatus(slot.status)} · ${esc(slot.duration)} мин</span>
          <p class="muted">Тип: ${esc(slot.lesson_types?.title) || '—'}</p>
          <p class="muted">Цена: ${Number(slot.price || slot.lesson_types?.price || 0).toLocaleString('ru-RU')} ₽ · Ученик: ${esc(slot.student_profiles?.name || slot.student_name) || '—'}</p>
          <div class="row-actions">
            <button class="btn small soft" onclick="setSlotStatus('${slot.id}','open')">Открыть</button>
            <button class="btn small green" onclick="setSlotStatus('${slot.id}','confirmed')">Подтвердить</button>
            <button class="btn small soft" onclick="rescheduleSlot('${slot.id}')">Перенести</button>
            <button class="btn small secondary" onclick="setSlotStatus('${slot.id}','completed')">Проведено</button>
            <button class="btn small red" onclick="setSlotStatus('${slot.id}','cancelled')">Отменить</button>
            <button class="btn small red" onclick="deleteSlot('${slot.id}')">Удалить</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Слотов нет</div>';

      $('teacherHomeworkList').innerHTML = state.homework.map(h => `
        <article class="learning-item">
          <div class="top"><strong>${esc(h.title)}</strong><span class="status ${h.is_done ? 'done' : 'pending'}">${h.is_done ? 'сдано' : 'в работе'}</span></div>
          <p class="muted">${esc(h.student_profiles?.name)} · ${esc(h.topics?.title)} · срок: ${esc(h.deadline) || '—'}</p>
          <p>${esc(h.description || '')}</p>
          ${h.grade_percent !== null && h.grade_percent !== undefined ? `<div class="homework-grade"><strong>Оценка: ${Number(h.grade_percent)}%</strong><div class="grade-bar"><span style="width:${Number(h.grade_percent)}%"></span></div></div>` : ''}
          <button class="btn small soft" onclick="gradeHomework('${h.id}')">Проверить / оценить</button>
        </article>
      `).join('') || '<div class="empty">ДЗ пока нет</div>';

      if ($('teacherSubmittedHomeworkList')) {
        const submitted = state.homework.filter(h => h.is_done || h.answer_text || h.answer_file_url);
        $('teacherSubmittedHomeworkList').innerHTML = submitted.map(h => `
          <article class="learning-item">
            <div class="top"><strong>${esc(h.title)}</strong><span class="status pending">${h.grade_percent !== null && h.grade_percent !== undefined ? 'проверено' : 'на проверке'}</span></div>
            <p class="muted">${esc(h.student_profiles?.name)} · ${esc(h.student_profiles?.email || '')} · срок: ${esc(h.deadline) || '—'}</p>
            ${h.answer_text ? `<p><strong>Ответ:</strong> ${esc(h.answer_text)}</p>` : '<p class="muted">Текст ответа не указан</p>'}
            ${h.answer_file_url ? `<a class="btn small soft" href="${esc(h.answer_file_url)}" target="_blank">Открыть файл ученика</a>` : ''}
            ${h.grade_percent !== null && h.grade_percent !== undefined ? `<div class="homework-grade"><strong>Результат: ${Number(h.grade_percent)}%</strong><div class="grade-bar"><span style="width:${Number(h.grade_percent)}%"></span></div>${h.teacher_comment ? `<p>${esc(h.teacher_comment)}</p>` : ''}</div>` : ''}
            <div class="row-actions">
              <button class="btn small" onclick="gradeHomework('${h.id}')">Оценить по 100%</button>
              <button class="btn small soft" onclick="commentHomework('${h.id}')">Только комментарий</button>
            </div>
          </article>
        `).join('') || '<div class="empty">Присланных ДЗ пока нет</div>';
      }

      $('teacherRequests').innerHTML = state.requests.map(r => `
        <article class="learning-item">
          <div class="top"><strong>${esc(r.type)}</strong><span class="status ${humanStatus(r.status)}">${humanStatus(r.status)}</span></div>
          <p class="muted">${esc(r.student_profiles?.name)} · ${new Date(r.created_at).toLocaleString('ru-RU')}</p>
          <p>${esc(r.message)}</p>
          <div class="row-actions">
            <button class="btn small green" onclick="approveStudentRequest('${r.id}')">Одобрить</button>
            <button class="btn small red" onclick="setRequestStatus('${r.id}','rejected')">Отклонить</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Запросов нет</div>';


      $('teacherBookingRequests').innerHTML = state.bookingRequests.map(req => `
        <article class="learning-item">
          <div class="top"><strong>${esc(req.name || req.student_profiles?.name)}</strong><span class="status ${humanStatus(req.status)}">${humanStatus(req.status)}</span></div>
          <p class="muted">${req.slots?.date ? fmtDate(req.slots.date) + ' · ' + esc(req.slots.time) : 'слот'} · ${esc(req.slots?.lesson_types?.title) || ''}</p>
          <p>Контакт: ${esc(req.contact || req.email || req.student_profiles?.email) || '—'}</p>
          <p class="muted">Формат: ${esc(req.format || '—')} · Направление: ${esc(req.direction || '—')}</p>
          ${req.message ? `<p>${esc(req.message)}</p>` : ''}
          <div class="row-actions">
            <button class="btn small green" onclick="approveBookingRequest('${req.id}')">Подтвердить</button>
            <button class="btn small red" onclick="rejectBookingRequest('${req.id}')">Отклонить</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Заявок на запись нет</div>';


      $('lessonLogsList').innerHTML = state.lessonLogs.map(log => `
        <article class="learning-item lesson-log">
          <div class="top"><strong>${esc(log.topic_title)}</strong><span class="topic-chip">${esc(log.student_profiles?.name) || 'ученик'}</span></div>
          <p class="muted">${esc(log.lesson_types?.title) || 'занятие'} · ${log.slots?.date ? fmtDate(log.slots.date) + ' · ' + esc(log.slots.time) : ''}</p>
          <p>${esc(log.summary)}</p>
          ${log.next_steps ? `<p class="muted">Повторить: ${esc(log.next_steps)}</p>` : ''}
          ${log.comment ? `<div class="success">Комментарий: ${esc(log.comment)}</div>` : ''}
        </article>
      `).join('') || '<div class="empty">Записей журнала пока нет</div>';
    }


    function renderPricingBlocks() {
      const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} ₽`;

      $('lessonTypesList').innerHTML = state.lessonTypes.map(lt => `
        <article class="learning-item">
          <div class="top">
            <strong>${esc(lt.title)}</strong>
            <span class="status ${lt.is_active ? 'approved' : 'closed'}">${lt.is_active ? 'активен' : 'скрыт'}</span>
          </div>
          <p class="muted">${esc(lt.subject)} · ${esc(lt.format)} · ${esc(lt.duration)} мин · ${money(lt.price)}</p>
          <p>${esc(lt.description)}</p>
          <div class="row-actions">
            <button class="btn small soft" onclick="editLessonType('${lt.id}')">Изменить</button>
            <button class="btn small ${lt.is_active ? 'red' : 'green'}" onclick="toggleLessonType('${lt.id}', ${lt.is_active ? 'false' : 'true'})">${lt.is_active ? 'Скрыть' : 'Включить'}</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Типов занятий пока нет</div>';

      $('subscriptionsList').innerHTML = state.subscriptions.map(sub => `
        <article class="learning-item">
          <div class="top"><strong>${esc(sub.title || ('Абонемент на ' + sub.lessons_count))}</strong><span class="status ${sub.is_active ? 'approved' : 'closed'}">${sub.is_active ? 'активен' : 'скрыт'}</span></div>
          <p class="muted">${esc(sub.lessons_count)} занятий · скидка ${esc(sub.discount_percent)}% · ${esc(sub.valid_days)} дней</p>
          <div class="row-actions">
            <button class="btn small soft" onclick="editSubscription('${sub.id}')">Изменить</button>
            <button class="btn small ${sub.is_active ? 'red' : 'green'}" onclick="toggleSubscription('${sub.id}', ${sub.is_active ? 'false' : 'true'})">${sub.is_active ? 'Скрыть' : 'Включить'}</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Абонементов пока нет</div>';

      $('studentPackagesList').innerHTML = state.packages.map(p => {
        const left = Number(p.lessons_total || 0) - Number(p.lessons_used || 0);
        return `
          <article class="learning-item">
            <div class="top"><strong>${esc(p.student_profiles?.name)}</strong><span class="status ${esc(p.status)}">${esc(p.status)}</span></div>
            <p class="muted">${esc(p.lesson_types?.title)} · осталось ${left} из ${esc(p.lessons_total)} занятий</p>
            <p class="muted">Оплачено: ${money(p.paid_amount)} · до ${esc(p.expires_at) || '—'}</p>
            <div class="row-actions">
              <button class="btn small soft" onclick="extendPackage('${p.id}')">Продлить</button>
              <button class="btn small green" onclick="usePackageLesson('${p.id}')">Списать 1 занятие</button>
            </div>
          </article>
        `;
      }).join('') || '<div class="empty">Пакетов пока нет</div>';

      $('paymentsList').innerHTML = state.payments.map(pay => `
        <article class="learning-item">
          <div class="top"><strong>${esc(pay.student_profiles?.name)}</strong><span class="status ${esc(pay.status)}">${esc(pay.status)}</span></div>
          <p class="muted">${money(pay.amount)} · ${esc(pay.method) || 'способ не указан'} · ${esc(pay.lesson_types?.title) || 'без типа'}</p>
          <p>${esc(pay.notes)}</p>
        </article>
      `).join('') || '<div class="empty">Оплат пока нет</div>';


      if ($('teacherReviewsList')) {
        $('teacherReviewsList').innerHTML = (state.reviews || []).map(r => `
          <article class="learning-item">
            <div class="top"><strong>${esc(r.author)}</strong><span class="status approved">${'★'.repeat(Number(r.rating || 5))}</span></div>
            <p>${esc(r.text)}</p>
            <p class="muted">${esc(r.source || '')}</p>
            <div class="row-actions">
              ${r.proof_url ? `<a class="btn small soft" href="${esc(r.proof_url)}" target="_blank">Подтверждение</a>` : ''}
              ${r.photo_url ? `<a class="btn small soft" href="${esc(r.photo_url)}" target="_blank">Фото</a>` : ''}
              <button class="btn small soft" onclick="editReview('${r.id}')">Изменить</button>
              <button class="btn small red" onclick="deleteReview('${r.id}')">Удалить</button>
            </div>
          </article>
        `).join('') || '<div class="empty">Отзывов пока нет</div>';
      }
    }

    $('slotLessonTypeSelect')?.addEventListener('change', () => {
      const lt = state.lessonTypes.find(x => x.id === $('slotLessonTypeSelect').value);
      if (!lt) return;
      $('slotDuration').value = lt.duration || 60;
      $('slotPrice').value = lt.price || 0;
    });

    $('packageSubscriptionSelect')?.addEventListener('change', () => {
      const sub = state.subscriptions.find(x => x.id === $('packageSubscriptionSelect').value);
      const lt = state.lessonTypes.find(x => x.id === $('packageLessonTypeSelect').value);
      if (!sub) return;
      $('packageLessonsTotal').value = sub.lessons_count || 0;
      const base = Number(lt?.price || 0) * Number(sub.lessons_count || 0);
      const total = Math.round(base * (1 - Number(sub.discount_percent || 0) / 100));
      $('packagePaidAmount').value = total;
      const start = $('packageStartsAt').value ? new Date($('packageStartsAt').value) : new Date();
      const expires = new Date(start);
      expires.setDate(expires.getDate() + Number(sub.valid_days || 30));
      $('packageExpiresAt').value = expires.toISOString().slice(0, 10);
    });


    $('teacherCalendarToggle')?.addEventListener('click', () => {
      const cal = $('teacherCalendar');
      const cards = $('teacherSlots');
      const showCalendar = cal.style.display === 'none';
      cal.style.display = showCalendar ? 'grid' : 'none';
      cards.style.display = showCalendar ? 'none' : 'grid';
    });

    $('studentSearch')?.addEventListener('input', renderTeacherCabinet);
    $('studentFilter')?.addEventListener('change', renderTeacherCabinet);
    $('refreshTeacherBtn')?.addEventListener('click', loadTeacherCabinet);

    $('addStudentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('student_profiles').insert({
        name: $('newStudentName').value.trim(),
        email: $('newStudentEmail').value.trim(),
        subject: $('newStudentSubject').value.trim(),
        yandex_folder_url: $('newStudentYandexFolder')?.value.trim() || null,
        notes: $('newStudentNotes').value.trim()
      });
      if (error) return alert('Не удалось добавить ученика: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addTopicForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('topics').insert({
        title: $('newTopicTitle').value.trim(),
        subject: $('newTopicSubject').value,
        description: $('newTopicDescription').value.trim()
      });
      if (error) return alert('Не удалось создать тему: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addMaterialForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      let fileUrl = $('materialUrl').value.trim();
      try {
        if ($('materialFile').files[0]) fileUrl = await uploadFileToStorage($('materialFile').files[0], 'materials');
      } catch (err) {
        return toast('Не удалось загрузить файл: ' + err.message, 'error');
      }

      const { error } = await supabaseClient.from('materials').insert({
        topic_id: $('materialTopicSelect').value,
        student_id: $('materialStudentSelect').value || null,
        title: $('materialTitle').value.trim(),
        file_url: fileUrl,
        description: $('materialDescription').value.trim()
      });
      if (error) return alert('Не удалось добавить материал: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addHomeworkForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      let homeworkFileUrl = '';
      try {
        if ($('homeworkFile').files[0]) homeworkFileUrl = await uploadFileToStorage($('homeworkFile').files[0], 'homework');
      } catch (err) {
        return toast('Не удалось загрузить файл ДЗ: ' + err.message, 'error');
      }

      const { error } = await supabaseClient.from('homework').insert({
        student_id: $('homeworkStudentSelect').value,
        topic_id: $('homeworkTopicSelect').value,
        title: $('homeworkTitle').value.trim(),
        description: $('homeworkDescription').value.trim(),
        deadline: $('homeworkDeadline').value || null,
        file_url: homeworkFileUrl
      });
      if (error) return alert('Не удалось выдать ДЗ: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addLessonTypeForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('lesson_types').insert({
        title: $('lessonTypeTitle').value.trim(),
        subject: $('lessonTypeSubject').value,
        duration: Number($('lessonTypeDuration').value),
        price: Number($('lessonTypePrice').value),
        currency: 'RUB',
        format: $('lessonTypeFormat').value,
        description: $('lessonTypeDescription').value.trim(),
        is_active: true
      });
      if (error) return alert('Не удалось создать тип занятия: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addSubscriptionForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('subscriptions').insert({
        title: $('subscriptionTitle').value.trim(),
        lessons_count: Number($('subscriptionLessons').value),
        discount_percent: Number($('subscriptionDiscount').value),
        valid_days: Number($('subscriptionValidDays').value),
        is_active: true
      });
      if (error) return alert('Не удалось создать абонемент: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addStudentPackageForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('student_packages').insert({
        student_id: $('packageStudentSelect').value,
        lesson_type_id: $('packageLessonTypeSelect').value,
        subscription_id: $('packageSubscriptionSelect').value || null,
        lessons_total: Number($('packageLessonsTotal').value),
        lessons_used: 0,
        paid_amount: Number($('packagePaidAmount').value),
        currency: 'RUB',
        status: 'active',
        starts_at: $('packageStartsAt').value || new Date().toISOString().slice(0, 10),
        expires_at: $('packageExpiresAt').value || null,
        notes: $('packageNotes').value.trim()
      });
      if (error) return alert('Не удалось выдать пакет: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });

    $('addPaymentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('payments').insert({
        student_id: $('paymentStudentSelect').value,
        lesson_type_id: $('paymentLessonTypeSelect').value || null,
        package_id: $('paymentPackageSelect').value || null,
        amount: Number($('paymentAmount').value),
        currency: 'RUB',
        status: $('paymentStatus').value,
        method: $('paymentMethod').value.trim(),
        notes: $('paymentNotes').value.trim()
      });
      if (error) return alert('Не удалось добавить оплату: ' + error.message);
      e.target.reset(); await loadTeacherCabinet();
    });



    $('addCaseForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('student_cases').insert({
        title: $('caseTitle').value.trim(),
        subject: $('caseSubject').value.trim(),
        grade: $('caseGrade').value.trim(),
        before_text: $('caseBefore').value.trim(),
        process_text: $('caseProcess').value.trim(),
        result_text: $('caseResult').value.trim(),
        is_published: true
      });
      if (error) return toast(error.message, 'error');
      toast('Кейс добавлен', 'success');
      e.target.reset();
      await loadTeacherCabinet();
    });

    $('addExampleForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      let fileUrl = $('exampleUrl').value.trim();
      try {
        if ($('exampleFile').files[0]) fileUrl = await uploadFileToStorage($('exampleFile').files[0], 'public_examples');
      } catch (err) {
        return toast('Не удалось загрузить файл: ' + err.message, 'error');
      }
      const { error } = await supabaseClient.from('lesson_examples').insert({
        title: $('exampleTitle').value.trim(),
        subject: $('exampleSubject').value.trim(),
        type: $('exampleType').value,
        description: $('exampleDescription').value.trim(),
        file_url: fileUrl,
        is_published: true
      });
      if (error) return toast(error.message, 'error');
      toast('Пример добавлен', 'success');
      e.target.reset();
      await loadTeacherCabinet();
    });

    window.deleteCase = async function(id) {
      if (!confirm('Удалить кейс?')) return;
      const { error } = await supabaseClient.from('student_cases').delete().eq('id', id);
      if (error) return toast(error.message, 'error');
      await loadTeacherCabinet();
    }

    window.deleteExample = async function(id) {
      if (!confirm('Удалить пример?')) return;
      const { error } = await supabaseClient.from('lesson_examples').delete().eq('id', id);
      if (error) return toast(error.message, 'error');
      await loadTeacherCabinet();
    }


    $('refreshReviewsBtn')?.addEventListener('click', loadTeacherCabinet);

    $('addReviewForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      let photoUrl = '';
      try {
        if ($('reviewPhotoFile').files[0]) photoUrl = await uploadFileToStorage($('reviewPhotoFile').files[0], 'reviews');
      } catch (err) {
        return toast('Не удалось загрузить фото отзыва: ' + err.message, 'error');
      }
      const { error } = await supabaseClient.from('reviews').insert({
        author: $('reviewAuthor').value.trim(),
        rating: Number($('reviewRating').value),
        source: $('reviewSource').value.trim(),
        text: $('reviewText').value.trim(),
        proof_url: $('reviewProofUrl').value.trim(),
        photo_url: photoUrl,
        is_published: true
      });
      if (error) return toast(error.message, 'error');
      toast('Отзыв добавлен', 'success');
      e.target.reset();
      await loadTeacherCabinet();
      await loadPublicReviews();
    });

    window.editReview = async function(id) {
      const r = state.reviews.find(x => x.id === id);
      if (!r) return;
      openEditModal({
        title: 'Редактировать отзыв',
        fields: [
          { name:'author', label:'Автор', value:r.author },
          { name:'rating', label:'Оценка', type:'number', value:r.rating || 5 },
          { name:'source', label:'Источник', value:r.source || '' },
          { name:'text', label:'Текст', type:'textarea', value:r.text || '' },
          { name:'proof_url', label:'Подтверждающая ссылка', value:r.proof_url || '' }
        ],
        onSave: async (values) => {
          const { error } = await supabaseClient.from('reviews').update({
            author: values.author,
            rating: Number(values.rating || 5),
            source: values.source,
            text: values.text,
            proof_url: values.proof_url
          }).eq('id', id);
          if (error) throw error;
          await loadTeacherCabinet();
          await loadPublicReviews();
        }
      });
    }

    window.deleteReview = async function(id) {
      if (!confirm('Удалить отзыв?')) return;
      const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
      if (error) return toast(error.message, 'error');
      toast('Отзыв удалён', 'success');
      await loadTeacherCabinet();
      await loadPublicReviews();
    }


    function buildRecurringDates(startDate, repeatType, repeatCount, repeatUntil) {
      const dates = [];
      const start = new Date(startDate + 'T00:00:00');
      if (!startDate || Number.isNaN(start.getTime())) return dates;

      const maxCount = Math.min(Math.max(Number(repeatCount || 1), 1), 52);
      const until = repeatUntil ? new Date(repeatUntil + 'T00:00:00') : null;

      for (let i = 0; i < maxCount; i++) {
        const d = new Date(start);
        if (repeatType === 'weekly') d.setDate(start.getDate() + i * 7);
        if (repeatType === 'biweekly') d.setDate(start.getDate() + i * 14);
        if (repeatType === 'monthly') d.setMonth(start.getMonth() + i);
        if (repeatType === 'none') d.setDate(start.getDate());

        if (until && d > until) break;
        dates.push(d.toISOString().slice(0, 10));
        if (repeatType === 'none') break;
      }
      return [...new Set(dates)];
    }

    $('createSlotForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const repeatType = $('slotRepeatType')?.value || 'none';
      const dates = buildRecurringDates(
        $('slotDate').value,
        repeatType,
        $('slotRepeatCount')?.value || 1,
        $('slotRepeatUntil')?.value || ''
      );

      if (!dates.length) return toast('Выберите корректную дату слота.', 'error');

      const rows = dates.map(date => ({
        date,
        time: $('slotTime').value,
        duration: Number($('slotDuration').value),
        status: $('slotStatus').value,
        lesson_type_id: $('slotLessonTypeSelect').value,
        price: Number($('slotPrice').value),
        currency: 'RUB'
      }));

      const { error } = await supabaseClient.from('slots').insert(rows);
      if (error) return toast('Не удалось создать слот: ' + error.message, 'error');

      await logActivity('create_recurring_slots', 'slots', null, {
        repeatType,
        count: rows.length,
        firstDate: rows[0]?.date,
        time: $('slotTime').value
      });

      toast(rows.length === 1 ? 'Слот создан' : `Создано слотов: ${rows.length}`, 'success');
      e.target.reset();
      $('slotRepeatCount').value = 1;
      await loadTeacherCabinet();
    });


    window.editLessonType = async function(id) {
      const lt = state.lessonTypes.find(x => x.id === id);
      if (!lt) return;
      openEditModal({
        title: 'Редактировать тип занятия',
        text: 'Название, длительность и цена изменятся для новых слотов.',
        fields: [
          { name:'title', label:'Название', value: lt.title },
          { name:'duration', label:'Длительность, минут', type:'number', value: lt.duration },
          { name:'price', label:'Цена, ₽', type:'number', value: lt.price },
          { name:'description', label:'Описание', type:'textarea', value: lt.description || '' }
        ],
        onSave: async (values) => {
          const { error } = await supabaseClient.from('lesson_types').update({
            title: values.title,
            duration: Number(values.duration),
            price: Number(values.price),
            description: values.description
          }).eq('id', id);
          if (error) throw error;
          await loadTeacherCabinet();
        }
      });
    }

    window.toggleLessonType = async function(id, isActive) {
      const { error } = await supabaseClient.from('lesson_types').update({ is_active: isActive }).eq('id', id);
      if (error) return toast(error.message, 'error');
      await logActivity('toggle_lesson_type', 'lesson_types', id, { isActive });
      toast(isActive ? 'Тип занятия включён' : 'Тип занятия скрыт', 'success');
      await loadTeacherCabinet();
    }

    window.editSubscription = async function(id) {
      const sub = state.subscriptions.find(x => x.id === id);
      if (!sub) return;
      openEditModal({
        title: 'Редактировать абонемент',
        fields: [
          { name:'title', label:'Название', value: sub.title || '' },
          { name:'lessons_count', label:'Количество занятий', type:'number', value: sub.lessons_count },
          { name:'discount_percent', label:'Скидка, %', type:'number', value: sub.discount_percent },
          { name:'valid_days', label:'Срок действия, дней', type:'number', value: sub.valid_days }
        ],
        onSave: async (values) => {
          const { error } = await supabaseClient.from('subscriptions').update({
            title: values.title,
            lessons_count: Number(values.lessons_count),
            discount_percent: Number(values.discount_percent),
            valid_days: Number(values.valid_days)
          }).eq('id', id);
          if (error) throw error;
          await loadTeacherCabinet();
        }
      });
    }

    window.toggleSubscription = async function(id, isActive) {
      const { error } = await supabaseClient.from('subscriptions').update({ is_active: isActive }).eq('id', id);
      if (error) return alert(error.message);
      await loadTeacherCabinet();
    }

    window.extendPackage = async function(id) {
      const p = state.packages.find(x => x.id === id);
      if (!p) return;
      const add = Number(prompt('Сколько занятий добавить?', '1') || 0);
      if (!add) return;
      const { error } = await supabaseClient.from('student_packages').update({ lessons_total: Number(p.lessons_total || 0) + add }).eq('id', id);
      if (error) return alert(error.message);
      await loadTeacherCabinet();
    }

    window.usePackageLesson = async function(id) {
      const p = state.packages.find(x => x.id === id);
      if (!p) return;
      if (Number(p.lessons_used || 0) >= Number(p.lessons_total || 0)) return alert('В пакете не осталось занятий.');
      const { error } = await supabaseClient.from('student_packages').update({ lessons_used: Number(p.lessons_used || 0) + 1 }).eq('id', id);
      if (error) return alert(error.message);
      await loadTeacherCabinet();
    }



    async function logActivity(action, entityType, entityId, details = {}) {
      try {
        await supabaseClient.from('activity_log').insert({
          user_id: state.user?.id || null,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details
        });
      } catch (err) {
        console.warn('activity_log skipped', err);
      }
    }

    window.approveBookingRequest = async function(id) {
      const req = state.bookingRequests.find(x => x.id === id);
      if (!req) return;
      const { error: slotError } = await supabaseClient.from('slots').update({
        status: 'confirmed',
        student_name: req.name,
        student_contact: req.contact,
        student_profile_id: req.student_profile_id || null
      }).eq('id', req.slot_id);

      if (slotError) return toast(slotError.message, 'error');

      const { error } = await supabaseClient.from('booking_requests').update({ status: 'approved' }).eq('id', id);
      if (error) return toast(error.message, 'error');

      await supabaseClient.from('notification_events').insert({
        type: 'booking_approved',
        channel: 'email',
        status: 'pending',
        payload: { to: state.siteSettings?.notification_email || 'bkmz.lby@mail.ru', requestId: id, name: req.name, email: req.email, contact: req.contact, slotId: req.slot_id }
      });

      await logActivity('approve_booking', 'booking_requests', id, { slot_id: req.slot_id, name: req.name });
      toast('Запись подтверждена', 'success');
      await loadTeacherCabinet();
    }

    window.rejectBookingRequest = async function(id) {
      const { error } = await supabaseClient.from('booking_requests').update({ status: 'rejected' }).eq('id', id);
      if (error) return toast(error.message, 'error');
      await logActivity('reject_booking', 'booking_requests', id);
      toast('Заявка отклонена', 'success');
      await loadTeacherCabinet();
    }



    async function autoDeductPackageForSlot(slotId) {
      const slot = state.slots.find(s => s.id === slotId);
      const studentId = slot?.student_profile_id;
      const lessonTypeId = slot?.lesson_type_id;
      if (!studentId) return;

      let query = supabaseClient
        .from('student_packages')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('expires_at', { ascending: true });

      if (lessonTypeId) query = query.eq('lesson_type_id', lessonTypeId);

      const { data, error } = await query;
      if (error || !data?.length) {
        toast('Занятие проведено, но подходящий пакет не найден для списания.', 'info');
        return;
      }

      const pack = data.find(p => Number(p.lessons_used || 0) < Number(p.lessons_total || 0));
      if (!pack) {
        toast('Занятие проведено, но в пакетах не осталось занятий.', 'info');
        return;
      }

      const { error: updError } = await supabaseClient
        .from('student_packages')
        .update({ lessons_used: Number(pack.lessons_used || 0) + 1 })
        .eq('id', pack.id);

      if (updError) {
        toast('Не удалось списать занятие из пакета: ' + updError.message, 'error');
        return;
      }

      await logActivity('auto_deduct_package_lesson', 'student_packages', pack.id, { slotId });
      toast('1 занятие автоматически списано из пакета.', 'success');
    }


    window.setSlotStatus = async function(id, status) {
      const { error } = await supabaseClient.from('slots').update({ status }).eq('id', id);
      if (error) return toast(error.message, 'error');
      await logActivity('set_slot_status', 'slots', id, { status });
      if (status === 'completed') await autoDeductPackageForSlot(id);
      try {
        await supabaseClient.from('google_sync_events').insert({ type:'calendar_slot_status_changed', status:'pending', payload:{ slot_id:id, status } });
      } catch (e) {
        console.warn('google_sync_events skipped', e);
      }
      toast('Статус слота обновлён', 'success');
      await loadTeacherCabinet();
    }

    window.deleteSlot = async function(id) {
      if (!confirm('Удалить слот?')) return;
      const { error } = await supabaseClient.from('slots').delete().eq('id', id);
      if (error) return alert(error.message);
      await loadTeacherCabinet();
    }
    window.commentHomework = async function(id) {
      const text = prompt('Комментарий преподавателя');
      if (text === null) return;
      const { error } = await supabaseClient.from('homework').update({ teacher_comment: text }).eq('id', id);
      if (error) return toast(error.message, 'error');
      await loadTeacherCabinet();
    }

    window.gradeHomework = async function(id) {
      const hw = state.homework.find(h => h.id === id);
      if (!hw) return;
      const raw = prompt('Оценка по 100% шкале', hw.grade_percent ?? '100');
      if (raw === null) return;
      const grade = Math.max(0, Math.min(100, Number(raw)));
      if (!Number.isFinite(grade)) return toast('Введите число от 0 до 100', 'error');
      const comment = prompt('Комментарий для ученика', hw.teacher_comment || '') ?? '';

      const { error } = await supabaseClient.from('homework').update({
        grade_percent: grade,
        teacher_comment: comment,
        checked_at: new Date().toISOString(),
        checked_by: state.user?.id || null
      }).eq('id', id);

      if (error) return toast(error.message, 'error');

      await supabaseClient.from('notification_events').insert({
        type: 'homework_checked',
        channel: 'email',
        status: 'pending',
        payload: {
          to: hw.student_profiles?.email,
          student: hw.student_profiles?.name,
          homework_id: id,
          title: hw.title,
          grade_percent: grade,
          comment
        }
      });

      toast('ДЗ проверено. Результат появится в ЛК ученика, событие уведомления создано.', 'success');
      await loadTeacherCabinet();
    }
    window.setRequestStatus = async function(id, status) {
      const { error } = await supabaseClient.from('lesson_requests').update({ status }).eq('id', id);
      if (error) return toast(error.message, 'error');
      await loadTeacherCabinet();
    }

    window.approveStudentRequest = async function(id) {
      const req = state.requests.find(r => r.id === id);
      if (!req) return;

      if (req.type === 'transfer' && req.slot_id && req.requested_date && req.requested_time) {
        const { error: slotError } = await supabaseClient
          .from('slots')
          .update({
            date: req.requested_date,
            time: req.requested_time,
            status: 'rescheduled'
          })
          .eq('id', req.slot_id);

        if (slotError) return toast(slotError.message, 'error');
      }

      const { error } = await supabaseClient.from('lesson_requests').update({ status:'approved' }).eq('id', id);
      if (error) return toast(error.message, 'error');

      await supabaseClient.from('notification_events').insert({
        type: 'student_request_approved',
        channel: 'email',
        status: 'pending',
        payload: {
          to: state.siteSettings?.notification_email || 'bkmz.lby@mail.ru',
          requestId: id,
          type: req.type,
          student: req.student_profiles?.name,
          requested_date: req.requested_date,
          requested_time: req.requested_time
        }
      });

      toast(req.type === 'transfer' ? 'Перенос одобрен, слот обновлён.' : 'Запрос одобрен.', 'success');
      await loadTeacherCabinet();
    }

    window.rescheduleSlot = async function(id) {
      const slot = state.slots.find(s => s.id === id);
      if (!slot) return;
      openEditModal({
        title: 'Перенести занятие',
        text: 'Измените дату и время. Ученик увидит обновление в ЛК.',
        fields: [
          { name:'date', label:'Новая дата', type:'date', value:slot.date },
          { name:'time', label:'Новое время', type:'time', value:slot.time },
          { name:'teacher_note', label:'Комментарий', type:'textarea', value:slot.teacher_note || '' }
        ],
        onSave: async (values) => {
          const { error } = await supabaseClient.from('slots').update({
            date: values.date,
            time: values.time,
            teacher_note: values.teacher_note,
            status: 'rescheduled'
          }).eq('id', id);
          if (error) throw error;

          await supabaseClient.from('notification_events').insert({
            type: 'slot_rescheduled',
            channel: 'email',
            status: 'pending',
            payload: {
              to: state.siteSettings?.notification_email || 'bkmz.lby@mail.ru',
              slotId: id,
              date: values.date,
              time: values.time
            }
          });

          await loadTeacherCabinet();
        }
      });
    }


    async function loadStudentData() {
      if (!state.studentProfile) return;
      const [materials, homework, slots, requests, packages, payments, lessonLogs, quizzes, quizQuestions, quizAttempts] = await Promise.all([
        supabaseClient.from('materials').select('*').or(`student_id.is.null,student_id.eq.${state.studentProfile.id}`).order('created_at', { ascending:false }),
        supabaseClient.from('homework').select('*').eq('student_id', state.studentProfile.id).order('deadline', { ascending:true }),
        supabaseClient.from('slots').select('*').eq('student_profile_id', state.studentProfile.id).order('date').order('time'),
        supabaseClient.from('lesson_requests').select('*').eq('student_id', state.studentProfile.id).order('created_at', { ascending:false }),
        supabaseClient.from('student_packages').select('*').eq('student_id', state.studentProfile.id).order('created_at', { ascending:false }),
        supabaseClient.from('payments').select('*').eq('student_id', state.studentProfile.id).order('created_at', { ascending:false }),
        supabaseClient.from('lesson_logs').select('*').eq('student_id', state.studentProfile.id).order('created_at', { ascending:false }),
        supabaseClient.from('quizzes').select('*').or(`student_id.is.null,student_id.eq.${state.studentProfile.id}`).eq('is_active', true).order('created_at', { ascending:false }),
        supabaseClient.from('quiz_questions').select('*').order('created_at'),
        supabaseClient.from('quiz_attempts').select('*').eq('student_id', state.studentProfile.id).order('created_at', { ascending:false })
      ]);
      state.materials = materials.data || [];
      state.homework = homework.data || [];
      state.slots = slots.data || [];
      state.requests = requests.data || [];
      state.packages = packages.data || [];
      state.payments = payments.data || [];
      state.lessonLogs = lessonLogs.data || [];
      state.quizzes = quizzes.data || [];
      state.quizQuestions = quizQuestions.data || [];
      state.quizAttempts = quizAttempts.data || [];
    }

    async function loadStudentCabinet() {
      if (!state.studentProfile) return setPage('login');
      await loadStudentData();
      renderStudentCabinet();
    }

    function renderStudentCabinet() {
      fillSelect('studentRequestSlot', state.slots || [], 'Не выбрано', s => `${fmtDate(s.date)} · ${s.time} · ${s.lesson_types?.title || 'занятие'}`);
      $('studentTitle').textContent = `Личный кабинет: ${state.studentProfile.name}`;
      const total = state.homework.length;
      const done = state.homework.filter(h => h.is_done).length;
      const percent = total ? Math.round(done / total * 100) : 0;
      $('studentProgressFill').style.width = percent + '%';
      $('studentProgressText').textContent = `${percent}% · ${done} / ${total}`;
      $('studentNextLessons').textContent = state.slots.length ? `${fmtDate(state.slots[0].date)} · ${state.slots[0].time}` : 'нет занятий';
      $('studentMaterialsCount').textContent = state.materials.length;
      const activePackages = state.packages.filter(p => p.status === 'active');
      const leftLessons = activePackages.reduce((sum, p) => sum + Math.max(0, Number(p.lessons_total || 0) - Number(p.lessons_used || 0)), 0);
      $('studentPackagesSummary').textContent = `${leftLessons} занятий осталось`;

      $('studentMaterials').innerHTML = state.materials.map(m => `
        <article class="learning-item">
          <div class="top"><strong>${esc(m.title)}</strong><span class="topic-chip">${esc(m.topics?.title) || 'Без темы'}</span></div>
          <p class="muted">${esc(m.description)}</p>
          ${m.file_url ? `<a class="btn small soft" href="${esc(m.file_url)}" target="_blank">Открыть материал</a>` : ''}
        </article>
      `).join('') || '<div class="empty">Материалов пока нет</div>';

      $('studentHomework').innerHTML = state.homework.map(h => `
        <article class="learning-item">
          <div class="top"><strong>${esc(h.title)}</strong><span class="status ${h.is_done ? 'done' : 'pending'}">${h.is_done ? 'выполнено' : 'в работе'}</span></div>
          <p class="muted">${esc(h.topics?.title)} · срок: ${esc(h.deadline) || '—'}</p>
          <p>${esc(h.description)}</p>
          ${h.file_url ? `<a class="btn small soft" href="${esc(h.file_url)}" target="_blank">Открыть файл задания</a>` : ''}
          <div class="field"><label>Ответ ученика</label><textarea data-answer="${h.id}">${esc(h.answer_text)}</textarea></div>
          <div class="field"><label>Файл с выполненным ДЗ</label><input type="file" data-answer-file="${h.id}"></div>
          ${h.answer_file_url ? `<a class="btn small soft" href="${esc(h.answer_file_url)}" target="_blank">Открыть отправленный файл</a>` : ''}
          ${h.grade_percent !== null && h.grade_percent !== undefined ? `<div class="homework-grade"><strong>Результат проверки: ${Number(h.grade_percent)}%</strong><div class="grade-bar"><span style="width:${Number(h.grade_percent)}%"></span></div>${h.teacher_comment ? `<p>Комментарий: ${esc(h.teacher_comment)}</p>` : ''}</div>` : ''}
          <div class="row-actions">
            <button class="btn small" onclick="submitHomework('${h.id}', true)">Сдать ДЗ</button>
            <button class="btn small soft" onclick="submitHomework('${h.id}', false)">Сохранить ответ</button>
          </div>
          ${h.teacher_comment ? `<div class="success">Комментарий: ${esc(h.teacher_comment)}</div>` : ''}
        </article>
      `).join('') || '<div class="empty">ДЗ пока нет</div>';

      $('studentSlots').innerHTML = state.slots.map(s => `
        <article class="slot-card ${humanStatus(s.status)}">
          <strong>${fmtDate(s.date)} · ${esc(s.time)}</strong>
          <span class="status ${humanStatus(s.status)}">${humanStatus(s.status)} · ${esc(s.duration)} мин</span>
          <p class="muted">${esc(s.lesson_types?.title) || 'Занятие'} · ${Number(s.price || s.lesson_types?.price || 0).toLocaleString('ru-RU')} ₽</p>
          <div class="row-actions">
            <button class="btn small soft" onclick="prepareTransferRequest('${s.id}')">Запросить перенос</button>
            <button class="btn small soft" onclick="downloadIcsForSlot('${s.id}')">Apple/Google .ics</button>
            <button class="btn small soft" onclick="openGoogleCalendarForSlot('${s.id}')">Google Calendar</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Ваших занятий пока нет</div>';

      renderStudentHomeworkReminders();

      $('studentRequests').innerHTML = state.requests.map(r => `
        <article class="learning-item"><div class="top"><strong>${esc(r.type)}</strong><span class="status ${humanStatus(r.status)}">${humanStatus(r.status)}</span></div><p>${esc(r.message)}</p></article>
      `).join('') || '<div class="empty">Запросов пока нет</div>';

      $('studentLessonLogs').innerHTML = state.lessonLogs.map(log => `
        <article class="learning-item lesson-log">
          <div class="top"><strong>${esc(log.topic_title)}</strong><span class="topic-chip">${esc(log.lesson_types?.title) || 'занятие'}</span></div>
          <p>${esc(log.summary)}</p>
          ${log.next_steps ? `<p class="muted">Повторить: ${esc(log.next_steps)}</p>` : ''}
          ${log.comment ? `<div class="success">Комментарий: ${esc(log.comment)}</div>` : ''}
        </article>
      `).join('') || '<div class="empty">Записей журнала пока нет</div>';
    }


    $('refreshLogsBtn')?.addEventListener('click', loadTeacherCabinet);

    $('addLessonLogForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const slot = state.slots.find(s => s.id === $('logSlotSelect').value);
      const lessonTypeId = slot?.lesson_type_id || null;

      const { error } = await supabaseClient.from('lesson_logs').insert({
        slot_id: $('logSlotSelect').value || null,
        student_id: $('logStudentSelect').value,
        lesson_type_id: lessonTypeId,
        topic_title: $('logTopicTitle').value.trim(),
        summary: $('logSummary').value.trim(),
        next_steps: $('logNextSteps').value.trim(),
        comment: $('logComment').value.trim()
      });

      if (error) return toast('Не удалось добавить запись: ' + error.message, 'error');

      if (slot && slot.status !== 'completed') {
        await supabaseClient.from('slots').update({ status: 'completed' }).eq('id', slot.id);
      }

      e.target.reset();
      toast('Запись в журнал добавлена', 'success');
      await loadTeacherCabinet();
    });


    $('refreshStudentBtn')?.addEventListener('click', loadStudentCabinet);

    window.submitHomework = async function(id, done) {
      const textarea = document.querySelector(`[data-answer="${id}"]`);
      const fileInput = document.querySelector(`[data-answer-file="${id}"]`);
      const payload = { answer_text: textarea.value.trim(), is_done: done };
      try {
        if (fileInput && fileInput.files[0]) payload.answer_file_url = await uploadFileToStorage(fileInput.files[0], 'answers');
      } catch (err) {
        return toast('Не удалось загрузить файл ответа: ' + err.message, 'error');
      }
      const { error } = await supabaseClient.from('homework').update(payload).eq('id', id);
      if (error) return alert(error.message);
      await loadStudentCabinet();
    }

    
    function slotCalendarTitle(slot) {
      return `${slot.lesson_types?.title || 'Занятие'} с Ильёй Юдиным`;
    }

    function slotDateTimeLocal(slot, end = false) {
      const start = new Date(`${slot.date}T${slot.time || '00:00'}`);
      if (end) start.setMinutes(start.getMinutes() + Number(slot.duration || 60));
      return start;
    }

    function googleDateFormat(date) {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    window.openGoogleCalendarForSlot = function(slotId) {
      const slot = state.slots.find(s => s.id === slotId);
      if (!slot) return;
      const start = slotDateTimeLocal(slot);
      const end = slotDateTimeLocal(slot, true);
      const url = new URL('https://calendar.google.com/calendar/render');
      url.searchParams.set('action', 'TEMPLATE');
      url.searchParams.set('text', slotCalendarTitle(slot));
      url.searchParams.set('dates', `${googleDateFormat(start)}/${googleDateFormat(end)}`);
      url.searchParams.set('details', 'Занятие с Ильёй Юдиным. Материалы и ДЗ доступны в личном кабинете.');
      window.open(url.toString(), '_blank');
    }

    window.downloadIcsForSlot = function(slotId) {
      const slot = state.slots.find(s => s.id === slotId);
      if (!slot) return;
      const start = googleDateFormat(slotDateTimeLocal(slot));
      const end = googleDateFormat(slotDateTimeLocal(slot, true));
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Ilya Yudin Lessons//RU',
        'BEGIN:VEVENT',
        `UID:${slot.id}@ilya-yudin`,
        `DTSTAMP:${googleDateFormat(new Date())}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${slotCalendarTitle(slot)}`,
        'DESCRIPTION:Занятие с Ильёй Юдиным. Материалы и ДЗ доступны в личном кабинете.',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\\r\\n');
      const blob = new Blob([ics], { type:'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `lesson-${slot.date}-${slot.time}.ics`;
      a.click();
      URL.revokeObjectURL(a.href);
    }


    window.prepareTransferRequest = function(slotId) {
      $('studentRequestType').value = 'transfer';
      $('studentRequestSlot').value = slotId;
      $('studentRequestMessage').value = 'Хочу перенести это занятие. Предлагаемые дата и время указаны выше.';
      setPage('studentCabinet');
      setTimeout(() => $('studentRequestNewDate')?.focus(), 100);
    }

    $('studentRequestForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.studentProfile) return;

      const payload = {
        student_id: state.studentProfile.id,
        type: $('studentRequestType').value,
        slot_id: $('studentRequestSlot').value || null,
        requested_date: $('studentRequestNewDate').value || null,
        requested_time: $('studentRequestNewTime').value || null,
        message: $('studentRequestMessage').value.trim(),
        status: 'pending'
      };

      const { error } = await supabaseClient.from('lesson_requests').insert(payload);
      if (error) return toast(error.message, 'error');

      await supabaseClient.from('notification_events').insert({
        type: 'student_request_created',
        channel: 'email',
        status: 'pending',
        payload: {
          to: state.siteSettings?.notification_email || 'bkmz.lby@mail.ru',
          student: state.studentProfile.name,
          email: state.studentProfile.email,
          ...payload
        }
      });

      toast('Запрос отправлен преподавателю.', 'success');
      e.target.reset();
      await loadStudentCabinet();
    });

    async function loadIntegrations() {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      await loadTeacherData();
      fillSelect('emailStudentSelect', state.students, 'Выберите ученика', s => `${s.name} · ${s.email}`);
      const booked = state.slots.filter(s => s.status === 'booked');
      const sel = $('googleSlotSelect');
      sel.innerHTML = booked.map(s => `<option value="${s.id}">${fmtDate(s.date)} · ${s.time} · ${esc(s.student_profiles?.name || s.student_name)}</option>`).join('') || '<option value="">Нет занятых слотов</option>';
    }

    function downloadCsv(filename, rows) {
      const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }

    $('exportStudentsCsv')?.addEventListener('click', () => downloadCsv('students.csv', [['name','email','subject'], ...state.students.map(s => [s.name,s.email,s.subject])]));
    $('exportSlotsCsv')?.addEventListener('click', () => downloadCsv('slots.csv', [['date','time','duration','status','lesson_type','price','student'], ...state.slots.map(s => [s.date,s.time,s.duration,s.status,s.lesson_types?.title,s.price || s.lesson_types?.price,s.student_profiles?.name || s.student_name])]));
    $('exportHomeworkCsv')?.addEventListener('click', () => downloadCsv('homework.csv', [['student','topic','title','deadline','done'], ...state.homework.map(h => [h.student_profiles?.name,h.topics?.title,h.title,h.deadline,h.is_done])]));

    $('openGoogleCalendarBtn')?.addEventListener('click', () => {
      const slot = state.slots.find(s => s.id === $('googleSlotSelect').value);
      if (!slot) return alert('Выберите слот');
      const start = new Date(`${slot.date}T${slot.time}:00`);
      const end = new Date(start.getTime() + Number(slot.duration || 60) * 60000);
      const fmt = d => d.toISOString().replaceAll('-','').replaceAll(':','').split('.')[0] + 'Z';
      const text = encodeURIComponent('Занятие с учеником');
      const details = encodeURIComponent(`Ученик: ${slot.student_profiles?.name || slot.student_name || ''}\nКонтакт: ${slot.student_contact || ''}`);
      window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}`, '_blank');
    });

    window.emailStudent = function(email, template='homework') {
      const subjects = {
        homework: 'Напоминание о домашнем задании',
        lesson: 'Напоминание о занятии',
        payment: 'Напоминание об оплате занятий'
      };
      const body = encodeURIComponent('Здравствуйте! Напоминаю по занятиям. Если есть вопросы — напишите мне.');
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subjects[template] || subjects.homework)}&body=${body}`;
    }

    $('openMailBtn')?.addEventListener('click', () => {
      const s = state.students.find(x => x.id === $('emailStudentSelect').value);
      if (!s) return alert('Выберите ученика');
      emailStudent(s.email, $('emailTemplate').value);
    });


    async function loadLibrary() {
      const { data, error } = await supabaseClient.from('materials').select('*, topics(title, subject)').order('created_at', { ascending:false });
      const list = $('libraryList');
      if (error) { list.innerHTML = `<div class="empty">Ошибка загрузки: ${esc(error.message)}</div>`; return; }
      const q = ($('librarySearch').value || '').toLowerCase();
      const subject = $('librarySubjectFilter').value;
      const filtered = (data || []).filter(m => {
        const text = `${m.title || ''} ${m.description || ''} ${m.topics?.title || ''}`.toLowerCase();
        const subj = m.subject || m.topics?.subject || '';
        return (!q || text.includes(q)) && (!subject || subj === subject);
      });
      list.innerHTML = filtered.map(m => `
        <article class="learning-item">
          <div class="top"><strong>${esc(m.title)}</strong><span class="topic-chip">${esc(m.topics?.title || m.subject || 'материал')}</span></div>
          <p class="muted">${esc(m.description)}</p>
          ${m.file_url ? `<a class="btn small soft" href="${esc(m.file_url)}" target="_blank">Открыть</a>` : ''}
        </article>
      `).join('') || '<div class="empty">Материалы не найдены</div>';
    }
    $('librarySearch')?.addEventListener('input', loadLibrary);
    $('librarySubjectFilter')?.addEventListener('change', loadLibrary);

    async function loadQuizzesPage() {
      if (document.body.classList.contains('is-admin')) await loadTeacherData();
      else if (state.studentProfile) await loadStudentData();
      fillSelect('quizTopicSelect', state.topics || [], 'Без темы', t => t.title);
      fillSelect('quizStudentSelect', state.students || [], 'Для всех учеников', s => `${s.name} · ${s.email}`);
      renderQuizzes();
    }

    function renderQuizzes() {
      const list = $('quizzesList');
      list.innerHTML = (state.quizzes || []).map(q => {
        const questions = (state.quizQuestions || []).filter(x => x.quiz_id === q.id);
        const attempt = (state.quizAttempts || []).find(a => a.quiz_id === q.id);
        return `
          <article class="learning-item">
            <div class="top"><strong>${esc(q.title)}</strong><span class="topic-chip">${questions.length} вопросов</span></div>
            <p class="muted">${esc(q.topics?.title || '')} ${attempt ? '· результат: ' + attempt.score + '/' + attempt.max_score : ''}</p>
            <p>${esc(q.description)}</p>
            <div class="row-actions">
              <button class="btn small" onclick="startQuiz('${q.id}')">Пройти</button>
              ${document.body.classList.contains('is-admin') ? `<button class="btn small soft" onclick="addQuizQuestion('${q.id}')">Вопрос</button>` : ''}
            </div>
          </article>
        `;
      }).join('') || '<div class="empty">Тестов пока нет</div>';
    }

    $('refreshQuizzesBtn')?.addEventListener('click', loadQuizzesPage);
    $('addQuizForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('quizzes').insert({
        title: $('quizTitle').value.trim(),
        topic_id: $('quizTopicSelect').value || null,
        student_id: $('quizStudentSelect').value || null,
        description: $('quizDescription').value.trim(),
        is_active: true
      });
      if (error) return toast(error.message, 'error');
      e.target.reset();
      await logActivity('create_quiz', 'quizzes', null, { title: $('quizTitle').value });
      toast('Тест создан', 'success');
      await loadQuizzesPage();
    });

    window.addQuizQuestion = async function(quizId) {
      openEditModal({
        title: 'Добавить вопрос',
        fields: [
          { name:'question', label:'Вопрос', type:'textarea', value:'' },
          { name:'options', label:'Варианты через ;', value:'вариант 1; вариант 2; вариант 3' },
          { name:'correct_answer', label:'Правильный ответ', value:'' }
        ],
        onSave: async (values) => {
          const options = values.options.split(';').map(x => x.trim()).filter(Boolean);
          const { error } = await supabaseClient.from('quiz_questions').insert({
            quiz_id: quizId,
            question: values.question,
            options,
            correct_answer: values.correct_answer
          });
          if (error) throw error;
          await loadQuizzesPage();
        }
      });
    }

    window.startQuiz = function(quizId) {
      const quiz = state.quizzes.find(q => q.id === quizId);
      const questions = state.quizQuestions.filter(q => q.quiz_id === quizId);
      $('quizRunnerTitle').textContent = quiz?.title || 'Тест';
      if (!questions.length) {
        $('quizRunner').innerHTML = '<div class="empty">В тесте пока нет вопросов.</div>';
        return;
      }
      $('quizRunner').innerHTML = `
        <form class="form-grid" id="quizAttemptForm">
          ${questions.map((q, i) => `
            <div class="learning-item">
              <strong>${i + 1}. ${esc(q.question)}</strong>
              ${(q.options || []).map(opt => `
                <label class="homework-check"><input type="radio" name="q_${q.id}" value="${esc(opt)}" required> <span>${esc(opt)}</span></label>
              `).join('')}
            </div>
          `).join('')}
          <button class="btn" type="submit">Завершить тест</button>
        </form>
      `;
      $('quizAttemptForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let score = 0;
        const answers = {};
        questions.forEach(q => {
          const picked = document.querySelector(`[name="q_${q.id}"]:checked`)?.value || '';
          answers[q.id] = picked;
          if (picked.trim().toLowerCase() === String(q.correct_answer || '').trim().toLowerCase()) score++;
        });
        if (!state.studentProfile && !document.body.classList.contains('is-admin')) return toast('Войдите как ученик, чтобы сохранить результат', 'error');
        const { error } = await supabaseClient.from('quiz_attempts').insert({
          quiz_id: quizId,
          student_id: state.studentProfile?.id || null,
          answers,
          score,
          max_score: questions.length
        });
        if (error) return toast(error.message, 'error');
        toast(`Результат: ${score}/${questions.length}`, 'success');
        await loadQuizzesPage();
      });
    }

    async function loadAnalytics() {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      await loadTeacherData();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const revenue = state.payments
        .filter(p => p.status === 'paid' && new Date(p.created_at) >= monthStart)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      $('analyticsRevenue').textContent = revenue.toLocaleString('ru-RU') + ' ₽';
      $('analyticsCompleted').textContent = state.slots.filter(s => s.status === 'completed').length;
      $('analyticsStudents').textContent = state.students.filter(s => s.active !== false).length;
      $('analyticsHomework').textContent = state.homework.filter(h => !h.is_done).length;
      $('analyticsUpcoming').innerHTML = state.slots.filter(s => ['booked','confirmed','open'].includes(s.status)).slice(0, 8).map(s => `
        <article class="slot-card ${humanStatus(s.status)}"><strong>${fmtDate(s.date)} · ${esc(s.time)}</strong><span class="status ${humanStatus(s.status)}">${humanStatus(s.status)}</span><p class="muted">${esc(s.lesson_types?.title || '')}</p></article>
      `).join('') || '<div class="empty">Нет ближайших занятий</div>';
      $('analyticsPayments').innerHTML = state.payments.filter(p => p.status !== 'paid').map(p => `
        <article class="learning-item"><div class="top"><strong>${esc(p.student_profiles?.name)}</strong><span class="status ${esc(p.status)}">${esc(p.status)}</span></div><p>${Number(p.amount || 0).toLocaleString('ru-RU')} ₽</p></article>
      `).join('') || '<div class="empty">Нет ожидающих оплат</div>';
    }

    async function loadActivityLogPage() {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      const { data, error } = await supabaseClient.from('activity_log').select('*').order('created_at', { ascending:false }).limit(100);
      if (error) return $('activityLogList').innerHTML = `<div class="empty">${esc(error.message)}</div>`;
      $('activityLogList').innerHTML = (data || []).map(a => `
        <article class="learning-item">
          <div class="top"><strong>${esc(a.action)}</strong><span class="topic-chip">${esc(a.entity_type)}</span></div>
          <p class="muted">${new Date(a.created_at).toLocaleString('ru-RU')}</p>
          <pre style="white-space:pre-wrap;margin:0;">${esc(JSON.stringify(a.details || {}, null, 2))}</pre>
        </article>
      `).join('') || '<div class="empty">История пока пуста</div>';
    }
    $('refreshActivityBtn')?.addEventListener('click', loadActivityLogPage);

    async function loadParentCabinet() {
      if (!state.studentProfile) return setPage('login');
      await loadStudentData();
      const left = state.packages.reduce((sum, p) => sum + Math.max(0, Number(p.lessons_total || 0) - Number(p.lessons_used || 0)), 0);
      $('parentLessonsLeft').textContent = left;
      $('parentHomeworkPending').textContent = state.homework.filter(h => !h.is_done).length;
      $('parentNextLesson').textContent = state.slots[0] ? `${fmtDate(state.slots[0].date)} · ${state.slots[0].time}` : 'нет';
      $('parentPaymentsSummary').textContent = state.payments.filter(p => p.status === 'paid').reduce((s,p)=>s+Number(p.amount||0),0).toLocaleString('ru-RU') + ' ₽';
      $('parentLessonLogs').innerHTML = state.lessonLogs.map(log => `<article class="learning-item lesson-log"><strong>${esc(log.topic_title)}</strong><p>${esc(log.summary)}</p>${log.comment ? `<div class="success">${esc(log.comment)}</div>` : ''}</article>`).join('') || '<div class="empty">Записей нет</div>';
      $('parentHomeworkList').innerHTML = state.homework.map(h => `<article class="learning-item"><div class="top"><strong>${esc(h.title)}</strong><span class="status ${h.is_done ? 'done' : 'pending'}">${h.is_done ? 'выполнено' : 'в работе'}</span></div><p class="muted">${esc(h.deadline) || 'без срока'}</p></article>`).join('') || '<div class="empty">ДЗ нет</div>';
    }



    async function loadTodayPage() {
      if (document.body.classList.contains('is-admin')) {
        await loadTeacherData();
        renderTodayAdmin();
      } else if (state.studentProfile) {
        await loadStudentData();
        renderTodayStudent();
      } else {
        setPage('login');
      }
    }

    function isToday(dateStr) {
      return dateStr === new Date().toISOString().slice(0, 10);
    }

    function renderTodayAdmin() {
      const todaySlots = state.slots.filter(s => isToday(s.date));
      const pendingBookings = state.bookingRequests.filter(r => r.status === 'pending');
      const pendingHomework = state.homework.filter(h => !h.is_done);
      const pendingPayments = state.payments.filter(p => p.status !== 'paid');

      $('todayLessonsCount').textContent = todaySlots.length;
      $('todayRequestsCount').textContent = pendingBookings.length;
      $('todayHomeworkCount').textContent = pendingHomework.length;
      $('todayPaymentsCount').textContent = pendingPayments.length;

      $('todayLessons').innerHTML = todaySlots.map(s => `
        <article class="learning-item">
          <div class="top"><strong>${esc(s.time)} · ${esc(s.lesson_types?.title || 'Занятие')}</strong><span class="status ${humanStatus(s.status)}">${humanStatus(s.status)}</span></div>
          <p class="muted">${esc(s.student_profiles?.name || s.student_name) || 'без ученика'}</p>
          <div class="row-actions">
            <button class="btn small green" onclick="setSlotStatus('${s.id}','completed')">Проведено</button>
            <button class="btn small red" onclick="setSlotStatus('${s.id}','cancelled')">Отменить</button>
          </div>
        </article>
      `).join('') || '<div class="empty">Сегодня занятий нет</div>';

      $('todayAttention').innerHTML = [
        ...pendingBookings.slice(0, 5).map(r => `<article class="learning-item"><strong>Заявка: ${esc(r.name)}</strong><p class="muted">${esc(r.contact)}</p><button class="btn small green" onclick="approveBookingRequest('${r.id}')">Подтвердить</button></article>`),
        ...pendingHomework.slice(0, 5).map(h => `<article class="learning-item"><strong>ДЗ не сдано: ${esc(h.title)}</strong><p class="muted">${esc(h.student_profiles?.name)}</p></article>`),
        ...pendingPayments.slice(0, 5).map(p => `<article class="learning-item"><strong>Оплата: ${esc(p.student_profiles?.name)}</strong><p class="muted">${Number(p.amount || 0).toLocaleString('ru-RU')} ₽ · ${esc(p.status)}</p></article>`)
      ].join('') || '<div class="empty">Срочных задач нет</div>';
    }

    function renderTodayStudent() {
      const todaySlots = state.slots.filter(s => isToday(s.date));
      const pendingHomework = state.homework.filter(h => !h.is_done);
      const left = state.packages.reduce((sum, p) => sum + Math.max(0, Number(p.lessons_total || 0) - Number(p.lessons_used || 0)), 0);

      $('todayLessonsCount').textContent = todaySlots.length;
      $('todayRequestsCount').textContent = state.requests.filter(r => r.status === 'pending').length;
      $('todayHomeworkCount').textContent = pendingHomework.length;
      $('todayPaymentsCount').textContent = `${left} занятий`;

      $('todayLessons').innerHTML = todaySlots.map(s => `
        <article class="learning-item"><div class="top"><strong>${esc(s.time)} · ${esc(s.lesson_types?.title || 'Занятие')}</strong><span class="status ${humanStatus(s.status)}">${humanStatus(s.status)}</span></div></article>
      `).join('') || '<div class="empty">Сегодня занятий нет</div>';

      $('todayAttention').innerHTML = pendingHomework.slice(0, 8).map(h => `
        <article class="learning-item"><strong>${esc(h.title)}</strong><p class="muted">Срок: ${esc(h.deadline) || 'без срока'}</p></article>
      `).join('') || '<div class="empty">Нет срочных ДЗ</div>';
    }

    async function loadSettingsPage() {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      await loadSiteSettings();
      const s = state.siteSettings || {};
      $('settingTeacherName').value = s.teacher_name || '';
      $('settingHeroTitle').value = s.hero_title || '';
      $('settingHeroText').value = s.hero_text || '';
      $('settingPhone').value = s.phone || '';
      $('settingEmail').value = s.email || '';
      $('settingTelegram').value = s.telegram || '';
      $('settingWhatsapp').value = s.whatsapp || '';
      $('settingPaymentUrl').value = s.payment_url || '';
      $('settingProfiUrl').value = s.profi_url || '';
      $('settingProfiAchievements').value = s.profi_achievements || '';
      $('settingNotificationEmail').value = s.notification_email || 'bkmz.lby@mail.ru';
      renderSettingsPreview();
    }

    function renderSettingsPreview() {
      const s = state.siteSettings || {};
      $('settingsPreview').innerHTML = Object.keys(s).length
        ? Object.entries(s).map(([k,v]) => `<article class="learning-item"><strong>${esc(k)}</strong><p class="muted">${esc(v)}</p></article>`).join('')
        : '<div class="empty">Настройки пока не заполнены</div>';
    }

    $('siteSettingsForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rows = [
        ['teacher_name', $('settingTeacherName').value.trim()],
        ['hero_title', $('settingHeroTitle').value.trim()],
        ['hero_text', $('settingHeroText').value.trim()],
        ['phone', $('settingPhone').value.trim()],
        ['email', $('settingEmail').value.trim()],
        ['telegram', $('settingTelegram').value.trim()],
        ['whatsapp', $('settingWhatsapp').value.trim()],
        ['payment_url', $('settingPaymentUrl').value.trim()],
        ['profi_url', $('settingProfiUrl').value.trim()],
        ['profi_achievements', $('settingProfiAchievements').value.trim()],
        ['notification_email', $('settingNotificationEmail').value.trim() || 'bkmz.lby@mail.ru']
      ].map(([key, value]) => ({ key, value, is_public: true }));

      const { error } = await supabaseClient.from('site_settings').upsert(rows, { onConflict: 'key' });
      if (error) return toast(error.message, 'error');
      await logActivity('update_site_settings', 'site_settings', null, {});
      toast('Настройки сохранены', 'success');
      await loadSettingsPage();
    });


    // Экспортируем ключевые функции для позднего патча и inline-кнопок.
    window.toast = toast;
    window.setPage = setPage;
    window.loadTeacherData = loadTeacherData;
    window.loadTeacherCabinet = loadTeacherCabinet;
    window.loadPublicSlots = loadPublicSlots;

    initAuth();
    loadSiteSettings();
    loadPublicSlots();
    loadPublicReviews();
    enhanceCabinetLayout();
    setLanguage(currentLang);
    prepareCabinetBranchBehavior();
  
/* ===== PLATFORM PATCH v6: Yandex materials + faster teacher CRM + no Google binding ===== */
(function(){
  if (window.__platformPatchV6Ready) return;
  window.__platformPatchV6Ready = true;

  const $id = (id) => document.getElementById(id);
  const esc2 = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmtMoney = (v) => Number(v || 0).toLocaleString('ru-RU') + ' ₽';
  const todayIso = () => new Date().toISOString().slice(0,10);
  const isAdmin = () => document.body.classList.contains('is-admin');

  let teacherDataLoading = null;
  let teacherDataLoadedAt = 0;
  const DATA_TTL = 4500;
  const debounce = (fn, ms=180) => { let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

  function toast2(msg, type='success') {
    if (typeof window.toast === 'function') window.toast(msg, type);
    else alert(msg);
  }

  async function ensureTeacherData(force=false) {
    if (!isAdmin()) return;
    const fresh = Date.now() - teacherDataLoadedAt < DATA_TTL;
    if (!force && fresh && window.state?.students) return;
    if (teacherDataLoading && !force) return teacherDataLoading;
    const loader = window.loadTeacherData || window.loadTeacherCabinet;
    if (!loader) return;
    teacherDataLoading = Promise.resolve(loader()).catch(e => {
      console.warn('teacher data load skipped', e);
      toast2('Часть данных не загрузилась: ' + (e.message || e), 'error');
    }).finally(() => { teacherDataLoadedAt = Date.now(); teacherDataLoading = null; });
    return teacherDataLoading;
  }

  async function logPlatformAction(action, payload={}) {
    if (!window.supabaseClient) return;
    try {
      await supabaseClient.from('activity_log').insert({ action, entity_type:'platform', details:payload });
    } catch (e) { console.warn('activity_log skipped', e); }
  }

  async function safeRefresh(page) {
    teacherDataLoadedAt = 0;
    await ensureTeacherData(true);
    if (page) await renderTeacherPage(page);
  }

  function teacherMount(page) { return $id(page + 'Mount'); }
  function yandexBtn(url, label='Открыть Яндекс-папку') {
    if (!url) return '';
    return `<a class="btn small soft" target="_blank" rel="noopener" href="${esc2(url)}"><i class="fa-solid fa-folder-open"></i> ${esc2(label)}</a>`;
  }

  window.renderTeacherStudentsFunctional = async function() {
    await ensureTeacherData();
    const mount = teacherMount('teacherStudents');
    if (!mount) return;
    const students = window.state?.students || [];
    mount.innerHTML = `
      <div class="teacher-tool-grid">
        <div class="panel">
          <h3>Добавить ученика</h3>
          <form class="form-grid" id="cloudAddStudentForm">
            <div class="field"><label>Имя ученика</label><input id="cloudStudentName" required></div>
            <div class="field"><label>Email</label><input id="cloudStudentEmail" type="email" required></div>
            <div class="field"><label>Курс / предмет</label><input id="cloudStudentCourse" placeholder="Математика, 8 класс"></div>
            <div class="field"><label>Telegram</label><input id="cloudStudentTelegram" placeholder="@username"></div>
            <div class="field"><label>Личная Яндекс-папка</label><input id="cloudStudentYandexFolder" placeholder="https://disk.yandex.ru/..."></div>
            <button class="btn" type="submit">Сохранить ученика</button>
          </form>
        </div>
        <div class="panel">
          <div class="top-actions"><h3>Ученики <span class="cloud-sync-pill">Supabase</span></h3><button class="btn small soft" id="cloudRefreshStudents">Обновить</button></div>
          <div class="search-row"><input id="cloudStudentSearch" placeholder="Поиск по имени, email, предмету"><select id="cloudStudentSubject"><option value="">Все предметы</option><option>Математика</option><option>Физика</option><option>Химия</option></select></div>
          <div class="item-list" id="cloudStudentsList"></div>
        </div>
      </div>`;
    const renderList = () => {
      const q = ($id('cloudStudentSearch')?.value || '').toLowerCase();
      const subj = $id('cloudStudentSubject')?.value || '';
      const filtered = students.filter(s => {
        const hay = `${s.name||''} ${s.email||''} ${s.subject||''}`.toLowerCase();
        return (!q || hay.includes(q)) && (!subj || String(s.subject||'').includes(subj));
      });
      $id('cloudStudentsList').innerHTML = filtered.map(s => `
        <article class="learning-item">
          <div class="top"><strong>${esc2(s.name)}</strong><span class="topic-chip">${esc2(s.subject || 'курс не указан')}</span></div>
          <p class="muted">${esc2(s.email || '')}${s.telegram ? ' · ' + esc2(s.telegram) : ''}</p>
          ${s.yandex_folder_url ? `<p class="muted">Материалы: Яндекс.Диск</p>${yandexBtn(s.yandex_folder_url)}` : '<p class="muted">Яндекс-папка не указана</p>'}
          <div class="row-actions">
            <button class="btn small soft" data-cloud-edit-student="${s.id}">Изменить</button>
            <button class="btn small red" data-cloud-delete-student="${s.id}">Удалить</button>
          </div>
        </article>`).join('') || '<div class="empty">Пока нет учеников</div>';
    };
    renderList();
    $id('cloudStudentSearch')?.addEventListener('input', debounce(renderList));
    $id('cloudStudentSubject')?.addEventListener('change', renderList);
    $id('cloudRefreshStudents')?.addEventListener('click', () => safeRefresh('teacherStudents'));
  };

  window.renderTeacherMaterialsFunctional = async function() {
    await ensureTeacherData();
    const mount = teacherMount('teacherMaterials');
    if (!mount) return;
    const topics = window.state?.topics || [];
    const materials = window.state?.materials || [];
    const students = window.state?.students || [];
    mount.innerHTML = `
      <div class="teacher-tool-grid">
        <div class="panel">
          <h3>Создать тему</h3>
          <form class="form-grid" id="cloudAddTopicForm">
            <div class="field"><label>Название темы</label><input id="cloudTopicTitle" required></div>
            <div class="field"><label>Предмет</label><input id="cloudTopicSubject" placeholder="Математика"></div>
            <div class="field"><label>Описание</label><textarea id="cloudTopicDescription"></textarea></div>
            <button class="btn" type="submit">Сохранить тему</button>
          </form>
        </div>
        <div class="panel">
          <h3>Добавить материал / ссылку</h3>
          <form class="form-grid" id="cloudAddMaterialForm">
            <div class="field"><label>Название</label><input id="cloudMaterialTitle" required placeholder="Конспект по квадратным уравнениям"></div>
            <div class="field"><label>Тема</label><select id="cloudMaterialTopic"><option value="">Без темы</option>${topics.map(t=>`<option value="${t.id}">${esc2(t.title)}</option>`).join('')}</select></div>
            <div class="field"><label>Ученик</label><select id="cloudMaterialStudent"><option value="">Всем</option>${students.map(s=>`<option value="${s.id}">${esc2(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Ссылка на файл / папку Яндекс.Диска</label><input id="cloudMaterialUrl" placeholder="https://disk.yandex.ru/..."></div>
            <div class="field"><label>Описание</label><textarea id="cloudMaterialDescription"></textarea></div>
            <button class="btn" type="submit">Сохранить материал</button>
          </form>
        </div>
        <div class="panel teacher-tool-full">
          <h3>Материалы</h3>
          <div class="item-list">${materials.map(m=>`
            <article class="learning-item">
              <div class="top"><strong>${esc2(m.title)}</strong><span class="topic-chip">${esc2(m.topics?.title || 'материал')}</span></div>
              <p class="muted">${m.student_profiles?.name ? 'Для: ' + esc2(m.student_profiles.name) : 'Для всех учеников'}</p>
              <p>${esc2(m.description || '')}</p>
              ${m.file_url || m.url ? `<a class="btn small soft" target="_blank" rel="noopener" href="${esc2(m.file_url || m.url)}">Открыть материал</a>` : ''}
            </article>`).join('') || '<div class="empty">Материалов пока нет</div>'}</div>
        </div>
      </div>`;
  };

  window.renderTeacherHomeworkFunctional = async function(reviewOnly=false) {
    await ensureTeacherData();
    const page = reviewOnly ? 'teacherHomeworkReview' : 'teacherHomework';
    const mount = teacherMount(page);
    if (!mount) return;
    const hw = window.state?.homework || [];
    const topics = window.state?.topics || [];
    const students = window.state?.students || [];
    const filtered = reviewOnly ? hw.filter(h => h.is_done || h.answer_text || h.answer_file_url) : hw;
    mount.innerHTML = `
      <div class="teacher-tool-grid">
        ${reviewOnly ? '' : `<div class="panel"><h3>Выдать ДЗ</h3><form class="form-grid" id="cloudAddHomeworkForm">
          <div class="field"><label>Ученик</label><select id="cloudHomeworkStudent" required>${students.map(s=>`<option value="${s.id}">${esc2(s.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Тема</label><select id="cloudHomeworkTopic"><option value="">Без темы</option>${topics.map(t=>`<option value="${t.id}">${esc2(t.title)}</option>`).join('')}</select></div>
          <div class="field"><label>Название</label><input id="cloudHomeworkTitle" required></div>
          <div class="field"><label>Описание</label><textarea id="cloudHomeworkDescription"></textarea></div>
          <div class="field"><label>Дедлайн</label><input id="cloudHomeworkDeadline" type="date"></div>
          <button class="btn" type="submit">Выдать ДЗ</button>
        </form></div>`}
        <div class="panel ${reviewOnly ? 'teacher-tool-full' : ''}"><h3>${reviewOnly ? 'Присланные работы' : 'Домашние задания'}</h3><div class="item-list">${filtered.map(h=>`
          <article class="learning-item">
            <div class="top"><strong>${esc2(h.title)}</strong><span class="status ${h.grade_percent != null ? 'done' : (h.is_done ? 'pending' : 'open')}">${h.grade_percent != null ? 'проверено' : (h.is_done ? 'сдано' : 'в работе')}</span></div>
            <p class="muted">${esc2(h.student_profiles?.name || '')} · срок: ${esc2(h.deadline || 'без срока')}</p>
            ${h.answer_text ? `<p><strong>Ответ:</strong> ${esc2(h.answer_text)}</p>` : ''}
            ${h.answer_file_url ? `<a class="btn small soft" target="_blank" href="${esc2(h.answer_file_url)}">Файл ученика</a>` : ''}
            ${h.grade_percent != null ? `<p><strong>Оценка:</strong> ${Number(h.grade_percent)}%</p><p>${esc2(h.teacher_comment || '')}</p>` : ''}
            <div class="row-actions"><button class="btn small" data-cloud-grade-homework="${h.id}">Оценить</button><button class="btn small soft" data-cloud-remind-homework="${h.id}">Напомнить</button></div>
          </article>`).join('') || '<div class="empty">Пока пусто</div>'}</div></div>
      </div>`;
  };

  let slotWeekStart = null;
  function getMondaySafe(d) { const date = new Date(d); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); date.setHours(0,0,0,0); return date; }
  function addDaysSafe(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
  function isoSafe(d) { return new Date(d).toISOString().slice(0,10); }

  window.renderTeacherScheduleFunctional = async function() {
    await ensureTeacherData();
    const mount = teacherMount('teacherSchedule');
    if (!mount) return;
    if (!slotWeekStart) slotWeekStart = getMondaySafe(new Date());
    const lessonTypes = (window.state?.lessonTypes || []).filter(x => x.is_active !== false);
    const slots = window.state?.slots || [];
    const days = Array.from({length:7}, (_,i)=>addDaysSafe(slotWeekStart,i));
    const times = [...new Set(['10:00','12:00','15:00','16:30','18:00','19:30', ...slots.map(s=>s.time).filter(Boolean)])].sort();
    const grid = [`<div class="slot-editor-cell slot-editor-head">Время</div>`];
    days.forEach(d => grid.push(`<div class="slot-editor-cell slot-editor-head">${d.toLocaleDateString('ru-RU',{weekday:'short', day:'2-digit', month:'2-digit'})}</div>`));
    times.forEach(time => {
      grid.push(`<div class="slot-editor-cell slot-editor-time">${time}</div>`);
      days.forEach(day => {
        const date = isoSafe(day);
        const cellSlots = slots.filter(s => s.date === date && s.time === time);
        grid.push(`<div class="slot-editor-cell" data-cloud-add-slot-date="${date}" data-cloud-add-slot-time="${time}">${cellSlots.map(s=>`
          <div class="slot-editor-chip ${esc2(s.status)}"><span>${esc2(s.lesson_types?.title || 'Слот')}</span><span>${esc2(typeof humanStatus === 'function' ? humanStatus(s.status) : s.status)} · ${fmtMoney(s.price || s.lesson_types?.price)}</span><div class="row-actions" style="margin-top:4px"><button class="btn small green" data-cloud-slot-complete="${s.id}">✓</button><button class="btn small soft" data-cloud-slot-edit="${s.id}">↔</button><button class="btn small red" data-cloud-slot-delete="${s.id}">×</button></div></div>`).join('') || '<span class="calendar-add-hint">+ добавить слот</span>'}</div>`);
      });
    });
    mount.innerHTML = `<div class="panel"><div class="top-actions"><h3>Календарь слотов <span class="cloud-sync-pill">Supabase</span></h3><div class="row-actions" style="margin-top:0"><button class="btn small soft" id="cloudSlotPrev">← Неделя</button><button class="btn small soft" id="cloudSlotToday">Сегодня</button><button class="btn small soft" id="cloudSlotNext">Неделя →</button></div></div><div class="notice" style="margin-bottom:12px">Клик по пустой ячейке добавляет слот. Кнопки внутри слота удаляют, переносят или отмечают занятие проведённым.</div><div class="slot-editor-calendar">${grid.join('')}</div></div>
      <div class="panel"><h3>Быстрое создание слота</h3><form class="form-grid" id="cloudManualSlotForm"><div class="grid-2"><div class="field"><label>Дата</label><input id="cloudSlotDate" type="date" value="${todayIso()}" required></div><div class="field"><label>Время</label><input id="cloudSlotTime" type="time" value="16:00" required></div></div><div class="field"><label>Тип занятия</label><select id="cloudSlotLessonType"><option value="">Без типа</option>${lessonTypes.map(lt=>`<option value="${lt.id}">${esc2(lt.title)} · ${fmtMoney(lt.price)}</option>`).join('')}</select></div><div class="grid-2"><div class="field"><label>Длительность</label><input id="cloudSlotDuration" type="number" value="60"></div><div class="field"><label>Цена</label><input id="cloudSlotPrice" type="number" value="2000"></div></div><button class="btn" type="submit">Добавить слот</button></form></div>`;
    $id('cloudSlotPrev')?.addEventListener('click', () => { slotWeekStart = addDaysSafe(slotWeekStart, -7); renderTeacherScheduleFunctional(); });
    $id('cloudSlotToday')?.addEventListener('click', () => { slotWeekStart = getMondaySafe(new Date()); renderTeacherScheduleFunctional(); });
    $id('cloudSlotNext')?.addEventListener('click', () => { slotWeekStart = addDaysSafe(slotWeekStart, 7); renderTeacherScheduleFunctional(); });
  };

  window.renderTeacherBookingsFunctional = async function() {
    await ensureTeacherData();
    const mount = teacherMount('teacherBookings');
    if (!mount) return;
    const requests = window.state?.bookingRequests || [];
    mount.innerHTML = `<div class="panel"><h3>Заявки на занятия <span class="cloud-sync-pill">Supabase</span></h3><div class="item-list">${requests.map(r=>`
      <article class="learning-item"><div class="top"><strong>${esc2(r.name || r.student_profiles?.name || 'Заявка')}</strong><span class="status ${esc2(r.status)}">${typeof humanStatus === 'function' ? humanStatus(r.status) : r.status}</span></div><p class="muted">${esc2(r.contact || r.email || '')}</p><p>${esc2(r.direction || '')} ${r.format ? '· ' + esc2(r.format) : ''}</p><div class="row-actions"><button class="btn small green" data-cloud-approve-booking="${r.id}">Подтвердить</button><button class="btn small red" data-cloud-reject-booking="${r.id}">Отклонить</button></div></article>`).join('') || '<div class="empty">Заявок пока нет</div>'}</div></div>`;
  };

  window.renderTeacherFinanceFunctional = async function(paymentsOnly=false) {
    await ensureTeacherData();
    const page = paymentsOnly ? 'teacherPayments' : 'teacherFinance';
    const mount = teacherMount(page);
    if (!mount) return;
    const lessonTypes = window.state?.lessonTypes || [];
    const subscriptions = window.state?.subscriptions || [];
    const students = window.state?.students || [];
    const payments = window.state?.payments || [];
    mount.innerHTML = `<div class="teacher-tool-grid">${paymentsOnly ? '' : `<div class="panel"><h3>Тип занятия</h3><form class="form-grid" id="cloudAddLessonTypeForm"><div class="field"><label>Название</label><input id="cloudLessonTypeTitle" required></div><div class="field"><label>Предмет</label><input id="cloudLessonTypeSubject" placeholder="Математика"></div><div class="grid-2"><div class="field"><label>Длительность</label><input id="cloudLessonTypeDuration" type="number" value="60"></div><div class="field"><label>Цена</label><input id="cloudLessonTypePrice" type="number" value="2000"></div></div><button class="btn" type="submit">Сохранить тип</button></form></div><div class="panel"><h3>Абонементы</h3><div class="item-list">${subscriptions.map(s=>`<article class="learning-item"><strong>${esc2(s.title)}</strong><p>${s.lessons_count || 0} занятий · скидка ${s.discount_percent || 0}%</p></article>`).join('') || '<div class="empty">Абонементов пока нет</div>'}</div></div>`}<div class="panel teacher-tool-full"><h3>Добавить оплату</h3><form class="form-grid" id="cloudAddPaymentForm"><div class="field"><label>Ученик</label><select id="cloudPaymentStudent"><option value="">Без ученика</option>${students.map(s=>`<option value="${s.id}">${esc2(s.name)}</option>`).join('')}</select></div><div class="grid-2"><div class="field"><label>Сумма</label><input id="cloudPaymentAmount" type="number" value="2000"></div><div class="field"><label>Статус</label><select id="cloudPaymentStatus"><option value="paid">Оплачено</option><option value="pending">Ожидает</option><option value="cancelled">Отменено</option></select></div></div><div class="field"><label>Комментарий</label><input id="cloudPaymentComment"></div><button class="btn" type="submit">Сохранить оплату</button></form></div><div class="panel teacher-tool-full"><h3>Оплаты</h3><div class="item-list">${payments.map(p=>`<article class="learning-item"><div class="top"><strong>${fmtMoney(p.amount)}</strong><span class="status ${esc2(p.status)}">${esc2(typeof humanStatus === 'function' ? humanStatus(p.status) : p.status)}</span></div><p class="muted">${esc2(p.student_profiles?.name || '')}</p><p>${esc2(p.notes || '')}</p></article>`).join('') || '<div class="empty">Оплат пока нет</div>'}</div></div></div>`;
  };

  window.renderTeacherContentFunctional = async function() {
    await ensureTeacherData();
    const mount = teacherMount('teacherContent');
    if (!mount) return;
    const reviews = window.state?.reviews || [];
    const cases = window.state?.cases || [];
    const examples = window.state?.examples || [];
    mount.innerHTML = `<div class="teacher-tool-grid">
      <div class="panel"><h3>Добавить отзыв</h3><form class="form-grid" id="cloudAddReviewForm"><div class="field"><label>Автор</label><input id="cloudReviewAuthor" required></div><div class="field"><label>Оценка</label><input id="cloudReviewRating" type="number" min="1" max="5" value="5"></div><div class="field"><label>Текст</label><textarea id="cloudReviewText" required></textarea></div><div class="field"><label>Подтверждающая ссылка</label><input id="cloudReviewProofUrl"></div><button class="btn" type="submit">Сохранить отзыв</button></form></div>
      <div class="panel"><h3>Добавить кейс</h3><form class="form-grid" id="cloudAddCaseForm"><div class="field"><label>Заголовок</label><input id="cloudCaseTitle" required></div><div class="field"><label>Предмет / класс</label><input id="cloudCaseSubject"></div><div class="field"><label>Было</label><textarea id="cloudCaseBefore"></textarea></div><div class="field"><label>Что сделали</label><textarea id="cloudCaseProcess"></textarea></div><div class="field"><label>Результат</label><textarea id="cloudCaseResult" required></textarea></div><button class="btn" type="submit">Сохранить кейс</button></form></div>
      <div class="panel"><h3>Добавить пример материала</h3><form class="form-grid" id="cloudAddExampleForm"><div class="field"><label>Название</label><input id="cloudExampleTitle" required></div><div class="field"><label>Предмет</label><input id="cloudExampleSubject"></div><div class="field"><label>Тип</label><select id="cloudExampleType"><option>Конспект</option><option>Домашнее задание</option><option>Разбор задачи</option><option>Презентация</option></select></div><div class="field"><label>Ссылка на файл / Яндекс.Диск</label><input id="cloudExampleUrl"></div><div class="field"><label>Описание</label><textarea id="cloudExampleDescription"></textarea></div><button class="btn" type="submit">Сохранить пример</button></form></div>
      <div class="panel"><h3>Отзывы</h3><div class="item-list">${reviews.map(r=>`<article class="learning-item"><div class="top"><strong>${esc2(r.author)}</strong><span class="topic-chip">${'★'.repeat(Number(r.rating || 5))}</span></div><p>${esc2(r.text)}</p>${r.proof_url ? `<a class="btn small soft" target="_blank" href="${esc2(r.proof_url)}">Подтверждение</a>` : ''}<div class="row-actions"><button class="btn small red" data-cloud-delete-review="${r.id}">Удалить</button></div></article>`).join('') || '<div class="empty">Отзывов пока нет</div>'}</div></div>
      <div class="panel"><h3>Кейсы</h3><div class="item-list">${cases.map(c=>`<article class="learning-item"><strong>${esc2(c.title)}</strong><p class="muted">${esc2(c.subject || '')}</p><p>${esc2(c.result_text || '')}</p><div class="row-actions"><button class="btn small red" data-cloud-delete-case="${c.id}">Удалить</button></div></article>`).join('') || '<div class="empty">Кейсов пока нет</div>'}</div></div>
      <div class="panel"><h3>Примеры материалов</h3><div class="item-list">${examples.map(x=>`<article class="learning-item"><strong>${esc2(x.title)}</strong><p>${esc2(x.description || '')}</p>${x.file_url ? `<a class="btn small soft" target="_blank" href="${esc2(x.file_url)}">Открыть</a>` : ''}<div class="row-actions"><button class="btn small red" data-cloud-delete-example="${x.id}">Удалить</button></div></article>`).join('') || '<div class="empty">Примеров пока нет</div>'}</div></div>
    </div>`;
  };

  async function renderTeacherPage(page) {
    if (page === 'teacherStudents') return renderTeacherStudentsFunctional();
    if (page === 'teacherMaterials') return renderTeacherMaterialsFunctional();
    if (page === 'teacherHomework') return renderTeacherHomeworkFunctional(false);
    if (page === 'teacherHomeworkReview') return renderTeacherHomeworkFunctional(true);
    if (page === 'teacherSchedule') return renderTeacherScheduleFunctional();
    if (page === 'teacherBookings') return renderTeacherBookingsFunctional();
    if (page === 'teacherFinance') return renderTeacherFinanceFunctional(false);
    if (page === 'teacherPayments') return renderTeacherFinanceFunctional(true);
    if (page === 'teacherContent') return renderTeacherContentFunctional();
    if (page === 'integrations') return renderYandexIntegrationsPage();
  }
  window.renderTeacherPage = renderTeacherPage;

  async function renderYandexIntegrationsPage() {
    if (!isAdmin()) return;
    await ensureTeacherData();
    const students = window.state?.students || [];
    const sel = $id('yandexEmailStudentSelect');
    if (sel) sel.innerHTML = '<option value="">Выберите ученика</option>' + students.map(s=>`<option value="${s.id}">${esc2(s.name)} · ${esc2(s.email || '')}</option>`).join('');
  }

  function enrichStudentYandexMaterials() {
    const box = $id('studentMaterials');
    const student = window.state?.studentProfile;
    if (!box || !student || $id('studentYandexFolderCard')) return;
    if (student.yandex_folder_url) {
      box.insertAdjacentHTML('afterbegin', `<article class="learning-item" id="studentYandexFolderCard"><div class="top"><strong>Моя папка с материалами</strong><span class="topic-chip">Яндекс.Диск</span></div><p class="muted">Здесь преподаватель собирает конспекты, записи и файлы именно для вас.</p>${yandexBtn(student.yandex_folder_url)}</article>`);
    }
  }

  document.addEventListener('click', async function(e){
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && typeof window.setPage === 'function') { e.preventDefault(); window.setPage(pageBtn.dataset.page); return; }

    const editStudent = e.target.closest('[data-cloud-edit-student]');
    if (editStudent) {
      e.preventDefault();
      const id = editStudent.dataset.cloudEditStudent;
      const s = (window.state?.students || []).find(x => x.id === id);
      if (!s) return;
      const name = prompt('Имя ученика', s.name || ''); if (name === null) return;
      const subject = prompt('Предмет / курс', s.subject || '') ?? (s.subject || '');
      const telegram = prompt('Telegram', s.telegram || '') ?? (s.telegram || '');
      const yandex_folder_url = prompt('Ссылка на Яндекс-папку ученика', s.yandex_folder_url || '') ?? (s.yandex_folder_url || '');
      const { error } = await supabaseClient.from('student_profiles').update({ name, subject, telegram, yandex_folder_url }).eq('id', id);
      if (error) return toast2(error.message, 'error');
      await logPlatformAction('student_updated', { id, name, subject });
      toast2('Карточка ученика обновлена.');
      await safeRefresh('teacherStudents');
      return;
    }

    const deleteStudent = e.target.closest('[data-cloud-delete-student]');
    if (deleteStudent) {
      e.preventDefault();
      if (!confirm('Удалить ученика?')) return;
      const { error } = await supabaseClient.from('student_profiles').delete().eq('id', deleteStudent.dataset.cloudDeleteStudent);
      if (error) return toast2(error.message, 'error');
      toast2('Ученик удалён.'); await safeRefresh('teacherStudents'); return;
    }

    const addSlot = e.target.closest('[data-cloud-add-slot-date]');
    if (addSlot && !e.target.closest('button') && !e.target.closest('.slot-editor-chip')) {
      e.preventDefault();
      const date = addSlot.dataset.cloudAddSlotDate, time = addSlot.dataset.cloudAddSlotTime;
      const price = Number(prompt('Цена', '2000') || 2000);
      const duration = Number(prompt('Длительность, минут', '60') || 60);
      const firstType = (window.state?.lessonTypes || [])[0];
      const row = { date, time, duration, status:'open', price, currency:'RUB', lesson_type_id:firstType?.id || null };
      const { error } = await supabaseClient.from('slots').insert(row);
      if (error) return toast2(error.message, 'error');
      toast2('Слот добавлен.'); await safeRefresh('teacherSchedule'); if (typeof loadPublicSlots === 'function') loadPublicSlots(); return;
    }

    const delSlot = e.target.closest('[data-cloud-slot-delete]');
    if (delSlot) { e.preventDefault(); e.stopPropagation(); if (!confirm('Удалить слот?')) return; const { error } = await supabaseClient.from('slots').delete().eq('id', delSlot.dataset.cloudSlotDelete); if (error) return toast2(error.message,'error'); toast2('Слот удалён.'); await safeRefresh('teacherSchedule'); if (typeof loadPublicSlots === 'function') loadPublicSlots(); return; }
    const complete = e.target.closest('[data-cloud-slot-complete]');
    if (complete) { e.preventDefault(); e.stopPropagation(); const { error } = await supabaseClient.from('slots').update({ status:'completed' }).eq('id', complete.dataset.cloudSlotComplete); if (error) return toast2(error.message,'error'); toast2('Занятие отмечено проведённым.'); await safeRefresh('teacherSchedule'); return; }
    const editSlot = e.target.closest('[data-cloud-slot-edit]');
    if (editSlot) { e.preventDefault(); e.stopPropagation(); const date = prompt('Новая дата YYYY-MM-DD'); if (!date) return; const time = prompt('Новое время HH:MM', '16:00'); if (!time) return; const { error } = await supabaseClient.from('slots').update({ date, time, status:'rescheduled' }).eq('id', editSlot.dataset.cloudSlotEdit); if (error) return toast2(error.message,'error'); toast2('Слот перенесён.'); await safeRefresh('teacherSchedule'); if (typeof loadPublicSlots === 'function') loadPublicSlots(); return; }

    const approve = e.target.closest('[data-cloud-approve-booking]');
    if (approve) { e.preventDefault(); if (typeof window.approveBookingRequest === 'function') await window.approveBookingRequest(approve.dataset.cloudApproveBooking); await safeRefresh('teacherBookings'); return; }
    const reject = e.target.closest('[data-cloud-reject-booking]');
    if (reject) { e.preventDefault(); if (typeof window.rejectBookingRequest === 'function') await window.rejectBookingRequest(reject.dataset.cloudRejectBooking); await safeRefresh('teacherBookings'); return; }
    const grade = e.target.closest('[data-cloud-grade-homework]');
    if (grade) { e.preventDefault(); if (typeof window.gradeHomework === 'function') await window.gradeHomework(grade.dataset.cloudGradeHomework); await safeRefresh('teacherHomeworkReview'); return; }

    const delReview = e.target.closest('[data-cloud-delete-review]');
    if (delReview) { e.preventDefault(); if (!confirm('Удалить отзыв?')) return; const { error } = await supabaseClient.from('reviews').delete().eq('id', delReview.dataset.cloudDeleteReview); if (error) return toast2(error.message,'error'); toast2('Отзыв удалён.'); await safeRefresh('teacherContent'); return; }
    const delCase = e.target.closest('[data-cloud-delete-case]');
    if (delCase) { e.preventDefault(); if (!confirm('Удалить кейс?')) return; const { error } = await supabaseClient.from('student_cases').delete().eq('id', delCase.dataset.cloudDeleteCase); if (error) return toast2(error.message,'error'); toast2('Кейс удалён.'); await safeRefresh('teacherContent'); return; }
    const delExample = e.target.closest('[data-cloud-delete-example]');
    if (delExample) { e.preventDefault(); if (!confirm('Удалить пример?')) return; const { error } = await supabaseClient.from('lesson_examples').delete().eq('id', delExample.dataset.cloudDeleteExample); if (error) return toast2(error.message,'error'); toast2('Пример удалён.'); await safeRefresh('teacherContent'); return; }

    if (e.target.closest('#openYandexMailBtn')) {
      e.preventDefault();
      const st = (window.state?.students || []).find(x => x.id === $id('yandexEmailStudentSelect')?.value);
      if (!st) return toast2('Выберите ученика', 'error');
      const template = $id('yandexEmailTemplate')?.value || 'homework';
      const subjects = { homework:'Напоминание о домашнем задании', lesson:'Напоминание о занятии', payment:'Напоминание об оплате занятий' };
      const body = encodeURIComponent(`Здравствуйте! Напоминаю по занятиям. Материалы доступны в вашей личной папке: ${st.yandex_folder_url || ''}`);
      window.location.href = `mailto:${st.email}?subject=${encodeURIComponent(subjects[template] || subjects.homework)}&body=${body}`;
      return;
    }
  }, true);

  document.addEventListener('submit', async function(e){
    const f = e.target;
    if (f.id === 'cloudAddStudentForm') { e.preventDefault(); const row = { name:($id('cloudStudentName')?.value || '').trim(), email:($id('cloudStudentEmail')?.value || '').trim(), subject:($id('cloudStudentCourse')?.value || '').trim(), telegram:($id('cloudStudentTelegram')?.value || '').trim(), yandex_folder_url:($id('cloudStudentYandexFolder')?.value || '').trim() || null }; const { error } = await supabaseClient.from('student_profiles').insert(row); if (error) return toast2(error.message,'error'); toast2('Ученик сохранён.'); await safeRefresh('teacherStudents'); return; }
    if (f.id === 'cloudAddTopicForm') { e.preventDefault(); const row = { title:($id('cloudTopicTitle')?.value || '').trim(), subject:($id('cloudTopicSubject')?.value || '').trim(), description:($id('cloudTopicDescription')?.value || '').trim() }; const { error } = await supabaseClient.from('topics').insert(row); if (error) return toast2(error.message,'error'); toast2('Тема сохранена.'); await safeRefresh('teacherMaterials'); return; }
    if (f.id === 'cloudAddMaterialForm') { e.preventDefault(); const row = { title:($id('cloudMaterialTitle')?.value || '').trim(), topic_id:($id('cloudMaterialTopic')?.value || '') || null, student_id:($id('cloudMaterialStudent')?.value || '') || null, file_url:($id('cloudMaterialUrl')?.value || '').trim(), description:($id('cloudMaterialDescription')?.value || '').trim() }; const { error } = await supabaseClient.from('materials').insert(row); if (error) return toast2(error.message,'error'); toast2('Материал сохранён.'); await safeRefresh('teacherMaterials'); return; }
    if (f.id === 'cloudAddHomeworkForm') { e.preventDefault(); const row = { student_id:($id('cloudHomeworkStudent')?.value || ''), topic_id:($id('cloudHomeworkTopic')?.value || '') || null, title:($id('cloudHomeworkTitle')?.value || '').trim(), description:($id('cloudHomeworkDescription')?.value || '').trim(), deadline:($id('cloudHomeworkDeadline')?.value || '') || null, is_done:false }; const { error } = await supabaseClient.from('homework').insert(row); if (error) return toast2(error.message,'error'); try { await supabaseClient.from('notification_events').insert({ type:'homework_created', channel:'internal', status:'pending', payload: row }); } catch(_) {} toast2('ДЗ выдано.'); await safeRefresh('teacherHomework'); return; }
    if (f.id === 'cloudManualSlotForm') { e.preventDefault(); const row = { date:($id('cloudSlotDate')?.value || ''), time:($id('cloudSlotTime')?.value || ''), lesson_type_id:($id('cloudSlotLessonType')?.value || '') || null, duration:Number(($id('cloudSlotDuration')?.value || '') || 60), price:Number(($id('cloudSlotPrice')?.value || '') || 2000), status:'open', currency:'RUB' }; const { error } = await supabaseClient.from('slots').insert(row); if (error) return toast2(error.message,'error'); toast2('Слот добавлен.'); await safeRefresh('teacherSchedule'); if (typeof loadPublicSlots === 'function') loadPublicSlots(); return; }
    if (f.id === 'cloudAddPaymentForm') { e.preventDefault(); const row = { student_id:($id('cloudPaymentStudent')?.value || '') || null, amount:Number(($id('cloudPaymentAmount')?.value || '') || 0), status:($id('cloudPaymentStatus')?.value || ''), notes:($id('cloudPaymentComment')?.value || '').trim(), currency:'RUB' }; const { error } = await supabaseClient.from('payments').insert(row); if (error) return toast2(error.message,'error'); toast2('Оплата сохранена.'); await safeRefresh('teacherPayments'); return; }
    if (f.id === 'cloudAddLessonTypeForm') { e.preventDefault(); const row = { title:($id('cloudLessonTypeTitle')?.value || '').trim(), subject:($id('cloudLessonTypeSubject')?.value || '').trim(), duration:Number(($id('cloudLessonTypeDuration')?.value || '') || 60), price:Number(($id('cloudLessonTypePrice')?.value || '') || 2000), currency:'RUB', format:'online', is_active:true }; const { error } = await supabaseClient.from('lesson_types').insert(row); if (error) return toast2(error.message,'error'); toast2('Тип занятия сохранён.'); await safeRefresh('teacherFinance'); return; }
    if (f.id === 'cloudAddReviewForm') { e.preventDefault(); const row = { author:($id('cloudReviewAuthor')?.value || '').trim(), rating:Number(($id('cloudReviewRating')?.value || '') || 5), text:($id('cloudReviewText')?.value || '').trim(), proof_url:($id('cloudReviewProofUrl')?.value || '').trim(), is_published:true }; const { error } = await supabaseClient.from('reviews').insert(row); if (error) return toast2(error.message,'error'); toast2('Отзыв сохранён.'); await safeRefresh('teacherContent'); return; }
    if (f.id === 'cloudAddCaseForm') { e.preventDefault(); const row = { title:($id('cloudCaseTitle')?.value || '').trim(), subject:($id('cloudCaseSubject')?.value || '').trim(), before_text:($id('cloudCaseBefore')?.value || '').trim(), process_text:($id('cloudCaseProcess')?.value || '').trim(), result_text:($id('cloudCaseResult')?.value || '').trim(), is_published:true }; const { error } = await supabaseClient.from('student_cases').insert(row); if (error) return toast2(error.message,'error'); toast2('Кейс сохранён.'); await safeRefresh('teacherContent'); return; }
    if (f.id === 'cloudAddExampleForm') { e.preventDefault(); const row = { title:($id('cloudExampleTitle')?.value || '').trim(), subject:($id('cloudExampleSubject')?.value || '').trim(), type:($id('cloudExampleType')?.value || ''), file_url:($id('cloudExampleUrl')?.value || '').trim(), description:($id('cloudExampleDescription')?.value || '').trim(), is_published:true }; const { error } = await supabaseClient.from('lesson_examples').insert(row); if (error) return toast2(error.message,'error'); toast2('Пример материала сохранён.'); await safeRefresh('teacherContent'); return; }
  }, true);

  const oldSetPage = window.setPage;
  if (typeof oldSetPage === 'function') {
    window.setPage = function(page) {
      oldSetPage(page);
      setTimeout(() => { renderTeacherPage(page); if (page === 'studentCabinet') enrichStudentYandexMaterials(); }, 140);
    };
  }
})();


/* ===== PLATFORM PATCH v8: instant updates, restore current page, safer student access RPCs ===== */
(function(){
  if (window.__platformPatchV8Ready) return;
  window.__platformPatchV8Ready = true;

  const $id = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const val = (id, fallback='') => { const el=$id(id); return el && 'value' in el ? el.value : fallback; };
  const trimVal = (id, fallback='') => String(val(id, fallback) || '').trim();
  const toast8 = (msg, type='success') => typeof window.toast === 'function' ? window.toast(msg, type) : alert(msg);
  const pathToPage = {
    '/': 'home',
    '/home': 'home',
    '/about': 'about',
    '/why': 'whyMe',
    '/parents': 'parents',
    '/services': 'services',
    '/booking': 'schedule',
    '/payment': 'payment',
    '/contacts': 'contacts',
    '/login': 'login',
    '/student': 'studentCabinet',
    '/teacher': 'teacherCabinet',
    '/teacher/students': 'teacherStudents',
    '/teacher/materials': 'teacherMaterials',
    '/teacher/homework': 'teacherHomework',
    '/teacher/homework-review': 'teacherHomeworkReview',
    '/teacher/schedule': 'teacherSchedule',
    '/teacher/bookings': 'teacherBookings',
    '/teacher/finance': 'teacherFinance',
    '/teacher/payments': 'teacherPayments',
    '/teacher/content': 'teacherContent',
    '/teacher/analytics': 'analytics',
    '/teacher/activity': 'activityLog',
    '/teacher/settings': 'settings',
    '/library': 'library',
    '/quizzes': 'quizzes',
    '/cases': 'cases',
    '/examples': 'lessonExamples',
    '/reviews': 'reviews',
    '/faq': 'faq',
    '/rules': 'rules'
  };
  const pageToPath = Object.fromEntries(Object.entries(pathToPage).map(([k,v]) => [v,k]));
  const currentPage = () => pathToPage[location.pathname] || localStorage.getItem('platform_current_page') || location.hash.replace(/^#\/?/, '') || 'home';
  const isTeacherPage = (p) => ['teacherCabinet','teacherStudents','teacherMaterials','teacherHomework','teacherHomeworkReview','teacherSchedule','teacherBookings','teacherFinance','teacherPayments','teacherContent'].includes(p);
  const randomPassword = (len=10) => {
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let out='';
    const bytes=new Uint8Array(len);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out += chars[b % chars.length];
    return out;
  };
  const normalizeLogin = (s) => String(s||'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9._-]/g,'');
  async function sha256(text) {
    const data = new TextEncoder().encode(String(text || ''));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 1) Запоминаем страницу и позицию прокрутки. После перезагрузки возвращаем туда же.
  const oldSetPage = window.setPage;
  if (typeof oldSetPage === 'function' && !window.__platformSetPageV8Wrapped) {
    window.__platformSetPageV8Wrapped = true;
    window.setPage = function(page){
      try {
        const prev = currentPage();
        if (prev) sessionStorage.setItem('platform_scroll_' + prev, String(window.scrollY || 0));
        localStorage.setItem('platform_current_page', page);
        const nextPath = pageToPath[page] || ('/' + page);
        if (location.pathname !== nextPath) history.pushState({ page }, '', nextPath);
      } catch(_) {}
      const result = oldSetPage(page);
      setTimeout(() => {
        const saved = Number(sessionStorage.getItem('platform_scroll_' + page) || 0);
        if (saved > 0) window.scrollTo({ top: saved, behavior: 'instant' in window ? 'instant' : 'auto' });
      }, 220);
      return result;
    };
  }
  window.addEventListener('popstate', () => {
    const page = currentPage();
    if (typeof oldSetPage === 'function') oldSetPage(page);
  });

  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      try { sessionStorage.setItem('platform_scroll_' + currentPage(), String(window.scrollY || 0)); } catch(_) {}
    }, 120);
  }, { passive:true });
  setTimeout(async () => {
    const saved = currentPage();
    if (!saved || saved === 'home') return;
    // Даём Supabase Auth и локальной студенческой сессии восстановиться.
    if (typeof window.restoreStudentSession === 'function') await window.restoreStudentSession().catch(()=>{});
    if (typeof window.setPage === 'function') window.setPage(saved);
  }, 900);

  // 2) Мгновенное обновление данных: локально после действий + Realtime между вкладками/устройствами.
  let refreshLock = null;
  async function refreshVisible(reason='update') {
    const page = currentPage();
    if (refreshLock) return refreshLock;
    refreshLock = (async () => {
      try {
        if (isTeacherPage(page) && document.body.classList.contains('is-admin')) {
          if (typeof window.safeRefresh === 'function') await window.safeRefresh(page);
          else if (typeof window.loadTeacherCabinet === 'function') await window.loadTeacherCabinet();
        }
        if (page === 'studentCabinet' && document.body.classList.contains('is-student') && typeof window.loadStudentCabinet === 'function') {
          await window.loadStudentCabinet();
        }
        if ((page === 'schedule' || reason === 'slots') && typeof window.loadPublicSlots === 'function') {
          await window.loadPublicSlots();
        }
      } catch(e) {
        console.warn('refreshVisible failed', e);
      } finally {
        refreshLock = null;
      }
    })();
    return refreshLock;
  }
  window.refreshVisible = refreshVisible;

  function startRealtime() {
    if (!window.supabaseClient || window.__platformRealtimeV8) return;
    window.__platformRealtimeV8 = true;
    try {
      window.supabaseClient.channel('platform-live-v8')
        .on('postgres_changes', { event:'*', schema:'public', table:'student_profiles' }, () => refreshVisible('students'))
        .on('postgres_changes', { event:'*', schema:'public', table:'student_credentials' }, () => refreshVisible('credentials'))
        .on('postgres_changes', { event:'*', schema:'public', table:'materials' }, () => refreshVisible('materials'))
        .on('postgres_changes', { event:'*', schema:'public', table:'homework' }, () => refreshVisible('homework'))
        .on('postgres_changes', { event:'*', schema:'public', table:'slots' }, () => refreshVisible('slots'))
        .on('postgres_changes', { event:'*', schema:'public', table:'payments' }, () => refreshVisible('payments'))
        .on('postgres_changes', { event:'*', schema:'public', table:'reviews' }, () => refreshVisible('content'))
        .on('postgres_changes', { event:'*', schema:'public', table:'student_cases' }, () => refreshVisible('content'))
        .on('postgres_changes', { event:'*', schema:'public', table:'lesson_examples' }, () => refreshVisible('content'))
        .subscribe((status) => console.log('[platform realtime]', status));
    } catch(e) {
      console.warn('Realtime disabled/skipped', e);
    }
  }
  setTimeout(startRealtime, 1200);

  // 3) Логины учеников через RPC. Это исправляет RLS-ошибку при вставке в student_credentials.
  async function listCredentials(ids) {
    if (!ids.length) return [];
    let rpc;
    try {
      rpc = await window.supabaseClient.rpc('list_student_credentials_for_teacher', { p_student_ids: ids });
    } catch (e) {
      rpc = { error: e };
    }
    if (!rpc?.error && Array.isArray(rpc?.data)) return rpc.data;
    console.warn('credentials RPC fallback', rpc?.error);
    try {
      const direct = await window.supabaseClient.from('student_credentials').select('student_id, login_name, is_active, updated_at').in('student_id', ids);
      if (direct.error) { console.warn('credentials direct failed', direct.error); return []; }
      return direct.data || [];
    } catch (e) {
      console.warn('credentials direct exception', e);
      return [];
    }
  }

  async function createStudentAccess(row) {
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
    const { data, error } = await window.supabaseClient.rpc('teacher_create_student_access', args);
    if (error) throw error;
    return data;
  }

  async function resetStudentPassword(studentId, passHash) {
    const { error } = await window.supabaseClient.rpc('teacher_reset_student_password', { p_student_id: studentId, p_password_hash: passHash });
    if (error) throw error;
  }

  async function deleteStudentAccess(studentId) {
    const { error } = await window.supabaseClient.rpc('teacher_delete_student_access', { p_student_id: studentId });
    if (error) throw error;
  }

  // Студенческий вход тоже пробуем через RPC, чтобы не требовался SELECT по таблице паролей.
  window.studentLoginByName = async function(login, password) {
    login = normalizeLogin(login);
    if (!login || !password) throw new Error('Введите имя и пароль.');
    const passHash = await sha256(password);
    let studentId = null;
    let rpc;
    try {
      rpc = await window.supabaseClient.rpc('student_login_by_password', { p_login_name: login, p_password_hash: passHash });
    } catch (e) {
      rpc = { error: e };
    }
    if (!rpc?.error && rpc?.data) studentId = rpc.data;
    if (!studentId) {
      // Совместимость со старой схемой, если v8 SQL ещё не выполнен.
      const { data, error } = await window.supabaseClient.from('student_credentials').select('student_id, login_name, password_hash, is_active').eq('login_name', login).maybeSingle();
      if (error) throw error;
      if (!data || data.is_active === false || data.password_hash !== passHash) throw new Error('Неверное имя или пароль.');
      studentId = data.student_id;
    }
    localStorage.setItem('student_session_id', studentId);
    if (typeof window.restoreStudentSession === 'function') await window.restoreStudentSession();
    toast8('Вход выполнен', 'success');
    window.setPage?.('studentCabinet');
  };

  // Переопределяем форму учеников на v8-ID, чтобы старые submit-обработчики v7 не перехватывали событие.
  window.renderTeacherStudentsFunctional = async function(){
    if (typeof window.ensureTeacherData === 'function') await window.ensureTeacherData(true);
    const mount = $id('teacherStudentsMount');
    if (!mount) return;
    const students = window.state?.students || [];
    mount.innerHTML = `
      <div class="teacher-tool-grid">
        <div class="panel">
          <h3>Создать ученика и доступ</h3>
          <p class="muted">Вы сами задаёте имя входа и пароль. Ученик входит без email.</p>
          <form class="form-grid" id="v8AddStudentLoginForm">
            <div class="field"><label>Имя ученика</label><input id="v8StudentName" required placeholder="Иван Петров"></div>
            <div class="grid-2">
              <div class="field"><label>Имя для входа</label><input id="v8StudentLogin" required placeholder="ivan_8class"></div>
              <div class="field"><label>Пароль</label><input id="v8StudentPassword" required placeholder="задайте или сгенерируйте"></div>
            </div>
            <button class="btn small soft" type="button" id="v8GeneratePassword">Сгенерировать пароль</button>
            <div class="field"><label>Email, необязательно</label><input id="v8StudentEmail" type="email" placeholder="для связи, не для входа"></div>
            <div class="field"><label>Курс / предмет</label><input id="v8StudentSubject" placeholder="Математика, 8 класс"></div>
            <div class="field"><label>Telegram</label><input id="v8StudentTelegram" placeholder="@username"></div>
            <div class="field"><label>Личная Яндекс-папка</label><input id="v8StudentYandex" placeholder="https://disk.yandex.ru/..."></div>
            <div class="field"><label>Заметки</label><textarea id="v8StudentNotes"></textarea></div>
            <button class="btn" type="submit">Создать доступ ученику</button>
          </form>
        </div>
        <div class="panel">
          <div class="top-actions"><h3>Ученики и доступы</h3><button class="btn small soft" id="v8RefreshStudents" type="button">Обновить</button></div>
          <div class="search-row"><input id="v8StudentSearch" placeholder="Поиск по имени, логину, предмету"><select id="v8StudentSubjectFilter"><option value="">Все предметы</option><option>Математика</option><option>Физика</option><option>Химия</option></select></div>
          <div class="item-list" id="v8StudentsList"><div class="empty">Загрузка...</div></div>
        </div>
      </div>`;
    const creds = await listCredentials(students.map(s => s.id).filter(Boolean));
    const credByStudent = Object.fromEntries(creds.map(c => [c.student_id, c]));
    const renderList = () => {
      const q = trimVal('v8StudentSearch').toLowerCase();
      const subj = val('v8StudentSubjectFilter');
      const filtered = students.filter(s => {
        const c = credByStudent[s.id] || {};
        const hay = `${s.name||''} ${s.email||''} ${s.subject||''} ${c.login_name||''}`.toLowerCase();
        return (!q || hay.includes(q)) && (!subj || String(s.subject||'').includes(subj));
      });
      const list = $id('v8StudentsList');
      if (!list) return;
      list.innerHTML = filtered.map(s => {
        const c = credByStudent[s.id];
        return `<article class="learning-item">
          <div class="top"><strong>${esc(s.name)}</strong><span class="topic-chip">${esc(s.subject || 'курс не указан')}</span></div>
          <p class="muted">${s.email ? esc(s.email) + ' · ' : ''}${s.telegram ? esc(s.telegram) + ' · ' : ''}логин: <strong>${esc(c?.login_name || 'не создан')}</strong></p>
          ${s.yandex_folder_url ? `<p class="muted">Материалы: личная Яндекс-папка</p><a class="btn small soft" target="_blank" rel="noopener" href="${esc(s.yandex_folder_url)}">Открыть папку</a>` : '<p class="muted">Яндекс-папка не указана</p>'}
          <div class="row-actions">
            <button class="btn small soft" data-v8-reset-pass="${s.id}">Новый пароль</button>
            <button class="btn small soft" data-v8-edit-student="${s.id}">Изменить</button>
            <button class="btn small red" data-v8-delete-student="${s.id}">Удалить</button>
          </div>
        </article>`;
      }).join('') || '<div class="empty">Пока нет учеников</div>';
    };
    renderList();
    $id('v8GeneratePassword')?.addEventListener('click', () => { const el=$id('v8StudentPassword'); if (el) el.value=randomPassword(10); });
    $id('v8StudentSearch')?.addEventListener('input', renderList);
    $id('v8StudentSubjectFilter')?.addEventListener('change', renderList);
    $id('v8RefreshStudents')?.addEventListener('click', () => refreshVisible('students'));
  };

  document.addEventListener('submit', async function(e){
    const f = e.target;
    if (!f || f.id !== 'v8AddStudentLoginForm') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      const login = normalizeLogin(trimVal('v8StudentLogin'));
      const pass = trimVal('v8StudentPassword');
      if (!login || !pass) throw new Error('Укажите имя входа и пароль.');
      const row = {
        name: trimVal('v8StudentName'),
        login_name: login,
        password_hash: await sha256(pass),
        email: trimVal('v8StudentEmail') || `${login}@student.local`,
        subject: trimVal('v8StudentSubject'),
        telegram: trimVal('v8StudentTelegram'),
        yandex_folder_url: trimVal('v8StudentYandex') || null,
        notes: trimVal('v8StudentNotes')
      };
      await createStudentAccess(row);
      toast8(`Доступ создан. Логин: ${login} · пароль: ${pass}`, 'success');
      f.reset();
      await refreshVisible('students');
    } catch(err) {
      toast8('Не удалось создать доступ: ' + (err.message || err), 'error');
    }
  }, true);

  document.addEventListener('click', async function(e){
    const reset = e.target.closest('[data-v8-reset-pass]');
    if (reset) {
      e.preventDefault(); e.stopImmediatePropagation();
      const pass = prompt('Новый пароль для ученика', randomPassword(10));
      if (!pass) return;
      try { await resetStudentPassword(reset.dataset.v8ResetPass, await sha256(pass)); toast8('Новый пароль: ' + pass, 'success'); await refreshVisible('credentials'); }
      catch(err) { toast8('Не удалось обновить пароль: ' + (err.message || err), 'error'); }
      return;
    }
    const edit = e.target.closest('[data-v8-edit-student]');
    if (edit) {
      e.preventDefault(); e.stopImmediatePropagation();
      const id = edit.dataset.v8EditStudent;
      const s = (window.state?.students || []).find(x => x.id === id);
      if (!s) return;
      const name = prompt('Имя ученика', s.name || ''); if (name === null) return;
      const subject = prompt('Предмет / курс', s.subject || '') ?? (s.subject || '');
      const telegram = prompt('Telegram', s.telegram || '') ?? (s.telegram || '');
      const yandex_folder_url = prompt('Ссылка на Яндекс-папку ученика', s.yandex_folder_url || '') ?? (s.yandex_folder_url || '');
      const { error } = await window.supabaseClient.from('student_profiles').update({ name, subject, telegram, yandex_folder_url }).eq('id', id);
      if (error) return toast8(error.message, 'error');
      toast8('Карточка ученика обновлена');
      await refreshVisible('students');
      return;
    }
    const del = e.target.closest('[data-v8-delete-student]');
    if (del) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!confirm('Удалить ученика и его логин?')) return;
      try { await deleteStudentAccess(del.dataset.v8DeleteStudent); toast8('Ученик удалён'); await refreshVisible('students'); }
      catch(err) { toast8('Не удалось удалить ученика: ' + (err.message || err), 'error'); }
      return;
    }
  }, true);
})();


/* ===== PLATFORM PATCH v9 runtime: sidebar cleanup + safer data refresh ===== */
(function(){
  if (window.__platformPatchV9Ready) return;
  window.__platformPatchV9Ready = true;

  function cleanupSidebar() {
    document.querySelectorAll('aside.sidebar .menu-group').forEach(group => {
      const visibleButtons = Array.from(group.querySelectorAll('.menu-group-body .nav-btn')).filter(btn => {
        const cs = window.getComputedStyle(btn);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      group.classList.toggle('empty-menu-group', visibleButtons.length === 0);
      if (visibleButtons.length === 0) group.open = false;
    });
  }
  window.cleanupSidebar = cleanupSidebar;
  ['DOMContentLoaded','load'].forEach(ev => window.addEventListener(ev, () => setTimeout(cleanupSidebar, 120)));
  const mo = new MutationObserver(() => setTimeout(cleanupSidebar, 60));
  if (document.body) mo.observe(document.body, { attributes:true, attributeFilter:['class'], childList:true, subtree:true });

  // Safer Supabase RPC wrapper for browsers where PostgREST builders do not expose .catch().
  window.safeRpc = async function(fn, args) {
    try { return await window.supabaseClient.rpc(fn, args || {}); }
    catch (error) { return { data:null, error }; }
  };
})();

