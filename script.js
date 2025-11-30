/* ================= CLOCK ================= */
function updateClock() {
    const now = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const d = days[now.getDay()];
    const m = months[now.getMonth()];
    const day = now.getDate();

    let h = now.getHours();
    const min = now.getMinutes().toString().padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    document.getElementById("clock").textContent =
        `${d} ${m} ${day} ${h}:${min} ${ampm}`;
}
updateClock();
setInterval(updateClock,1000);


/* ================= GLOBAL ================= */
let currentWindow = null;
let isDragging = false;
let isResizing = false;

let dragOffsetX = 0;
let dragOffsetY = 0;

let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

let zIndexCounter = 2000;

/* Smooth drag values */
let smoothX = 0;
let smoothY = 0;
let targetX = 0;
let targetY = 0;


/* ================= EMERGENCY END DRAG ================= */
function endDragForcefully() {
    isDragging = false;
    isResizing = false;
    currentWindow = null;
}

window.addEventListener("lostpointercapture", endDragForcefully, true);
window.addEventListener("pointercancel", endDragForcefully, true);
window.addEventListener("blur", endDragForcefully, true);
window.addEventListener("mouseleave", endDragForcefully, true);


document.querySelectorAll(".dock-item").forEach(item => {
    item.addEventListener("click", () => {
        const id = item.getAttribute("data-window");
        const win = document.getElementById(id);

        // أطفئ باقي النوافذ
        document.querySelectorAll(".window").forEach(w => {
            if (w.id !== id) w.classList.remove("active");
        });

        // فعّل هذه النافذة فقط
        win.classList.remove("hidden");
        win.classList.add("active");
        win.style.display = "flex";
        win.style.zIndex = ++zIndexCounter;

        // إظهار النقطة تحت التطبيق
        item.classList.add("open");

                // لو كانت نافذة التيرمينال → خله جاهز للكتابة مباشرة
        if (id === "terminal-window") {
            focusTerminalInput();
        }
    });
});


/* ================= WINDOW SETUP ================= */
document.querySelectorAll(".window").forEach(win => {

  // عند الضغط على أي مكان داخل النافذة → تصبح هي النافذة النشطة
win.addEventListener("pointerdown", () => {
    document.querySelectorAll(".window").forEach(w => {
        if (w !== win) w.classList.remove("active");
    });
    win.classList.add("active");
    win.style.zIndex = ++zIndexCounter;

    if (win.id === "terminal-window") {
        // رجّع الكتابة للتيرمينال
        focusTerminalInput();
    } else {
        // أي نافذة ثانية → ألغِ الكتابة في التيرمينال
        const input = document.getElementById("terminal-input");
        if (input) input.blur();
    }
});
// لو ضغط خارج التيرمينال بالكامل → ألغِ فوكس الكتابة
window.addEventListener("pointerdown", (e) => {
    const termWin = document.getElementById("terminal-window");
    if (!termWin) return;

    if (!termWin.contains(e.target)) {
        const input = document.getElementById("terminal-input");
        if (input) input.blur();
    }
});

    const titlebar = win.querySelector(".window-titlebar");
    const resizeH = win.querySelector(".resize-handle");

    const closeBtn = win.querySelector(".window-control.close");
    const minBtn   = win.querySelector(".window-control.minimize");
    const maxBtn   = win.querySelector(".window-control.maximize");


        /* ----- CLOSE ----- */

closeBtn.addEventListener("pointerdown", e => {
    e.stopPropagation();
    win.classList.add("closing");

    setTimeout(() => {
        win.classList.add("hidden");
        win.classList.remove("active", "closing");

        // إزالة النقطة من الـ Dock
        const dockItem = document.querySelector(`.dock-item[data-window='${win.id}']`);
        dockItem.classList.remove("open");
    }, 220);
});

    /* ----- MINIMIZE ----- */
minBtn.addEventListener("pointerdown", e => {
    e.stopPropagation();
    win.classList.add("minimizing");

    setTimeout(() => {
        win.classList.add("hidden");
        win.classList.remove("active", "minimizing");
    }, 280); // مدة الأنيميشن
});

    /* ----- MAXIMIZE ----- */
    maxBtn.addEventListener("pointerdown", e => {
        e.stopPropagation();
        win.classList.toggle("maximized");
    });

    /* ----- DRAG START ----- */
titlebar.addEventListener("pointerdown", e => {
    if (e.target.classList.contains("window-control")) return;
    if (win.classList.contains("maximized")) return;

    // جعل باقي النوافذ غير نشطة
    document.querySelectorAll(".window").forEach(w => {
        if (w !== win) w.classList.remove("active");
    });

    win.classList.add("active");
    if (e.target.classList.contains("window-control")) return;
    if (win.classList.contains("maximized")) return;

    isDragging = true;
    currentWindow = win;

    const rect = win.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // وضع المواضع الحالية حتى لا يحصل jump
    smoothX = rect.left;
    smoothY = rect.top;
    targetX = smoothX;
    targetY = smoothY;

    win.style.zIndex = ++zIndexCounter;
    win.style.transition = "none";
    win.style.willChange = "left, top";

    // شكل الماوس (macOS style)
    document.body.style.cursor = "grabbing";

    win.setPointerCapture(e.pointerId);
});

    /* ----- RESIZE START ----- */
    resizeH.addEventListener("pointerdown", e => {
        e.stopPropagation();
        if (win.classList.contains("maximized")) return;

        isResizing = true;
        currentWindow = win;

        const rect = win.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;

        startX = e.clientX;
        startY = e.clientY;

        win.style.zIndex = ++zIndexCounter;
        win.setPointerCapture(e.pointerId);
    });
});


