/**
 * auto-logout.js
 * Shows a warning after WARN_AFTER ms of inactivity, then logs out after LOGOUT_AFTER ms.
 * Import and call initAutoLogout(signOutFn, redirectUrl) from any dashboard.
 */

const WARN_AFTER   = 58 * 60 * 1000; // 58 minutes — show warning
const LOGOUT_AFTER =  2 * 60 * 1000; // 2 more minutes — then logout

let _warnTimer   = null;
let _logoutTimer = null;
let _signOutFn   = null;
let _redirectUrl = 'login.html';
let _overlayEl   = null;
let _countdownEl = null;
let _countdownInterval = null;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

function _buildOverlay() {
    if (document.getElementById('autoLogoutOverlay')) return;

    const style = document.createElement('style');
    style.textContent = `
        #autoLogoutOverlay {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(10,15,30,0.78);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            align-items: center;
            justify-content: center;
            animation: alFadeIn 0.3s ease;
        }
        #autoLogoutOverlay.show { display: flex; }
        @keyframes alFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        .al-card {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 24px;
            padding: 48px 40px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
        .al-icon {
            font-size: 56px;
            margin-bottom: 16px;
            animation: alPulse 1.5s ease-in-out infinite;
        }
        @keyframes alPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50%       { transform: scale(0.92); opacity: 0.7; }
        }
        .al-title {
            margin: 0 0 10px;
            font-size: 1.4rem;
            font-weight: 800;
            color: #fff;
        }
        .al-msg {
            margin: 0 0 8px;
            color: rgba(255,255,255,0.65);
            font-size: 0.9rem;
            line-height: 1.6;
        }
        .al-countdown {
            font-size: 2.2rem;
            font-weight: 900;
            color: #f59e0b;
            margin: 12px 0 28px;
            letter-spacing: -1px;
        }
        .al-countdown span { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.5); margin-left: 4px; }
        .al-btn {
            padding: 13px 32px;
            border-radius: 10px;
            border: none;
            background: #3b82f6;
            color: #fff;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            width: 100%;
        }
        .al-btn:hover { background: #2563eb; transform: translateY(-1px); }
        .al-btn:active { transform: translateY(0); }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'autoLogoutOverlay';
    overlay.innerHTML = `
        <div class="al-card">
            <div class="al-icon">⏱️</div>
            <h2 class="al-title">Session Timeout Warning</h2>
            <p class="al-msg">You've been inactive for a while. You'll be logged out in:</p>
            <div class="al-countdown" id="alCountdown">120 <span>seconds</span></div>
            <button class="al-btn" id="alStayBtn">Stay Logged In</button>
        </div>
    `;
    document.body.appendChild(overlay);

    _overlayEl   = overlay;
    _countdownEl = document.getElementById('alCountdown');

    document.getElementById('alStayBtn').addEventListener('click', _resetTimers);
}

function _showWarning() {
    if (!_overlayEl) return;
    _overlayEl.classList.add('show');

    let remaining = Math.floor(LOGOUT_AFTER / 1000);
    if (_countdownEl) _countdownEl.innerHTML = `${remaining} <span>seconds</span>`;

    clearInterval(_countdownInterval);
    _countdownInterval = setInterval(() => {
        remaining--;
        if (_countdownEl) _countdownEl.innerHTML = `${remaining} <span>seconds</span>`;
        if (remaining <= 0) {
            clearInterval(_countdownInterval);
            _doLogout();
        }
    }, 1000);

    // Auto logout timer as backup
    clearTimeout(_logoutTimer);
    _logoutTimer = setTimeout(_doLogout, LOGOUT_AFTER);
}

function _hideWarning() {
    if (_overlayEl) _overlayEl.classList.remove('show');
    clearInterval(_countdownInterval);
    clearTimeout(_logoutTimer);
}

async function _doLogout() {
    _hideWarning();
    try {
        if (typeof _signOutFn === 'function') await _signOutFn();
    } catch (_) {}
    window.location.replace(_redirectUrl);
}

function _resetTimers() {
    _hideWarning();
    clearTimeout(_warnTimer);
    _warnTimer = setTimeout(_showWarning, WARN_AFTER);
}

function _onActivity() {
    // Only reset if warning is NOT showing (don't reset during countdown)
    if (_overlayEl && _overlayEl.classList.contains('show')) return;
    _resetTimers();
}

/**
 * Call this once after auth is confirmed.
 * @param {Function} signOutFn  - e.g. () => signOut(auth)
 * @param {string}   redirectUrl - where to go after logout (default: 'login.html')
 * @param {number}   warnMinutes - minutes of inactivity before warning (default: 10)
 */
export function initAutoLogout(signOutFn, redirectUrl = 'login.html', warnMinutes = 10) {
    _signOutFn   = signOutFn;
    _redirectUrl = redirectUrl;

    // Allow custom warn time
    const customWarn = warnMinutes * 60 * 1000;

    _buildOverlay();

    ACTIVITY_EVENTS.forEach(evt =>
        window.addEventListener(evt, _onActivity, { passive: true })
    );

    // Start the timer
    clearTimeout(_warnTimer);
    _warnTimer = setTimeout(_showWarning, customWarn);
}

/**
 * Stop auto-logout (call on manual logout).
 */
export function stopAutoLogout() {
    clearTimeout(_warnTimer);
    clearTimeout(_logoutTimer);
    clearInterval(_countdownInterval);
    ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, _onActivity)
    );
    _hideWarning();
}
