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
let dragPendingRestore = false;
let pendingPointerX = 0;
let pendingPointerY = 0;

let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let startLeft = 0;
let startTop = 0;
let resizeDirection = "";
let pendingSnapZone = null;
let titlebarClickTimer = null;

let zIndexCounter = 2000;

/* Smooth drag values */
let smoothX = 0;
let smoothY = 0;
let targetX = 0;
let targetY = 0;

let contactAppData = null;
let terminalAppData = null;
let settingsAppData = null;
let mainData = null;

function resetWindowState(win) {
    if (!win) return;

    win.classList.remove("maximized", "snapped", "active", "minimizing", "closing");
win.dataset.snapState = "";

    win.style.top = win.dataset.defaultTop || "";
    win.style.left = win.dataset.defaultLeft || "";
    win.style.width = win.dataset.defaultWidth || "";
    win.style.height = win.dataset.defaultHeight || "";
    win.style.right = "";
    win.style.bottom = "";
    win.style.transform = "";
    win.style.filter = "";

    const content = win.querySelector(".window-content");
    if (content) {
        content.scrollTop = 0;
        content.scrollLeft = 0;
    }

    if (typeof win.resetAppState === "function") {
        win.resetAppState();
    }
}

function updateFocusedDockDot(activeWindowId) {
    document.querySelectorAll(".dock-item").forEach(item => {
        item.classList.remove("focused");
    });

    if (!activeWindowId) return;

    const activeDockItem = document.querySelector(`.dock-item[data-window="${activeWindowId}"]`);
    if (activeDockItem) {
        activeDockItem.classList.add("focused");
    }
}

