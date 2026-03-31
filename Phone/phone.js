function openLink(url) {
  window.open(url, "_blank");
}

let mainData = null;
let contactAppData = null;


async function loadMainData() {
  try {
    const res = await fetch("../main-data.json");
    const data = await res.json();
    mainData = data;

    const site = data.site || {};
    const osName = site.osName || "MqMr's OS";
    const version = site.version || "1.0.0v";

    const tabTemplate = data.tabs?.phone || "{osName} - Phone | {version}";
    document.title = tabTemplate
      .replace("{osName}", osName)
      .replace("{version}", version);

    const menuLabel = document.querySelector(".menubar-left .menubar-item strong");
    if (menuLabel) menuLabel.textContent = osName;

    window.softwareInfo = {
      osName,
      version,
      creator: site.creator || "MqMr"
    };
  } catch (err) {
    console.warn("Could not load ../main-data.json", err);
  }
}





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


async function loadAboutMeApp() {
  try {
    const res = await fetch("../Apps/AboutMe.json");
    const data = await res.json();

    const nameEl = document.getElementById("about-name");
    const subtitleEl = document.getElementById("about-subtitle");
    const descriptionEl = document.getElementById("about-description");
    const avatarEl = document.getElementById("about-avatar");

    const instagramBtn = document.getElementById("about-instagram-btn");
    const discordBtn = document.getElementById("about-discord-btn");
    const xBtn = document.getElementById("about-x-btn");
    const youtubeBtn = document.getElementById("about-youtube-btn");

    if (nameEl) nameEl.textContent = data.name || "";
    if (subtitleEl) subtitleEl.textContent = data.subtitle || "";
    if (descriptionEl) descriptionEl.textContent = data.description || "";
    if (avatarEl) avatarEl.src = "../" + (data.avatar || "");

    if (instagramBtn && data.socials?.instagram) {
      instagramBtn.onclick = () => openLink(data.socials.instagram);
    }

    if (discordBtn && data.socials?.discord) {
      discordBtn.onclick = () => openLink(data.socials.discord);
    }

    if (xBtn && data.socials?.x) {
      xBtn.onclick = () => openLink(data.socials.x);
    }

    if (youtubeBtn && data.socials?.youtube) {
      youtubeBtn.onclick = () => openLink(data.socials.youtube);
    }
  } catch (error) {
    console.warn("Failed to load ../Apps/AboutMe.json", error);
  }
}

async function loadProjectsApp() {
  try {
    const res = await fetch("../Apps/Projects.json");
    const data = await res.json();

    const titleEl = document.getElementById("projects-section-title");
    const subtitleEl = document.getElementById("projects-section-subtitle");
    const listEl = document.getElementById("projects-list");

    if (!listEl) return;

    if (titleEl) {
      titleEl.textContent = data.Section?.title || "Projects";
    }

    if (subtitleEl) {
      subtitleEl.textContent = data.Section?.subtitle || "";
    }

    const appTags = data.AppTags || {};
    const projects = Array.isArray(data.Projects) ? data.Projects : [];

    listEl.innerHTML = "";

    const visibleProjects = projects.filter(project => project.show !== false);

    visibleProjects.forEach(project => {
      const tags = Array.isArray(project.tags) ? project.tags : [];
      const primaryTagKey = tags[0] || null;
      const primaryTag = primaryTagKey ? appTags[primaryTagKey] : null;

      const projectItem = document.createElement("div");
      projectItem.className = "project-item";

      if (primaryTag?.bgColor) {
        projectItem.style.background = primaryTag.bgColor;
      }

      const nameEl = document.createElement("h3");
      nameEl.className = "project-name";
      nameEl.textContent = project.name || "Untitled Project";

      const descEl = document.createElement("p");
      descEl.className = "project-desc";
      descEl.textContent = project.description || "";

      const tagsWrap = document.createElement("div");
      tagsWrap.className = "project-tags";

      tags.forEach((tagKey, index) => {
        const tagInfo = appTags[tagKey];
        const tagEl = document.createElement("span");
        tagEl.className = "project-tag";

        if (tagInfo) {
          tagEl.textContent = tagInfo.label || tagKey;

          if (index === 0 && primaryTag?.textColor) {
            tagEl.style.background = primaryTag.textColor;
            tagEl.style.color = "#ffffff";
          }
        } else {
          tagEl.textContent = tagKey;
        }

        tagsWrap.appendChild(tagEl);
      });

      const websiteLink = project.links?.website?.trim();
      const githubLink = project.links?.github?.trim();

      let actionsWrap = null;

      if (websiteLink || githubLink) {
        actionsWrap = document.createElement("div");
        actionsWrap.className = "project-actions";

        if (websiteLink) {
          const websiteBtn = document.createElement("a");
          websiteBtn.className = "project-action-btn";
          websiteBtn.href = websiteLink;
          websiteBtn.target = "_blank";
          websiteBtn.rel = "noopener noreferrer";
          websiteBtn.textContent = "Website";
          actionsWrap.appendChild(websiteBtn);
        }

        if (githubLink) {
          const githubBtn = document.createElement("a");
          githubBtn.className = "project-action-btn project-action-btn-secondary";
          githubBtn.href = githubLink;
          githubBtn.target = "_blank";
          githubBtn.rel = "noopener noreferrer";
          githubBtn.textContent = "GitHub";
          actionsWrap.appendChild(githubBtn);
        }
      }

      projectItem.appendChild(nameEl);
      projectItem.appendChild(descEl);

      if (tags.length > 0) {
        projectItem.appendChild(tagsWrap);
      }

      if (actionsWrap) {
        projectItem.appendChild(actionsWrap);
      }

      listEl.appendChild(projectItem);
    });
  } catch (error) {
    console.warn("Failed to load ../Apps/Projects.json", error);
  }
}

