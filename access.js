import { isLocalPreview } from './preview-mode.js';

const $ = selector => document.querySelector(selector);
const dialog = $('#access');
const form = $('#access-form');
const verification = $('#verify-form');
const email = $('#email');
const password = $('#password');
const code = $('#verification-code');
const status = $('#access-status');
const hint = $('#access-hint');
const qr = $('#authenticator-qr');
let editor = false;
let busy = false;
let client = null;
let ownerCheck;
let factorId;
let pendingFactor;

function openAccess(forEditor) {
  if (dialog.open || busy) return;
  editor = forEditor;
  $('#access-title').textContent = editor ? 'Private server' : 'Private inbox';
  $('#password-label').textContent = editor ? 'Server password' : 'Password';
  $('#unlock').textContent = editor ? 'Connect' : 'Continue';
  $('#email-field').hidden = isLocalPreview && editor;
  email.required = !$('#email-field').hidden;
  email.value = isLocalPreview && !editor ? 'viewer@example.test' : '';
  password.autocomplete = isLocalPreview ? 'off' : 'current-password';
  hint.hidden = !isLocalPreview || editor;
  hint.textContent = hint.hidden ? '' : 'Use a sample password to open the inbox preview.';
  dialog.showModal();
  (email.required && !email.value ? email : password).focus();
}

function setBusy(active) {
  busy = active;
  for (const id of ['#close-access', '#unlock', '#verify', '#enroll']) $(id).disabled = active;
}

function destination() {
  return editor ? 'editor.html' : 'inbox.html';
}

function enterPreview() {
  sessionStorage.setItem(editor ? 'mqmr-editor-preview' : 'mqmr-inbox-preview', '1');
  location.assign(destination());
}

function showVerification() {
  form.hidden = true;
  verification.hidden = false;
  code.maxLength = isLocalPreview ? 2 : 6;
  code.pattern = isLocalPreview ? '[0-9]{2}' : '[0-9]{6}';
  code.setAttribute('aria-describedby', 'access-hint');
  hint.textContent = isLocalPreview ? 'Enter the preview code 69.' : 'Enter the six-digit code from your authenticator.';
  hint.hidden = false;
  code.focus();
}

async function cancelPendingLogin() {
  if (pendingFactor) await client.auth.mfa.unenroll({ factorId: pendingFactor }).catch(() => {});
  if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {});
}

$('#open-access').addEventListener('click', () => openAccess(false));
$('#open-connect').addEventListener('click', () => openAccess(true));
$('#close-access').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
dialog.addEventListener('close', async () => {
  const signinInProgress = Boolean(client);
  if (signinInProgress) setBusy(true);
  form.reset();
  verification.reset();
  verification.hidden = true;
  form.hidden = false;
  $('#enroll').hidden = true;
  $('#authenticator-setup').hidden = true;
  qr.removeAttribute('src');
  $('#authenticator-key').textContent = '';
  status.textContent = '';
  if (/^\?(access|connect)=1$/.test(location.search)) history.replaceState(null, '', location.pathname);
  try {
    await cancelPendingLogin();
  } finally {
    client = null;
    pendingFactor = factorId = undefined;
    setBusy(false);
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  status.textContent = '';
  if (isLocalPreview) {
    if (!password.value.trim()) {
      status.textContent = 'Enter a sample password.';
      return;
    }
    password.value = '';
    if (editor) enterPreview();
    else showVerification();
    return;
  }

  setBusy(true);
  try {
    const { mailboxClient, isOwner } = await import('./mail-access.js');
    const mailbox = await mailboxClient();
    const { data, error } = await mailbox.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    });
    if (error || !isOwner(data.user, data.session?.access_token)) {
      if (!error) await mailbox.auth.signOut({ scope: 'local' });
      status.textContent = error?.status === 429 ? 'Too many attempts. Try again later.' : 'Could not sign in. Check your email and password.';
      return;
    }
    client = mailbox;
    ownerCheck = isOwner;
    const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
    if (factorError) throw factorError;
    factorId = factors.totp.find(factor => factor.status === 'verified')?.id;
    if (factorId) showVerification();
    else {
      form.hidden = true;
      hint.hidden = false;
      hint.textContent = 'Set up an authenticator to finish signing in.';
      $('#enroll').hidden = false;
      $('#enroll').focus();
    }
  } catch {
    status.textContent = 'Could not start verification. Try again.';
  } finally {
    password.value = '';
    setBusy(false);
  }
});

$('#enroll').addEventListener('click', async () => {
  if (!client || busy) return;
  setBusy(true);
  status.textContent = '';
  try {
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: 'MqR' });
    if (error) throw error;
    pendingFactor = factorId = data.id;
    const image = data.totp.qr_code;
    if (image.startsWith('data:image/svg+xml')) qr.src = image;
    else if (image.trimStart().startsWith('<svg')) qr.src = 'data:image/svg+xml,' + encodeURIComponent(image);
    $('#authenticator-key').textContent = data.totp.secret;
    $('#authenticator-setup').hidden = false;
    $('#enroll').hidden = true;
    showVerification();
  } catch {
    status.textContent = 'Could not set up your authenticator. Try again.';
  } finally {
    setBusy(false);
  }
});

verification.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  status.textContent = '';
  if (isLocalPreview) {
    if (code.value === '69') enterPreview();
    else status.textContent = 'That code does not match.';
    code.value = '';
    return;
  }

  if (!client || !factorId) return;
  setBusy(true);
  try {
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.value });
    if (error || !data?.access_token) {
      status.textContent = 'That code could not be verified. Try the current code from your authenticator.';
      return;
    }
    pendingFactor = undefined;
    const result = await client.auth.getUser(data.access_token);
    if (result.error || !ownerCheck(result.data.user, data.access_token, true)) {
      status.textContent = 'Could not verify the owner session.';
      return;
    }
    client = null;
    location.assign(destination());
  } catch {
    status.textContent = 'Verification is temporarily unavailable. Try again.';
  } finally {
    code.value = '';
    setBusy(false);
  }
});

const params = new URLSearchParams(location.search);
if (params.get('access') === '1' || params.get('connect') === '1') openAccess(params.get('connect') === '1');
