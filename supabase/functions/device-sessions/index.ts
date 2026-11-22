import session from './session.mjs';

const siteOrigin = 'https://mqmr.bio';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const encoder = new TextEncoder();

async function configuration() {
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(serviceRoleKey), 'HKDF', false, ['deriveBits']
  );
  const bytes = await crypto.subtle.deriveBits({
    name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(siteOrigin),
    info: encoder.encode('mqr/device-session-credentials/v1')
  }, material, 256);
  return {
    SITE_ORIGIN: siteOrigin,
    SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_3UET6C2bQ5vwSE8wzTY5Tw_jt2NiAvJ',
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    DEVICE_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(bytes)))
  };
}

const config = configuration();

Deno.serve(async request => {
  const path = new URL(request.url).pathname;
  const route = path.split('/').at(-1);
  const upstream = new Request(siteOrigin + '/api/device-session/' + route, request);
  return session.fetch(upstream, await config, EdgeRuntime);
});