/* ================= SMOOTH DRAG LOOP — macOS STYLE ================= */
function smoothLoop() {
    if (isDragging && currentWindow) {

        // حركة سلسة
        smoothX += (targetX - smoothX) * 0.15;
        smoothY += (targetY - smoothY) * 0.15;

        // نحول إحداثيات الشاشة لإحداثيات داخل .desktop
        const desktopRect = document.querySelector(".desktop").getBoundingClientRect();

        currentWindow.style.left = (smoothX - desktopRect.left) + "px";
        currentWindow.style.top  = (smoothY - desktopRect.top) + "px";
    }

    requestAnimationFrame(smoothLoop);
}
requestAnimationFrame(smoothLoop);


/* ================= POINTER MOVE ================= */
window.addEventListener("pointermove", e => {

    /* ---- DRAG ---- */
    if (isDragging && currentWindow) {

        targetX = Math.max(0, e.clientX - dragOffsetX);
        targetY = Math.max(32, e.clientY - dragOffsetY);
        return;
    }

    /* ---- RESIZE ---- */
    if (isResizing && currentWindow) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        currentWindow.style.width  = Math.max(400, startWidth + dx) + "px";
        currentWindow.style.height = Math.max(300, startHeight + dy) + "px";
    }
});


/* ================= POINTER UP ================= */
window.addEventListener("pointerup", () => {
    if (currentWindow) {
        currentWindow.style.transition = "";
        currentWindow.style.willChange = "auto";
    }

    isDragging = false;
    isResizing = false;
    currentWindow = null;

    // رجع شكل المؤشر طبيعي
    document.body.style.cursor = "default";
});


/* ================= FORM ================= */
function handleSubmit(e) {
    e.preventDefault();

    const go = confirm("wait!, if you wanna contact with me, send me a message on my insta or my other accounts.\n\nOpen Instagram?");

    if (go) {
        window.open("https://www.instagram.com/_.wp1/", "_blank");
    }

    e.target.reset();
    return false;
}


/* ================= TERMINAL LOGIC ================= */

const terminalBody = document.getElementById("terminal-body");
const terminalWindow = document.getElementById("terminal-window");

