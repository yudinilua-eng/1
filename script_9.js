
/* ===== PLATFORM PATCH v18: student self password, teacher visible password, progress graphics, theme ===== */
(function(){
  if(window.__platformPatchV18Ready) return; window.__platformPatchV18Ready=true;
  const $=id=>document.getElementById(id);
  const toast=(m,t='info')=>typeof window.toast==='function'?window.toast(m,t):alert(m);
  async function sha256(text){ const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||''))); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  const supa=()=>window.supabaseClient;
  function applyTheme(theme){
    document.body.classList.remove('student-theme-calm','student-theme-sky','student-theme-mint','student-theme-sunset');
    document.body.classList.add('student-theme-'+(theme||'calm'));
    localStorage.setItem('student_theme',theme||'calm');
  }
  function initTheme(){ applyTheme(localStorage.getItem('student_theme')||'calm'); }
  function renderStudentProgressV18(){
    const hw=window.state?.homework||[];
    const total=hw.length;
    const done=hw.filter(h=>h.is_done || h.status==='checked' || h.status==='done').length;
    const checked=hw.filter(h=>h.grade_percent!==null && h.grade_percent!==undefined).length;
    const avg=checked?Math.round(hw.filter(h=>h.grade_percent!==null&&h.grade_percent!==undefined).reduce((s,h)=>s+Number(h.grade_percent||0),0)/checked):0;
    const pending=Math.max(0,total-done);
    const pct=total?Math.round(done/total*100):0;
    const donut=$('studentHomeworkDonut'), text=$('studentHomeworkDonutText'), badge=$('studentProgressBadge'), legend=$('studentProgressLegend');
    if(donut) donut.style.setProperty('--p',pct);
    if(text) text.textContent=pct+'%';
    if(badge) badge.textContent=done+' / '+total;
    if(legend) legend.innerHTML=`<div class="legend-row"><span>Выполнено</span><strong>${done}</strong></div><div class="legend-row"><span>В работе</span><strong>${pending}</strong></div><div class="legend-row"><span>Проверено</span><strong>${checked}</strong></div><div class="legend-row"><span>Средний результат</span><strong>${avg}%</strong></div>`;
  }
  const oldRender=window.renderStudentCabinet;
  if(typeof oldRender==='function'){
    window.renderStudentCabinet=function(){ oldRender.apply(this,arguments); renderStudentProgressV18(); initTheme(); };
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-theme]'); if(!b) return;
    e.preventDefault(); applyTheme(b.dataset.theme); toast('Оформление кабинета обновлено','success');
  },true);
  document.addEventListener('submit',async e=>{
    if(e.target?.id!=='studentChangePasswordForm') return;
    e.preventDefault(); e.stopImmediatePropagation();
    const password=($('studentNewPassword')?.value||'').trim();
    const studentId=window.state?.studentProfile?.id || localStorage.getItem('student_session_id');
    if(!studentId) return toast('Сначала войдите как ученик','error');
    if(password.length<6) return toast('Пароль должен быть не короче 6 символов','error');
    try{
      const p_password_hash=await sha256(password);
      const {error}=await supa().rpc('student_change_own_password_v18',{p_student_id:studentId,p_password_hash,p_password_plain:password});
      if(error) throw error;
      $('studentNewPassword').value='';
      toast('Пароль изменён. Преподаватель увидит актуальный пароль в карточке ученика.','success');
    }catch(err){
      toast('Не удалось сменить пароль: '+(err.message||err),'error');
    }
  },true);
  // Улучшаем профильный блок и убираем оранжевый дубль после каждого рендера.
  function cleanProfileDuplicates(){
    document.querySelectorAll('a,button').forEach(el=>{
      const txt=(el.textContent||'').trim().toLowerCase();
      if(document.body.classList.contains('is-logged') && txt==='мой профиль' && !el.closest('.profile-dock') && !el.closest('aside.sidebar')){
        const st=getComputedStyle(el); if(st.backgroundColor.includes('204')||st.backgroundColor.includes('221')||el.className.includes('orange')) el.style.display='none';
      }
    });
  }
  const oldGetCreds=window.getCredsV18;
  setInterval(()=>{renderStudentProgressV18(); cleanProfileDuplicates();},1200);
  document.addEventListener('DOMContentLoaded',()=>{initTheme(); setTimeout(()=>{renderStudentProgressV18(); cleanProfileDuplicates();},600);});
})();
