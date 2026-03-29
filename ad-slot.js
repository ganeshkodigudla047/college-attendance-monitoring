/**
 * ad-slot.js
 * Shared advertisement slot for all dashboards.
 * Reads from Firestore: system/superAdminSettings { adUrl, adType }
 * The X button only dismisses for the session — only super admin can remove the ad.
 */

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const AD_DOC = () => doc(db, 'system', 'superAdminSettings');
const SESSION_KEY = 'adSlotDismissed';

function _ytEmbed(url) {
    const patterns = [
        /youtu\.be\/([^?&]+)/,
        /youtube\.com\/watch\?v=([^&]+)/,
        /youtube\.com\/embed\/([^?&]+)/,
        /youtube\.com\/shorts\/([^?&]+)/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0`;
    }
    return null;
}

function _ensureSlot() {
    if (document.getElementById('adSlot')) return;

    // Inject CSS
    if (!document.getElementById('ad-slot-style')) {
        const s = document.createElement('style');
        s.id = 'ad-slot-style';
        s.textContent = `
            #adSlot {
                display: none;
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 300px;
                aspect-ratio: 16 / 9;
                border-radius: 16px;
                overflow: hidden;
                background: #0f172a !important;
                box-shadow: 0 8px 32px rgba(0,0,0,0.35) !important;
                z-index: 9990;
                transition: width 0.35s ease, aspect-ratio 0.35s ease;
                animation: adFloatIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
            }
            @keyframes adFloatIn {
                from { opacity: 0; transform: translateY(40px) scale(0.92); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            #adSlot.visible { display: block !important; }
            #adSlot img, #adSlot video {
                width: 100%; height: 100%;
                object-fit: cover;
                display: block;
            }
            #adSlot iframe { width: 100%; height: 100%; border: none; display: block; }
            #adSlotClose {
                position: absolute;
                top: 8px; right: 10px;
                background: rgba(0,0,0,0.6) !important;
                color: #fff !important;
                border: none;
                border-radius: 50%;
                width: 28px; height: 28px;
                font-size: 14px;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                z-index: 10;
                opacity: 0.85;
                transition: opacity 0.2s, background 0.2s;
                font-weight: 700;
            }
            #adSlotClose:hover { opacity: 1; background: rgba(0,0,0,0.9) !important; }
        `;
        document.head.appendChild(s);
    }

    // Inject HTML
    const slot = document.createElement('div');
    slot.id = 'adSlot';
    slot.innerHTML = `
        <img src="" alt="Advertisement" style="display:none;" />
        <video autoplay muted loop playsinline style="display:none;"></video>
        <button id="adSlotClose" title="Dismiss ad">✕</button>
    `;
    document.body.appendChild(slot);

    // X button — dismiss for session only
    document.getElementById('adSlotClose').addEventListener('click', () => {
        slot.classList.remove('visible');
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
    });
}

function _applySlot(url, type) {
    const slot = document.getElementById('adSlot');
    if (!slot || !url) return;

    const img = slot.querySelector('img');
    const vid = slot.querySelector('video');
    let iframe = slot.querySelector('iframe');
    if (iframe) iframe.remove();

    if (type === 'youtube') {
        slot.style.aspectRatio = '16 / 9';
        iframe = document.createElement('iframe');
        iframe.src = _ytEmbed(url);
        iframe.allow = 'autoplay; encrypted-media';
        slot.insertBefore(iframe, slot.querySelector('#adSlotClose'));
        if (img) img.style.display = 'none';
        if (vid) vid.style.display = 'none';
    } else if (type === 'video') {
        if (vid) { vid.src = url; vid.load(); vid.play().catch(() => {}); vid.style.display = 'block'; }
        if (img) img.style.display = 'none';
        vid.onloadedmetadata = () => {
            if (vid.videoHeight > vid.videoWidth) {
                slot.style.width = '180px';
                slot.style.aspectRatio = '9 / 16';
            }
        };
    } else {
        if (img) {
            img.src = url;
            img.style.display = 'block';
            img.onload = () => {
                if (img.naturalHeight > img.naturalWidth) {
                    slot.style.width = '180px';
                    slot.style.aspectRatio = '9 / 16';
                }
            };
        }
        if (vid) vid.style.display = 'none';
    }

    slot.classList.add('visible');
}

export async function loadAdSlot() {
    // Don't show if dismissed this session
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch (_) {}

    _ensureSlot();

    try {
        const snap = await getDoc(AD_DOC());
        if (!snap.exists()) return;
        const { adUrl, adType } = snap.data();
        if (adUrl) _applySlot(adUrl, adType || 'image');
    } catch (e) {
        console.warn('ad-slot:', e);
    }
}
