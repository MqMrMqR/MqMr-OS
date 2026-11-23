import { isOwner, lockOwner, verifiedOwnerClient } from './mail-access.js?v=quick';
import { isLocalPreview } from './preview-mode.js';

const mailbox = document.querySelector('#mailbox');
const gate = document.querySelector('#mailbox-gate');
const gateStatus = document.querySelector('#gate-status');
const redirect = () => location.replace('index.html?access=1');

window.addEventListener('pagehide', () => { mailbox.hidden = true; });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

async function unlock() {
  if (window.self !== window.top) {
    gateStatus.textContent = 'Open Inbox directly to sign in.';
    return;
  }
  try {
    if (isLocalPreview && sessionStorage.getItem('mqmr-inbox-preview') !== '1') return redirect();
    const clientRequest = isLocalPreview
      ? import('./preview-inbox.js?v=images').then(({ previewMailbox }) => previewMailbox())
      : verifiedOwnerClient({ preloadInbox: true });
    const [client, { initializeInbox }] = await Promise.all([clientRequest, import('./inbox.js?v=images')]);
    if (!client) return redirect();
    if (isLocalPreview) {
      mailbox.dataset.preview = 'true';
      document.querySelector('#preview-label').hidden = false;
      document.querySelector('#connect').hidden = true;
    } else {
      client.auth.onAuthStateChange((_event, session) => {
        if (!isOwner(session?.user, session?.access_token, true)) {
          mailbox.hidden = true;
          redirect();
        }
      });
    }

    document.querySelector('#sign-out').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (isLocalPreview) sessionStorage.removeItem('mqmr-inbox-preview');
        else await lockOwner(client);
        mailbox.hidden = true;
        redirect();
      } catch {
        document.querySelector('#mail-status').textContent = 'Could not sign out. Try again.';
        button.disabled = false;
      }
    });

    initializeInbox(client);
    mailbox.hidden = false;
    gate.hidden = true;

    if (!isLocalPreview) {
      const google = document.createElement('script');
      google.src = 'https://accounts.google.com/gsi/client';
      google.async = true;
      document.head.append(google);
    }
  } catch {
    gateStatus.textContent = 'Could not verify inbox access. Check your connection and reload.';
  }
}

unlock();
