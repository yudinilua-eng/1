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
      if (page === 'schedule') loadPublicSlots();
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
    $('mobileMenuBtn').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));

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

    $('loginTabBtn').addEventListener('click', () => {
      $('authMode').value = 'login';
      $('authSubmitBtn').textContent = 'Войти';
      $('loginTabBtn').classList.add('active');
      $('signupTabBtn').classList.remove('active');
    });
    $('signupTabBtn').addEventListener('click', () => {
      $('authMode').value = 'signup';
      $('authSubmitBtn').textContent = 'Зарегистрироваться';
      $('signupTabBtn').classList.add('active');
      $('loginTabBtn').classList.remove('active');
    });

    $('authForm').addEventListener('submit', async (e) => {
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

    $('logoutBtn').addEventListener('click', async () => {
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
      $('languageToggle').innerHTML = `<i class="fa-solid fa-globe"></i> ${lang === 'ru' ? 'EN' : 'RU'}`;
      document.querySelectorAll('option').forEach(opt => {
        if (!opt.dataset.ruText) opt.dataset.ruText = opt.textContent;
        const key = opt.dataset.ruText.trim();
        opt.textContent = lang === 'en' && I18N.en[key] ? I18N.en[key] : opt.dataset.ruText;
      });
    }

    document.querySelector('[data-action="language"]').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLanguage(currentLang === 'ru' ? 'en' : 'ru');
      toast(currentLang === 'en' ? 'English enabled' : 'Русский язык включён', 'success');
    });

    window.goToBooking = function(subject) {
      localStorage.setItem('selected_subject', subject);
      setPage('schedule');
      setTimeout(() => {
        const target = document.getElementById('calendarGrid') || document.getElementById('publicSlots');
        target?.scrollIntoView({ behavior:'smooth', block:'start' });
        toast(currentLang === 'en' ? `Choose a slot for ${subject}` : `Выберите удобный слот: ${subject}`, 'success');
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



    let teacherCalendarWeekStart = getMonday(new Date());

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

    function setWizardStep(step) {
      wizardStep = Math.max(1, Math.min(5, step));
      document.querySelectorAll('.wizard-step').forEach(el => el.classList.toggle('active', Number(el.dataset.wizardStep) === wizardStep));
      document.querySelectorAll('.wizard-panel').forEach(el => el.classList.toggle('active', Number(el.dataset.wizardPanel) === wizardStep));
    }

    window.wizardNext = function() {
      setWizardStep(wizardStep + 1);
      if (wizardStep === 4) {
        localStorage.setItem('selected_subject', wizardState.subject || 'Математика');
        loadPublicSlots();
      }
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
      const { data, error } = await supabaseClient.from('slots').select('*, lesson_types(title, subject, price, duration)').eq('status','open').order('date').order('time');
      const box = $('publicSlots');
      if (error) { box.innerHTML = `<div class="empty">Не удалось загрузить слоты: ${esc(error.message)}</div>`; return; }
      const selectedSubject = getSelectedSubject();
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

    $('bookingModalClose').addEventListener('click', () => $('bookingModal').classList.remove('active'));
    $('bookingModal').addEventListener('click', (e) => { if (e.target.id === 'bookingModal') $('bookingModal').classList.remove('active'); });

    $('bookingForm').addEventListener('submit', async (e) => {
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

    $('calendarPrevWeek').addEventListener('click', async () => { calendarWeekStart = addDays(calendarWeekStart, -7); await loadPublicSlots(); });
    $('calendarToday').addEventListener('click', async () => { calendarWeekStart = getMonday(new Date()); await loadPublicSlots(); });
    $('calendarNextWeek').addEventListener('click', async () => { calendarWeekStart = addDays(calendarWeekStart, 7); await loadPublicSlots(); });

    $('contactForm').addEventListener('submit', async (e) => {
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
    ['calcDuration','calcCount','calcPlan'].forEach(id => $(id).addEventListener('change', updateCalc));
    $('payDemoBtn').addEventListener('click', async () => {
      if (!state.siteSettings || !Object.keys(state.siteSettings).length) await loadSiteSettings();
      const url = state.siteSettings?.payment_url;
      if (url) window.open(url, '_blank');
      else toast('Добавьте платёжную ссылку в настройках сайта.', 'info');
    });
    updateCalc();

    async function loadTeacherData() {
      const [students, topics, materials, homework, slots, requests, lessonTypes, subscriptions, packages, payments, lessonLogs, bookingRequests, activity, quizzes, quizQuestions, quizAttempts, reviews, cases, examples] = await Promise.all([
        supabaseClient.from('student_profiles').select('*').order('created_at', { ascending:false }),
        supabaseClient.from('topics').select('*').order('created_at', { ascending:false }),
        supabaseClient.from('materials').select('*, topics(title)').order('created_at', { ascending:false }),
        supabaseClient.from('homework').select('*, student_profiles(name,email), topics(title), lesson_types(title, price, duration)').order('created_at', { ascending:false }),
        supabaseClient.from('slots').select('*, student_profiles(name,email), lesson_types(title, subject, price, duration)').order('date').order('time'),
        supabaseClient.from('lesson_requests').select('*, student_profiles(name,email)').order('created_at', { ascending:false }),
        supabaseClient.from('lesson_types').select('*').order('sort_order').order('created_at', { ascending:false }),
        supabaseClient.from('subscriptions').select('*').order('lessons_count'),
        supabaseClient.from('student_packages').select('*, student_profiles(name,email), lesson_types(title, price, duration), subscriptions(title, lessons_count, discount_percent)').order('created_at', { ascending:false }),
        supabaseClient.from('payments').select('*, student_profiles(name,email), lesson_types(title), student_packages(lessons_total, lessons_used)').order('created_at', { ascending:false }),
        supabaseClient.from('lesson_logs').select('*, student_profiles(name,email), slots(date,time), lesson_types(title)').order('created_at', { ascending:false }),
        supabaseClient.from('booking_requests').select('*, slots(date,time,duration,price,status,lesson_types(title)), student_profiles(name,email)').order('created_at', { ascending:false }),
        supabaseClient.from('activity_log').select('*').order('created_at', { ascending:false }).limit(50),
        supabaseClient.from('quizzes').select('*, topics(title), student_profiles(name,email)').order('created_at', { ascending:false }),
        supabaseClient.from('quiz_questions').select('*').order('created_at'),
        supabaseClient.from('quiz_attempts').select('*, quizzes(title), student_profiles(name,email)').order('created_at', { ascending:false }),
        supabaseClient.from('reviews').select('*').order('created_at', { ascending:false }),
        supabaseClient.from('student_cases').select('*').order('created_at', { ascending:false }),
        supabaseClient.from('lesson_examples').select('*').order('created_at', { ascending:false })
      ]);
      state.students = students.data || [];
      state.topics = topics.data || [];
      state.materials = materials.data || [];
      state.homework = homework.data || [];
      state.slots = slots.data || [];
      state.requests = requests.data || [];
      state.lessonTypes = lessonTypes.data || [];
      state.subscriptions = subscriptions.data || [];
      state.packages = packages.data || [];
      state.payments = payments.data || [];
      state.lessonLogs = lessonLogs.data || [];
      state.bookingRequests = bookingRequests.data || [];
      state.activity = activity.data || [];
      state.quizzes = quizzes.data || [];
      state.quizQuestions = quizQuestions.data || [];
      state.quizAttempts = quizAttempts.data || [];
      state.reviews = reviews.data || [];
      state.cases = cases.data || [];
      state.examples = examples.data || [];
      state.lessonLogs = lessonLogs.data || [];
    }

    async function loadTeacherCabinet() {
      if (!document.body.classList.contains('is-admin')) return setPage('login');
      await loadTeacherData();
      renderTeacherCabinet();
    }

    function fillSelect(selectId, items, placeholder, getLabel) {
      const select = $(selectId);
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
