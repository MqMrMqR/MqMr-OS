/* ================= CLOCK ================= */
function updateClock() {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/* ================= GLOBAL DATA ================= */
let mainData = null;
let contactAppData = null;
let settingsAppData = null;

/* ================= HELPERS ================= */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/* ================= MAIN DATA ================= */
async function loadMainData() {
  try {
    const res = await fetch("../main-data.json");
    const data = await res.json();
    mainData = data;

    const site = data.site || {};
    const osName = site.osName || "MqMr's OS";
    const version = site.version || "1.0.0v";
    const creator = site.creator || "MqMr";
    const osLink = site.osLink || "mqmr.lol";

    window.softwareInfo = { osName, version, creator };

    const menuLabel = document.querySelector('.menubar-left .menubar-item strong');
    if (menuLabel) menuLabel.textContent = osName;

const osLinkInput = document.getElementById("simple-os-link-input");
if (osLinkInput) {
  osLinkInput.value = osLink;
}

    const tabTemplate = data.tabs?.simple || "{osName} - Simple | {version}";
    document.title = tabTemplate
      .replace("{osName}", osName)
      .replace("{version}", version);

    setText("hero-title", `Welcome to ${osName}`);
    setText("hero-subtitle", "Building digital experiences that matter.");
  } catch (error) {
    console.warn("Could not load ../main-data.json", error);
  }
}

/* ================= ABOUT APP ================= */
async function loadAboutMeApp() {
  try {
    const res = await fetch("../Apps/AboutMe.json");
    const data = await res.json();

    setText("about-card-title", data.appName || "About Me");
    setText("about-card-subtitle", "A quick snapshot of who I am.");

    const avatarEl = document.getElementById("about-avatar");
    const nameEl = document.getElementById("about-name");
    const subtitleEl = document.getElementById("about-subtitle");
    const descriptionEl = document.getElementById("about-description");

    if (avatarEl) avatarEl.src = "../" + (data.avatar || "assets/avatar.jpg");
    if (nameEl) nameEl.textContent = data.name || "";
    if (subtitleEl) subtitleEl.textContent = data.subtitle || "";
    if (descriptionEl) descriptionEl.textContent = data.description || "";

    const socials = data.socials || {};

    const instagramBtn = document.getElementById("about-instagram-btn");
    const discordBtn = document.getElementById("about-discord-btn");
    const xBtn = document.getElementById("about-x-btn");
    const youtubeBtn = document.getElementById("about-youtube-btn");

    if (instagramBtn && socials.instagram) {
      instagramBtn.onclick = () => window.open(socials.instagram, "_blank");
    }
    if (discordBtn && socials.discord) {
      discordBtn.onclick = () => window.open(socials.discord, "_blank");
    }
    if (xBtn && socials.x) {
      xBtn.onclick = () => window.open(socials.x, "_blank");
    }
    if (youtubeBtn && socials.youtube) {
      youtubeBtn.onclick = () => window.open(socials.youtube, "_blank");
    }
  } catch (error) {
    console.warn("Failed to load ../Apps/AboutMe.json", error);
  }
}

/* ================= PROJECTS APP ================= */
async function loadProjectsApp() {
  try {
    const res = await fetch("../Apps/Projects.json");
    const data = await res.json();

    setText("projects-card-title", data.Section?.title || "Projects");
    setText("projects-card-subtitle", data.Section?.subtitle || "");

    const versionEl = document.getElementById("simple-projects-version");
    if (versionEl) {
      versionEl.textContent = `Current Version: ${window.softwareInfo?.version || "—"}`;
    }

    const listEl = document.getElementById("projects-embed-list");
    if (!listEl) return;

    listEl.innerHTML = "";

    const appTags = data.AppTags || {};
    const projects = safeArray(data.Projects).filter(project => project.show !== false);

    projects.forEach(project => {
      const item = document.createElement("div");
      item.className = "embed-project-item";

      const top = document.createElement("div");
      top.className = "embed-project-top";

      const name = document.createElement("h3");
      name.className = "embed-project-name";
      name.textContent = project.name || "Untitled Project";

      const tagsWrap = document.createElement("div");
      tagsWrap.className = "embed-project-tags";

      safeArray(project.tags).forEach(tagKey => {
        const tagInfo = appTags[tagKey];
        const tagEl = document.createElement("span");
        tagEl.className = "embed-project-tag";
        tagEl.textContent = tagInfo?.label || tagKey;

        if (tagInfo?.bgColor) tagEl.style.background = tagInfo.bgColor;
        if (tagInfo?.textColor) tagEl.style.color = tagInfo.textColor;

        tagsWrap.appendChild(tagEl);
      });

      top.appendChild(name);
      if (tagsWrap.childNodes.length > 0) top.appendChild(tagsWrap);

      const desc = document.createElement("p");
      desc.className = "embed-project-desc";
      desc.textContent = project.description || "";

      const actions = document.createElement("div");
      actions.className = "embed-project-actions";

      const websiteLink = project.links?.website?.trim();
      const githubLink = project.links?.github?.trim();

      if (websiteLink) {
        const websiteBtn = document.createElement("a");
        websiteBtn.className = "embed-action-btn";
        websiteBtn.href = websiteLink;
        websiteBtn.target = "_blank";
        websiteBtn.rel = "noopener noreferrer";
        websiteBtn.textContent = "Website";
        actions.appendChild(websiteBtn);
      }

      if (githubLink) {
        const githubBtn = document.createElement("a");
        githubBtn.className = "embed-action-btn embed-action-btn-secondary";
        githubBtn.href = githubLink;
        githubBtn.target = "_blank";
        githubBtn.rel = "noopener noreferrer";
        githubBtn.textContent = "GitHub";
        actions.appendChild(githubBtn);
      }

      item.appendChild(top);
      item.appendChild(desc);
      if (actions.childNodes.length > 0) item.appendChild(actions);

      listEl.appendChild(item);
    });
  } catch (error) {
    console.warn("Failed to load ../Apps/Projects.json", error);
  }
}

/* ================= WORKSPACE APP ================= */
async function loadWorkspaceApp() {
  try {
    const res = await fetch("../Apps/Workspace.json");
    const data = await res.json();

    setText("workspace-card-title", data.Section?.title || "Workspace");
    setText("workspace-card-subtitle", data.Section?.subtitle || "");

    setText("workspace-areas-title", data.AreasSection?.title || "Build Areas");
    setText("workspace-tools-title", data.ToolsSection?.title || "Tools");
    setText("workspace-hardware-title", data.HardwareSection?.title || "Device Specs");

    const areasList = document.getElementById("workspace-areas-list");
    const toolsList = document.getElementById("workspace-tools-list");
    const hardwareList = document.getElementById("workspace-hardware-list");

    if (areasList) {
      areasList.innerHTML = "";
      safeArray(data.Areas).forEach(area => {
        const item = document.createElement("li");
        item.innerHTML = `
          <span class="embed-line-title">${area.title || "Untitled"}</span>
          <span class="embed-line-text">${area.description || ""}</span>
        `;
        areasList.appendChild(item);
      });
    }

    if (toolsList) {
      toolsList.innerHTML = "";
      safeArray(data.Tools).forEach(tool => {
        const item = document.createElement("li");
        item.innerHTML = `
          <span class="embed-line-title">${tool.name || "Unknown Tool"}</span>
          <span class="embed-line-text">${tool.type || ""}</span>
        `;
        toolsList.appendChild(item);
      });
    }

    if (hardwareList) {
      hardwareList.innerHTML = "";
      safeArray(data.Hardware?.items).forEach(spec => {
        const valueText = Array.isArray(spec.values)
          ? spec.values.join(" • ")
          : (spec.value || "");

        const item = document.createElement("li");
        item.innerHTML = `
          <span class="embed-line-title">${spec.label || ""}</span>
          <span class="embed-line-text">${valueText}</span>
        `;
        hardwareList.appendChild(item);
      });
    }
  } catch (error) {
    console.warn("Failed to load ../Apps/Workspace.json", error);
  }
}

/* ================= CONTACT APP ================= */
function handleSimpleContactSubmit(e) {
  e.preventDefault();

  const form = e.target;

  const name = form.elements['simple-name']?.value.trim() || '';
  const phone = form.elements['simple-phone']?.value.trim() || '';
  const subject =
    form.elements['simple-subject']?.value.trim() ||
    contactAppData?.Mail?.defaultSubject ||
    'New message from your OS';
  const message = form.elements['simple-message']?.value.trim() || '';

  const lines = [];

  if (name) lines.push(`Name: ${name}`);
  if (phone) {
    lines.push(`Phone: ${phone}`);
  } else {
    lines.push(`Phone: ${contactAppData?.Mail?.phoneFallback || "(not provided)"}`);
  }

  lines.push('');
  lines.push(contactAppData?.Mail?.messageLabel || 'Message:');
  lines.push(message || '(no message)');

  const body = lines.join('\n');
  const to = contactAppData?.Mail?.to || 'mqmr@mqmr.bio';

  const gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1&tf=1' +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(gmailUrl, 'gmail-compose', 'width=550,height=525');

  return false;
}
window.handleSimpleContactSubmit = handleSimpleContactSubmit;

async function loadContactApp() {
  try {
    const res = await fetch("../Apps/Contact.json");
    const data = await res.json();
    contactAppData = data;

    const section = data.Section || {};
    const fields = data.Form?.fields || {};
    const form = data.Form || {};

    setText("contact-card-title", section.title || "Get in Touch");
    setText("contact-card-subtitle", section.subtitle || "");

    setText("simple-contact-name-label", fields.name?.label || "Name");
    setText("simple-contact-phone-label", fields.phone?.label || "Phone Number");
    setText("simple-contact-subject-label", fields.subject?.label || "Subject");
    setText("simple-contact-message-label", fields.message?.label || "Message");
    setText("simple-contact-submit-text", form.submitButton || "Send Message");
    setText("simple-contact-submit-icon", form.submitIcon || "✈️");

    const nameInput = document.getElementById("simple-name");
    const phoneInput = document.getElementById("simple-phone");
    const subjectInput = document.getElementById("simple-subject");
    const messageInput = document.getElementById("simple-message");

    if (nameInput) nameInput.placeholder = fields.name?.placeholder || "";
    if (phoneInput) phoneInput.placeholder = fields.phone?.placeholder || "";
    if (subjectInput) subjectInput.placeholder = fields.subject?.placeholder || "";
    if (messageInput) messageInput.placeholder = fields.message?.placeholder || "";
  } catch (error) {
    console.warn("Failed to load ../Apps/Contact.json", error);
  }
}

/* ================= SETTINGS APP ================= */
async function loadSettingsApp() {
  try {
    const res = await fetch("../Apps/Settings.json");
    const data = await res.json();
    settingsAppData = data;

    const display = data.Display || {};

    setText("simple-settings-title", "Simple Mode Settings");
    setText("simple-settings-section-title", display.modePage?.title || "Display Mode");
    setText("simple-advanced-title", display.modePage?.advancedTitle || "Enable Advanced Display Mode");
    setText("simple-advanced-description", display.modePage?.advancedDescription || "Unlocks additional display layouts intended for advanced use.");
    setText("simple-display-mode-title", display.modePage?.displayModeTitle || "Display Mode");
    setText("simple-display-mode-description", display.modePage?.displayModeDescription || "Choose how the interface layout is presented.");
setText("display-dialog-title", display.dialog?.title || "Change Display Mode.");
setText("display-dialog-description", display.dialog?.description || "The interface will adjust to reflect the new display mode.");
setText("display-dialog-cancel", display.dialog?.cancel || "Cancel");
setText("display-dialog-continue", display.dialog?.continue || "Continue");
  } catch (error) {
    console.warn("Failed to load ../Apps/Settings.json", error);
  }
}

function toggleSimpleSettings(force) {
  const overlay = document.getElementById('simple-settings-overlay');
  if (!overlay) return;

  if (typeof force === 'boolean') {
    overlay.hidden = !force;
  } else {
    overlay.hidden = !overlay.hidden;
  }
}
window.toggleSimpleSettings = toggleSimpleSettings;

function overlayClickToClose(event) {
  if (event.target.id === 'simple-settings-overlay') {
    toggleSimpleSettings(false);
  }
}
window.overlayClickToClose = overlayClickToClose;

/* ================= DISPLAY MODE (Simple) ================= */
(function () {
  const advancedSwitch = document.getElementById("simple-advanced-display-switch");
  const displaySelect = document.getElementById("simple-display-mode-select");
const dialog = document.getElementById("display-mode-dialog");
const btnCancel = document.getElementById("display-dialog-cancel");
const btnContinue = document.getElementById("display-dialog-continue");

  if (!advancedSwitch || !displaySelect || !dialog) return;

  let isAdvancedOn = false;
  let currentMode = "simple";
  let pendingMode = null;

  function refreshDisplayOptions() {
    const options = [
      {
        value: "standard",
        label: settingsAppData?.Display?.modePage?.options?.standard || "Standard"
      },
      {
        value: "simple",
        label: settingsAppData?.Display?.modePage?.options?.simple || "Simple"
      }
    ];

    if (isAdvancedOn) {
      options.push({
        value: "phone",
        label: settingsAppData?.Display?.modePage?.options?.phone || "Phone"
      });
    }

    displaySelect.innerHTML = "";

    options.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      displaySelect.appendChild(option);
    });

    displaySelect.value = currentMode;
  }

  function openDialog() {
    dialog.classList.remove("modal-hidden");
  }

  function closeDialog() {
    dialog.classList.add("modal-hidden");
    pendingMode = null;
  }

  advancedSwitch.addEventListener("click", () => {
    isAdvancedOn = !isAdvancedOn;
    advancedSwitch.classList.toggle("is-on", isAdvancedOn);
    advancedSwitch.setAttribute("aria-pressed", String(isAdvancedOn));

    if (!isAdvancedOn && currentMode === "phone") {
      currentMode = "simple";
    }

    refreshDisplayOptions();
  });

  displaySelect.addEventListener("change", (e) => {
    const newValue = e.target.value;
    if (newValue === currentMode) return;

    pendingMode = newValue;
    openDialog();
  });

  btnCancel.addEventListener("click", () => {
    displaySelect.value = currentMode;
    closeDialog();
  });

  btnContinue.addEventListener("click", () => {
    if (!pendingMode) {
      closeDialog();
      return;
    }

    const newMode = pendingMode;
    currentMode = newMode;
    closeDialog();

    if (newMode === "standard") {
      window.location.href = "../index.html";
    } else if (newMode === "simple") {
      window.location.href = "./simple.html";
    } else if (newMode === "phone") {
      window.location.href = "../Phone/phone.html";
    }
  });

  refreshDisplayOptions();
})();

/* ================= MOBILE REDIRECT ================= */
(function redirectToPhoneIfMobile() {
  const isPhone =
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  if (isPhone) {
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/Phone/')) {
      window.location.replace('../Phone/phone.html');
    }
  }
})();

/* ================= INIT ================= */
(async function initSimplePage() {
  await loadMainData();
  await loadSettingsApp();
  await loadAboutMeApp();
  await loadProjectsApp();
  await loadWorkspaceApp();
  await loadContactApp();
})();