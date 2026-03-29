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
    '#invite', '#invite *', '#adminlist', '#adminlist *',
    '#collegelist', '#collegelist *', '#userlist', '#userlist *',
    '#messages', '#messages *', '#dayscount', '#dayscount *',
    '#bgaudit', '#bgaudit *', '#platformbg', '#platformbg *',
    '#superadminbg', '#superadminbg *', '#admanage', '#admanage *',
    '#holiday', '#holiday *', '#security', '#security *',
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
    '.controls-bar', '.admin-controls', '.tab-scroller',
    '.table-wrap', '.table-responsive',
    '.provisioning-card', '.audit-log-card', '.bg-audit-card',
    '.admin-card', '.college-card', '.user-card',
    'table', 'th', 'td'
].join(',');

let _bgObserver = null;
let _adaptiveCanvas = null;
let _adaptiveCtx = null;
let _adaptiveImg = null;
let _adaptiveRaf = null;
let _adaptiveUrl = null;
let _adaptiveMutationObserver = null;

const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','INPUT','TEXTAREA','SELECT','OPTION','SVG','PATH','IMG','VIDEO','CANVAS','CODE','PRE']);
const ADAPTIVE_ATTR = 'data-adaptive-colored';

/** Wrap every word-level text node in a <span data-adaptive-colored> so we can color each word */
function _wrapTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            const p = node.parentElement;
            if (!p) return NodeFilter.FILTER_REJECT;
            if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
            if (p.hasAttribute(ADAPTIVE_ATTR)) return NodeFilter.FILTER_REJECT; // already wrapped
            if (p.closest('[data-adaptive-colored]')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(textNode => {
        const parent = textNode.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName)) return;
        const text = textNode.textContent;
        // Split into words preserving spaces
        const parts = text.split(/(\s+)/);
        if (parts.length <= 1) {
            // Single word — just mark the parent
            const span = document.createElement('span');
            span.setAttribute(ADAPTIVE_ATTR, '1');
            span.style.display = 'inline';
            span.textContent = text;
            textNode.replaceWith(span);
        } else {
            const frag = document.createDocumentFragment();
            parts.forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    frag.appendChild(document.createTextNode(part));
                } else {
                    const span = document.createElement('span');
                    span.setAttribute(ADAPTIVE_ATTR, '1');
                    span.style.display = 'inline';
                    span.textContent = part;
                    frag.appendChild(span);
                }
            });
            textNode.replaceWith(frag);
        }
    });
}

/** Sample average luminance of a rect region from the loaded bg image */
function _sampleLuminance(x, y, w, h) {
    if (!_adaptiveCtx || !_adaptiveImg || !_adaptiveImg.complete) return null;
    const iw = _adaptiveImg.naturalWidth  || 1;
    const ih = _adaptiveImg.naturalHeight || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Background is fixed — map viewport coords (not document coords) to image coords
    // x, y here are already getBoundingClientRect values (viewport-relative)
    const scaleX = iw / vw;
    const scaleY = ih / vh;
    const sx = Math.max(0, Math.min(iw - 1, Math.floor(x * scaleX)));
    const sy = Math.max(0, Math.min(ih - 1, Math.floor(y * scaleY)));
    const sw = Math.max(1, Math.min(iw - sx, Math.floor(w * scaleX)));
    const sh = Math.max(1, Math.min(ih - sy, Math.floor(h * scaleY)));
    try {
        const data = _adaptiveCtx.getImageData(sx, sy, sw, sh).data;
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
            total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        return total / (data.length / 4);
    } catch (_) { return null; }
}

function _getEffectiveBgColor(el) {
    // Walk up the DOM to find the first element with a non-transparent background
    let node = el;
    while (node && node !== document.body) {
        const bg = window.getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            const m = bg.match(/[\d.]+/g);
            if (m) return { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 };
        }
        node = node.parentElement;
    }
    return null; // fully transparent — use canvas sample
}