function getDesktopRect() {
    return document.querySelector(".desktop").getBoundingClientRect();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function saveWindowRestoreBounds(win) {
    const desktopRect = getDesktopRect();
    const rect = win.getBoundingClientRect();

    win.dataset.restoreLeft = (rect.left - desktopRect.left) + "px";
    win.dataset.restoreTop = (rect.top - desktopRect.top) + "px";
    win.dataset.restoreWidth = rect.width + "px";
    win.dataset.restoreHeight = rect.height + "px";
}

function restoreWindowBounds(win) {
    win.classList.remove("maximized", "snapped");
    win.dataset.snapState = "";

    win.style.left = win.dataset.restoreLeft || win.dataset.defaultLeft || "";
    win.style.top = win.dataset.restoreTop || win.dataset.defaultTop || "";
    win.style.width = win.dataset.restoreWidth || win.dataset.defaultWidth || "";
    win.style.height = win.dataset.restoreHeight || win.dataset.defaultHeight || "";
    win.style.right = "";
    win.style.bottom = "";
}

function clearSnapPreview() {
    pendingSnapZone = null;
    const preview = document.getElementById("snap-preview");
    if (!preview) return;
    preview.classList.remove("visible");
}

function getSnapZone(clientX, clientY) {
    const desktopRect = getDesktopRect();

    const edgeX = 28;
    const edgeY = 28;

    const topBandHeight = 90;
    const bottomBandHeight = 70;
    const cornerWidth = Math.min(220, window.innerWidth * 0.22);

    const nearLeft = clientX <= edgeX;
    const nearRight = clientX >= window.innerWidth - edgeX;
    const nearTop = clientY <= desktopRect.top + edgeY;
    const nearBottom = clientY >= window.innerHeight - edgeY;

    const inTopBand = clientY <= desktopRect.top + topBandHeight;
    const inBottomBand = clientY >= window.innerHeight - bottomBandHeight;

    const inTopLeftCornerZone = inTopBand && clientX <= cornerWidth;
    const inTopRightCornerZone = inTopBand && clientX >= window.innerWidth - cornerWidth;

    const inBottomLeftCornerZone = inBottomBand && clientX <= cornerWidth;
    const inBottomRightCornerZone = inBottomBand && clientX >= window.innerWidth - cornerWidth;

    if (inTopLeftCornerZone) return "top-left";
    if (inTopRightCornerZone) return "top-right";
    if (inBottomLeftCornerZone) return "bottom-left";
    if (inBottomRightCornerZone) return "bottom-right";

    if (inTopBand) return "maximize";
    if (nearLeft) return "left";
    if (nearRight) return "right";

    return null;
}

function getSnapPreviewRect(zone) {
    const desktopRect = getDesktopRect();

    const fullX = 0;
    const fullY = desktopRect.top;
    const fullW = window.innerWidth;
    const fullH = window.innerHeight - desktopRect.top;

    const halfW = fullW / 2;
    const halfH = fullH / 2;

    switch (zone) {
        case "maximize":
            return { left: fullX, top: fullY, width: fullW, height: fullH };

        case "left":
            return { left: fullX, top: fullY, width: halfW, height: fullH };

        case "right":
            return { left: halfW, top: fullY, width: halfW, height: fullH };

        case "top-left":
            return { left: fullX, top: fullY, width: halfW, height: halfH };

        case "top-right":
            return { left: halfW, top: fullY, width: halfW, height: halfH };

        case "bottom-left":
            return { left: fullX, top: fullY + halfH, width: halfW, height: halfH };

        case "bottom-right":
            return { left: halfW, top: fullY + halfH, width: halfW, height: halfH };

        default:
            return null;
    }
}

function showSnapPreview(zone) {
    const preview = document.getElementById("snap-preview");
    if (!preview) return;

    if (!zone) {
        clearSnapPreview();
        return;
    }

    const rect = getSnapPreviewRect(zone);
    if (!rect) {
        clearSnapPreview();
        return;
    }

    pendingSnapZone = zone;
    preview.style.left = rect.left + "px";
    preview.style.top = rect.top + "px";
    preview.style.width = rect.width + "px";
    preview.style.height = rect.height + "px";
    preview.classList.add("visible");
}

function toggleWindowMaximize(win) {
    if (!win.classList.contains("maximized")) {
        if (!win.classList.contains("snapped")) {
            saveWindowRestoreBounds(win);
        }

        win.classList.remove("snapped");
        win.dataset.snapState = "";
        win.style.right = "";
        win.style.bottom = "";
        win.classList.add("maximized");
    } else {
        restoreWindowBounds(win);
    }
}

function snapWindow(win, zone) {
    if (zone === "maximize") {
        toggleWindowMaximize(win);
        return;
    }

    if (!win.classList.contains("maximized") && !win.classList.contains("snapped")) {
        saveWindowRestoreBounds(win);
    }

    const desktopRect = getDesktopRect();
    const rect = getSnapPreviewRect(zone);
    if (!rect) return;

    win.classList.remove("maximized");
    win.classList.add("snapped");
    win.dataset.snapState = zone;

    win.style.left = (rect.left - desktopRect.left) + "px";
    win.style.top = (rect.top - desktopRect.top) + "px";
    win.style.width = rect.width + "px";
    win.style.height = rect.height + "px";
    win.style.right = "";
    win.style.bottom = "";
}

function restoreForDragIfNeeded(win, pointerX, pointerY) {
    const wasMaximized = win.classList.contains("maximized");
    const wasSnapped = win.classList.contains("snapped");

    if (!wasMaximized && !wasSnapped) return null;

    const oldRect = win.getBoundingClientRect();
    const oldWidth = oldRect.width;

    restoreWindowBounds(win);

    const desktopRect = getDesktopRect();
    const restoredWidth = parseFloat(win.style.width) || oldRect.width;
    const restoredHeight = parseFloat(win.style.height) || oldRect.height;

    const pointerRatioX = clamp((pointerX - oldRect.left) / oldWidth, 0.12, 0.88);
    const newLeftViewport = clamp(
        pointerX - restoredWidth * pointerRatioX,
        0,
        window.innerWidth - restoredWidth
    );

    const newTopViewport = clamp(
        pointerY - 18,
        desktopRect.top,
        window.innerHeight - restoredHeight
    );

    win.style.left = (newLeftViewport - desktopRect.left) + "px";
    win.style.top = (newTopViewport - desktopRect.top) + "px";

    return {
        left: newLeftViewport,
        top: newTopViewport,
        width: restoredWidth,
        height: restoredHeight
    };
}

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
updateFocusedDockDot(id);
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

    if (!win.dataset.defaultTop) {
        win.dataset.defaultTop = win.style.top || "";
        win.dataset.defaultLeft = win.style.left || "";
        win.dataset.defaultWidth = win.style.width || "";
        win.dataset.defaultHeight = win.style.height || "";
    }

  // عند الضغط على أي مكان داخل النافذة → تصبح هي النافذة النشطة
win.addEventListener("pointerdown", () => {
    document.querySelectorAll(".window").forEach(w => {
        if (w !== win) w.classList.remove("active");
    });
    win.classList.add("active");
    win.style.zIndex = ++zIndexCounter;
updateFocusedDockDot(win.id);
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
const resizeHandles = win.querySelectorAll(".resize-handle");

    const closeBtn = win.querySelector(".window-control.close");
    const minBtn   = win.querySelector(".window-control.minimize");
    const maxBtn   = win.querySelector(".window-control.maximize");


        /* ----- CLOSE ----- */

closeBtn.addEventListener("pointerdown", e => {
    e.stopPropagation();

    win.classList.remove("minimizing");
    win.classList.add("closing");

    setTimeout(() => {
        win.classList.add("hidden");
        resetWindowState(win);

        const dockItem = document.querySelector(`.dock-item[data-window='${win.id}']`);
        if (dockItem) {
            dockItem.classList.remove("open");
            const activeWindow = document.querySelector(".window.active:not(.hidden)");
updateFocusedDockDot(activeWindow ? activeWindow.id : null);
        }
    }, 190);
});
    /* ----- MINIMIZE ----- */
minBtn.addEventListener("pointerdown", e => {
    e.stopPropagation();
    win.classList.add("minimizing");

    setTimeout(() => {
        win.classList.add("hidden");
        win.classList.remove("active", "minimizing");
        const activeWindow = document.querySelector(".window.active:not(.hidden)");
updateFocusedDockDot(activeWindow ? activeWindow.id : null);
    }, 280); // مدة الأنيميشن
});

/* ----- MAXIMIZE ----- */
maxBtn.addEventListener("pointerdown", e => {
    e.stopPropagation();
    toggleWindowMaximize(win);
});



/* ----- DRAG START / DOUBLE CLICK ----- */
titlebar.addEventListener("pointerdown", e => {
    if (e.target.closest(".window-control")) return;
    if (e.button !== 0) return;

    document.querySelectorAll(".window").forEach(w => {
        if (w !== win) w.classList.remove("active");
    });

    win.classList.add("active");
    win.style.zIndex = ++zIndexCounter;
    updateFocusedDockDot(win.id);

    if (titlebarClickTimer) {
        clearTimeout(titlebarClickTimer);
        titlebarClickTimer = null;

        dragPendingRestore = false;
        isDragging = false;
        currentWindow = null;

        toggleWindowMaximize(win);
        return;
    }

    titlebarClickTimer = setTimeout(() => {
        titlebarClickTimer = null;
    }, 240);

    currentWindow = win;
    isDragging = true;

    pendingPointerX = e.clientX;
    pendingPointerY = e.clientY;

    dragPendingRestore =
        win.classList.contains("maximized") ||
        win.classList.contains("snapped");

    const rect = win.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    smoothX = rect.left;
    smoothY = rect.top;
    targetX = smoothX;
    targetY = smoothY;

    win.style.transition = "none";
    win.style.willChange = "left, top";
    document.body.style.cursor = "grabbing";

    win.setPointerCapture(e.pointerId);
});

/* ----- RESIZE START ----- */
resizeHandles.forEach(handle => {
    handle.addEventListener("pointerdown", e => {
        e.stopPropagation();
        if (win.classList.contains("maximized")) return;

        isResizing = true;
        currentWindow = win;

        const rect = win.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;

        startX = e.clientX;
        startY = e.clientY;

        resizeDirection = Array.from(handle.classList)
            .find(cls => cls.startsWith("resize-handle-"))
            ?.replace("resize-handle-", "") || "";

        win.style.zIndex = ++zIndexCounter;
        win.style.transition = "none";
        win.style.willChange = "width, height, left, top";

        win.setPointerCapture(e.pointerId);
    });
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
    const menubar = document.querySelector(".menubar");
    const menubarHeight = menubar ? menubar.offsetHeight : 32;

    if (dragPendingRestore) {
        const restoredBounds = restoreForDragIfNeeded(currentWindow, e.clientX, e.clientY);
        dragPendingRestore = false;

        const rect = currentWindow.getBoundingClientRect();

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        smoothX = rect.left;
        smoothY = rect.top;

        if (restoredBounds) {
            smoothX = restoredBounds.left;
            smoothY = restoredBounds.top;
        }

        targetX = smoothX;
        targetY = smoothY;
    }

    const minX = 0;
    const minY = menubarHeight;

    const maxX = window.innerWidth - currentWindow.offsetWidth;
    const maxY = window.innerHeight - currentWindow.offsetHeight;

    targetX = Math.min(Math.max(minX, e.clientX - dragOffsetX), maxX);
    targetY = Math.min(Math.max(minY, e.clientY - dragOffsetY), maxY);

    const snapZone = getSnapZone(e.clientX, e.clientY);
    showSnapPreview(snapZone);

    return;
}
    /* ---- RESIZE ---- */
if (isResizing && currentWindow) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const menubar = document.querySelector(".menubar");
    const menubarHeight = menubar ? menubar.offsetHeight : 32;

    const minWidth = 400;
    const minHeight = 300;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    // East
    if (resizeDirection.includes("e")) {
        newWidth = Math.max(minWidth, startWidth + dx);
        newWidth = Math.min(newWidth, window.innerWidth - startLeft);
    }

    // South
    if (resizeDirection.includes("s")) {
        newHeight = Math.max(minHeight, startHeight + dy);
        newHeight = Math.min(newHeight, window.innerHeight - startTop);
    }

    // West
    if (resizeDirection.includes("w")) {
        const maxLeft = startLeft + startWidth - minWidth;
        newLeft = Math.max(0, Math.min(startLeft + dx, maxLeft));
        newWidth = startWidth - (newLeft - startLeft);
    }

    // North
    if (resizeDirection.includes("n")) {
        const maxTop = startTop + startHeight - minHeight;
        newTop = Math.max(menubarHeight, Math.min(startTop + dy, maxTop));
        newHeight = startHeight - (newTop - startTop);
    }

    const desktopRect = document.querySelector(".desktop").getBoundingClientRect();

    currentWindow.style.width = newWidth + "px";
    currentWindow.style.height = newHeight + "px";
    currentWindow.style.left = (newLeft - desktopRect.left) + "px";
    currentWindow.style.top = (newTop - desktopRect.top) + "px";
}});


/* ================= POINTER UP ================= */
window.addEventListener("pointerup", () => {
    const releasedWindow = currentWindow;
    const wasDragging = isDragging;

    if (releasedWindow) {
        releasedWindow.style.transition = "";
        releasedWindow.style.willChange = "auto";
    }

    isDragging = false;
    isResizing = false;
    dragPendingRestore = false;
    resizeDirection = "";
    currentWindow = null;
    document.body.style.cursor = "default";

    if (wasDragging && releasedWindow && pendingSnapZone) {
        snapWindow(releasedWindow, pendingSnapZone);
    }

    clearSnapPreview();
});

/* ================= FORM ================= */
function handleSubmit(e) {
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

    window.open(
        gmailUrl,
        "gmail-compose",
        "width=550,height=525"
    );

    return false;
}

/* ================= TERMINAL LOGIC ================= */

const terminalBody = document.getElementById("terminal-body");
const terminalWindow = document.getElementById("terminal-window");

function getTerminalPromptMarkup() {
    const ui = terminalAppData?.UI || {};
    const promptUser = ui.promptUser || "guest";
    const promptHost = ui.promptHost || "mqmr-os";
    const promptPath = ui.promptPath || "~";

    return `
<span class="prompt">
    <span style="color:#4d99ef;">${promptUser}@${promptHost}:${promptPath}$</span>
    <span id="terminal-input" contenteditable="true" style="outline:none;"></span>
</span>
`;
}

function buildTerminalWelcome() {
    const ui = terminalAppData?.UI || {};
    const welcomeTitle = ui.welcomeTitle || "Welcome to MqMr's OS Terminal";
    const welcomeSubtitle = ui.welcomeSubtitle || "Type 'help' to see available commands.";

    return `${welcomeTitle}
${welcomeSubtitle}

${getTerminalPromptMarkup()}`;
}

function initializeTerminalContent() {
    if (!terminalBody) return;
    terminalBody.innerHTML = buildTerminalWelcome();
}

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

function newPrompt() {
    const old = document.getElementById("terminal-input");
    if (old) old.removeAttribute("id");

    terminalBody.innerHTML += "\n" + getTerminalPromptMarkup();
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
updateFocusedDockDot(windowId);
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

if (terminalBody) {
    terminalBody.addEventListener("keydown", function (e) {
        const input = document.getElementById("terminal-input");
        if (!input) return;

        if (!terminalWindow || !terminalWindow.classList.contains("active")) return;

        if (e.key === "Enter") {
            e.preventDefault();

            const rawCmd = input.innerText;
            const cmd = rawCmd.trim().toLowerCase();
            input.contentEditable = "false";

            const messages = terminalAppData?.Messages || {};
            const commands = Array.isArray(terminalAppData?.Commands) ? terminalAppData.Commands : [];

            const matchedCommand = commands.find(item => item.command?.toLowerCase() === cmd);

            if (!cmd) {
                newPrompt();
                return;
            }

            if (!matchedCommand) {
                const commandNotFound = messages.commandNotFound || "Command not found.";
                terminalBody.innerHTML += `\n${commandNotFound}\n`;
                newPrompt();
                return;
            }

            if (matchedCommand.action === "clear") {
                terminalBody.innerHTML = "";
                newPrompt();
                return;
            }

            if (matchedCommand.action === "help") {
                const sw = window.softwareInfo || {};
                const osName = sw.osName || "MqMr's OS";
                const version = sw.version || "1.0.0v";

                let helpHeader = messages.helpHeader || "{osName} Terminal - version {version}";
                helpHeader = helpHeader
                    .replace("{osName}", osName)
                    .replace("{version}", version);

                const helpTitle = messages.helpTitle || "Available commands:";

                const commandLines = commands
                    .map(item => `  ${String(item.command).padEnd(10, " ")} - ${item.description || ""}`)
                    .join("\n");

                terminalBody.innerHTML += `\n${helpHeader}\n${helpTitle}\n${commandLines}\n`;
                newPrompt();
                return;
            }

            if (matchedCommand.action === "open_window") {
                const ok = openAppById(matchedCommand.target);
                if (!ok) {
                    const failMsgTemplate = messages.appOpenFailed || 'Could not open "{command}" app.';
                    const failMsg = failMsgTemplate.replace("{command}", matchedCommand.command || cmd);
                    terminalBody.innerHTML += `\n${failMsg}\n`;
                }
                newPrompt();
                return;
            }

            const commandNotFound = messages.commandNotFound || "Command not found.";
            terminalBody.innerHTML += `\n${commandNotFound}\n`;
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

/* ================= DISPLAY MODE SETTINGS ================= */

(function () {
  const advancedSwitch = document.getElementById("advanced-display-switch");
  const displaySelect  = document.getElementById("display-mode-select");

  const dialog         = document.getElementById("display-mode-dialog");
  const btnCancel      = document.getElementById("display-dialog-cancel");
  const btnContinue    = document.getElementById("display-dialog-continue");

  if (!advancedSwitch || !displaySelect || !dialog) return;

  let isAdvancedOn = false;
  let currentMode  = displaySelect.value || "standard";
  let pendingMode  = null;

  // تحديث الخيارات في القائمة حسب حالة Advanced
  function refreshDisplayOptions() {
    const previousValue = displaySelect.value || currentMode;

    const baseOptions = [
      { value: "standard", label: "Standard" },
      { value: "simple",   label: "Simple" },
    ];

    const options = isAdvancedOn
      ? [...baseOptions, { value: "phone", label: "Phone" }]
      : baseOptions;

    displaySelect.innerHTML = "";
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      displaySelect.appendChild(o);
    });

    // لو الوضع السابق غير متاح الآن (مثلاً كان Phone وأغلقنا Advanced)
    if (!options.some(o => o.value === previousValue)) {
      currentMode = "standard";
      displaySelect.value = "standard";
    } else {
      displaySelect.value = previousValue;
    }
  }

  // فتح / إغلاق الـ dialog
  function openDialog() {
    dialog.classList.remove("modal-hidden");
  }

  function closeDialog() {
    dialog.classList.add("modal-hidden");
    pendingMode = null;
  }

  // تغيير حالة الـ switch
  advancedSwitch.addEventListener("click", () => {
    isAdvancedOn = !isAdvancedOn;
    advancedSwitch.classList.toggle("is-on", isAdvancedOn);
    advancedSwitch.setAttribute("aria-pressed", String(isAdvancedOn));

    refreshDisplayOptions();
  });

  // عندما يغيّر المستخدم الـ Display Mode
  displaySelect.addEventListener("change", (e) => {
    const newValue = e.target.value;
    if (newValue === currentMode) return;

    pendingMode = newValue;
    openDialog();
  });

  // Cancel → رجوع للقيمة القديمة
  btnCancel.addEventListener("click", () => {
    if (pendingMode !== null) {
      displaySelect.value = currentMode;
    }
    closeDialog();
  });

btnContinue.addEventListener("click", () => {
    if (!pendingMode) {
        closeDialog();
        return;
    }

    const newMode = pendingMode;
    pendingMode = null;

    // تحديث المتغير
    currentMode = newMode;

    // 🔥 التحويل بين الصفحات
    if (newMode === "standard") {
        window.location.href = "./index.html"; 
    } 
    else if (newMode === "simple") {
        window.location.href = "./Simple/simple.html"; 
    } 
    else if (newMode === "phone") {
        window.location.href = "./Phone/phone.html";
    }

    closeDialog();
});

  // إغلاق بالضغط خارج البانل
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      // رجّع القيمة القديمة لو كان فيه تغيير معلق
      if (pendingMode !== null) {
        displaySelect.value = currentMode;
      }
      closeDialog();
    }
  });

  // تهيئة أولية
  refreshDisplayOptions();
})();


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
  const mappedTitle =
    settingsAppData?.Sections?.[sectionName]?.middleTitle ||
    sectionName.charAt(0).toUpperCase() + sectionName.slice(1);

  middleTitle.textContent = mappedTitle;
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
  settingsWindow.resetAppState = function () {
    activateSection("general");

    const generalSection = settingsWindow.querySelector('.settings-middle-section[data-section="general"]');
    const aboutBtn = generalSection?.querySelector('.mid-btn[data-page="general-about-page"]');
    if (aboutBtn) {
      activateMid(aboutBtn);
    }

    const mainArea = settingsWindow.querySelector(".settings-main");
    if (mainArea) {
      mainArea.scrollTop = 0;
    }
  };
  // ===================== LOAD DATA FROM JSON =====================
async function loadMainData() {
  try {
    const res = await fetch("main-data.json");
    const data = await res.json();
    mainData = data;

    const site = data.site || {};
    const osName = site.osName || "MqMr's OS";
    const version = site.version || "1.0.0v";
    const creator = site.creator || "MqMr";

    window.softwareInfo = {
      osName,
      version,
      creator
    };

    const aboutCreator = document.getElementById("about-creator");
    const aboutVersion = document.getElementById("about-version");
    const swVersion = document.getElementById("sw-version");
    const swChangelogList = document.getElementById("sw-changelog-list");
    const swUpcomingList = document.getElementById("sw-upcoming-list");

    if (aboutCreator) aboutCreator.textContent = creator;
    if (aboutVersion) aboutVersion.textContent = version;
    if (swVersion) swVersion.textContent = version;

if (swChangelogList && Array.isArray(data.changelog)) {
  swChangelogList.innerHTML = "";

  data.changelog.forEach(item => {
    const li = document.createElement("li");

    const versionEl = document.createElement("span");
    versionEl.className = "changelog-version";
    versionEl.textContent = item.version || "";

    const labelEl = document.createElement("span");
    labelEl.className = "changelog-label";
    labelEl.textContent = item.label || "";

    li.appendChild(versionEl);
    li.appendChild(labelEl);
    swChangelogList.appendChild(li);
  });

  const changelogEmbed = swChangelogList.closest(".settings-changelog-embed");
  if (changelogEmbed) {
    changelogEmbed.scrollTop = 0;
  }
}

if (swUpcomingList && Array.isArray(data.upcoming?.items)) {
  swUpcomingList.innerHTML = "";

  data.upcoming.items.forEach(item => {
    const li = document.createElement("li");

    const labelEl = document.createElement("span");
    labelEl.className = "changelog-label";
    labelEl.textContent = item.label || "";

    li.appendChild(labelEl);
    swUpcomingList.appendChild(li);
  });

  const upcomingEmbed = swUpcomingList.closest(".settings-changelog-embed");
  if (upcomingEmbed) {
    upcomingEmbed.scrollTop = 0;
  }
}

    const menuLabel = document.querySelector(".menubar-left .menubar-item strong");
    if (menuLabel) menuLabel.textContent = osName;

    const tabTemplate = data.tabs?.standard || "{osName} | {version}";
    document.title = tabTemplate
      .replace("{osName}", osName)
      .replace("{version}", version);

    console.log("Main data loaded successfully");
  } catch (err) {
    console.warn("Could not load main-data.json", err);
  }
}

async function loadSettingsApp() {
  try {
    const res = await fetch("./Apps/Settings.json");
    const data = await res.json();
    settingsAppData = data;

    const w = data.Window || {};
    const sections = data.Sections || {};
    const general = data.General || {};
    const display = data.Display || {};
    const privacy = data.Privacy || {};

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || "";
    };

    setText("settings-sidebar-title", w.sidebarTitle);
    setText("settings-section-general-label", sections.general?.label);
    setText("settings-section-display-label", sections.display?.label);
    setText("settings-section-privacy-label", sections.privacy?.label);

    setText("settings-menu-about-label", general.menu?.about);
    setText("settings-menu-software-label", general.menu?.softwareUpdate);
    setText("settings-menu-mode-label", display.menu?.mode);
    setText("settings-menu-google-label", privacy.menu?.google);

    setText("settings-about-page-title", general.aboutPage?.title);
    setText("settings-about-creator-label", general.aboutPage?.creatorLabel);
    setText("settings-about-software-label", general.aboutPage?.softwareLabel);

    setText("settings-software-page-title", general.softwarePage?.title);
    setText("settings-software-update-label", general.softwarePage?.updateLabel);
    setText("settings-software-available-label", general.softwarePage?.availableUpdatesLabel);
    setText("settings-software-changelog-label", general.softwarePage?.changeLogsLabel);
    setText("settings-software-upcoming-label", general.softwarePage?.upcomingLabel);
    setText("sw-updates-text", general.softwarePage?.availableUpdatesText);

    setText("settings-display-page-title", display.modePage?.title);
    setText("settings-display-advanced-title", display.modePage?.advancedTitle);
    setText("settings-display-advanced-description", display.modePage?.advancedDescription);
    setText("settings-display-mode-title", display.modePage?.displayModeTitle);
    setText("settings-display-mode-description", display.modePage?.displayModeDescription);

    setText("settings-google-page-title", privacy.googlePage?.title);
    setText("settings-google-account-label", privacy.googlePage?.accountLabel);
    setText("privacy-google-desc-main", privacy.googlePage?.signedOutDescription);
    setText("privacy-google-desc-safety", privacy.googlePage?.signedOutSafety);
    setText("settings-google-main-button-text", privacy.googlePage?.signInButton);

    setText("display-dialog-title", display.dialog?.title);
    setText("display-dialog-description", display.dialog?.description);
    setText("display-dialog-cancel", display.dialog?.cancel);
    setText("display-dialog-continue", display.dialog?.continue);

    const optionStandard = document.getElementById("settings-display-option-standard");
    const optionSimple = document.getElementById("settings-display-option-simple");

    if (optionStandard) optionStandard.textContent = display.modePage?.options?.standard || "Standard";
    if (optionSimple) optionSimple.textContent = display.modePage?.options?.simple || "Simple";

    const settingsWindowTitle = document.querySelector("#settings-window .window-title");
    if (settingsWindowTitle) settingsWindowTitle.textContent = w.title || "Settings";

    console.log("Settings app loaded successfully");
  } catch (err) {
    console.warn("Could not load Apps/Settings.json", err);
  }
}

