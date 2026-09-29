/* Publishable browser credentials; authorization is enforced by database RLS. */
window.siteBackend = window.supabase?.createClient(
  'https://ebufvcuxcypoxwbvcbjg.supabase.co',
  'sb_publishable_3UET6C2bQ5vwSE8wzTY5Tw_jt2NiAvJ',
  { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }
);
window.fetchSiteContent = async function(path) {
  const key = path.replace(/^(\.\/|\.\.\/)+/, '');
  try {
    if (window.siteBackend) {
      const { data, error } = await siteBackend.from('site_content').select('content').eq('path', key).maybeSingle().abortSignal(AbortSignal.timeout(4000));
      if (!error && data) return new Response(JSON.stringify(data.content), { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) { console.warn('Using bundled content:', error.message); }
  return fetch(path);
};
window.signInToSite = async function() {
  if (!window.siteBackend) throw new Error('Sign-in service could not load. Check your connection and reload.');
  const { error } = await siteBackend.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
  if (error) throw error;
};
