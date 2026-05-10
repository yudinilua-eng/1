
/* ===== PLATFORM PATCH v14: instant route switch + homepage sync ===== */
(function(){
  if (window.__platformPatchV14Ready) return;
  window.__platformPatchV14Ready = true;

  const routeByPage = window.platformRouteByPage || {
    home:'/', today:'/today', about:'/about', whyMe:'/why-me', parents:'/parents', services:'/services', schedule:'/booking', payment:'/payment', contacts:'/contacts',
    library:'/library', quizzes:'/quizzes', cases:'/cases', lessonExamples:'/examples', reviews:'/reviews', faq:'/faq', rules:'/rules', login:'/login',
    studentCabinet:'/student', teacherCabinet:'/teacher', teacherStudents:'/teacher/students', teacherMaterials:'/teacher/materials', teacherHomework:'/teacher/homework',
    teacherHomeworkReview:'/teacher/homework-review', teacherSchedule:'/teacher/schedule', teacherBookings:'/teacher/bookings', teacherNotifications:'/teacher/notifications',
    teacherFinance:'/teacher/finance', teacherPayments:'/teacher/payments', teacherContent:'/teacher/content', analytics:'/teacher/analytics', activityLog:'/teacher/activity',
    settings:'/teacher/settings', integrations:'/teacher/yandex-materials', parentCabinet:'/parent'
  };
  const pageByRoute = Object.fromEntries(Object.entries(routeByPage).map(([p,u]) => [u,p]));
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function supa(){ return window.supabaseClient; }
  function currentPage(){ return document.querySelector('.page.active')?.id?.replace('page-','') || pageByRoute[location.pathname.replace(/\/$/,'') || '/'] || 'home'; }
  function pageFromPath(){ const clean = location.pathname.replace(/\/$/,'') || '/'; return pageByRoute[clean] || 'home'; }

  // Главный фикс: никакого location.assign при клике по боковому меню.
  // URL меняется через History API, а нужный раздел показывается сразу в текущем документе.
  window.platformNavigate = function(page, opts={}){
    const url = routeByPage[page] || ('/' + page);
    try {
      if (!opts.replace && location.pathname !== url) history.pushState({page}, '', url);
      if (opts.replace && location.pathname !== url) history.replaceState({page}, '', url);
      localStorage.setItem('last_page', page);
    } catch(_) {}
    const rawSetPage = window.__v14RawSetPage || window.setPage;
    if (typeof rawSetPage === 'function') rawSetPage(page);
    if (!opts.keepScroll) setTimeout(() => window.scrollTo({top:0, behavior:'auto'}), 0);
  };

  if (!window.__v14RawSetPage && typeof window.setPage === 'function') {
    window.__v14RawSetPage = window.setPage;
    window.setPage = function(page){
      const url = routeByPage[page] || ('/' + page);
      try { if (location.pathname !== url) history.pushState({page}, '', url); } catch(_) {}
      const result = window.__v14RawSetPage(page);
      if (page === 'home') setTimeout(refreshHomepageLiveContent, 80);
      return result;
    };
  }

  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-page]');
    if (btn?.dataset?.page) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.platformNavigate(btn.dataset.page);
      return;
    }
    const inline = e.target.closest('[onclick*="setPage("]');
    if (inline) {
      const m = String(inline.getAttribute('onclick') || '').match(/setPage\(['\"]([^'\"]+)['\"]\)/);
      if (m) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); window.platformNavigate(m[1]); }
    }
  }, true);

  window.addEventListener('popstate', () => window.platformNavigate(pageFromPath(), {replace:true, keepScroll:true}));

  async function loadTable(table, queryFn){
    if (!supa()) return [];
    try {
      const q = queryFn ? queryFn(supa().from(table)) : supa().from(table).select('*');
      const {data, error} = await q;
      if (error) return [];
      return data || [];
    } catch(_) { return []; }
  }

  async function refreshHomepageLiveContent(){
    const box = document.getElementById('homeLiveCards');
    if (!box) return;
    const [reviews, cases, examples, lessonTypes] = await Promise.all([
      loadTable('reviews', q => q.select('*').eq('is_published', true).order('created_at', {ascending:false}).limit(2)),
      loadTable('student_cases', q => q.select('*').eq('is_published', true).order('created_at', {ascending:false}).limit(2)),
      loadTable('lesson_examples', q => q.select('*').eq('is_published', true).order('created_at', {ascending:false}).limit(2)),
      loadTable('lesson_types', q => q.select('*').eq('is_active', true).order('price', {ascending:true}).limit(3))
    ]);

    const cards = [];
    if (cases[0]) cards.push(`<article class="panel link-card" data-page="cases"><div class="card-icon"><i class="fa-solid fa-trophy"></i></div><h3>${esc(cases[0].title || 'Кейс ученика')}</h3><p class="muted">${esc(cases[0].subject || '')}</p><p>${esc(cases[0].result_text || cases[0].process_text || '')}</p><button class="btn small soft" data-page="cases">Все кейсы</button></article>`);
    if (reviews[0]) cards.push(`<article class="panel link-card" data-page="reviews"><div class="card-icon"><i class="fa-solid fa-star"></i></div><h3>Отзыв ${esc(reviews[0].author || '')}</h3><p>${esc(reviews[0].text || '')}</p><p class="muted">Оценка: ${esc(reviews[0].rating || '5')}/5</p><button class="btn small soft" data-page="reviews">Все отзывы</button></article>`);
    if (examples[0]) cards.push(`<article class="panel link-card" data-page="lessonExamples"><div class="card-icon"><i class="fa-solid fa-file-lines"></i></div><h3>${esc(examples[0].title || 'Пример материала')}</h3><p class="muted">${esc(examples[0].subject || '')} · ${esc(examples[0].type || '')}</p><p>${esc(examples[0].description || '')}</p><button class="btn small soft" data-page="lessonExamples">Примеры</button></article>`);
    if (lessonTypes.length) cards.push(`<article class="panel"><div class="card-icon"><i class="fa-solid fa-wallet"></i></div><h3>Форматы занятий</h3>${lessonTypes.map(t=>`<p class="muted"><strong>${esc(t.title || 'Занятие')}</strong> · ${Number(t.price || 0).toLocaleString('ru-RU')} ₽ · ${esc(t.duration || 60)} мин</p>`).join('')}<button class="btn small soft" data-page="services">Услуги и цены</button></article>`);

    box.innerHTML = cards.length ? cards.join('') : `<article class="panel"><div class="empty">Добавьте отзывы, кейсы, примеры материалов или типы занятий в ЛК преподавателя — они появятся здесь автоматически.</div></article>`;
  }
  window.refreshHomepageLiveContent = refreshHomepageLiveContent;

  async function refreshAllPublicViews(){
    await refreshHomepageLiveContent();
    if (typeof window.loadPublicSlots === 'function') await window.loadPublicSlots().catch(()=>{});
    // Страницы кейсов/отзывов/примеров используют свои функции внутри основного скрипта; при переходе они загрузятся заново.
  }
  window.refreshAllPublicViews = refreshAllPublicViews;

  // После любых изменений преподавателя обновляем публичную часть без перезагрузки.
  document.addEventListener('submit', () => setTimeout(refreshAllPublicViews, 900), true);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cloud-delete-review], [data-cloud-delete-case], [data-cloud-delete-example], [data-cloud-slot-delete], [data-cloud-slot-edit], [data-cloud-slot-complete], [data-cloud-approve-booking], [data-cloud-reject-booking]')) {
      setTimeout(refreshAllPublicViews, 900);
    }
  }, true);

  setTimeout(() => {
    if (!supa() || window.__v14PublicRealtimeReady) return;
    window.__v14PublicRealtimeReady = true;
    try {
      supa().channel('platform-v14-public-sync')
        .on('postgres_changes', {event:'*', schema:'public', table:'reviews'}, refreshAllPublicViews)
        .on('postgres_changes', {event:'*', schema:'public', table:'student_cases'}, refreshAllPublicViews)
        .on('postgres_changes', {event:'*', schema:'public', table:'lesson_examples'}, refreshAllPublicViews)
        .on('postgres_changes', {event:'*', schema:'public', table:'lesson_types'}, refreshAllPublicViews)
        .on('postgres_changes', {event:'*', schema:'public', table:'site_settings'}, refreshAllPublicViews)
        .on('postgres_changes', {event:'*', schema:'public', table:'slots'}, refreshAllPublicViews)
        .subscribe();
    } catch(_) {}
  }, 1200);

  // Применяем прямой URL сразу после загрузки без промежуточного location.assign.
  setTimeout(() => {
    const page = pageFromPath();
    if (page !== currentPage()) window.platformNavigate(page, {replace:true, keepScroll:true});
    if (page === 'home' || currentPage() === 'home') refreshHomepageLiveContent();
  }, 80);
})();
