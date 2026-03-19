// Email Reminder Service for Attendance System
class EmailReminderService {
    constructor() {
        const emailConfig = getEmailRuntimeConfig();
        this.emailjsPublicKey = emailConfig.publicKey;
        this.serviceId = emailConfig.serviceId;
        this.templateId = emailConfig.templateId;
        this.isInitialized = false;
        this.reminderTimers = new Map();
        this.sessionSettings = null;
        this.currentUser = null;
        this.schedulerInterval = null;
    }

    // Initialize EmailJS
    async initialize() {
        try {
            const emailConfig = getEmailRuntimeConfig();
            this.emailjsPublicKey = emailConfig.publicKey;
            this.serviceId = emailConfig.serviceId;
            this.templateId = emailConfig.templateId;

            if (typeof emailjs !== 'undefined') {
                emailjs.init(this.emailjsPublicKey);
                this.isInitialized = true;
                console.log('✅ EmailJS initialized successfully');
            } else {
                console.error('❌ EmailJS library not loaded');
                return false;
            }

            // Load session settings
            await this.loadSessionSettings();
            
            // Load current user
            await this.loadCurrentUser();

            // Start reminder scheduler
            this.startReminderScheduler();

            console.log('✅ Email reminder service initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize email reminder service:', error);
            return false;
        }
    }

