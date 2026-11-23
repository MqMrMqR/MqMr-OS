import { lockRemembered, rememberedOwnerClient } from './device-client.js?v=quick';

export const ownerEmail = 'mqmrpc@gmail.com';
export const ownerId = '5922fd59-f07a-4ec9-8939-abc615b7c640';
export const url = 'https://ebufvcuxcypoxwbvcbjg.supabase.co';
export const publishableKey = 'sb_publishable_3UET6C2bQ5vwSE8wzTY5Tw_jt2NiAvJ';
export const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js';
export const sdkIntegrity = 'sha384-l7yJnh/cWKcqeTC5adHUdc5b+J4Kb2QTGRSkCQehn1YT5xEFlrgwnXOYuvrtI1F6';
let clientPromise;
export const sessionStorageKey = 'mqmr-private-inbox';

export function mailboxClient() {
  clientPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sdkUrl;
    script.crossOrigin = 'anonymous';
    script.integrity = sdkIntegrity;
    script.onload = () => {
      try {
        resolve(window.supabase.createClient(url, publishableKey, {
          auth: {
            detectSessionInUrl: false,
            storage: sessionStorage,
            storageKey: sessionStorageKey,
            persistSession: true,
            autoRefreshToken: true
          }
        }));
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = reject;
    document.head.append(script);
  }).catch(error => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}

// Use only with a token validated by signInWithPassword or getUser.
export function isOwner(user, token, requireMfa = false) {
  if (user?.id !== ownerId || user?.email !== ownerEmail || user?.app_metadata?.role !== 'admin') return false;
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded));
    if (claims.sub !== ownerId || !Array.isArray(claims.amr)) return false;
    const hasMethod = method => claims.amr.some(entry => entry?.method === method);
    return hasMethod('password') && (!requireMfa || (claims.aal === 'aal2' && hasMethod('totp')));
  } catch {
    return false;
  }
}

export async function verifiedOwnerClient(options) {
  if (!sessionStorage.getItem(sessionStorageKey)) {
    return rememberedOwnerClient(options);
  }
  const client = await mailboxClient();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError && (!sessionError.status || sessionError.status >= 500)) throw sessionError;
  if (!session) return rememberedOwnerClient(options);

  const { data, error } = await client.auth.getUser(session.access_token);
  if (error && (!error.status || error.status >= 500)) throw error;
  if (!error && isOwner(data.user, session.access_token, true)) return client;
  return rememberedOwnerClient(options);
}
export async function lockOwner(client) {
  if (!client.remembered) await lockRemembered();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
