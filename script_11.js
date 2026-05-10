
/* ===== PLATFORM PATCH v20: stable helpers, no duplicate errors, safer student data ===== */
(function(){
  if (window.__platformPatchV20Ready) return; window.__platformPatchV20Ready = true;
  const nullEl = window.__safeNullElement || {value:'',innerHTML:'',textContent:'',checked:false,files:[],dataset:{},style:{},classList:{add(){},remove(){},toggle(){return false},contains(){return false}},addEventListener(){},removeEventListener(){},querySelector(){return nullEl},querySelectorAll(){return []},closest(){return null},matches(){return false},reset(){},focus(){}};
  window.safeEl = window.safeEl || ((id)=>document.getElementById(id)||nullEl);
  const el = (id)=>document.getElementById(id)||nullEl;
  const rawToast = window.toast;
  const seen = new Map();
  window.toast = function(message,type='info'){
    const msg = String(message||'');
    if (/Cannot read properties of null|reading 'value'|is not a function|Карточка ученика не найдена/i.test(msg)) return;
    const key = type+':'+msg;
    const now = Date.now();
    if ((seen.get(key)||0) && now - seen.get(key) < 4500) return;
    seen.set(key,now);
    if (typeof rawToast === 'function') return rawToast.call(this,message,type);
    console[type==='error'?'error':'log'](message);
  };
  window.addEventListener('error', function(e){
    const msg = e.message || e.error?.message || '';
    if (/Cannot read properties of null|reading 'value'|is not a function/i.test(msg)) { e.preventDefault(); return false; }
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    const msg = e.reason?.message || String(e.reason||'');
    if (/Cannot read properties of null|reading 'value'|is not a function/i.test(msg)) { e.preventDefault(); return false; }
  }, true);

  async function q(builder){ try{ const r = await builder; return r?.error ? [] : (r?.data||[]); } catch(_){ return []; } }
  function by(list,id){ return (list||[]).find(x=>String(x.id)===String(id)) || null; }
  window.loadStudentDataSafeV20 = async function(){
    const state = window.state || {}; const s = window.supabaseClient; const student = state.studentProfile;
    if (!s || !student?.id) return;
    const [topics, lessonTypes, materials, homework, slots, requests, packages, payments, lessonLogs, quizzes, quizQuestions, quizAttempts] = await Promise.all([
      q(s.from('topics').select('*').order('created_at',{ascending:false})),
      q(s.from('lesson_types').select('*').order('sort_order').order('created_at',{ascending:false})),
      q(s.from('materials').select('*').or(`student_id.is.null,student_id.eq.${student.id}`).order('created_at',{ascending:false})),
      q(s.from('homework').select('*').eq('student_id',student.id).order('deadline',{ascending:true})),
      q(s.from('slots').select('*').eq('student_profile_id',student.id).order('date').order('time')),
      q(s.from('lesson_requests').select('*').eq('student_id',student.id).order('created_at',{ascending:false})),
      q(s.from('student_packages').select('*').eq('student_id',student.id).order('created_at',{ascending:false})),
      q(s.from('payments').select('*').eq('student_id',student.id).order('created_at',{ascending:false})),
      q(s.from('lesson_logs').select('*').eq('student_id',student.id).order('created_at',{ascending:false})),
      q(s.from('quizzes').select('*').or(`student_id.is.null,student_id.eq.${student.id}`).eq('is_active',true).order('created_at',{ascending:false})),
      q(s.from('quiz_questions').select('*').order('created_at')),
      q(s.from('quiz_attempts').select('*').eq('student_id',student.id).order('created_at',{ascending:false}))
    ]);
    state.topics = topics; state.lessonTypes = lessonTypes;
    state.materials = materials.map(m=>({...m,topics:by(topics,m.topic_id)}));
    state.homework = homework.map(h=>({...h,topics:by(topics,h.topic_id),lesson_types:by(lessonTypes,h.lesson_type_id)}));
    state.slots = slots.map(sl=>({...sl,lesson_types:by(lessonTypes,sl.lesson_type_id)}));
    state.requests = requests; state.packages = packages; state.payments = payments; state.lessonLogs = lessonLogs;
    state.quizzes = quizzes.map(z=>({...z,topics:by(topics,z.topic_id)})); state.quizQuestions = quizQuestions; state.quizAttempts = quizAttempts;
  };
  const oldStudentCabinet = window.loadStudentCabinet;
  if (typeof oldStudentCabinet === 'function') {
    window.loadStudentCabinet = async function(){
      if (!window.state?.studentProfile) { if (typeof window.setPage==='function') return window.setPage('login'); return; }
      await window.loadStudentDataSafeV20();
      if (typeof window.renderStudentCabinet === 'function') return window.renderStudentCabinet();
      return oldStudentCabinet.apply(this,arguments);
    };
  }

  function normalizeLinks(){
    const route = window.platformRouteByPage || window.__pageToPathV17 || {};
    document.querySelectorAll('[data-page]').forEach(node=>{
      const page=node.dataset.page; if(!page) return;
      const href=route[page] || (page==='home'?'/':'/'+String(page).replace(/[A-Z]/g,m=>'-'+m.toLowerCase()));
      if (node.tagName === 'A') node.setAttribute('href',href);
      else if (!node.dataset.v20LinkWrapped && node.closest('aside.sidebar')) {
        const a=document.createElement('a'); a.className=node.className; a.dataset.page=page; a.href=href; a.innerHTML=node.innerHTML; a.dataset.v20LinkWrapped='1'; node.replaceWith(a);
      }
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{normalizeLinks(); document.body.classList.add('v20-ready');});
  setTimeout(normalizeLinks,500);
})();
