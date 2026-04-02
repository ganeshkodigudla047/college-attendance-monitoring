/**
 * email-reminder-service.js
 * Attendance reminder — runs in the STUDENT's browser.
 * Sends an email to the student 10 min before each session ends
 * if they haven't marked attendance yet.
 */

/* ── EmailJS config ── */
function _getEmailConfig() {
    if (window.emailJSConfig && typeof window.emailJSConfig.loadConfig === 'function') {
        const c = window.emailJSConfig.loadConfig();
        return { publicKey: c.publicKey, serviceId: c.serviceId, templateId: c.templateId };
    }
    return {
        publicKey:  'pZ5Z7DtClyskT-d5S',
        serviceId:  'service_17odv2l',
        templateId: 'template_o8c4fyw'
    };
}

/* ── Helpers ── */
function _hhmm(date) {
    return date.toTimeString().slice(0, 5);
}
function _toMin(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function _today() {
    return new Date().toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════════
   EmailReminderService  — student-side reminder engine
   ══════════════════════════════════════════════════════════ */
class EmailReminderService {
    constructor() {
        this.isInitialized  = false;
        this.sessionSettings = null;
        this.currentUser    = null;
        this._timer         = null;
        this._sentToday     = new Set();   // 'FN_2026-03-29', 'AN_2026-03-29'
    }

    /* ── public API ── */

    async initialize() {
        try {
            const cfg = _getEmailConfig();
            if (typeof emailjs === 'undefined') {
                console.warn('EmailJS not loaded — reminders disabled');
                return false;
            }
            emailjs.init(cfg.publicKey);
            this.isInitialized = true;

            await this._loadSettings();
            await this._loadUser();
            this._startScheduler();

            console.log('✅ Email reminder service ready');
            return true;
        } catch (e) {
            console.error('EmailReminderService init error:', e);
            return false;
        }
    }

    stopAllReminders() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this.isInitialized = false;
    }

    getReminderStats() {
        const logs = JSON.parse(localStorage.getItem('emailReminderLogs') || '[]');
        const today = _today();
        const todayLogs = logs.filter(l => l.date === today);
        return {
            totalReminders:   logs.length,
            todayReminders:   todayLogs.length,
            todaySuccessful:  todayLogs.filter(l => l.status === 'success').length,
            todayFailed:      todayLogs.filter(l => l.status === 'failed').length,
            lastReminder:     logs.length ? logs[logs.length - 1] : null
        };
    }

    clearReminderLogs() {
        localStorage.removeItem('emailReminderLogs');
    }

    /* ── internals ── */

    async _loadSettings() {
        try {
            // Try Firestore first
            if (window.db && window.getDoc && window.doc) {
                const snap = await window.getDoc(window.doc(window.db, 'settings', 'attendance'));
                if (snap.exists()) {
                    const d = snap.data();
                    this.sessionSettings = {
                        fnStart: d.fnStart || '09:00',
                        fnEnd:   d.fnEnd   || '12:00',
                        anStart: d.anStart || '13:00',
                        anEnd:   d.anEnd   || '17:00',
                        reminderMinutes: Number(window.emailReminderSettings?.reminderMinutes || 10)
                    };
                    return;
                }
            }
        } catch (_) {}

        // Fallback defaults
        this.sessionSettings = {
            fnStart: '09:00', fnEnd: '12:00',
            anStart: '13:00', anEnd: '17:00',
            reminderMinutes: 10
        };
    }

    async _loadUser() {
        try {
            const authUser = window.auth?.currentUser || window.currentUser || null;
            if (authUser && window.db && window.getDoc && window.doc) {
                const snap = await window.getDoc(window.doc(window.db, 'users', authUser.uid));
                if (snap.exists()) {
                    this.currentUser = { uid: authUser.uid, ...snap.data() };
                    return;
                }
            }
            this.currentUser = authUser;
        } catch (_) {}
    }

    _startScheduler() {
        if (this._timer) clearInterval(this._timer);
        this._checkNow();
        this._timer = setInterval(() => this._checkNow(), 60_000); // every minute
    }

    async _checkNow() {
        if (!this.isInitialized || !this.currentUser || !this.sessionSettings) return;
        // Only send to students
        const role = (this.currentUser.role || '').toLowerCase();
        if (role !== 'student') return;

        const now     = new Date();
        const nowMin  = _toMin(_hhmm(now));
        const s       = this.sessionSettings;
        const remind  = s.reminderMinutes || 10;

        const sessions = [
            { type: 'FN', start: _toMin(s.fnStart), end: _toMin(s.fnEnd) },
            { type: 'AN', start: _toMin(s.anStart), end: _toMin(s.anEnd) }
        ];

        for (const sess of sessions) {
            const triggerMin = sess.end - remind;          // e.g. 12:00 - 10 = 11:50
            const key = `${sess.type}_${_today()}`;

            // Only fire within the session window and at the trigger minute
            if (nowMin < sess.start || nowMin > sess.end) continue;
            if (Math.abs(nowMin - triggerMin) > 1)        continue;  // ±1 min window
            if (this._sentToday.has(key))                 continue;  // already sent

            // Check if attendance already marked
            const marked = await this._isMarked(sess.type);
            if (marked) { this._sentToday.add(key); continue; }

            // Send!
            this._sentToday.add(key);
            await this._sendEmail(sess);
        }
    }

    async _isMarked(sessionType) {
        try {
            const today = _today();
            // Check live window variable first (fastest)
            if (window.todayAttendanceStatuses) {
                return (window.todayAttendanceStatuses[sessionType] || '').toLowerCase() === 'present';
            }
            // Firestore check
            if (window.db && window.getDocs && window.collection && window.query && window.where) {
                const q = window.query(
                    window.collection(window.db, 'attendanceRecords'),
                    window.where('studentUid', '==', this.currentUser.uid),
                    window.where('date', '==', today),
                    window.where('session', '==', sessionType)
                );
                const snap = await window.getDocs(q);
                return snap.docs.some(d => (d.data().status || '').toLowerCase() === 'present');
            }
        } catch (_) {}
        return false;
    }

    async _sendEmail(sess) {
        try {
            const cfg         = _getEmailConfig();
            const sessionName = sess.type === 'FN' ? 'Forenoon' : 'Afternoon';
            const endHHMM     = sess.type === 'FN' ? this.sessionSettings.fnEnd : this.sessionSettings.anEnd;
            const remind      = this.sessionSettings.reminderMinutes || 10;

            const params = {
                to_name:          this.currentUser.name  || 'Student',
                to_email:         this.currentUser.email,
                student_id:       this.currentUser.studentId || this.currentUser.rollNumber || 'N/A',
                session_name:     sessionName,
                session_type:     sess.type,
                minutes_left:     remind,
                session_end_time: endHHMM,
                current_time:     new Date().toLocaleTimeString(),
                current_date:     new Date().toLocaleDateString(),
                dashboard_link:   `${window.location.origin}/student-dashboard.html`
            };

            await emailjs.send(cfg.serviceId, cfg.templateId, params);
            console.log(`✅ Reminder sent to ${this.currentUser.email} for ${sess.type}`);
            this._log(sess, sessionName, remind, 'success');
            this._toast(`📧 Attendance reminder sent for ${sessionName} session`, 'success');
        } catch (e) {
            console.error('Reminder email failed:', e);
            this._log(sess, sess.type === 'FN' ? 'Forenoon' : 'Afternoon',
                      this.sessionSettings.reminderMinutes || 10, 'failed', e.message);
        }
    }

    _log(sess, sessionName, minutesLeft, status, error = null) {
        const logData = {
            userId:      this.currentUser?.uid   || 'unknown',
            userName:    this.currentUser?.name  || 'Unknown',
            userEmail:   this.currentUser?.email || 'unknown',
            studentId:   this.currentUser?.studentId || this.currentUser?.rollNumber || 'N/A',
            collegeId:   this.currentUser?.collegeId || 'unknown',
            session:     sess.type,
            sessionName,
            minutesLeft,
            date:        _today(),
            time:        _hhmm(new Date()),
            timestamp:   new Date().toISOString(),
            method:      'email',
            status,
            error
        };

        const logs = JSON.parse(localStorage.getItem('emailReminderLogs') || '[]');
        logs.push(logData);
        if (logs.length > 200) logs.splice(0, logs.length - 200);
        localStorage.setItem('emailReminderLogs', JSON.stringify(logs));

        // Write to Firestore emailLogs collection for Super Admin view
        try {
            if (window.db && window.collection && window.addDoc) {
                const fsData = { ...logData };
                if (window.serverTimestamp) fsData.timestamp = window.serverTimestamp();
                window.addDoc(window.collection(window.db, 'emailLogs'), fsData);
            }
        } catch (fbErr) {
            console.warn('Failed to log email to Firestore:', fbErr);
        }
    }

    _toast(msg, type = 'info') {
        const el = document.createElement('div');
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
        el.style.cssText = `
            position:fixed; top:20px; right:20px; padding:14px 20px;
            border-radius:10px; color:#fff; font-size:14px; font-weight:600;
            z-index:99999; max-width:340px; box-shadow:0 4px 16px rgba(0,0,0,0.2);
            background:${colors[type] || colors.info};
            animation:slideInRight 0.3s ease-out;
        `;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 5000);
    }

    /* ── kept for backward compat / admin test buttons ── */
    async sendBulkRemindersNow() {
        this._toast('Reminders are sent automatically from each student\'s browser.', 'info');
    }
    async sendTestEmailToAllStudents() {
        this._toast('Use the Test button in Email Reminders settings.', 'info');
    }
    showSuccessMessage(m) { this._toast(m, 'success'); }
    showErrorMessage(m)   { this._toast(m, 'error'); }
}