// نخلي التيرمنال ينزل دايم تحت
function scrollBottom() {
    if (!terminalBody) return;
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

// فوكس على سطر الكتابة + يحط المؤشر في آخر السطر
function focusTerminalInput() {
    const input = document.getElementById("terminal-input");
    if (!input) return;

    // فقط فوكس ع العنصر
    //input.focus();

    // لو فيه نص، حط المؤشر في آخره
    if (input.innerText && input.innerText.length > 0) {
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false); // المؤشر في النهاية
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// نضيف برومبت جديد
function newPrompt() {
    // شيل الـ id من أي input قديم (عشان ما يكون فيه تكرار)
    const old = document.getElementById("terminal-input");
    if (old) old.removeAttribute("id");

    terminalBody.innerHTML += `
<span class="prompt">
    <span style="color:#4d99ef;">guest@mqmr-os:~$</span>
    <span id="terminal-input" contenteditable="true" style="outline:none;"></span>
</span>
`;
    scrollBottom();
    setTimeout(focusTerminalInput, 10);
}

// دالة تفتح أي تطبيق (نفس شغل الـ Dock)
function openAppById(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return false;

    // طفي باقي النوافذ
    document.querySelectorAll(".window").forEach(w => {
        if (w !== win) w.classList.remove("active");
    });

    win.classList.remove("hidden");
    win.classList.add("active");
    win.style.display = "flex";

    // ارفع فوق
    if (typeof zIndexCounter !== "undefined") {
        win.style.zIndex = ++zIndexCounter;
    }

    // فعّل النقطة تحت التطبيق في الـ Dock
    const dockItem = document.querySelector(`.dock-item[data-window="${windowId}"]`);
    if (dockItem) {
        dockItem.classList.add("open");
    }

    // لو فتحنا تطبيق من التيرمنال نفسه → رجّع فوكس للـ input
    if (windowId === "terminal-window") {
        setTimeout(focusTerminalInput, 10);
    }

    return true;
}

// أي ضغط داخل نافذة التيرمنال → فوكس للكتابة
// أي ضغط داخل نافذة التيرمينال
if (terminalWindow) {
    terminalWindow.addEventListener("pointerdown", (e) => {
        const target = e.target;

        // لو الكليك داخل جسم التيرمينال (الأسود) → فوكس بس
        if (target.closest("#terminal-body")) {
            focusTerminalInput();
            return;
        }

        // لو ضغطنا على أزرار (close / minimize / maximize) أو الـ resize → لا تسوي drag
        if (
            target.classList.contains("window-control") ||
            target.closest(".window-control") ||
            target.classList.contains("resize-handle")
        ) {
            return;
        }

        if (terminalWindow.classList.contains("maximized")) return;

        // نفس منطق السحب حق باقي النوافذ بالضبط
        document.querySelectorAll(".window").forEach(w => {
            if (w !== terminalWindow) w.classList.remove("active");
        });

        terminalWindow.classList.add("active");

        isDragging = true;
        currentWindow = terminalWindow;

        const rect = terminalWindow.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        smoothX = rect.left;
        smoothY = rect.top;
        targetX = smoothX;
        targetY = smoothY;

        terminalWindow.style.zIndex = ++zIndexCounter;
        terminalWindow.style.transition = "none";
        terminalWindow.style.willChange = "left, top";

        document.body.style.cursor = "grabbing";

        terminalWindow.setPointerCapture(e.pointerId);
    });
}

// إذا ضغطنا خارج التيرمنال → شيل الفوكس
window.addEventListener("pointerdown", (e) => {
    if (!terminalWindow) return;
    if (!terminalWindow.contains(e.target)) {
        const input = document.getElementById("terminal-input");
        if (input) input.blur();
    }
});
// أي ضغط كيبورد والـ terminal هي النافذة النشطة → تأكد إن الفوكس على سطر الكتابة
window.addEventListener("keydown", (e) => {
    if (!terminalWindow) return;

    // لازم التيرمنال تكون هي الـ active window
    if (!terminalWindow.classList.contains("active")) return;

    const input = document.getElementById("terminal-input");
    if (!input) return;

    // لو الفوكس مو داخل التيرمنال (أو على body مثلاً) رجّعه للـ input
    if (!terminalWindow.contains(document.activeElement)) {
        focusTerminalInput();
    }
});

// أوامر التيرمنال
if (terminalBody) {
    terminalBody.addEventListener("keydown", function (e) {
        const input = document.getElementById("terminal-input");
        if (!input) return;

        // ما نكتب إلا إذا التيرمنال هي النافذة النشطة
        if (!terminalWindow || !terminalWindow.classList.contains("active")) return;

        if (e.key === "Enter") {
            e.preventDefault();

            const rawCmd = input.innerText;
            const cmd = rawCmd.trim().toLowerCase();
            input.contentEditable = "false"; // نقفل البرومبت القديم

            // ========== clear ==========
            if (cmd === "clear") {
                terminalBody.innerHTML = "";
                newPrompt();
                return;
            }

            // ========== help ==========
            if (cmd === "help") {
                const sw = window.softwareInfo || {};
                const osName = sw.osName || "MqMr's OS";
                const version = sw.version || "1.0.0v";

                terminalBody.innerHTML += `
${osName} Terminal – version ${version}
Available commands:
  help      - Show this help message
  clear     - Clear the terminal
  about     - Open About app
  skills    - Open Skills app
  projects  - Open Projects app
  contact   - Open Contact app
  settings  - Open Settings app
  terminal  - Focus Terminal app
`;
                newPrompt();
                return;
            }

            // ========== الأوامر اللي تفتح التطبيقات ==========
            const appMap = {
                "about": "about-window",
                "skills": "skills-window",
                "projects": "projects-window",
                "contact": "contact-window",
                "settings": "settings-window",
                "terminal": "terminal-window"
            };

            if (appMap[cmd]) {
                const ok = openAppById(appMap[cmd]);
                if (!ok) {
                    terminalBody.innerHTML += `\nCould not open "${cmd}" app.\n`;
                }
                newPrompt();
                return;
            }

            // ========== أي شيء ثاني ==========
            if (cmd !== "") {
                terminalBody.innerHTML += `\nCommand not found.\n`;
            }

            newPrompt();
        }
    });
}

// فوكس تلقائي أول ما يفتح التيرمنال
setTimeout(() => {
    if (!terminalWindow) return;
    if (!terminalWindow.classList.contains("hidden")) {
        focusTerminalInput();
    }
}, 50);

/* ================= END TERMINAL LOGIC ================= */



// ===================== SETTINGS APP LOGIC =====================
(function () {
  const settingsWindow = document.getElementById("settings-window");
  if (!settingsWindow) return;

  const sidebarButtons = settingsWindow.querySelectorAll(".settings-btn");
  const middleSections = settingsWindow.querySelectorAll(".settings-middle-section");
  const midButtons = settingsWindow.querySelectorAll(".mid-btn");
  const pages = settingsWindow.querySelectorAll(".settings-page");
  const middleTitle = document.getElementById("settings-middle-title");

  function showPage(pageId) {
    pages.forEach(page => {
      if (page.id === pageId) {
        page.style.display = "block";
        // allow transition to kick in
        requestAnimationFrame(() => {
          page.classList.add("is-visible");
        });
      } else {
        page.classList.remove("is-visible");
        page.style.display = "none";
      }
    });
  }

  function activateMid(btn) {
    midButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const pageId = btn.getAttribute("data-page");
    if (pageId) showPage(pageId);
  }

  function activateSection(sectionName) {
    // left sidebar highlight
    sidebarButtons.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-section") === sectionName);
    });

    // middle title (General / Display / Privacy ...)
    if (middleTitle) {
      const pretty = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
      middleTitle.textContent = pretty;
    }

    // show only matching middle section
    middleSections.forEach(sec => {
      const isActive = sec.getAttribute("data-section") === sectionName;
      sec.classList.toggle("active", isActive);

      if (isActive) {
        const firstMid = sec.querySelector(".mid-btn");
        if (firstMid) activateMid(firstMid);
      }
    });
  }

  // click handlers
  sidebarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.getAttribute("data-section");
      if (!sec) return;
      activateSection(sec);
    });
  });

  midButtons.forEach(btn => {
    btn.addEventListener("click", () => activateMid(btn));
  });

  // default state: General → About
  activateSection("general");

  // ===================== LOAD DATA FROM JSON =====================
  // ===================== LOAD DATA FROM JSON =====================
  fetch("settings-data.json")
    .then(res => res.json())
    .then(data => {
      const sw = data.software;
      if (!sw) return;

      // نخزن البيانات في global عشان نستخدمها في التيرمنال وغيره
      window.softwareInfo = sw;

      // ===== Settings: General → About =====
      const aboutCreator = document.getElementById("about-creator");
      const aboutVersion = document.getElementById("about-version");

      if (aboutCreator) aboutCreator.textContent = sw.creator || "MqMr";
      if (aboutVersion) aboutVersion.textContent = sw.version || "1.0.0v";

      // ===== Settings: General → Software Update =====
      const swVersion = document.getElementById("sw-version");
      const swUpdatesText = document.getElementById("sw-updates-text");
      const swChangelogList = document.getElementById("sw-changelog-list");

      if (swVersion) swVersion.textContent = sw.version || "1.0.0v";
      if (swUpdatesText) swUpdatesText.textContent = sw.availableUpdatesText || "Your software is up to date";

      if (swChangelogList && Array.isArray(sw.changelog)) {
        swChangelogList.innerHTML = "";
        sw.changelog.forEach(item => {
          const li = document.createElement("li");
          li.textContent = `${item.version}: ${item.label}`;
          swChangelogList.appendChild(li);
        });
      }

      // ===== Title & Menubar =====
      if (sw.osName) {
        // عنوان التبويب
        document.title = `${sw.osName} | ${sw.version}`;

        // اسم النظام في المينوبار (أول strong في menubar-left)
        const menuLabel = document.querySelector(".menubar-left .menubar-item strong");
        if (menuLabel) menuLabel.textContent = sw.osName;
      }

      // ===== Projects Window title =====
      const projectsTitle = document.getElementById("projects-version-title");
      if (projectsTitle) {
        projectsTitle.textContent = `Coming Soon!, Current Version: ${sw.version}`;
      }
    })
    .catch(err => {
      console.warn("Could not load settings-data.json", err);
    });
})();








