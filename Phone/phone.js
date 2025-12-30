function openLink(url) {
  window.open(url, "_blank");
}

/* جلب الإصدار من settings-data.json (اختياري) */
fetch("../settings-data.json")
  .then(res => res.json())
  .then(data => {
    const sw = data.software;
    if (!sw) return;

    const versionEl = document.getElementById("phone-projects-version");
    if (versionEl && sw.version) {
      versionEl.textContent = `Coming Soon!, Current Version: ${sw.version}`;
    }

    if (sw.osName && sw.version) {
      document.title = `${sw.osName} | Phone`;
    }
  })
  .catch(() => {});



  function handlePhoneContactSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const subject = form.subject.value.trim();
  const message = form.message.value.trim();

  const lines = [];
  if (name) lines.push(`Name: ${name}`);
  if (phone) lines.push(`Phone: ${phone}`);
  lines.push('');
  lines.push('Message:');
  lines.push(message);

  const body = lines.join('\n');

  const to = 'mqmr@mqmr.lol';

  const gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&tf=1' +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(gmailUrl, '_blank');

  return false;
}
