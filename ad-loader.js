/**
 * ad-loader.js
 * Loads and displays the super admin advertisement on any page.
 * Reads from Firestore: system/superAdminSettings { adUrl, adType }
 */

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const AD_DOC = () => doc(db, 'system', 'superAdminSettings');

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

function _injectStyles() {
    if (document.getElementById('ad-loader-style')) return;
    const s = document.createElement('style');
    s.id = 'ad-loader-style';
    s.textContent = `
        #pageAdBanner {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 9998 !important;
            border-radius: 16px !important;
            overflow: hidden !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35) !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: #0f172a !important;
            display: none;
            animation: adSlideIn 0.4s ease-out;
            max-width: 300px;
            width: 300px;
        }
        #pageAdBanner.visible { display: block !important; }
        #pageAdBanner * { background: transparent !important; }
        #pageAdBanner img, #pageAdBanner video, #pageAdBanner iframe {
            background: transparent !important;
        }
        @keyframes adSlideIn {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        #pageAdBanner img,
        #pageAdBanner video,
        #pageAdBanner iframe {
            width: 100%;
            display: block;
            border: none;
        }
        #pageAdBanner img    { aspect-ratio: 16/9; object-fit: cover; }
        #pageAdBanner video  { aspect-ratio: 16/9; object-fit: cover; }
        #pageAdBanner iframe { aspect-ratio: 16/9; }
        #pageAdClose {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: rgba(0,0,0,0.55);
            border: none;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
            line-height: 1;
            transition: background 0.2s;
        }
        #pageAdClose:hover { background: rgba(0,0,0,0.8); }
    `;
    document.head.appendChild(s);
}

function _buildBanner(url, type) {
    _injectStyles();

    let banner = document.getElementById('pageAdBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'pageAdBanner';
        document.body.appendChild(banner);
    }

    banner.innerHTML = '';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.id = 'pageAdClose';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = () => banner.classList.remove('visible');
    banner.appendChild(closeBtn);

    if (type === 'youtube') {
        const iframe = document.createElement('iframe');
        iframe.src = _ytEmbed(url);
        iframe.allow = 'autoplay; encrypted-media';
        banner.appendChild(iframe);
    } else if (type === 'video') {
        const vid = document.createElement('video');
        vid.src = url;
        vid.autoplay = true;
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        banner.appendChild(vid);
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Advertisement';
        banner.appendChild(img);
    }

    banner.classList.add('visible');
}

export async function loadPageAd() {
    try {
        const snap = await getDoc(AD_DOC());
        if (!snap.exists()) return;
        const data = snap.data();
        const adUrl = data.adUrl;
        const adType = data.adType || 'image';
        if (!adUrl) return;
        // Skip base64 data URLs — too large for login page banner
        if (adUrl.startsWith('data:')) {
            _buildBanner(adUrl, adType);
            return;
        }
        _buildBanner(adUrl, adType);
    } catch (e) {
        console.warn('Ad loader:', e);
    }
}