function _luminanceFromRGB(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function _applyAdaptiveColors() {
    const spans = document.querySelectorAll(`span[${ADAPTIVE_ATTR}]`);
    spans.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Skip off-screen elements (with generous buffer for partially visible)
        if (rect.width < 1 || rect.height < 1) return;
        if (rect.bottom < -300 || rect.top > window.innerHeight + 300) return;

        // Check if element has its own opaque background
        const ownBg = _getEffectiveBgColor(el);
        let lum;

        if (ownBg && ownBg.a > 0.5) {
            lum = _luminanceFromRGB(ownBg.r, ownBg.g, ownBg.b);
        } else {
            // Background is fixed — use viewport coords directly (no scrollY offset)
            // Sample at the center of the span for accuracy
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            lum = _sampleLuminance(cx, cy, Math.max(1, rect.width), Math.max(1, rect.height));
            if (lum === null) return;
        }

        const isDark = lum < 140;
        el.style.setProperty('color', isDark ? '#ffffff' : '#0f172a', 'important');
        el.style.setProperty('text-shadow',
            isDark ? '0 1px 4px rgba(0,0,0,0.85)' : '0 1px 2px rgba(255,255,255,0.8)',
            'important');
    });
}

function _scheduleAdaptive() {
    if (_adaptiveRaf) cancelAnimationFrame(_adaptiveRaf);
    _adaptiveRaf = requestAnimationFrame(() => {
        _adaptiveRaf = null;
        _applyAdaptiveColors();
    });
}

function _loadAdaptiveImage(imageUrl) {
    _adaptiveCanvas = document.createElement('canvas');
    _adaptiveCtx = _adaptiveCanvas.getContext('2d', { willReadFrequently: true });
    // Store url so toggle-on can resume
    if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem('_adaptiveImgUrl', imageUrl); } catch(_) {}
    }
    // If detector is disabled, load canvas silently but don't attach listeners
    const enabled = localStorage.getItem('adaptiveDetectorEnabled') !== '0';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        _adaptiveCanvas.width  = img.naturalWidth;
        _adaptiveCanvas.height = img.naturalHeight;
        _adaptiveCtx.drawImage(img, 0, 0);
        _adaptiveImg = img;
        if (!enabled) return; // canvas ready but don't run
        _wrapTextNodes(document.body);
        _applyAdaptiveColors();
    };
    img.onerror = () => {
        fetch(imageUrl)
            .then(r => r.blob())
            .then(blob => createImageBitmap(blob))
            .then(bitmap => {
                _adaptiveCanvas.width  = bitmap.width;
                _adaptiveCanvas.height = bitmap.height;
                _adaptiveCtx.drawImage(bitmap, 0, 0);
                _adaptiveImg = { complete: true, naturalWidth: bitmap.width, naturalHeight: bitmap.height };
                if (!enabled) return;
                _wrapTextNodes(document.body);
                _applyAdaptiveColors();
            })
            .catch(() => {});
    };
    const sep = imageUrl.includes('?') ? '&' : '?';
    img.src = imageUrl + sep + '_cb=' + Date.now();

    if (!enabled) return; // don't attach scroll/mutation listeners

    // Re-run on scroll and resize — drives per-letter color change as user scrolls
    window.addEventListener('scroll', _scheduleAdaptive, { passive: true });
    window.addEventListener('resize', _scheduleAdaptive, { passive: true });

    // Watch for new DOM content — wrap new text nodes then recolor
    _adaptiveMutationObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) _wrapTextNodes(node);
            }
        }
        _scheduleAdaptive();
    });
    _adaptiveMutationObserver.observe(document.body, { childList: true, subtree: true });
}


