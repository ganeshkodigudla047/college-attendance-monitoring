/**
 * college-background.js
 * Loads and applies the college background image for all dashboards.
 * Auto-detects background brightness and adjusts text color for readability.
 */

import { db } from "./firebase.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const BG_STYLE_ID = "college-bg-style";

const TRANSPARENT_SELECTORS = [
    '.header', '.sidebar', '.sidebar-footer',
    '.header-clock', '.notification', '.notification-btn', '.logout-btn',
    '.nav-item', '.sidebar-nav', '.sidebar-menu', '.nav-link', '.menu-item',
    '.page.section', '.section', '.page',
    '#home', '#home *', '#homePage', '#homePage *',
    '#settings', '#settings *', '#timing', '#timing *',
    '#gps', '#gps *', '#approvals', '#approvals *',
    '#students', '#students *', '#staff', '#staff *',
    '#attendance', '#attendance *', '#profile', '#profile *',
    '#emailreminders', '#emailreminders *',
    '.status-box', '.admin-settings-box',
    '.home-session-box', '.mark-session-box', '.attendance-box',
    '.records-container', '.table-container', '.profile-card-v2',
    '.profile-container-premium', '.profile-sidebar', '.profile-main',
    '.profile-content-v2', '.card', '.stat-card', '.sa-stat-card',
    '.sa-card', '.sa-activity-card', '.sa-attention', '.greeting-block',
    '.admin-profile-shell', '.admin-profile-hero', '.admin-profile-body',
    '.session-card', '.admin-setting-item', '.profile-info-item-v2',
    '.admin-profile-field', '.status-message', '.step-box',
    '.sa-info-row', '.sa-config-item', '.profile-detail-item',
    'table', 'th', 'td'
].join(',');

let _bgObserver = null;

/**
 * Sample the brightness of an image URL using a canvas.
 * Returns a promise resolving to "dark" or "light".
 */
function _detectImageBrightness(imageUrl) {
    return new Promise((resolve) => {
        // Attempt 1: with crossOrigin (needed for canvas pixel read)
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 80; canvas.height = 80;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, 80, 80);
                const data = ctx.getImageData(0, 0, 80, 80).data;
                let total = 0;
                for (let i = 0; i < data.length; i += 4) {
                    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                }
                resolve((total / (data.length / 4)) > 128 ? "light" : "dark");
            } catch (_) {
                // Canvas tainted — try without crossOrigin
                _detectBrightnessNoCORS(imageUrl, resolve);
            }
        };
        img.onerror = () => _detectBrightnessNoCORS(imageUrl, resolve);

        // Append cache-bust so browser re-fetches with CORS headers
        const sep = imageUrl.includes("?") ? "&" : "?";
        img.src = imageUrl + sep + "_cb=" + Date.now();
    });
}

function _detectBrightnessNoCORS(imageUrl, resolve) {
    // Load without crossOrigin — can't read pixels but can measure perceived
    // brightness by rendering to an offscreen canvas via createImageBitmap
    if (typeof createImageBitmap !== "undefined") {
        fetch(imageUrl)
            .then(r => r.blob())
            .then(blob => createImageBitmap(blob, { resizeWidth: 40, resizeHeight: 40, resizeQuality: "low" }))
            .then(bitmap => {
                const canvas = document.createElement("canvas");
                canvas.width = 40; canvas.height = 40;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(bitmap, 0, 0);
                const data = ctx.getImageData(0, 0, 40, 40).data;
                let total = 0;
                for (let i = 0; i < data.length; i += 4) {
                    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                }
                resolve((total / (data.length / 4)) > 128 ? "light" : "dark");
            })
            .catch(() => resolve("dark"));
    } else {
        resolve("dark");
    }
}

