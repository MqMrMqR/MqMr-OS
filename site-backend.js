/* Publishable browser credentials; authorization is enforced by database RLS. */
window.siteBackend = window.supabase?.createClient(
  'https://ebufvcuxcypoxwbvcbjg.supabase.co',
  'sb_publishable_3UET6C2bQ5vwSE8wzTY5Tw_jt2NiAvJ',
  { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }
);
window.siteContentDocuments = Object.create(null);
const siteContentRequests = new Map();
window.fetchSiteContent = async function(path) {
  const key = path.replace(/^(\.\/|\.\.\/)+/, '');
  if (window.parent !== window && new URLSearchParams(location.search).has('editor')) {
    try {
      const draft = window.parent.MqMrEditor?.getContent(key);
      if (draft) { window.siteContentDocuments[key] = draft; return new Response(JSON.stringify(draft)); }
    } catch {}
  }
  if (!siteContentRequests.has(key)) siteContentRequests.set(key, (async () => {
  try {
    if (window.siteBackend) {
      const { data, error } = await siteBackend.from('site_content').select('content').eq('path', key).maybeSingle().abortSignal(AbortSignal.timeout(4000));
      if (!error && data) return data.content;
    }
  } catch (error) { console.warn('Using bundled content:', error.message); }
  const response = await fetch(path);
  if (!response.ok) throw new Error('Content unavailable: ' + key);
  return response.json();
  })());
  try {
    const content = await siteContentRequests.get(key);
    window.siteContentDocuments[key] = content;
    return new Response(JSON.stringify(content), {headers:{'Content-Type':'application/json'}});
  } catch (error) { siteContentRequests.delete(key); throw error; }
};
window.signInToSite = async function() {
  if (!window.siteBackend) throw new Error('Sign-in service could not load. Check your connection and reload.');
  const { error } = await siteBackend.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
  if (error) throw error;
};