function _stopAdaptive() {
    window.removeEventListener('scroll', _scheduleAdaptive);
    window.removeEventListener('resize', _scheduleAdaptive);
    if (_adaptiveRaf) { cancelAnimationFrame(_adaptiveRaf); _adaptiveRaf = null; }
    if (_adaptiveMutationObserver) { _adaptiveMutationObserver.disconnect(); _adaptiveMutationObserver = null; }
    _adaptiveImg = null;
    _adaptiveCanvas = null;
    _adaptiveCtx = null;
    _adaptiveUrl = null;
}

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
        if (el.classList.contains('cs-wrap') || el.classList.contains('cs-trigger') || el.classList.contains('cs-dropdown') || el.classList.contains('cs-option')) return;
        el.style.removeProperty('background');
        el.style.removeProperty('background-color');
        el.style.removeProperty('background-image');
        el.style.removeProperty('box-shadow');
    });
    // Strip inline backgrounds from section children only
    document.querySelectorAll('.section *, .page *').forEach(el => {
        if (el.classList.contains('cs-wrap') || el.classList.contains('cs-trigger') || el.classList.contains('cs-dropdown') || el.classList.contains('cs-option')) return;
        if (el.closest('.custom-select-wrap')) return;
        if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'OPTION' || el.tagName === 'TEXTAREA') return;
        if (el.id === 'loadingScreen' || el.closest('#loadingScreen')) return;
        if (el.classList.contains('modal') || el.classList.contains('overlay') || el.closest('.modal') || el.closest('.overlay')) return;
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
        // Replace any new native selects with custom ones (debounced)
        clearTimeout(_bgObserver._csTimer);
        _bgObserver._csTimer = setTimeout(() => _initCustomSelects(), 200);
    });
    _bgObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
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

        /* ── MAKE ALL CONTENT TRANSPARENT ── */
        body.has-bg .page, body.has-bg .section, body.has-bg .page.section,
        body.has-bg .main, body.has-bg .sidebar, body.has-bg .sidebar-footer,
        body.has-bg .header,
        body.has-bg .header-clock, body.has-bg .notification, body.has-bg .logout-btn,
        body.has-bg .submenu, body.has-bg .nav-item, body.has-bg .menu-item,
        body.has-bg .card, body.has-bg .stat-card, body.has-bg .sa-stat-card,
        body.has-bg .sa-card, body.has-bg .sa-activity-card, body.has-bg .sa-attention,
        body.has-bg .status-box, body.has-bg .admin-settings-box, body.has-bg .session-card,
        body.has-bg .admin-setting-item, body.has-bg .profile-info-item-v2,
        body.has-bg .controls-bar, body.has-bg .admin-controls, body.has-bg .tab-scroller,
        body.has-bg .table-wrap, body.has-bg .table-responsive,
        body.has-bg .provisioning-card, body.has-bg .audit-log-card,
        body.has-bg .admin-card, body.has-bg .college-card, body.has-bg .user-card,
        body.has-bg .sa-info-row, body.has-bg .sa-config-item, body.has-bg .sa-status-badge,
        body.has-bg .sa-calendar, body.has-bg .sa-pending-item, body.has-bg .sa-attention-list li,
        body.has-bg .sa-greeting, body.has-bg .greeting-container,
        body.has-bg .profile-card-v2, body.has-bg .profile-container-premium,
        body.has-bg .profile-sidebar, body.has-bg .profile-main, body.has-bg .profile-content-v2,
        body.has-bg .admin-profile-shell, body.has-bg .admin-profile-hero, body.has-bg .admin-profile-body,
        body.has-bg .step-box, body.has-bg .status-message, body.has-bg .greeting-block,
        body.has-bg table, body.has-bg td,
        body.has-bg .bg-audit-card, body.has-bg .notify-header,
        body.has-bg .home-session-box, body.has-bg .mark-session-box, body.has-bg .attendance-box {
            background: transparent !important;
            background-color: transparent !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
        /* custom select blur */
        body.has-bg .cs-trigger {
            background: rgba(255,255,255,0.12) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            border: 1px solid rgba(255,255,255,0.3) !important;
            box-shadow: none !important;
        }
        body.has-bg .cs-trigger:hover {
            background: rgba(255,255,255,0.22) !important;
        }
        body.has-bg .cs-dropdown {
            background: rgba(15,23,42,0.6) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
        }
        body.has-bg .cs-option {
            background: transparent !important;
            color: rgba(255,255,255,0.9) !important;
        }
        body.has-bg .cs-option:hover {
            background: rgba(255,255,255,0.18) !important;
            color: #fff !important;
        }
        body.has-bg .cs-option.selected {
            background: rgba(59,130,246,0.4) !important;
            color: #93c5fd !important;
        }

        /* ── HEADER: restore background image trick ── */
        .header {
            background-image: url("${imageUrl}") !important;
            background-size: cover !important;
            background-position: center top !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
        }

        /* ── BUTTONS: transparent glass style ── */
        body.has-bg button {
            background: rgba(255,255,255,0.1) !important;
            border-color: rgba(255,255,255,0.2) !important;
            color: #fff !important;
            text-shadow: none !important;
            box-shadow: none !important;
        }
        body.has-bg button:hover {
            background: rgba(255,255,255,0.2) !important;
        }
        /* Specific button colors */
        body.has-bg #approveSelected,
        body.has-bg #saBgSaveBtn,
        body.has-bg button[style*="background:#3b82f6"],
        body.has-bg button[style*="background: #3b82f6"],
        body.has-bg button[style*="background: #2563eb"],
        body.has-bg button[style*="background:#2563eb"],
        body.has-bg .btn-primary { background: #3b82f6 !important; border-color: #2563eb !important; color: #fff !important; }
        body.has-bg #rejectSelected,
        body.has-bg button[style*="background:#dc2626"],
        body.has-bg button[style*="background: #dc2626"],
        body.has-bg button[style*="background:#ef4444"],
        body.has-bg button[style*="background: #ef4444"],
        body.has-bg .btn-danger { background: #dc2626 !important; border-color: #b91c1c !important; color: #fff !important; }
        body.has-bg button[style*="background:#10b981"],
        body.has-bg button[style*="background: #10b981"] { background: #10b981 !important; color: #fff !important; }
        body.has-bg button[style*="background:#d97706"],
        body.has-bg button[style*="background: #d97706"] { background: #d97706 !important; color: #fff !important; }
        body.has-bg .menu-btn { background: #3b82f6 !important; }
        body.has-bg #saBgTabUrl { background: #3b82f6 !important; }

        /* ── INPUTS / SELECTS: glass style ── */
        body.has-bg input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        body.has-bg select,
        body.has-bg textarea {
            background: rgba(255,255,255,0.12) !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.25) !important;
            text-shadow: none !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
        }
        body.has-bg input:focus,
        body.has-bg select:focus,
        body.has-bg textarea:focus {
            background: rgba(255,255,255,0.18) !important;
            border-color: rgba(255,255,255,0.5) !important;
            outline: none !important;
        }
        body.has-bg input::placeholder,
        body.has-bg textarea::placeholder { color: rgba(255,255,255,0.45) !important; }
        body.has-bg select { color-scheme: dark; }
        body.has-bg select option { background: rgba(15,23,42,0.92) !important; color: #f1f5f9 !important; }
        body.has-bg select option:hover,
        body.has-bg select option:focus { background: rgba(255,255,255,0.25) !important; color: #fff !important; }
        body.has-bg select option:checked { background: #3b82f6 !important; color: #fff !important; }

        /* ── NOTIFICATION BADGE ── */
        body.has-bg .notification-badge { background: #ef4444 !important; }

        /* ── LOADING SCREEN ── */
        body.has-bg #loadingScreen,
        body.has-bg .loading-overlay { background: rgba(15,23,42,0.95) !important; }

        /* ── MODAL / OVERLAY ── */
        body.has-bg .modal-overlay,
        body.has-bg .overlay,
        body.has-bg #logoutOverlay { background: rgba(0,0,0,0.6) !important; }
        body.has-bg .modal-card,
        body.has-bg .modal,
        body.has-bg .request-modal-content,
        body.has-bg .admin-profile-modal-card {
            background: rgba(15,23,42,0.75) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
        }

        /* ── NOTIFY LIST ── */
        body.has-bg .notify-list { background: rgba(15,23,42,0.92) !important; }
        body.has-bg .notify-item:hover { background: rgba(255,255,255,0.1) !important; }

        /* ── SIDEBAR ACTIVE / HOVER ── */
        body.has-bg .sidebar li.active { background: rgba(59,130,246,0.25) !important; border-radius: 8px; }
        body.has-bg .sidebar li:hover  { background: rgba(255,255,255,0.08) !important; border-radius: 8px; }

        /* ── TABLE HEADERS ── */
        body.has-bg th { background: rgba(15,23,42,0.6) !important; color: rgba(255,255,255,0.85) !important; border-bottom: 2px solid rgba(255,255,255,0.15) !important; }

        /* ── TABLE ROW HOVER ── */
        body.has-bg tbody tr:hover { background: rgba(255,255,255,0.1) !important; cursor: pointer; }

        /* ── STATUS BADGES ── */
        body.has-bg .status-registered { background: rgba(16,185,129,0.25) !important; color: #6ee7b7 !important; }
        body.has-bg .status-pending    { background: rgba(245,158,11,0.25) !important;  color: #fcd34d !important; }
        body.has-bg .status-expired    { background: rgba(239,68,68,0.25) !important;   color: #fca5a5 !important; }

        /* ── CARD HOVER ── */
        body.has-bg .card:hover, body.has-bg .stat-card:hover,
        body.has-bg .sa-stat-card:hover, body.has-bg .sa-card:hover,
        body.has-bg .sa-activity-card:hover, body.has-bg .session-card:hover,
        body.has-bg .admin-card:hover, body.has-bg .college-card:hover,
        body.has-bg .user-card:hover {
            background: rgba(255,255,255,0.1) !important;
            transform: translateY(-3px);
        }

        /* ── TEXT COLORS ── */
        body.has-bg,
        body.has-bg .main, body.has-bg .section *,
        body.has-bg h1, body.has-bg h2, body.has-bg h3,
        body.has-bg h4, body.has-bg h5, body.has-bg h6,
        body.has-bg p, body.has-bg span, body.has-bg label,
        body.has-bg li, body.has-bg a, body.has-bg div {
            color: ${textColor} !important;
            text-shadow: ${textShadow} !important;
        }
        body.has-bg button, body.has-bg input, body.has-bg select, body.has-bg textarea {
            text-shadow: none !important;
        }
        body.has-bg .muted, body.has-bg .text-muted {
            color: ${textMuted} !important;
        }

        /* ── BORDERS ── */
        body.has-bg td { border-bottom: 1px solid ${borderColor} !important; color: ${textColor} !important; }
        body.has-bg .card, body.has-bg .stat-card, body.has-bg .sa-stat-card,
        body.has-bg .admin-card, body.has-bg .college-card, body.has-bg .user-card {
            border: 1px solid ${borderColor} !important;
        }

        /* ── CUSTOM SELECT ── */
        body.has-bg .custom-select-trigger {
            background: rgba(255,255,255,0.15) !important;
            border-color: rgba(255,255,255,0.25) !important;
            color: ${textColor} !important;
        }
        body.has-bg .custom-select-option { color: rgba(255,255,255,0.85) !important; }
        body.has-bg .custom-select-option:hover { background: rgba(255,255,255,0.18) !important; }
        body.has-bg .custom-select-option.selected { background: rgba(59,130,246,0.4) !important; color: #93c5fd !important; }

        /* ── SA HOME SPECIFIC ── */
        body.has-bg .sa-greeting, body.has-bg .greeting-container { background: transparent !important; }
        body.has-bg .sa-attention-list li, body.has-bg .sa-pending-item,
        body.has-bg .sa-info-row, body.has-bg .sa-config-item,
        body.has-bg .sa-status-badge, body.has-bg .sa-calendar {
            background: transparent !important;
            border-color: ${borderColor} !important;
        }
        body.has-bg .sa-activity-actions button {
            background: rgba(255,255,255,0.12) !important;
            border-color: ${borderColor} !important;
            color: ${textColor} !important;
        }
        body.has-bg .sa-holiday-badge {
            background: rgba(255,255,255,0.15) !important;
            border-color: rgba(255,255,255,0.3) !important;
        }
        body.has-bg .sa-empty-state {
            background: rgba(255,255,255,0.08) !important;
            border-color: ${borderColor} !important;
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
    // Replace native selects with custom styled ones
    _initCustomSelects();

    try { sessionStorage.setItem("collegeBgUrl", imageUrl); } catch (_) {}

    // Detect actual brightness and update if different
    const brightness = await _detectImageBrightness(imageUrl);
    const isDark = brightness === "dark";
    // Move to end again after async gap (other scripts may have appended styles)
    document.head.appendChild(styleEl);
    styleEl.textContent = _buildCSS(imageUrl, isDark);
    _stripInlineBackgrounds();
    // Re-init custom selects for any dynamically added ones
    _initCustomSelects();
    try { sessionStorage.setItem("collegeBgBrightness", brightness); } catch (_) {}

    // Start per-element adaptive color detection
    _loadAdaptiveImage(imageUrl);
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
 * Toggle the adaptive color detector on/off.
 * Persists preference to localStorage.
 */
export function setAdaptiveDetector(enabled) {
    localStorage.setItem('adaptiveDetectorEnabled', enabled ? '1' : '0');
    if (enabled) {
        if (_adaptiveImg && !_adaptiveMutationObserver) {
            // Re-attach listeners and re-wrap
            _wrapTextNodes(document.body);
            _applyAdaptiveColors();
            window.addEventListener('scroll', _scheduleAdaptive, { passive: true });
            window.addEventListener('resize', _scheduleAdaptive, { passive: true });
            _adaptiveMutationObserver = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) _wrapTextNodes(node);
                    }
                }
                _scheduleAdaptive();
            });
            _adaptiveMutationObserver.observe(document.body, { childList: true, subtree: true });
        } else if (_adaptiveUrl) {
            _loadAdaptiveImage(_adaptiveUrl);
        }
    } else {
        // Stop listeners but keep canvas/image so we can resume
        window.removeEventListener('scroll', _scheduleAdaptive);
        window.removeEventListener('resize', _scheduleAdaptive);
        if (_adaptiveRaf) { cancelAnimationFrame(_adaptiveRaf); _adaptiveRaf = null; }
        if (_adaptiveMutationObserver) { _adaptiveMutationObserver.disconnect(); _adaptiveMutationObserver = null; }
        // Reset all adaptive span colors back to inherited
        document.querySelectorAll(`span[data-adaptive-colored]`).forEach(el => {
            el.style.removeProperty('color');
            el.style.removeProperty('text-shadow');
        });
    }
}

export function isAdaptiveDetectorEnabled() {
    return localStorage.getItem('adaptiveDetectorEnabled') !== '0';
}

/**
 * Remove the college background (reset to default).
 */
export function removeCollegeBackground() {
    const styleEl = document.getElementById(BG_STYLE_ID);
    if (styleEl) styleEl.remove();
    document.body.classList.remove("has-bg");
    _stopObserver();
    _stopAdaptive();
    _destroyCustomSelects();
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

/* ============================================================
   CUSTOM SELECT — replaces native <select> when bg is active
   ============================================================ */

const CS_STYLE_ID = 'custom-select-bg-style';

function _injectCustomSelectStyle() {
    // Remove and re-append so it always comes AFTER the bg style tag (wins cascade)
    const existing = document.getElementById(CS_STYLE_ID);
    if (existing) existing.remove();
    const s = document.createElement('style');
    s.id = CS_STYLE_ID;
    s.textContent = `
        .cs-wrap {
            position: relative;
            display: inline-block;
            vertical-align: middle;
        }
        .cs-trigger {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 9px 14px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.3) !important;
            background: rgba(255,255,255,0.15) !important;
            background-color: rgba(255,255,255,0.15) !important;
            backdrop-filter: blur(14px) !important;
            -webkit-backdrop-filter: blur(14px) !important;
            color: #fff !important;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            transition: background 0.15s, border-color 0.15s;
            box-sizing: border-box;
            width: 100%;
            min-width: 100px;
            box-shadow: none !important;
        }
        .cs-trigger:hover {
            background: rgba(255,255,255,0.25) !important;
            background-color: rgba(255,255,255,0.25) !important;
            border-color: rgba(255,255,255,0.55) !important;
        }
        .cs-arrow {
            font-size: 10px;
            opacity: 0.7;
            transition: transform 0.2s;
            flex-shrink: 0;
            color: #fff !important;
        }
        .cs-wrap.open .cs-arrow { transform: rotate(180deg); }
        .cs-dropdown {
            display: none !important;
            position: absolute !important;
            top: calc(100% + 4px) !important;
            left: 0 !important;
            min-width: 100% !important;
            z-index: 99999 !important;
            border-radius: 10px !important;
            border: 1px solid rgba(255,255,255,0.25) !important;
            background: rgba(10,15,30,0.85) !important;
            background-color: rgba(10,15,30,0.85) !important;
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
            overflow: hidden !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
            max-height: 260px !important;
            overflow-y: auto !important;
        }
        .cs-wrap.open .cs-dropdown { display: block !important; }
        .cs-option {
            padding: 10px 16px !important;
            color: rgba(255,255,255,0.9) !important;
            cursor: pointer !important;
            white-space: nowrap !important;
            transition: background 0.12s !important;
            font-size: 14px !important;
            background: transparent !important;
            background-color: transparent !important;
        }
        .cs-option:hover {
            background: rgba(255,255,255,0.18) !important;
            background-color: rgba(255,255,255,0.18) !important;
            color: #fff !important;
        }
        .cs-option.selected {
            background: rgba(59,130,246,0.4) !important;
            background-color: rgba(59,130,246,0.4) !important;
            color: #93c5fd !important;
            font-weight: 600 !important;
        }
        .cs-option.selected:hover {
            background: rgba(59,130,246,0.6) !important;
            background-color: rgba(59,130,246,0.6) !important;
            color: #fff !important;
        }
    `;
    document.head.appendChild(s);
}

function _removeCustomSelectStyle() {
    const s = document.getElementById(CS_STYLE_ID);
    if (s) s.remove();
}

function _buildCustomSelect(nativeSelect) {
    if (nativeSelect.dataset.csReplaced) return;
    nativeSelect.dataset.csReplaced = '1';

    // Hide native select but keep it in DOM for form/JS compatibility
    nativeSelect.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';

    const wrap = document.createElement('div');
    wrap.className = 'cs-wrap';

    const trigger = document.createElement('div');
    trigger.className = 'cs-trigger';

    const label = document.createElement('span');
    label.className = 'cs-label';

    const arrow = document.createElement('span');
    arrow.className = 'cs-arrow';
    arrow.textContent = '▼';

    trigger.appendChild(label);
    trigger.appendChild(arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'cs-dropdown';

    function syncLabel() {
        const sel = nativeSelect.options[nativeSelect.selectedIndex];
        label.textContent = sel ? sel.text : '';
    }

    function buildOptions() {
        dropdown.innerHTML = '';
        Array.from(nativeSelect.options).forEach((opt, i) => {
            const item = document.createElement('div');
            item.className = 'cs-option' + (i === nativeSelect.selectedIndex ? ' selected' : '');
            item.textContent = opt.text;
            item.dataset.value = opt.value;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                nativeSelect.value = opt.value;
                nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                syncLabel();
                dropdown.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
                item.classList.add('selected');
                wrap.classList.remove('open');
            });
            dropdown.appendChild(item);
        });
        syncLabel();
    }

    // Watch for options being added/changed (e.g. JS populates the select later)
    const nativeObserver = new MutationObserver(() => buildOptions());
    nativeObserver.observe(nativeSelect, { childList: true, subtree: true, attributes: true });
    nativeSelect._csObserver = nativeObserver;

    // Sync on programmatic value change
    nativeSelect.addEventListener('change', () => {
        syncLabel();
        dropdown.querySelectorAll('.cs-option').forEach((o, i) => {
            o.classList.toggle('selected', i === nativeSelect.selectedIndex);
        });
    });

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Rebuild options fresh every open (catches dynamic updates)
        buildOptions();
        const isOpen = wrap.classList.contains('open');
        document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open'));
        if (!isOpen) wrap.classList.add('open');
    });

    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);
    nativeSelect.parentNode.insertBefore(wrap, nativeSelect);
    wrap.appendChild(nativeSelect);

    nativeSelect._csWrap = wrap;
    buildOptions();
}

function _destroyCustomSelect(nativeSelect) {
    if (!nativeSelect.dataset.csReplaced) return;
    delete nativeSelect.dataset.csReplaced;
    if (nativeSelect._csObserver) { nativeSelect._csObserver.disconnect(); delete nativeSelect._csObserver; }
    const wrap = nativeSelect._csWrap;
    if (wrap && wrap.parentNode) {
        wrap.parentNode.insertBefore(nativeSelect, wrap);
        wrap.remove();
    }
    nativeSelect.style.cssText = '';
    delete nativeSelect._csWrap;
}

function _initCustomSelects() {
    _injectCustomSelectStyle();
    if (_bgObserver) _bgObserver.disconnect();
    document.querySelectorAll('select').forEach(s => {
        if (s.closest('.custom-select-wrap')) return;
        if (s.dataset.csReplaced) return;
        _buildCustomSelect(s);
    });
    if (_bgObserver) {
        _bgObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }
}

function _destroyCustomSelects() {
    document.querySelectorAll('select[data-cs-replaced]').forEach(s => _destroyCustomSelect(s));
    _removeCustomSelectStyle();
}

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.cs-wrap.open').forEach(w => w.classList.remove('open'));
});