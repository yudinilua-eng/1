
/* ===== PLATFORM PATCH v19: public/cabinet display modes and top-nav state ===== */
(function(){
  if(window.__platformPatchV19Ready) return; window.__platformPatchV19Ready=true;
  const publicPages=new Set(['home','about','whyMe','parents','services','schedule','payment','contacts','quizzes','cases','lessonExamples','reviews','faq','rules','login']);
  const labelMap={home:'Главная',services:'Программы',about:'Обо мне',whyMe:'Почему со мной',reviews:'Отзывы',schedule:'Запись',contacts:'Контакты'};
  function setMode(page){
    const isPublic=publicPages.has(page);
    document.body.classList.toggle('public-page',isPublic);
    document.body.classList.toggle('cabinet-page',!isPublic);
    document.querySelectorAll('.edu-nav-links [data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===page));
    const top=document.getElementById('eduTopLogin');
    if(top){
      const logged=document.body.classList.contains('is-admin')||document.body.classList.contains('is-student')||document.body.classList.contains('is-logged');
      const target=document.body.classList.contains('is-admin')?'teacherCabinet':(document.body.classList.contains('is-student')?'studentCabinet':'login');
      top.dataset.page= logged?target:'login';
      top.href= logged?(window.platformRouteByPage?.[target]||'/teacher'):'/login';
      top.innerHTML= logged?'<i class="fa-solid fa-user-check"></i> Мой профиль':'<i class="fa-solid fa-user"></i> Личный кабинет';
    }
  }
  const prev=window.setPage;
  if(typeof prev==='function'){
    window.setPage=function(page){setMode(page); return prev.apply(this,arguments);};
  }
  document.addEventListener('click',function(e){
    const a=e.target.closest('.edu-topnav a[data-page]');
    if(!a) return;
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button===1) return;
    e.preventDefault();
    if(typeof window.setPage==='function'){
      history.pushState?.({page:a.dataset.page},'',a.getAttribute('href')||'/');
      window.setPage(a.dataset.page);
      window.scrollTo({top:0,behavior:'auto'});
    }
  },true);
  setTimeout(()=>{
    const current=(document.querySelector('.page.active')?.id||'page-home').replace('page-','');
    setMode(current);
  },100);
  const modeObserver = new MutationObserver(() => {
    const current=(document.querySelector('.page.active')?.id||'page-home').replace('page-','');
    setMode(current);
  });
  document.querySelectorAll('.page').forEach(p => modeObserver.observe(p, { attributes:true, attributeFilter:['class'] }));
  setInterval(()=>{
    const current=(document.querySelector('.page.active')?.id||'page-home').replace('page-','');
    setMode(current);
  },8000);
})();