    // Load session timing settings
    async loadSessionSettings() {
        try {
            if (window.db && typeof window.getDoc === 'function' && typeof window.doc === 'function') {
                const settingsSnap = await window.getDoc(window.doc(window.db, 'settings', 'attendance'));
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    this.sessionSettings = {
                        fnStartTime: data.fnStart || data.FNStart || '09:00',
                        fnEndTime: data.fnEnd || data.FNEnd || '12:00',
                        anStartTime: data.anStart || data.ANStart || '13:00',
                        anEndTime: data.anEnd || data.ANEnd || '17:00',
                        reminderMinutes: Number(window.emailReminderSettings?.reminderMinutes || 10)
                    };
                    console.log('📓 Session settings loaded from Firestore:', this.sessionSettings);
                    return;
                }
            }

            if (window.settings) {
                this.sessionSettings = {
                    fnStartTime: window.settings.fnStart || '09:00',
                    fnEndTime: window.settings.fnEnd || '12:00',
                    anStartTime: window.settings.anStart || '13:00',
                    anEndTime: window.settings.anEnd || '17:00',
                    reminderMinutes: 10
                };
            } else {
                // Fallback to localStorage
                const settings = localStorage.getItem('attendanceSettings');
                if (settings) {
                    this.sessionSettings = JSON.parse(settings);
                } else {
                    // Default settings
                    this.sessionSettings = {
                        fnStartTime: '09:00',
                        fnEndTime: '12:00',
                        anStartTime: '13:00',
                        anEndTime: '17:00',
                        reminderMinutes: 10
                    };
                }
            }
            
            console.log('📅 Session settings loaded:', this.sessionSettings);
        } catch (error) {
            console.error('Error loading session settings:', error);
        }
    }

    // Load current user information
    async loadCurrentUser() {
        try {
            let user = null;
            let authUser = null;
            
            if (window.auth && window.auth.currentUser) {
                authUser = window.auth.currentUser;
            } else if (window.currentUser && window.currentUser.uid) {
                authUser = window.currentUser;
            } else if (typeof currentUser !== 'undefined' && currentUser) {
                authUser = currentUser;
            }

            if (authUser && window.db && typeof window.getDoc === 'function' && typeof window.doc === 'function') {
                const userSnap = await window.getDoc(window.doc(window.db, 'users', authUser.uid));
                if (userSnap.exists()) {
                    user = { uid: authUser.uid, ...userSnap.data() };
                }
            }

            if (!user && authUser) {
                user = authUser;
            } else if (!user) {
                const userStr = localStorage.getItem('currentUser');
                if (userStr) {
                    user = JSON.parse(userStr);
                }
            }
            
            this.currentUser = user;
            console.log('👤 Current user loaded for email reminders:', this.currentUser?.name || this.currentUser?.email || 'Unknown');
            
        } catch (error) {
            console.error('Error loading current user:', error);
        }
    }

    // Start the reminder scheduler
    startReminderScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
        }

        this.schedulerInterval = setInterval(() => {
            this.checkForReminders();
        }, 60000); // Check every minute

        // Also check immediately
        this.checkForReminders();
        
        console.log('⏰ Email reminder scheduler started');
    }

    // Check if reminders need to be sent
    async checkForReminders() {
        if (!this.currentUser || !this.sessionSettings || !this.isInitialized) return;

        const now = new Date();
        const currentTime = this.formatTime(now);
        const currentSession = this.getCurrentSession(currentTime);

        if (!currentSession) return;

        // Calculate reminder time (10 minutes before session ends)
        const reminderTime = this.calculateReminderTime(currentSession.endTime);
        
        // Check if it's time to send reminder
        if (this.shouldSendReminder(currentTime, reminderTime, currentSession.type)) {
            await this.sendReminderIfNotMarked(currentSession);
        }
    }

    // Get current active session
    getCurrentSession(currentTime) {
        const { fnStartTime, fnEndTime, anStartTime, anEndTime } = this.sessionSettings;

        if (this.isTimeBetween(currentTime, fnStartTime, fnEndTime)) {
            return { type: 'FN', startTime: fnStartTime, endTime: fnEndTime };
        } else if (this.isTimeBetween(currentTime, anStartTime, anEndTime)) {
            return { type: 'AN', startTime: anStartTime, endTime: anEndTime };
        }

        return null;
    }

    // Calculate when to send reminder (10 minutes before end)
    calculateReminderTime(endTime) {
        const [hours, minutes] = endTime.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(hours, minutes, 0, 0);
        
        // Subtract reminder minutes (default 10)
        const reminderDate = new Date(endDate.getTime() - (this.sessionSettings.reminderMinutes || 10) * 60000);
        
        return this.formatTime(reminderDate);
    }

    // Check if current time is between start and end
    isTimeBetween(currentTime, startTime, endTime) {
        return currentTime >= startTime && currentTime <= endTime;
    }

    // Check if reminder should be sent
    shouldSendReminder(currentTime, reminderTime, sessionType) {
        const reminderKey = `${sessionType}_${this.getTodayDate()}`;
        
        // Check if reminder already sent today for this session
        if (this.reminderTimers.has(reminderKey)) {
            return false;
        }

        // Check if current time matches reminder time (within 1 minute window)
        const currentMinutes = this.timeToMinutes(currentTime);
        const reminderMinutes = this.timeToMinutes(reminderTime);
        
        return Math.abs(currentMinutes - reminderMinutes) <= 1;
    }

    // Send reminder if attendance not marked
    async sendReminderIfNotMarked(session) {
        try {
            // Get ALL students from Firestore
            const allStudents = await this.getAllStudents();
            
            if (allStudents.length === 0) {
                console.log('📧 No students found to send reminders to');
                return;
            }

            console.log(`📧 Checking ${allStudents.length} students for ${session.type} session reminders`);
            
            let emailsSent = 0;
            let emailsFailed = 0;

            // Send reminders to all students who haven't marked attendance
            for (const student of allStudents) {
                try {
                    // Check if this student has already marked attendance
                    const isMarked = await this.checkStudentAttendanceStatus(student, session.type);
                    
                    if (!isMarked) {
                        // Check if reminder already sent today for this student and session
                        const reminderKey = `${student.uid}_${session.type}_${this.getTodayDate()}`;
                        
                        if (!this.reminderTimers.has(reminderKey)) {
                            const success = await this.sendEmailReminderToStudent(student, session);
                            
                            if (success) {
                                emailsSent++;
                                // Mark reminder as sent for this student
                                this.reminderTimers.set(reminderKey, true);
                            } else {
                                emailsFailed++;
                            }
                            
                            // Add small delay between emails to avoid rate limiting
                            await this.delay(1000); // 1 second delay
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error processing reminder for student ${student.name}:`, error);
                    emailsFailed++;
                }
            }
            
            console.log(`📧 Email reminder summary: ${emailsSent} sent, ${emailsFailed} failed`);
            
            // Show summary notification
            if (emailsSent > 0) {
                this.showSuccessMessage(`📧 Sent ${emailsSent} email reminders for ${session.type} session`);
            }
            
        } catch (error) {
            console.error('❌ Error sending bulk email reminders:', error);
        }
    }

    // Get all students from Firestore
    async getAllStudents() {
        try {
            // Check if we have access to Firestore
            if (!window.db || typeof window.getDocs !== 'function' || typeof window.collection !== 'function') {
                console.error('❌ Firestore not available for bulk email reminders');
                return [];
            }

            const currentCollegeId = this.currentUser?.collegeId || window.currentUserData?.collegeId || null;
            const studentsQuery = currentCollegeId
                ? window.query(window.collection(window.db, 'users'), window.where('collegeId', '==', currentCollegeId))
                : window.collection(window.db, 'users');
            const snapshot = await window.getDocs(studentsQuery);
            
            const students = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.role === 'student' && userData.approved && userData.email) {
                    students.push({
                        uid: doc.id,
                        name: userData.name || 'Student',
                        email: userData.email,
                        studentId: userData.studentId || 'N/A',
                        department: userData.department || 'N/A',
                        collegeId: userData.collegeId || null
                    });
                }
            });
            
            console.log(`📧 Found ${students.length} approved students with email addresses`);
            return students;
            
        } catch (error) {
            console.error('❌ Error fetching students:', error);
            return [];
        }
    }

    // Check if a specific student has marked attendance
    async checkStudentAttendanceStatus(student, sessionType) {
        try {
            const today = this.getTodayDate();
            
            if (window.db && typeof window.getDocs === 'function' && typeof window.collection === 'function') {
                const attendanceQuery = window.query(
                    window.collection(window.db, 'attendanceRecords'),
                    window.where('studentUid', '==', student.uid),
                    window.where('date', '==', today),
                    window.where('session', '==', sessionType)
                );
                const attendanceSnap = await window.getDocs(attendanceQuery);

                if (!attendanceSnap.empty) {
                    return attendanceSnap.docs.some(attDoc => (attDoc.data().status || '').toLowerCase() === 'present');
                }
            }
            
            // Fallback: check localStorage (only works for current user)
            if (student.uid === this.currentUser?.uid) {
                const attendanceKey = `attendance_${student.uid}_${today}`;
                const attendanceData = localStorage.getItem(attendanceKey);
                
                if (attendanceData) {
                    const attendance = JSON.parse(attendanceData);
                    return sessionType === 'FN' ? attendance.fnMarked : attendance.anMarked;
                }
            }
            
            return false; // Assume not marked if we can't verify
        } catch (error) {
            console.error(`❌ Error checking attendance for student ${student.name}:`, error);
            return false;
        }
    }

    // Send email reminder to a specific student
    async sendEmailReminderToStudent(student, session) {
        try {
            const sessionName = session.type === 'FN' ? 'Forenoon' : 'Afternoon';
            const minutesLeft = this.sessionSettings.reminderMinutes || 10;
            const currentTime = new Date().toLocaleTimeString();
            const currentDate = new Date().toLocaleDateString();

            // Prepare email template parameters
            const templateParams = {
                to_name: student.name,
                to_email: student.email,
                student_id: student.studentId,
                session_name: sessionName,
                session_type: session.type,
                minutes_left: minutesLeft,
                session_end_time: session.endTime,
                current_time: currentTime,
                current_date: currentDate,
                dashboard_link: window.location.origin + '/student-dashboard.html#markPage'
            };

            // Send email using EmailJS
            const response = await emailjs.send(
                this.serviceId,
                this.templateId,
                templateParams
            );

            console.log(`✅ Email sent to ${student.name} (${student.email}):`, response);

            // Store reminder log
            this.storeReminderLog(session, sessionName, minutesLeft, 'email', 'success', student);

            return true;
        } catch (error) {
            console.error(`❌ Failed to send email to ${student.name} (${student.email}):`, error);
            
            // Store failed attempt
            this.storeReminderLog(session, sessionName, minutesLeft, 'email', 'failed', student, error.message);
            
            return false;
        }
    }

    // Add delay utility function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Check if attendance is already marked for today's session
    async checkAttendanceStatus(sessionType) {
        try {
            const today = this.getTodayDate();
            
            // Check if attendance is marked in today's attendance statuses
            if (window.todayAttendanceStatuses) {
                const status = window.todayAttendanceStatuses[sessionType];
                return status === "Present";
            }
            
            // Fallback: check localStorage
            const attendanceKey = `attendance_${this.currentUser.uid}_${today}`;
            const attendanceData = localStorage.getItem(attendanceKey);
            
            if (attendanceData) {
                const attendance = JSON.parse(attendanceData);
                return sessionType === 'FN' ? attendance.fnMarked : attendance.anMarked;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking attendance status:', error);
            return false;
        }
    }

    // Send the email reminder
    async sendEmailReminder(session) {
        try {
            const sessionName = session.type === 'FN' ? 'Forenoon' : 'Afternoon';
            const minutesLeft = this.sessionSettings.reminderMinutes || 10;
            const currentTime = new Date().toLocaleTimeString();
            const currentDate = new Date().toLocaleDateString();

            // Prepare email template parameters
            const templateParams = {
                to_name: this.currentUser.name || 'Student',
                to_email: this.currentUser.email,
                student_id: this.currentUser.studentId || 'N/A',
                session_name: sessionName,
                session_type: session.type,
                minutes_left: minutesLeft,
                session_end_time: session.endTime,
                current_time: currentTime,
                current_date: currentDate,
                dashboard_link: window.location.origin + '/student-dashboard.html#markPage'
            };

            // Send email using EmailJS
            const response = await emailjs.send(
                this.serviceId,
                this.templateId,
                templateParams
            );

            console.log('✅ Email sent successfully:', response);

            // Store reminder log
            this.storeReminderLog(session, sessionName, minutesLeft, 'email', 'success');

            // Show success notification
            this.showSuccessMessage(`📧 Email reminder sent for ${sessionName} session`);

            return true;
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            
            // Store failed attempt
            this.storeReminderLog(session, sessionName, minutesLeft, 'email', 'failed', error.message);
            
            // Show error notification
            this.showErrorMessage(`❌ Failed to send email reminder: ${error.message}`);
            
            return false;
        }
    }

    // Store reminder log for analytics
    storeReminderLog(session, sessionName, minutesLeft, method, status, student = null, error = null) {
        const log = {
            userId: student ? student.uid : (this.currentUser?.uid || 'unknown'),
            userName: student ? student.name : (this.currentUser?.name || 'Unknown'),
            userEmail: student ? student.email : (this.currentUser?.email || 'unknown'),
            studentId: student ? student.studentId : (this.currentUser?.studentId || 'N/A'),
            session: session.type,
            sessionName: sessionName,
            minutesLeft: minutesLeft,
            date: this.getTodayDate(),
            time: this.formatTime(new Date()),
            timestamp: new Date().toISOString(),
            method: method,
            status: status,
            error: error
        };

        // Save to localStorage
        const logs = JSON.parse(localStorage.getItem('emailReminderLogs') || '[]');
        logs.push(log);
        
        // Keep only last 500 logs (increased for bulk emails)
        if (logs.length > 500) {
            logs.splice(0, logs.length - 500);
        }
        
        localStorage.setItem('emailReminderLogs', JSON.stringify(logs));
    }

    // Show success message
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    // Show error message
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    // Show message notification
    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                messageEl.style.background = '#10b981';
                break;
            case 'error':
                messageEl.style.background = '#ef4444';
                break;
            case 'info':
            default:
                messageEl.style.background = '#3b82f6';
                break;
        }

        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 5000);
    }

    // Utility functions
    formatTime(date) {
        return date.toTimeString().slice(0, 5); // HH:MM format
    }

    getTodayDate() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Send test email to all students (for admin testing)
    async sendTestEmailToAllStudents() {
        if (!this.isInitialized) {
            console.error('❌ Email service not initialized');
            return false;
        }

        const testSession = { type: 'FN', startTime: '09:00', endTime: '12:00' };
        
        try {
            console.log('📧 Starting bulk test email to all students...');
            
            const allStudents = await this.getAllStudents();
            
            if (allStudents.length === 0) {
                console.log('❌ No students found for bulk test');
                return false;
            }

            console.log(`📧 Sending test emails to ${allStudents.length} students...`);
            
            let sent = 0;
            let failed = 0;

            for (const student of allStudents) {
                try {
                    const success = await this.sendEmailReminderToStudent(student, testSession);
                    if (success) {
                        sent++;
                    } else {
                        failed++;
                    }
                    
                    // Small delay to avoid rate limiting
                    await this.delay(1000);
                } catch (error) {
                    console.error(`❌ Test email failed for ${student.name}:`, error);
                    failed++;
                }
            }

            console.log(`✅ Bulk test complete: ${sent} sent, ${failed} failed`);
            this.showSuccessMessage(`📧 Bulk test complete: ${sent} emails sent, ${failed} failed`);
            
            return sent > 0;
        } catch (error) {
            console.error('❌ Bulk test email error:', error);
            return false;
        }
    }

    // Manual trigger to send reminders to all students now
    async sendBulkRemindersNow() {
        if (!this.isInitialized) {
            console.error('❌ Email service not initialized');
            return false;
        }

        try {
            console.log('📧 Manually triggering bulk reminders...');
            
            const now = new Date();
            const currentTime = this.formatTime(now);
            const currentSession = this.getCurrentSession(currentTime);

            if (!currentSession) {
                console.log('❌ No active session found');
                this.showErrorMessage('❌ No active session found. Reminders can only be sent during FN (09:00-12:00) or AN (13:00-17:00) sessions.');
                return false;
            }

            await this.sendReminderIfNotMarked(currentSession);
            return true;
        } catch (error) {
            console.error('❌ Manual bulk reminder error:', error);
            this.showErrorMessage(`❌ Failed to send bulk reminders: ${error.message}`);
            return false;
        }
    }

    // Get reminder statistics
    getReminderStats() {
        const logs = JSON.parse(localStorage.getItem('emailReminderLogs') || '[]');
        const today = this.getTodayDate();
        
        const todayLogs = logs.filter(log => log.date === today);
        const successfulToday = todayLogs.filter(log => log.status === 'success').length;
        const failedToday = todayLogs.filter(log => log.status === 'failed').length;
        
        return {
            totalReminders: logs.length,
            todayReminders: todayLogs.length,
            todaySuccessful: successfulToday,
            todayFailed: failedToday,
            lastReminder: logs.length > 0 ? logs[logs.length - 1] : null
        };
    }

    // Clear all reminder logs
    clearReminderLogs() {
        localStorage.removeItem('emailReminderLogs');
        console.log('📧 Email reminder logs cleared');
    }

    // Stop all reminders (for logout)
    stopAllReminders() {
        this.reminderTimers.clear();
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        this.isInitialized = false;
        console.log('📧 Email reminder service stopped');
    }
}

function getEmailRuntimeConfig() {
    if (window.emailJSConfig && typeof window.emailJSConfig.loadConfig === 'function') {
        const config = window.emailJSConfig.loadConfig();
        return {
            publicKey: config.publicKey || 'pZ5Z7DtClyskT-d5S',
            serviceId: config.serviceId || 'service_17odv2l',
            templateId: config.templateId || 'template_o8c4fyw'
        };
    }

    return {
        publicKey: 'pZ5Z7DtClyskT-d5S',
        serviceId: 'service_17odv2l',
        templateId: 'template_o8c4fyw'
    };
}

class EmailApprovalService {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        const emailConfig = getEmailRuntimeConfig();
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS library not loaded for approval emails');
            return false;
        }

        emailjs.init(emailConfig.publicKey);
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
        if (!this.isInitialized) {
            await this.initialize();
        }

        const emailConfig = getEmailRuntimeConfig();
        const statusLabel = status === 'approved' ? 'Approved' : 'Rejected';
        const requestLabel = String(requestType || 'request').replace(/_/g, ' ');
        const templateParams = {
            to_email: toEmail,
            to_name: toName || toEmail,
            status: statusLabel,
            approval_status: statusLabel,
            request_type: requestLabel,
            action_type: requestLabel,
            approved_by: approvedBy || 'Administrator',
            admin_name: approvedBy || 'Administrator',
            message_title: `${requestLabel} ${statusLabel}`,
            message_body: extra.reason || `${requestLabel} has been ${statusLabel.toLowerCase()} by ${approvedBy || 'Administrator'}.`,
            reason: extra.reason || '',
            permission_type: extra.permissionType || '',
            college_name: extra.collegeName || '',
            dashboard_link: `${window.location.origin}/login.html`
        };

        await emailjs.send(emailConfig.serviceId, emailConfig.templateId, templateParams);
        return true;
    }
}

// Global instance
window.emailReminderService = new EmailReminderService();
window.emailApprovalService = new EmailApprovalService();

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.emailReminderService) {
            window.emailReminderService.initialize();
        }
    }, 2000);
});

// Test functions for debugging
window.testEmailReminder = {
    // Send a test email to current user
    sendTest: async function() {
        if (window.emailReminderService && window.emailReminderService.currentUser) {
            const testSession = { type: 'FN', startTime: '09:00', endTime: '12:00' };
            return await window.emailReminderService.sendEmailReminderToStudent(
                window.emailReminderService.currentUser, 
                testSession
            );
        }
        return false;
    },
    
    // Send test emails to ALL students
    sendBulkTest: async function() {
        if (window.emailReminderService) {
            return await window.emailReminderService.sendTestEmailToAllStudents();
        }
        return false;
    },
    
    // Send reminders to all students NOW (manual trigger)
    sendBulkReminders: async function() {
        if (window.emailReminderService) {
            return await window.emailReminderService.sendBulkRemindersNow();
        }
        return false;
    },
    
    // Get current status
    getStatus: function() {
        if (window.emailReminderService) {
            console.log('=== Email Reminder Service Status ===');
            console.log('Initialized:', window.emailReminderService.isInitialized);
            console.log('Current user:', window.emailReminderService.currentUser);
            console.log('Session settings:', window.emailReminderService.sessionSettings);
            console.log('Stats:', window.emailReminderService.getReminderStats());
            console.log('=== End Status ===');
        }
    },
    
    // Get all students (for testing)
    getStudents: async function() {
        if (window.emailReminderService) {
            const students = await window.emailReminderService.getAllStudents();
            console.log(`📧 Found ${students.length} students:`, students);
            return students;
        }
        return [];
    },
    
    // Clear logs
    clearLogs: function() {
        if (window.emailReminderService) {
            window.emailReminderService.clearReminderLogs();
        }
    }
};

console.log('📧 Email reminder service loaded. Test functions available:', Object.keys(window.testEmailReminder));