function _stripInlineBackgrounds() {
    document.querySelectorAll(TRANSPARENT_SELECTORS).forEach(el => {
        if (el.closest('.custom-select-wrap')) return;
        el.style.removeProperty('background');
        el.style.removeProperty('background-color');
        el.style.removeProperty('background-image');
    });
    // Strip ALL inline backgrounds from every element on the page
    document.querySelectorAll('.header, .header *, .sidebar, .sidebar *, .sidebar-footer, .section *, .page *').forEach(el => {
        if (el.closest('.custom-select-wrap')) return;
        if (el.style.background || el.style.backgroundColor || el.style.backgroundImage) {
            el.style.removeProperty('background');
            el.style.removeProperty('background-color');
            el.style.removeProperty('background-image');
        }
    });
}

function _startObserver() {
    if (_bgObserver) return;
    _bgObserver = new MutationObserver(() => {
        _stripInlineBackgrounds();
        // Re-apply dark color-scheme to any newly added selects
        document.querySelectorAll('select').forEach(s => { s.style.colorScheme = 'dark'; });
    });
    _bgObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
}

function _stopObserver() {
    if (_bgObserver) { _bgObserver.disconnect(); _bgObserver = null; }
}

function _buildCSS(imageUrl, isDark) {
    const textColor   = isDark ? "#ffffff"                    : "#0f172a";
    const textMuted   = isDark ? "rgba(255,255,255,0.75)"     : "#475569";
    const borderColor = isDark ? "rgba(255,255,255,0.35)"     : "rgba(0,0,0,0.25)";
    const textShadow  = isDark ? "0 1px 4px rgba(0,0,0,0.9)" : "0 1px 3px rgba(255,255,255,0.9)";

    return `
        body {
            background-image: url("${imageUrl}") !important;
            background-size: cover !important;
            background-position: center center !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
        }

        /* ── HEADER & SIDEBAR: fully transparent ── */
        .header, .sidebar, .sidebar-footer,
        .nav-item, .sidebar-nav, .sidebar-menu,
        .nav-link, .menu-item, .submenu,
        .header-clock, .notification, .logout-btn,
        .header-right > *, .sidebar li, .sidebar li.active,
        .sidebar-brand, .sidebar-footer * {
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            border-color: transparent !important;
        }

        /* ── HEADER: hide content scrolling behind it ── */
        /* Use the same background image on the header so it looks transparent
           but actually clips content scrolling underneath */
        .header {
            background-image: url("${imageUrl}") !important;
            background-size: cover !important;
            background-position: center top !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
        }

        /* ── ALL CONTENT BOXES: fully transparent ── */
        .page.section, .section, .page,
        .page.section *, .section *, .page *,
        #home, #home *,
        #homePage, #homePage *,
        .status-box, .admin-settings-box,
        .home-session-box, .mark-session-box, .attendance-box,
        .profile-card-v2,
        .profile-container-premium, .profile-sidebar, .profile-main,
        .profile-content-v2, .card, .stat-card, .sa-stat-card,
        .sa-card, .sa-activity-card, .sa-attention, .greeting-block,
        .admin-profile-shell, .admin-profile-hero, .admin-profile-body,
        .session-card, .admin-setting-item, .profile-info-item-v2,
        .admin-profile-field, .status-message, .step-box,
        .sa-info-row, .sa-config-item, .profile-detail-item,
        .notify-list, .notify-header {
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
        }
        /* Restore visible borders on content boxes after transparent rule */
        .card, .stat-card, .sa-stat-card, .sa-card,
        .status-box, .session-card, .admin-setting-item,
        .profile-info-item-v2, .sa-info-row, .sa-config-item,
        .profile-detail-item, .admin-settings-box,
        .home-session-box, .mark-session-box, .attendance-box {
            border: 1px solid ${borderColor} !important;
        }

        /* ── TABLE: glass effect when background is present ── */
        .table-container, .records-container {
            background: rgba(255,255,255,0.08) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            box-shadow: none !important;
        }
        table, .records-fixed-table { background: transparent !important; }
        th, .records-fixed-table thead th {
            position: sticky;
            top: 0;
            z-index: 10;
            background: rgba(15,23,42,0.8) !important;
            color: rgba(255,255,255,0.75) !important;
            border-bottom: 2px solid rgba(255,255,255,0.15) !important;
            backdrop-filter: blur(8px) !important;
            white-space: nowrap;
        }
        td, .records-fixed-table td {
            color: ${textColor} !important;
            border-bottom: 1px solid ${borderColor} !important;
            background: transparent !important;
            white-space: nowrap;
        }

        /* ── TABLE ROW HOVER HIGHLIGHT ── */
        body.has-bg tbody tr:hover {
            background: ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"} !important;
            cursor: pointer;
        }

        /* ── TEXT COLORS: high specificity with body.has-bg prefix ── */
        body.has-bg,
        body.has-bg .main, body.has-bg .main-content,
        body.has-bg .section *, body.has-bg .page *,
        body.has-bg #home *, body.has-bg #homePage *,
        body.has-bg h1, body.has-bg h2, body.has-bg h3,
        body.has-bg h4, body.has-bg h5, body.has-bg h6,
        body.has-bg p, body.has-bg span, body.has-bg label,
        body.has-bg li, body.has-bg a, body.has-bg div {
            color: ${textColor} !important;
            text-shadow: ${textShadow} !important;
        }
        /* Exclude dropdown panels from text color override */
        body.has-bg .custom-select-panel,
        body.has-bg .custom-select-panel *,
        body.has-bg .custom-select-option {
            color: rgba(255,255,255,0.85) !important;
            text-shadow: none !important;
        }
        body.has-bg .custom-select-option:hover {
            color: #fff !important;
            background: rgba(255,255,255,0.18) !important;
        }
        body.has-bg .custom-select-option.selected {
            color: #93c5fd !important;
            background: rgba(59,130,246,0.4) !important;
        }
        body.has-bg .custom-select-option.selected:hover {
            color: #fff !important;
            background: rgba(59,130,246,0.55) !important;
        }
        /* Custom select trigger adapts to bg brightness */
        body.has-bg .custom-select-trigger {
            background: rgba(255,255,255,0.15) !important;
            border-color: rgba(255,255,255,0.25) !important;
            color: ${textColor} !important;
            text-shadow: none !important;
        }
        body.has-bg .muted, body.has-bg .text-muted,
        body.has-bg .subtitle, body.has-bg .section-subtext,
        body.has-bg .profile-info-label, body.has-bg .sa-stat-label,
        body.has-bg .stat-label {
            color: ${textMuted} !important;
            text-shadow: ${textShadow} !important;
        }
        /* Borders — all visible containers */
        body.has-bg .card, body.has-bg .stat-card,
        body.has-bg .sa-stat-card, body.has-bg .sa-card,
        body.has-bg .status-box, body.has-bg .admin-settings-box,
        body.has-bg .session-card, body.has-bg .admin-setting-item,
        body.has-bg .profile-info-item-v2,
        body.has-bg .table-wrap, body.has-bg .table-responsive,
        body.has-bg .table-container, body.has-bg .records-container,
        body.has-bg .controls-bar, body.has-bg .admin-controls,
        body.has-bg .section > div, body.has-bg .page > div,
        body.has-bg [style*="border"],
        body.has-bg td, body.has-bg th {
            border-color: ${borderColor} !important;
        }
        /* Inputs always readable */
        body.has-bg input:not(.records-select),
        body.has-bg select:not(.records-select),
        body.has-bg textarea {
            color: #0f172a !important;
            background: rgba(255,255,255,0.88) !important;
            text-shadow: none !important;
        }
        /* Filter bars */
        body.has-bg .controls-bar input, body.has-bg .controls-bar select,
        body.has-bg .admin-controls input, body.has-bg .admin-controls select,
        body.has-bg .records-select {
            background: rgba(255,255,255,0.15) !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.3) !important;
            text-shadow: none !important;
            color-scheme: dark;
        }
        body.has-bg .controls-bar input::placeholder,
        body.has-bg .admin-controls input::placeholder {
            color: rgba(255,255,255,0.5) !important;
        }
        /* ALL selects get dark color-scheme */
        body.has-bg select { color-scheme: dark; }
        body.has-bg select option { background: #1e293b !important; color: #f1f5f9 !important; }
        /* Buttons keep their own colors */
        body.has-bg button, body.has-bg .btn, body.has-bg [class*="btn"] {
            text-shadow: none !important;
        }
    `;
}

