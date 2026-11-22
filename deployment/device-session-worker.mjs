const siteOrigin = 'https://mqmr.bio';
const prefix = '/api/device-session/';
const backend = 'https://ebufvcuxcypoxwbvcbjg.supabase.co/functions/v1/device-sessions/';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const route = url.pathname.slice(prefix.length);
    if (url.origin !== siteOrigin || !url.pathname.startsWith(prefix) || !/^[a-z-]+$/.test(route)) {
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }
    const headers = new Headers();
    for (const name of ['authorization', 'content-type', 'origin', 'sec-fetch-site', 'user-agent']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const sessionCookie = request.headers.get('cookie')?.split(';').map(value => value.trim())
      .find(value => value.startsWith('__Host-mqr-device='));
    if (sessionCookie) headers.set('cookie', sessionCookie);
    try {
      const upstream = await fetch(backend + route, {
        method: request.method, headers, body: request.body,
        redirect: 'manual', cache: 'no-store', ...(request.body && { duplex: 'half' })
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        return Response.json({ error: 'Unexpected session server redirect.' }, {
          status: 502, headers: { 'Cache-Control': 'no-store' }
        });
      }
      const output = new Headers({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      const cookies = upstream.headers.getSetCookie?.() ?? upstream.headers.getAll('Set-Cookie');
      const cookie = cookies.find(value => value.startsWith('__Host-mqr-device='));
      if (cookie) output.set('Set-Cookie', cookie);
      return new Response(upstream.body, { status: upstream.status, headers: output });
    } catch {
      return Response.json({ error: 'Device sessions are temporarily unavailable.' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' }
      });
    }
  }
};
