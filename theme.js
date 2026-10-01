/* Apply before first paint; shared across Desktop, Simple, Phone and Admin. */
(() => {
  const modes=['light','dark','auto'], media=matchMedia('(prefers-color-scheme: dark)');
  let preference='auto';
  try { const saved=JSON.parse(localStorage.getItem('mqmr_appearance')||'{}'); if(modes.includes(saved.theme))preference=saved.theme; } catch {}
  function apply(){ const mode=preference==='auto'?(media.matches?'dark':'light'):preference; document.documentElement.dataset.theme=mode; document.documentElement.style.colorScheme=mode; window.dispatchEvent(new CustomEvent('mqmr-theme-change',{detail:{preference,mode}})); }
  window.MqMrTheme={get:()=>preference,set(value){if(!modes.includes(value))return; preference=value;try{const saved=JSON.parse(localStorage.getItem('mqmr_appearance')||'{}');localStorage.setItem('mqmr_appearance',JSON.stringify({...saved,theme:value}));}catch{}apply();}};
  media.addEventListener('change',()=>{if(preference==='auto')apply();});
  window.addEventListener('storage',event=>{if(event.key!=='mqmr_appearance')return;try{const saved=JSON.parse(event.newValue||'{}');preference=modes.includes(saved.theme)?saved.theme:'auto';apply();}catch{}});
  apply();
})();