/**
 * Apply background image to the page body.
 * Auto-detects brightness and sets text color for readability.
 */
export async function applyCollegeBackground(imageUrl) {
    if (!imageUrl) return;

    let styleEl = document.getElementById(BG_STYLE_ID);
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = BG_STYLE_ID;
    }
    // Always move to end of <head> so it wins the CSS cascade over all other stylesheets
    document.head.appendChild(styleEl);

    // Apply immediately with cached brightness (instant load), then refine
    const cachedBrightness = sessionStorage.getItem("collegeBgBrightness");
    styleEl.textContent = _buildCSS(imageUrl, cachedBrightness !== "light");

    document.body.classList.add("has-bg");
    _stripInlineBackgrounds();
    _startObserver();
    // Apply dark color-scheme to ALL selects so OS dropdown popup renders dark
    document.querySelectorAll('select').forEach(s => { s.style.colorScheme = 'dark'; });

    try { sessionStorage.setItem("collegeBgUrl", imageUrl); } catch (_) {}

    // Detect actual brightness and update if different
    const brightness = await _detectImageBrightness(imageUrl);
    const isDark = brightness === "dark";
    // Move to end again after async gap (other scripts may have appended styles)
    document.head.appendChild(styleEl);
    styleEl.textContent = _buildCSS(imageUrl, isDark);
    _stripInlineBackgrounds();

    try { sessionStorage.setItem("collegeBgBrightness", brightness); } catch (_) {}
}