async function loadContactApp() {
  try {
    const res = await fetch("../Apps/Contact.json");
    const data = await res.json();
    contactAppData = data;

    const section = data.Section || {};
    const fields = data.Form?.fields || {};
    const form = data.Form || {};

    const appTitle = document.getElementById("contact-app-title");
    const appSubtitle = document.getElementById("contact-app-subtitle");

    const nameLabel = document.getElementById("contact-name-label");
    const phoneLabel = document.getElementById("contact-phone-label");
    const subjectLabel = document.getElementById("contact-subject-label");
    const messageLabel = document.getElementById("contact-message-label");

    const nameInput = document.getElementById("contact-name");
    const phoneInput = document.getElementById("contact-phone");
    const subjectInput = document.getElementById("contact-subject");
    const messageInput = document.getElementById("contact-message");

    const submitText = document.getElementById("contact-submit-text");
    const submitIcon = document.getElementById("contact-submit-icon");

    if (appTitle) appTitle.textContent = section.title || "Get in Touch";
    if (appSubtitle) appSubtitle.textContent = section.subtitle || "";

    if (nameLabel) nameLabel.textContent = fields.name?.label || "Name";
    if (phoneLabel) phoneLabel.textContent = fields.phone?.label || "Phone Number";
    if (subjectLabel) subjectLabel.textContent = fields.subject?.label || "Subject";
    if (messageLabel) messageLabel.textContent = fields.message?.label || "Message";

    if (nameInput) nameInput.placeholder = fields.name?.placeholder || "";
    if (phoneInput) phoneInput.placeholder = fields.phone?.placeholder || "";
    if (subjectInput) subjectInput.placeholder = fields.subject?.placeholder || "";
    if (messageInput) messageInput.placeholder = fields.message?.placeholder || "";

    if (submitText) submitText.textContent = form.submitButton || "Send Message";
    if (submitIcon) submitIcon.textContent = form.submitIcon || "✈️";
  } catch (error) {
    console.warn("Failed to load ../Apps/Contact.json", error);
  }
}

function handlePhoneContactSubmit(e) {
  e.preventDefault();

  const form = e.target;

  const name = form.elements["contact-name"]?.value.trim() || "";
  const phone = form.elements["contact-phone"]?.value.trim() || "";
  const subject =
    form.elements["contact-subject"]?.value.trim() ||
    contactAppData?.Mail?.defaultSubject ||
    "New message from your OS";
  const message = form.elements["contact-message"]?.value.trim() || "";

  const lines = [];

  if (name) lines.push(`Name: ${name}`);
  if (phone) {
    lines.push(`Phone: ${phone}`);
  } else {
    lines.push(`Phone: ${contactAppData?.Mail?.phoneFallback || "(not provided)"}`);
  }

  lines.push("");
  lines.push(contactAppData?.Mail?.messageLabel || "Message:");
  lines.push(message || "(no message)");

  const body = lines.join("\n");
  const to = contactAppData?.Mail?.to || "mqmr@mqmr.bio";

  const gmailUrl =
    "https://mail.google.com/mail/?view=cm&fs=1&tf=1" +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(gmailUrl, "_blank");
  return false;
}

loadAboutMeApp();
loadProjectsApp();
loadContactApp();