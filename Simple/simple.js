/* ================= CLOCK ================= */
function updateClock() {
  const now = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const d = days[now.getDay()];
  const m = months[now.getMonth()];
  const day = now.getDate();

  let h = now.getHours();
  const min = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;

  const clockEl = document.getElementById('clock');
  if (clockEl) {
    clockEl.textContent = `${d} ${m} ${day} ${h}:${min} ${ampm}`;
  }
}
updateClock();
setInterval(updateClock, 1000);

/* ================= SETTINGS-DATA (اختياري) ================= */
fetch("../settings-data.json")
  .then(res => res.json())
  .then(data => {
    const sw = data.software;
    if (!sw) return;

    // نخزنها لو احتجناها
    window.softwareInfo = sw;

    if (sw.osName && sw.version) {
      document.title = `${sw.osName} | ${sw.version}`;
    }

    const menuLabel = document.querySelector('.menubar-left .menubar-item strong');
    if (menuLabel && sw.osName) {
      menuLabel.textContent = sw.osName;
    }

    // تحديث نص "Current Version" في كرت Projects
    const projectsVersion = document.getElementById('simple-projects-version');
    if (projectsVersion && sw.version) {
      projectsVersion.textContent = `Coming Soon!, Current Version: ${sw.version}`;
    }
  })
  .catch(() => {
    // عادي لو ما فيه ملف settings-data.json
  });

/* ================= CONTACT FORM (نفس فكرة الأصل) ================= */
function handleSimpleContactSubmit(e) {
  e.preventDefault();

  const form = e.target;

  const name = form.elements['simple-name']?.value.trim() || '';
  const phone = form.elements['simple-phone']?.value.trim() || '';
  const subject =
    form.elements['simple-subject']?.value.trim() || 'New message from your OS (Simple)';
  const message = form.elements['simple-message']?.value.trim() || '';

  const lines = [];

  if (name) lines.push(`Name: ${name}`);
  if (phone) {
    lines.push(`Phone: ${phone}`);
  } else {
    lines.push('Phone: (not provided)');
  }

  lines.push('');
  lines.push('Message:');
  lines.push(message || '(no message)');

  const body = lines.join('\n');

  const to = 'mqmr@mqmr.lol';

  const gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&tf=1' +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(
    gmailUrl,
    'gmail-compose',
    'width=550,height=525'
  );

  return false;
}


function toggleSimpleSettings(force) {
  const overlay = document.getElementById('simple-settings-overlay');
  if (!overlay) return;

  if (force === true) {
    overlay.classList.remove('hidden');
  } else if (force === false) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.toggle('hidden');
  }
}

function overlayClickToClose(event) {
  if (event.target.id === 'simple-settings-overlay') {
    toggleSimpleSettings(false);
  }
}

/* ================= DISPLAY MODE (Simple) ================= */
(function () {
  const advancedSwitch = document.getElementById("simple-advanced-display-switch");
  const displaySelect  = document.getElementById("simple-display-mode-select");

  const dialog      = document.getElementById("simple-display-mode-dialog");
  const btnCancel   = document.getElementById("simple-display-dialog-cancel");
  const btnContinue = document.getElementById("simple-display-dialog-continue");

  if (!advancedSwitch || !displaySelect || !dialog) return;

  const baseOptions = [
    { value: "standard", label: "Standard" },
    { value: "simple",   label: "Simple" },
  ];

  const advancedOptions = [
    ...baseOptions,
    { value: "phone", label: "Phone" },
  ];

let isAdvancedOn = false;
let currentMode  = "simple";
let pendingMode  = null;

// عشان الواجهة تكون صح:
displaySelect.value = "simple";
document.body.classList.add("display-simple");

  function getOptions() {
    return isAdvancedOn ? advancedOptions : baseOptions;
  }

  function applyDisplayMode() {
    document.body.classList.remove("display-standard", "display-simple", "display-phone");
    const cls = "display-" + (currentMode || "standard");
    document.body.classList.add(cls);
  }

  function refreshDisplayOptions() {
    const previousValue = displaySelect.value || currentMode;
    const options = getOptions();

    displaySelect.innerHTML = "";
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      displaySelect.appendChild(o);
    });

    if (!options.some(o => o.value === previousValue)) {
      // مثلاً كنا على phone وقفلنا advanced
      currentMode = "standard";
      displaySelect.value = "standard";
    } else {
      currentMode = previousValue;
      displaySelect.value = previousValue;
    }

    applyDisplayMode();
  }

  function openDialog() {
    dialog.classList.remove("modal-hidden");
  }

  function closeDialog() {
    dialog.classList.add("modal-hidden");
    pendingMode = null;
  }

  // switch on/off
  advancedSwitch.addEventListener("click", () => {
    isAdvancedOn = !isAdvancedOn;
    advancedSwitch.classList.toggle("is-on", isAdvancedOn);
    advancedSwitch.setAttribute("aria-pressed", String(isAdvancedOn));

    refreshDisplayOptions();
  });

  // لما يغير الـ select
  displaySelect.addEventListener("change", (e) => {
    const newValue = e.target.value;
    if (newValue === currentMode) return;

    pendingMode = newValue;
    openDialog();
  });

  // أزرار الـ Dialog
  btnCancel.addEventListener("click", () => {
    // رجّع الـ select للوضع الحالي
    displaySelect.value = currentMode;
    closeDialog();
  });

btnContinue.addEventListener("click", () => {
  if (!pendingMode) {
    closeDialog();
    return;
  }

  const newMode = pendingMode;
  pendingMode = null;
  currentMode = newMode;

  closeDialog();

  // 🔥 التحويل بين الصفحات
  if (newMode === "standard") {
    window.location.href = "../index.html"; 
  } 
  else if (newMode === "simple") {
    window.location.href = "./simple.html";  
  } 
  else if (newMode === "phone") {
    window.location.href = "../Phone/phone.html";
  }
});

  // Init
  refreshDisplayOptions();
  advancedSwitch.classList.toggle("is-on", isAdvancedOn);
  advancedSwitch.setAttribute("aria-pressed", String(isAdvancedOn));
})();

function toggleSimpleSettings(force) {
  const overlay = document.getElementById('simple-settings-overlay');
  if (!overlay) return;

  if (typeof force === 'boolean') {
    // force = true → افتح | false → اقفل
    overlay.hidden = !force ? true : false;
  } else {
    // لو ما حددنا force → toggle
    overlay.hidden = !overlay.hidden;
  }
}

function overlayClickToClose(event) {
  // ما نقفل إلا لو الضغط كان على الخلفية نفسها
  if (event.target.id === 'simple-settings-overlay') {
    toggleSimpleSettings(false);
  }
}



(function redirectToPhoneIfMobile() {
  const isPhone =
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(
      navigator.userAgent
    ) ||
    window.innerWidth <= 768;

  if (isPhone) {
    const currentPath = window.location.pathname;

    // لو هو بالفعل في نسخة Phone لا نسوي شي
    if (!currentPath.includes('/Phone/')) {
      window.location.replace('https://mqmr.lol/Phone/phone.html');
    }
  }
})();