/* ================= GOOGLE SIGN-IN (with name & picture) ================= */

// حط هنا الـ Client ID اللي أخذته من Google Console:
const GOOGLE_CLIENT_ID = "543147531406-tvgcuqvlh92c2dfcfs4iqqpfqeb55cam.apps.googleusercontent.com";

let googleUser = null; // بنحفظ فيه بيانات المستخدم

// دالة لفك الـ JWT اللي ترسله Google عشان نطلع الاسم والصورة
function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );

  return JSON.parse(jsonPayload);
}

// تستقبل الرد من Google لما يختار المستخدم حسابه
function handleGoogleCredential(response) {
  try {
    const payload = parseJwt(response.credential);

    googleUser = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };

    // نحفظ البيانات في localStorage عشان ما تروح بعد Refresh
    localStorage.setItem("mqmr_google_user", JSON.stringify(googleUser));

    updateGoogleUI();
  } catch (err) {
    console.error("Error parsing Google ID token", err);
  }
}

// تحديث شكل الإعدادات بعد تسجيل الدخول
function updateGoogleUI() {
  const googleRow = document.querySelector("#privacy-google-page .setting-row");
  const btnSidebar = document.getElementById("btn-google-signin-sidebar");
  const btnMain = document.getElementById("btn-google-signin-main");

  if (!googleRow) return;

  // لو مافي مستخدم → رجّع الزرار للوضع الطبيعي واحذف الكارد
  if (!googleUser) {
    if (btnSidebar) btnSidebar.textContent = "Sign In with Google";
    if (btnMain) btnMain.textContent = "Sign In with Google";

    const existing = document.getElementById("google-user-card");
    if (existing) existing.remove();
    return;
  }

  // عدّل نص الأزرار
  if (btnSidebar) btnSidebar.textContent = "Signed in";
  if (btnMain) btnMain.textContent = "Sign out";

  // كارد فيه الاسم + الصورة + الإيميل
  let card = document.getElementById("google-user-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "google-user-card";
    card.style.display = "flex";
    card.style.alignItems = "center";
    card.style.gap = "10px";
    card.style.marginTop = "8px";
    googleRow.appendChild(card);
  }

  card.innerHTML = `
    <img src="${googleUser.picture}" alt="avatar"
         style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
    <div>
      <div style="font-size:14px;font-weight:600;">${googleUser.name}</div>
      <div style="font-size:12px;color:#6b7280;">${googleUser.email}</div>
    </div>
  `;

  // زر الـ Sign out (اللي في صفحة Google)
  if (btnMain) {
    btnMain.onclick = () => {
      const email = googleUser && googleUser.email;
      googleUser = null;
      localStorage.removeItem("mqmr_google_user");
      updateGoogleUI();

      // نطلب من Google إلغاء التفويض (اختياري)
      if (window.google && google.accounts && google.accounts.id && email) {
        google.accounts.id.revoke(email, () => {
          console.log("Google session revoked");
        });
      }
    };
  }
}