/* ══════════════════════════════════════════════════════════
   EmailApprovalService  — approval/rejection notifications
   ══════════════════════════════════════════════════════════ */
class EmailApprovalService {
    constructor() { this.isInitialized = false; }

    async initialize() {
        const cfg = _getEmailConfig();
        if (typeof emailjs === 'undefined') return false;
        emailjs.init(cfg.publicKey);
        this.isInitialized = true;
        return true;
    }

    async sendApprovalNotification(toEmail, toName, approvedBy, requestType = 'request', extra = {}) {
        return this.sendStatusNotification('approved', toEmail, toName, approvedBy, requestType, extra);
    }

    async sendRejectionNotification(toEmail, toName, approvedBy, requestType = 'request', reason = '', extra = {}) {
        return this.sendStatusNotification('rejected', toEmail, toName, approvedBy, requestType, { ...extra, reason });
    }

    async sendStatusNotification(status, toEmail, toName, approvedBy, requestType, extra = {}) {
        if (!this.isInitialized) await this.initialize();
        const cfg          = _getEmailConfig();
        const statusLabel  = status === 'approved' ? 'Approved' : 'Rejected';
        const requestLabel = String(requestType || 'request').replace(/_/g, ' ');
        const params = {
            to_email:       toEmail,
            to_name:        toName || toEmail,
            status:         statusLabel,
            approval_status: statusLabel,
            request_type:   requestLabel,
            action_type:    requestLabel,
            approved_by:    approvedBy || 'Administrator',
            admin_name:     approvedBy || 'Administrator',
            message_title:  `${requestLabel} ${statusLabel}`,
            message_body:   extra.reason || `${requestLabel} has been ${statusLabel.toLowerCase()} by ${approvedBy || 'Administrator'}.`,
            reason:         extra.reason || '',
            permission_type: extra.permissionType || '',
            college_name:   extra.collegeName || '',
            dashboard_link: `${window.location.origin}/login.html`
        };
        try {
            await emailjs.send(cfg.serviceId, cfg.templateId, params);
            return true;
        } catch (e) {
            console.error('Approval email failed:', e);
            return false;
        }
    }
}

/* ── globals ── */
window.emailReminderService = new EmailReminderService();
window.emailApprovalService = new EmailApprovalService();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.emailReminderService.initialize(), 2000);
});

/* ── debug helpers ── */
window.testEmailReminder = {
    sendTest: async () => {
        const svc = window.emailReminderService;
        if (!svc?.currentUser) return console.warn('Not initialized');
        const sess = { type: 'FN', start: 0, end: 720 };
        await svc._sendEmail(sess);
    },
    getStatus: () => {
        const svc = window.emailReminderService;
        console.table({
            initialized:  svc.isInitialized,
            user:         svc.currentUser?.email,
            settings:     JSON.stringify(svc.sessionSettings),
            sentToday:    [...svc._sentToday].join(', ') || 'none'
        });
    },
    clearLogs: () => window.emailReminderService.clearReminderLogs()
};

console.log('📧 Email reminder service loaded (student-side). Debug: window.testEmailReminder');