loadMainData();
loadSettingsApp();


})();





/* ================= GOOGLE SIGN-IN (Popup OAuth) ================= */

// حط هنا الـ Client ID حق مشروعك من Google Console
const GOOGLE_CLIENT_ID = "543147531406-tvgcuqvlh92c2dfcfs4iqqpfqeb55cam.apps.googleusercontent.com";

let googleUser = null;        // name / email / picture
let googleTokenClient = null; // OAuth token client

// نحاول نرجّع بيانات المستخدم من localStorage (عشان ما تروح بعد Refresh)
(function restoreGoogleUser() {
  try {
    const saved = localStorage.getItem("mqmr_google_user");
    if (saved) {
      googleUser = JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to parse saved Google user", e);
  }
})();

// يرسم الكرت اللي في يسار نافذة الإعدادات
function renderSettingsSidebarCard() {
  const box = document.getElementById("settings-google-card-inner");
  if (!box) return;

  if (!googleUser) {
    // حالة غير مسجّل
    box.innerHTML = `
      <p style="
        font-size:14px;
        font-weight:600;
        margin-bottom:10px;
        color:#111827;
      ">
        ${settingsAppData?.Window?.googleCardSignedOutTitle || "Sign in with Google"}
      </p>
      <button id="btn-google-signin-sidebar" style="
        width:100%;
        padding:8px 0;
        border-radius:999px;
        border:none;
        background:#007aff;
        color:white;
        font-size:13px;
        font-weight:600;
        cursor:pointer;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        ${settingsAppData?.Window?.googleCardSignedOutButton || "Sign In"}
      </button>
    `;
  } else {
    // حالة مسجّل (كرت فيه الصورة + الاسم + زر Logout أحمر)
    box.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;">
        <img src="${googleUser.picture}" alt="Google avatar" style="
          width:56px;
          height:56px;
          border-radius:50%;
          object-fit:cover;
        ">
        <div style="
          font-size:14px;
          font-weight:600;
          color:#111827;
          max-width:100%;
          text-align:center;
          word-break:break-word;
        ">
          ${googleUser.name}
        </div>
        <button id="btn-google-logout-sidebar" style="
          width:100%;
          padding:8px 0;
          border-radius:999px;
          border:none;
          background:#ef4444;
          color:white;
          font-size:13px;
          font-weight:600;
          cursor:pointer;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          ${settingsAppData?.Window?.googleCardSignedInButton || "Logout"}
        </button>
      </div>
    `;
  }
}

// يحدّث صفحة Privacy → Google
function updateGooglePrivacySection() {
  const descMain = document.getElementById("privacy-google-desc-main");
  const descSafety = document.getElementById("privacy-google-desc-safety");
  const btnMain = document.getElementById("btn-google-signin-main");
  const googleRow = document.querySelector("#privacy-google-page .setting-row");

  const isSignedIn = !!googleUser;

  if (descMain) descMain.style.display = isSignedIn ? "none" : "";
  if (descSafety) descSafety.style.display = isSignedIn ? "none" : "";

  if (btnMain) {
btnMain.textContent = isSignedIn
  ? (settingsAppData?.Privacy?.googlePage?.logoutButton || "Logout")
  : (settingsAppData?.Privacy?.googlePage?.signInButton || "Sign In with Google");
      btnMain.style.background = isSignedIn ? "#ef4444" : "#007aff";
  }

  // كرت صغير يعرض الإسم + الإيميل داخل Privacy
  if (!googleRow) return;

  let card = document.getElementById("google-user-card");
  if (!isSignedIn) {
    if (card) card.remove();
    return;
  }

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
}

// يحدّث كل الـ UI الخاصة بقوقل ويربط الأزرار
function updateGoogleUI() {
  renderSettingsSidebarCard();
  updateGooglePrivacySection();

  const btnSidebarLogin = document.getElementById("btn-google-signin-sidebar");
  const btnSidebarLogout = document.getElementById("btn-google-logout-sidebar");
  const btnMain = document.getElementById("btn-google-signin-main");

  if (btnSidebarLogin) btnSidebarLogin.onclick = startGoogleLogin;
  if (btnSidebarLogout) btnSidebarLogout.onclick = logoutGoogle;
  if (btnMain) btnMain.onclick = googleUser ? logoutGoogle : startGoogleLogin;
    // ✅ توحيد الخط Inter لكل الأزرار
  [btnSidebarLogin, btnSidebarLogout, btnMain].forEach((btn) => {
    if (btn) {
      btn.style.fontFamily =
        "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    }
  });
}

// تهيئة OAuth Client من Google (Popup فيه حساباتك)
function setupGoogleOAuth() {
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    console.warn("Google OAuth not available yet");
    return;
  }

  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "openid profile email",
    callback: (tokenResponse) => {
      // بعد ما يرجع لنا access_token نجيب بيانات المستخدم من Google
      fetchGoogleProfile(tokenResponse.access_token);
    },
  });
}

// جلب بيانات المستخدم من Google
async function fetchGoogleProfile(accessToken) {
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch Google profile");
    }

    const data = await res.json();

    googleUser = {
      name: data.name || data.given_name || "Google User",
      email: data.email || "",
      picture: data.picture || "",
    };

    localStorage.setItem("mqmr_google_user", JSON.stringify(googleUser));
    updateGoogleUI();
  } catch (err) {
    console.error(err);
  }
}

// يبدأ تسجيل الدخول → يفتح Popup بحسابات قوقل
function startGoogleLogin() {
  if (!googleTokenClient) {
    alert("Google Sign-In is still loading, try again in a second.");
    return;
  }

  // select_account عشان يطلع لك صفحة الحسابات كل مرة
  googleTokenClient.requestAccessToken({
    prompt: "select_account",
  });
}

// خروج (Logout)
function logoutGoogle() {
  googleUser = null;
  localStorage.removeItem("mqmr_google_user");
  updateGoogleUI();
}

// ننتظر مكتبة Google تنتهي تحميل
function initGoogleOAuthPolling(tries = 0) {
  if (window.google && google.accounts && google.accounts.oauth2) {
    setupGoogleOAuth();
    return;
  }
  if (tries > 20) {
    console.warn("Could not init Google OAuth");
    return;
  }
  setTimeout(() => initGoogleOAuthPolling(tries + 1), 300);
}

// أول مرة نحمل الصفحة
updateGoogleUI();
initGoogleOAuthPolling();







/* ================= DEFAULT WINDOW ================= */
// افتح نافذة About عند بداية تشغيل الموقع
const defaultWindow = document.getElementById("about-window");
defaultWindow.classList.add("active");
defaultWindow.style.display = "flex";

// تفعيل النقطة تحت أيقونة About
const aboutDockItem = document.querySelector(".dock-item.about");
aboutDockItem.classList.add("open");
aboutDockItem.classList.add("focused");







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
      window.location.replace('./Phone/phone.html');
    }
  }
})();



async function loadAboutMeApp() {
    try {
        const res = await fetch("./Apps/AboutMe.json");
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
        if (avatarEl) avatarEl.src = data.avatar || "";

        if (instagramBtn && data.socials?.instagram) {
            instagramBtn.onclick = () => window.open(data.socials.instagram, "_blank");
        }

        if (discordBtn && data.socials?.discord) {
            discordBtn.onclick = () => window.open(data.socials.discord, "_blank");
        }

        if (xBtn && data.socials?.x) {
            xBtn.onclick = () => window.open(data.socials.x, "_blank");
        }

        if (youtubeBtn && data.socials?.youtube) {
            youtubeBtn.onclick = () => window.open(data.socials.youtube, "_blank");
        }

        console.log("AboutMe app loaded successfully");
    } catch (error) {
        console.warn("Failed to load Apps/AboutMe.json", error);
    }
}

loadAboutMeApp();

async function loadProjectsApp() {
    try {
        const res = await fetch("./Apps/Projects.json");
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

        console.log("Projects app loaded successfully");
    } catch (error) {
        console.warn("Failed to load Apps/Projects.json", error);
    }
}

loadProjectsApp();

async function loadWorkspaceApp() {
    try {
        const res = await fetch("./Apps/Workspace.json");
        const data = await res.json();

        const sectionTitle = document.getElementById("workspace-section-title");
        const sectionSubtitle = document.getElementById("workspace-section-subtitle");

        const areasTitle = document.getElementById("workspace-areas-title");
        const areasSubtitle = document.getElementById("workspace-areas-subtitle");
        const areasList = document.getElementById("workspace-areas-list");

        const toolsTitle = document.getElementById("workspace-tools-title");
        const toolsSubtitle = document.getElementById("workspace-tools-subtitle");
        const toolsList = document.getElementById("workspace-tools-list");

        const hardwareTitle = document.getElementById("workspace-hardware-title");
        const hardwareSubtitle = document.getElementById("workspace-hardware-subtitle");
        const hardwareList = document.getElementById("workspace-hardware-list");

        if (sectionTitle) sectionTitle.textContent = data.Section?.title || "Workspace";
        if (sectionSubtitle) sectionSubtitle.textContent = data.Section?.subtitle || "";

        if (areasTitle) areasTitle.textContent = data.AreasSection?.title || "Build Areas";
        if (areasSubtitle) areasSubtitle.textContent = data.AreasSection?.subtitle || "";
        if (toolsTitle) toolsTitle.textContent = data.ToolsSection?.title || "Tools";
        if (toolsSubtitle) toolsSubtitle.textContent = data.ToolsSection?.subtitle || "";
        if (hardwareTitle) hardwareTitle.textContent = data.HardwareSection?.title || "Device Specs";
        if (hardwareSubtitle) hardwareSubtitle.textContent = data.HardwareSection?.subtitle || "";

        if (areasList) {
            areasList.innerHTML = "";
            (data.Areas || []).forEach(area => {
                const card = document.createElement("div");
                card.className = "workspace-stack-item";

                const title = document.createElement("h4");
                title.className = "workspace-stack-title";
                title.textContent = area.title || "Untitled";

                const desc = document.createElement("p");
                desc.className = "workspace-stack-description";
                desc.textContent = area.description || "";

                card.appendChild(title);
                card.appendChild(desc);
                areasList.appendChild(card);
            });
        }

        if (toolsList) {
            toolsList.innerHTML = "";
            (data.Tools || []).forEach(tool => {
                const pill = document.createElement("div");
                pill.className = "workspace-tool-pill";

                const name = document.createElement("span");
                name.className = "workspace-tool-name";
                name.textContent = tool.name || "Unknown Tool";

                const type = document.createElement("span");
                type.className = "workspace-tool-type";
                type.textContent = tool.type || "";

                pill.appendChild(name);
                pill.appendChild(type);
                toolsList.appendChild(pill);
            });
        }

        if (hardwareList) {
            hardwareList.innerHTML = "";
            ((data.Hardware && data.Hardware.items) || []).forEach(spec => {
                const row = document.createElement("div");
                row.className = "workspace-spec-row";

                const label = document.createElement("div");
                label.className = "workspace-spec-label";
                label.textContent = spec.label || "";

                const valueWrap = document.createElement("div");
                valueWrap.className = "workspace-spec-value";

                if (Array.isArray(spec.values)) {
                    spec.values.forEach(value => {
                        const line = document.createElement("div");
                        line.textContent = value;
                        valueWrap.appendChild(line);
                    });
                } else {
                    valueWrap.textContent = spec.value || "";
                }

                row.appendChild(label);
                row.appendChild(valueWrap);
                hardwareList.appendChild(row);
            });
        }

        console.log("Workspace app loaded successfully");
    } catch (error) {
        console.warn("Failed to load Apps/Workspace.json", error);
    }
}

loadWorkspaceApp();


async function loadContactApp() {
    try {
        const res = await fetch("./Apps/Contact.json");
        const data = await res.json();
        contactAppData = data;

        const section = data.Section || {};
        const fields = data.Form?.fields || {};
        const form = data.Form || {};

        const windowTitle = document.getElementById("contact-window-title");
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

        if (windowTitle) windowTitle.textContent = section.windowTitle || "Contact";
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

        console.log("Contact app loaded successfully");
    } catch (error) {
        console.warn("Failed to load Apps/Contact.json", error);
    }
}

loadContactApp();



async function loadTerminalApp() {
    try {
        const res = await fetch("./Apps/Terminal.json");
        const data = await res.json();
        terminalAppData = data;

        const windowTitle = document.getElementById("terminal-window-title");
        if (windowTitle) {
            windowTitle.textContent = data.Section?.windowTitle || "Terminal";
        }

        initializeTerminalContent();

        console.log("Terminal app loaded successfully");
    } catch (error) {
        console.warn("Failed to load Apps/Terminal.json", error);
    }
}

loadTerminalApp();


const terminalWindowEl = document.getElementById("terminal-window");
if (terminalWindowEl) {
  terminalWindowEl.resetAppState = function () {
    initializeTerminalContent();
  };
}