/**
 * Load background from Firestore for a given collegeId and apply it.
 */
export async function loadAndApplyBackground(collegeId) {
    if (!collegeId) return;

    try {
        const cached = sessionStorage.getItem("collegeBgUrl");
        if (cached) { applyCollegeBackground(cached); }
    } catch (_) {}

    try {
        const snap = await getDoc(doc(db, "colleges", collegeId));
        if (snap.exists()) {
            const bgUrl = snap.data().backgroundImage || null;
            if (bgUrl) {
                applyCollegeBackground(bgUrl);
            } else {
                removeCollegeBackground();
            }
        }
    } catch (err) {
        console.warn("college-background: could not load background", err);
    }
}

/**
 * Remove the college background (reset to default).
 */
export function removeCollegeBackground() {
    const styleEl = document.getElementById(BG_STYLE_ID);
    if (styleEl) styleEl.remove();
    document.body.classList.remove("has-bg");
    _stopObserver();
    // Restore default color-scheme on all selects
    document.querySelectorAll('select').forEach(s => { s.style.colorScheme = ''; });
    try { sessionStorage.removeItem("collegeBgUrl"); } catch (_) {}
    try { sessionStorage.removeItem("collegeBgBrightness"); } catch (_) {}
}

/**
 * Save a background image URL to Firestore for the college.
 * Optionally pass uploader metadata { uid, name } to record who set it.
 */
export async function saveCollegeBackground(collegeId, imageUrl, uploader = null) {
    if (!collegeId) throw new Error("No college ID");
    const payload = { backgroundImage: imageUrl };
    if (uploader) {
        payload.bgUploadedBy = uploader.uid || null;
        payload.bgUploadedByName = uploader.name || null;
        payload.bgUploadedAt = serverTimestamp();
    }
    await updateDoc(doc(db, "colleges", collegeId), payload);
    applyCollegeBackground(imageUrl);
}

/**
 * Remove background from Firestore and page.
 */
export async function deleteCollegeBackground(collegeId) {
    if (!collegeId) throw new Error("No college ID");
    await updateDoc(doc(db, "colleges", collegeId), { backgroundImage: null });
    removeCollegeBackground();
}