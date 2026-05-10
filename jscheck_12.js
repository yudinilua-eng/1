
/* ===== v21: ensure EdTech UI is applied to every route/page ===== */
(function(){
  if (window.__platformV21AllPagesReady) return;
  window.__platformV21AllPagesReady = true;
  const pageLabels = {
    home:'Главная', today:'Сегодня', about:'Обо мне', whyMe:'Почему со мной', parents:'Родителям', services:'Программы и цены', schedule:'Запись на урок', payment:'Оплата', contacts:'Контакты',
    library:'Библиотека', quizzes:'Тесты', cases:'Кейсы учеников', lessonExamples:'Примеры материалов', reviews:'Отзывы', faq:'FAQ', rules:'Правила', login:'Вход в кабинет',
    studentCabinet:'Личный кабинет ученика', teacherCabinet:'Обзор кабинета', teacherStudents:'Ученики', teacherMaterials:'Материалы и темы', teacherHomework:'Домашние задания',
    teacherHomeworkReview:'Проверка ДЗ', teacherSchedule:'Расписание и слоты', teacherBookings:'Заявки на занятия', teacherNotifications:'Уведомления', teacherFinance:'Финансы',
    teacherPayments:'Оплаты', teacherContent:'Отзывы и кейсы', analytics:'Аналитика', activityLog:'История действий', settings:'Настройки сайта', integrations:'Материалы Яндекс'
  };
  const publicPages = new Set(['home','about','whyMe','parents','services','schedule','payment','contacts','library','quizzes','cases','lessonExamples','reviews','faq','rules','login']);
  function activePage(){
    const active = document.querySelector('.page.active');
    return active ? active.id.replace(/^page-/,'') : 'home';
  }
  function polishPage(page){
    page = page || activePage();
    document.body.dataset.activePage = page;
    document.body.classList.toggle('public-route', publicPages.has(page));
    document.body.classList.toggle('cabinet-route', !publicPages.has(page));
    document.querySelectorAll('.edu-nav-links a[data-page], .edu-topnav a[data-page], aside.sidebar .nav-btn[data-page]').forEach(el=>{
      el.classList.toggle('active', el.dataset.page === page);
    });
    document.querySelectorAll('.page:not(#page-home)').forEach(sec=>{
      sec.classList.add('edtech-page');
      const p = sec.id.replace(/^page-/,'');
      if (!sec.querySelector(':scope > .v21-page-marker')) {
        const marker = document.createElement('div');
        marker.className = 'v21-page-marker';
        marker.setAttribute('aria-hidden','true');
        marker.style.cssText = 'position:absolute;right:22px;top:22px;width:72px;height:72px;border-radius:24px;background:linear-gradient(135deg,rgba(109,40,217,.12),rgba(6,182,212,.10));filter:blur(.1px);z-index:0;pointer-events:none;';
        sec.prepend(marker);
      }
      const head = sec.querySelector(':scope > .section-head');
      if (head && !head.dataset.v21Polished) {
        head.dataset.v21Polished = '1';
        const h = head.querySelector('h1,h2');
        if (h && !h.querySelector('.v21-title-dot')) h.insertAdjacentHTML('afterbegin','<span class="v21-title-dot" style="display:inline-block;width:.55em;height:.55em;margin-right:.32em;border-radius:999px;background:linear-gradient(135deg,var(--edu-purple),var(--edu-cyan));vertical-align:.04em;box-shadow:0 8px 18px rgba(109,40,217,.20)"></span>');
      }
      sec.querySelectorAll('.panel,.mini-panel,.soft-section,.item-card,.case-card,.review-card').forEach(card=>card.classList.add('v21-card'));
    });
  }
  const oldSetPage = window.setPage;
  if (typeof oldSetPage === 'function' && !window.__platformV21SetPageWrapped) {
    window.__platformV21SetPageWrapped = true;
    window.setPage = function(page){
      const result = oldSetPage.apply(this, arguments);
      requestAnimationFrame(()=>polishPage(page));
      setTimeout(()=>polishPage(page), 120);
      return result;
    };
  }
  document.addEventListener('click', e=>{
    const btn = e.target.closest('#mobileMenuBtn');
    if (btn) { document.body.classList.toggle('mobile-menu-open'); return; }
    const nav = e.target.closest('aside.sidebar .nav-btn[data-page], aside.sidebar a[data-page]');
    if (nav) document.body.classList.remove('mobile-menu-open');
  }, true);
  window.addEventListener('resize', ()=>{ if (innerWidth > 980) document.body.classList.remove('mobile-menu-open'); });
  document.addEventListener('DOMContentLoaded', ()=>polishPage(activePage()));
  setTimeout(()=>polishPage(activePage()), 400);
  setTimeout(()=>polishPage(activePage()), 1200);
})();
