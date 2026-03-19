// EmailJS Configuration for Attendance Reminder System

// Note: Browser tracking prevention may show warnings about storage access
// This is normal and doesn't affect functionality - EmailJS will still work

class EmailJSConfig {
    constructor() {
        // EmailJS Configuration - REPLACE WITH YOUR ACTUAL VALUES
        this.config = {
            // ⚠️ REPLACE THESE WITH YOUR REAL EMAILJS CREDENTIALS ⚠️
            publicKey: 'pZ5Z7DtClyskT-d5S',   // ⚠️ Add your EmailJS public key
            serviceId: 'service_17odv2l',
            templateId: 'template_o8c4fyw',
            
            // Email template variables (these will be replaced in your email template)
            templateVars: {
                to_name: '{{to_name}}',               // Student name
                to_email: '{{to_email}}',             // Student email
                student_id: '{{student_id}}',         // Student ID
                session_name: '{{session_name}}',     // Forenoon/Afternoon
                session_type: '{{session_type}}',     // FN/AN
                minutes_left: '{{minutes_left}}',     // Minutes before session ends
                session_end_time: '{{session_end_time}}', // Session end time
                current_time: '{{current_time}}',     // Current time
                current_date: '{{current_date}}',     // Current date
                dashboard_link: '{{dashboard_link}}'  // Link to mark attendance
            }
        };
    }

    // Get configuration
    getConfig() {
        return this.config;
    }

    // Update configuration with error handling for tracking prevention
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        try {
            localStorage.setItem('emailjsConfig', JSON.stringify(this.config));
        } catch (e) {
            // Silently handle storage access errors (tracking prevention)
            console.log('Storage access limited by browser privacy settings (this is normal)');
        }
    }

    // Load configuration from localStorage with error handling
    loadConfig() {
        try {
            const saved = localStorage.getItem('emailjsConfig');
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) };
            }
        } catch (e) {
            // Silently handle storage access errors (tracking prevention)
            console.log('Using default configuration (storage access limited)');
        }
        return this.config;
    }

    // Validate configuration
    isConfigValid() {
        const { publicKey, serviceId, templateId } = this.config;
        return publicKey && publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY' &&
               serviceId && serviceId !== 'YOUR_SERVICE_ID' &&
               templateId && templateId !== 'attendance_reminder';
    }

    // Get setup instructions
    getSetupInstructions() {
        return {
            step1: "Sign up at https://www.emailjs.com/",
            step2: "Create an email service (Gmail, Outlook, etc.)",
            step3: "Create an email template with the required variables",
            step4: "Get your Public Key, Service ID, and Template ID",
            step5: "Update the configuration in this file",
            
            templateExample: `
Subject: 🔔 Attendance Reminder - {{session_name}} Session

Dear {{to_name}},

This is a friendly reminder that your {{session_name}} attendance session is about to close.

📋 Session Details:
• Student ID: {{student_id}}
• Session: {{session_name}} ({{session_type}})
• Time Remaining: {{minutes_left}} minutes
• Session Ends: {{session_end_time}}
• Current Time: {{current_time}}
• Date: {{current_date}}

⚠️ Please mark your attendance immediately to avoid being marked absent.

👆 Click here to mark attendance: {{dashboard_link}}

If you have already marked your attendance, please ignore this message.

Best regards,
Attendance Management System
            `,
            
            requiredVariables: [
                'to_name', 'to_email', 'student_id', 'session_name', 
                'session_type', 'minutes_left', 'session_end_time', 
                'current_time', 'current_date', 'dashboard_link'
            ]
        };
    }
}

// Global instance
window.emailJSConfig = new EmailJSConfig();

// Load saved configuration on startup
window.emailJSConfig.loadConfig();

console.log('📧 EmailJS configuration loaded');
console.log('📋 Setup instructions available: window.emailJSConfig.getSetupInstructions()');

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailJSConfig;
}