// تهيئة Google Identity وربطها بالأزرار
function setupGoogleSignIn() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    console.warn("Google Identity Services not available");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
  });

  // لو فيه مستخدم محفوظ من قبل في localStorage
  const saved = localStorage.getItem("mqmr_google_user");
  if (saved) {
    try {
      googleUser = JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved Google user", e);
    }
  }
  updateGoogleUI();

  // أربط الأزرار إنها تفتح نافذة اختيار الحساب
  const btnSidebar = document.getElementById("btn-google-signin-sidebar");
  const btnMain = document.getElementById("btn-google-signin-main");

  function startSignIn() {
    // تفتح One Tap / Popup من Google لاختيار الحساب
    google.accounts.id.prompt();
  }

  [btnSidebar, btnMain].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", startSignIn);
    }
  });
}

// ننتظر لين مكتبة Google تتحمل ثم نهيئها (Polling بسيط)
function initGoogleSignInPolling(tries = 0) {
  if (window.google && google.accounts && google.accounts.id) {
    setupGoogleSignIn();
    return;
  }
  if (tries > 20) {
    console.warn("Could not init Google Sign-In");
    return;
  }
  setTimeout(() => initGoogleSignInPolling(tries + 1), 300);
}

initGoogleSignInPolling();







/* ================= DEFAULT WINDOW ================= */
// افتح نافذة About عند بداية تشغيل الموقع
const defaultWindow = document.getElementById("about-window");
defaultWindow.classList.add("active");
defaultWindow.style.display = "flex";

// تفعيل النقطة تحت أيقونة About
const aboutDockItem = document.querySelector(".dock-item.about");
aboutDockItem.classList.add("open");
