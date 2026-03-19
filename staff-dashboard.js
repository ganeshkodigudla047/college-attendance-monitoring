import { auth, db } from "./firebase.js";
import { loadAndApplyBackground } from "./college-background.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  collection, getDocs, getDoc, doc, updateDoc, addDoc, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ================= LOADING SCREEN ================= */
window.showLoading = function(message = 'Loading...') {
  const el = document.getElementById('loadingScreen');
  const status = document.getElementById('loadingStatus');
  if (el) { el.classList.remove('fade-out'); el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  if (status && message) status.textContent = message;
};

window.hideLoading = function() {
  const el = document.getElementById('loadingScreen');
  if (el) {
    el.classList.add('fade-out');
    document.body.style.overflow = '';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }
};

/* ================= TIME-BASED GREETING SYSTEM ================= */

function updateTimeBasedGreeting() {
	const greetingBlock = document.getElementById('greetingBlock');
	const welcome = document.getElementById('welcome');
	const greetingSubtext = document.getElementById('greetingSubtext');
	const timeIcon = document.getElementById('timeIcon');
	const bgElement1 = document.getElementById('bgElement1');
	const bgElement2 = document.getElementById('bgElement2');
	const bgElement3 = document.getElementById('bgElement3');

	if (!greetingBlock) return;

	const hour = new Date().getHours();
	let greeting, subtext, icon, background, elements, textColor;

	// Morning (6 AM - 12 PM)
	if (hour >= 6 && hour < 12) {
		greeting = 'Good Morning!';
		subtext = 'Rise and shine! Here\'s your department overview.';
		icon = '🌅';
		background = 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';
		textColor = '#1e293b';
		elements = [
			{ top: '-60px', right: '-40px', width: '260px', height: '260px', background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 65%)' },
			{ bottom: '-80px', left: '-60px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(255,200,150,0.3) 0%, transparent 70%)' },
			{ top: '30%', right: '25%', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)' }
		];
	}
	// Afternoon (12 PM - 5 PM)
	else if (hour >= 12 && hour < 17) {
		greeting = 'Good Afternoon!';
		subtext = 'Keep up the great work! You\'re doing amazing.';
		icon = '☀️';
		background = 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
		textColor = '#1e293b';
		elements = [
			{ top: '-70px', right: '-50px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 60%)' },
			{ bottom: '-60px', left: '-40px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(168,237,234,0.4) 0%, transparent 70%)' },
			{ top: '50%', left: '50%', width: '140px', height: '140px', background: 'radial-gradient(circle, rgba(254,214,227,0.4) 0%, transparent 70%)' }
		];
	}
	// Evening (5 PM - 8 PM)
	else if (hour >= 17 && hour < 20) {
		greeting = 'Good Evening!';
		subtext = 'Winding down the day. Great job today!';
		icon = '🌆';
		background = 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
		textColor = '#1e293b';
		elements = [
			{ top: '-80px', right: '-60px', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 65%)' },
			{ bottom: '-70px', left: '-50px', width: '240px', height: '240px', background: 'radial-gradient(circle, rgba(250,112,154,0.25) 0%, transparent 70%)' },
			{ top: '35%', right: '35%', width: '110px', height: '110px', background: 'radial-gradient(circle, rgba(254,225,64,0.3) 0%, transparent 70%)' }
		];
	}
	// Night (8 PM - 6 AM)
	else {
		greeting = 'Good Night!';
		subtext = 'Working late? Don\'t forget to rest when you can.';
		icon = '🌙';
		background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)';
		textColor = '#ffffff';
		elements = [
			{ top: '10%', right: '20%', width: '4px', height: '4px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 10px rgba(255,255,255,0.8)' },
			{ top: '25%', right: '60%', width: '3px', height: '3px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 8px rgba(255,255,255,0.6)' },
			{ top: '40%', right: '15%', width: '5px', height: '5px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 12px rgba(255,255,255,0.9)' },
			{ top: '60%', right: '75%', width: '3px', height: '3px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 8px rgba(255,255,255,0.7)' },
			{ top: '15%', right: '85%', width: '4px', height: '4px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 10px rgba(255,255,255,0.8)' },
			{ top: '70%', right: '40%', width: '3px', height: '3px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 8px rgba(255,255,255,0.6)' },
			{ top: '50%', right: '90%', width: '4px', height: '4px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 10px rgba(255,255,255,0.8)' },
			{ top: '80%', right: '25%', width: '5px', height: '5px', background: '#ffffff', borderRadius: '50%', boxShadow: '0 0 12px rgba(255,255,255,0.9)' }
		];
	}

	// Apply changes
	if (welcome) {
		welcome.textContent = greeting;
		welcome.style.color = textColor;
	}
	if (greetingSubtext) {
		greetingSubtext.textContent = subtext;
		greetingSubtext.style.color = textColor;
	}
	if (timeIcon) {
		timeIcon.textContent = icon;
	}
	if (greetingBlock) {
		greetingBlock.style.background = background;
	}

	// Update decorative orbs/stars
	if (bgElement1 && elements[0]) Object.assign(bgElement1.style, elements[0]);
	if (bgElement2 && elements[1]) Object.assign(bgElement2.style, elements[1]);
	if (bgElement3 && elements[2]) Object.assign(bgElement3.style, elements[2]);
	
	// Add more stars for night time
	if (hour >= 20 || hour < 6) {
		for (let i = 3; i < elements.length; i++) {
			const starId = `bgElement${i + 1}`;
			let starElement = document.getElementById(starId);
			
			if (!starElement) {
				starElement = document.createElement('div');
				starElement.id = starId;
				starElement.className = 'greeting-orb';
				starElement.style.position = 'absolute';
				starElement.style.pointerEvents = 'none';
				greetingBlock.appendChild(starElement);
			}
			
			Object.assign(starElement.style, elements[i]);
		}
	} else {
		// Remove extra star elements during daytime
		for (let i = 4; i <= 11; i++) {
			const starElement = document.getElementById(`bgElement${i}`);
			if (starElement) {
				starElement.remove();
			}
		}
	}
}

// Update greeting on page load and every minute
document.addEventListener('DOMContentLoaded', () => {
	updateTimeBasedGreeting();
	setInterval(updateTimeBasedGreeting, 60000);
});

/* ========== STATE ========== */
let me = null;
let studentsCache = [];
let attendanceRecords = [];
let attendanceSettings = null;
let unregisterAuthListener;

/* ========== DOM ELEMENTS ========== */
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
// const welcomeText = document.getElementById("welcomeText"); // Removed - using time-based greeting now
const currentTimeEl = document.getElementById("currentTime");
const currentDateEl = document.getElementById("currentDate");

/* Stats */
const deptStudentsCount = document.getElementById("deptStudentsCount");
const totalDaysStaff = document.getElementById("totalDaysStaff");
const fnPresentCount = document.getElementById("fnPresentCount");
const fnAbsentCount = document.getElementById("fnAbsentCount");
const anPresentCount = document.getElementById("anPresentCount");
const anAbsentCount = document.getElementById("anAbsentCount");

/* Timings */
const fnTimingEl = document.getElementById("fnTiming");
const anTimingEl = document.getElementById("anTiming");

/* Profile */
const profilePhoto = document.getElementById("profilePhoto");
const profileNameDisplay = document.getElementById("profileNameDisplay");
const profileRoleBadge = document.getElementById("profileRoleBadge");
const pName = document.getElementById("pName");
const pEmail = document.getElementById("pEmail");
const pPhone = document.getElementById("pPhone");
const pDept = document.getElementById("pDept");
const pId = document.getElementById("pId");
const sidebarPhoto = document.getElementById("sidebarPhoto");
const sidebarName = document.getElementById("sidebarName");
const sidebarRole = document.getElementById("sidebarRole");

/* Header Elements */
const headerName = document.getElementById("headerName");
const headerRole = document.getElementById("headerRole");
const headerLogoutBtn = document.getElementById("headerLogoutBtn");
const addProfileInfoBtn = document.getElementById("addProfileInfoBtn");

/* ========== PERMISSION REQUEST MODAL FUNCTIONS ========== */
// Define permission request functions early to ensure availability
window.openPermissionRequestModal = function () {
  console.log("openPermissionRequestModal called");

  // Check if modal already exists
  const existingModal = document.getElementById('permissionRequestModal');
  if (existingModal) {
    console.log("Modal already exists, removing it first");
    existingModal.remove();
  }

  console.log("Creating new modal...");
  const modal = document.createElement('div');
  modal.id = 'permissionRequestModal';
  modal.className = 'overlay';
  modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 20px;
    `;

  modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 24px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0; color: #1f2937; font-size: 1.25rem; font-weight: 700;">🔐 Request Admin Permission</h3>
                <button onclick="window.closePermissionRequestModal()" style="background: #f3f4f6; border: none; color: #6b7280; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <p style="color: #64748b; margin-bottom: 16px;">Request permission from college administrators to approve student registrations and profile updates. All requests expire automatically in 10 minutes.</p>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Permission Type</label>
                    <select id="permissionType" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
                        <option value="">Select permission type...</option>
                        <option value="registrations">Student Registrations</option>
                        <option value="profile">Profile Updates</option>
                        <option value="both">Both (Registrations & Profile)</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Reason for Request</label>
                    <textarea id="permissionReason" placeholder="Please explain why you need this permission..." style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; min-height: 80px; resize: vertical;"></textarea>
                </div>
                
                <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">⏰</span>
                        <span style="font-size: 14px; font-weight: 600; color: #92400e;">Auto-expires in 10 minutes after approval</span>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button onclick="window.closePermissionRequestModal()" style="flex: 1; padding: 12px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 10px; font-weight: 600; cursor: pointer;">Cancel</button>
                <button onclick="window.submitPermissionRequest()" style="flex: 1; padding: 12px; border: none; background: #3b82f6; color: white; border-radius: 10px; font-weight: 600; cursor: pointer;">Submit Request</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);
};

// Close permission request modal
window.closePermissionRequestModal = function () {
  const modal = document.getElementById('permissionRequestModal');
  if (modal) {
    modal.remove();
  }
};

// Submit permission request
window.submitPermissionRequest = async function () {
  const permissionType = document.getElementById('permissionType').value;
  const permissionReason = document.getElementById('permissionReason').value.trim();

  if (!permissionType) {
    alert('Please select a permission type.');
    return;
  }

  if (!permissionReason) {
    alert('Please provide a reason for your request.');
    return;
  }

  try {
    // Show loading state
    const submitBtn = document.querySelector('#permissionRequestModal button[onclick="window.submitPermissionRequest()"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '🔄 Submitting...';
    submitBtn.disabled = true;

    // Calculate expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Create permission request
    const requestData = {
      staffId: me.uid,
      staffName: me.name,
      staffEmail: me.email,
      staffRole: me.role,
      department: me.department,
      permissionType: permissionType,
      reason: permissionReason,
      duration: '10_minutes', // Fixed to 10 minutes
      status: 'pending',
      requestedAt: serverTimestamp(),
      expiresAt: expiresAt,
      collegeId: me.collegeId || null,
      collegeName: me.collegeName || null
    };

    await addDoc(collection(db, 'permissionRequests'), requestData);

    alert('Permission request submitted successfully! You will be notified when it is approved. Request expires in 10 minutes.');

    // Close modal
    window.closePermissionRequestModal();

    // Update UI to show pending status
    updatePermissionStatus('pending', permissionType);

  } catch (error) {
    console.error('Error submitting permission request:', error);
    alert('Failed to submit permission request. Please try again.');

    // Restore button state
    const submitBtn = document.querySelector('#permissionRequestModal button[onclick="window.submitPermissionRequest()"]');
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
};

// Create a simple global function as backup
window.requestAdminPermission = function () {
  console.log("requestAdminPermission called as backup");
  if (typeof window.openPermissionRequestModal === 'function') {
    window.openPermissionRequestModal();
  } else {
    alert("Permission request function not available. Please refresh the page.");
  }
};

// Debug: Confirm functions are defined immediately
console.log("🔧 DEBUG: Permission functions defined at load time");
console.log("openPermissionRequestModal:", typeof window.openPermissionRequestModal);
console.log("requestAdminPermission:", typeof window.requestAdminPermission);

/* Notifications */
const notifyBtn = document.getElementById("notifyBtn");
const notifyCount = document.getElementById("notifyCount");
const notifyList = document.getElementById("notifyList");
let pendingApprovals = [];
let notifyUsersUnsub = null;

/* Attendance */
const attDateFilter = document.getElementById("attDateFilter");
const attStatusFilter = document.getElementById("attStatusFilter");
const attSearch = document.getElementById("attSearch");
const attendanceTableBody = document.getElementById("attendanceTableBody");
const recentActivityBody = document.getElementById("recentActivityBody");

/* Profile Update Elements */
const showRegistrations = document.getElementById("showRegistrations");
const showProfileUpdates = document.getElementById("showProfileUpdates");
const registrationApprovalsView = document.getElementById("registrationApprovalsView");
const profileUpdatesView = document.getElementById("profileUpdatesView");
const profileUpdateTable = document.getElementById("profileUpdateTable");
const hodProfileArea = document.getElementById("hodProfileArea");

const requestModal = document.getElementById("requestModal");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const newFieldValue = document.getElementById("newFieldValue");
const photoRequestArea = document.getElementById("photoRequestArea");
const textRequestArea = document.getElementById("textRequestArea");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const photoPreview = document.getElementById("photoPreview");
const submitRequestBtn = document.getElementById("submitRequestBtn");
const cancelModal = document.getElementById("cancelModal");
const reqPhotoBtn = document.getElementById("reqPhotoBtn");
const photoUnlockedArea = document.getElementById("photoUnlockedArea");
const phoneUnlockedArea = document.getElementById("phoneUnlockedArea");
const phoneEditInput = document.getElementById("phoneEditInput");
const savePhoneBtn = document.getElementById("savePhoneBtn");
const addRequestBtn = document.getElementById("addRequestBtn");
const reqPhoneInput = document.getElementById("reqPhoneInput");
const reqDeptInput = document.getElementById("reqDeptInput");
const multiFieldForm = document.getElementById("multiFieldForm");
const photoTimer = document.getElementById("photoTimer");
const phoneTimer = document.getElementById("phoneTimer");
const detailsUnlockedArea = document.getElementById("detailsUnlockedArea");
const detailsTimer = document.getElementById("detailsTimer");
const deptEditInput = document.getElementById("deptEditInput");
const phoneDetailEditInput = document.getElementById("phoneDetailEditInput");
const saveDetailsBtn = document.getElementById("saveDetailsBtn");

// Photo Update Modal Elements
const photoUpdateModal = document.getElementById("photoUpdateModal");
const photoUpdateInput = document.getElementById("photoUpdateInput");
const photoPreviewImg = document.getElementById("photoPreviewImg");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const savePhotoUpdate = document.getElementById("savePhotoUpdate");
const cancelPhotoUpdate = document.getElementById("cancelPhotoUpdate");
const closePhotoModal = document.getElementById("closePhotoModal");
const requestPhotoBtn = document.getElementById("requestPhotoBtn");
const photoSelectionArea = document.getElementById("photoSelectionArea");
const photoApprovalTimer = document.getElementById("photoApprovalTimer");
const photoTimerText = document.getElementById("photoTimerText");

let activeRequestField = null;
let activeRequestLabel = null;
let currentProfilePhotoBase64 = null;
let hodProfileApprovalEnabled = false;
let selectedPhotoFile = null;

// Global functions for profile management
window.requestProfileEdit = function () {
  // Check if user already has a pending request
  if (me && me.pendingUnlock_details) {
    alert('You already have a pending profile edit request. Please wait for admin approval.');
    return;
  }

  // Show confirmation dialog with clear approval messaging
  const confirmed = confirm(
    '📝 REQUEST APPROVAL TO EDIT PROFILE\n\n' +
    '⚠️ IMPORTANT: This will send a REQUEST to the admin for approval.\n' +
    'NO changes will be made until admin approves your request.\n\n' +
    '⏰ REQUEST EXPIRES: 10 minutes after submission\n' +
    '⏰ APPROVAL EXPIRES: 10 minutes after admin approval\n\n' +
    'You can request to update:\n' +
    '• Personal Information (Name, Email, Phone)\n' +
    '• College Information (College Name, College ID)\n' +
    '• Work Information (Department, Staff ID)\n\n' +
    'Do you want to send the approval request?'
  );

  if (!confirmed) return;

  // Use the existing permission request system
  openRequestModal('details', 'Profile Edit Approval Request');
};

window.requestPhotoChange = function () {
  // Check if user already has a pending photo request
  if (me && me.pendingUnlock_photo) {
    alert('You already have a pending photo change request. Please wait for admin approval.');
    return;
  }

  // Show confirmation dialog
  const confirmed = confirm(
    '📷 Profile Photo Change Request\n\n' +
    'This will send a request to the admin for permission to change your profile photo.\n\n' +
    '⏰ REQUEST EXPIRES: 10 minutes after submission\n' +
    '⏰ APPROVAL EXPIRES: 10 minutes after admin approval\n\n' +
    'Do you want to proceed?'
  );

  if (!confirmed) return;

  // Use the existing photo request system
  const reqPhotoBtn = document.getElementById('reqPhotoBtn');
  if (reqPhotoBtn) {
    reqPhotoBtn.click();
  } else {
    // Fallback: open photo update modal directly
    const photoUpdateModal = document.getElementById('photoUpdateModal');
    if (photoUpdateModal) {
      photoUpdateModal.classList.remove("hidden");
    }
  }
};


/* Logout */
const logoutBtn = document.getElementById("logoutBtn");
const logoutOverlay = document.getElementById("logoutOverlay");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");

/* ========== INITIALIZATION ========== */

onAuthStateChanged(auth, async user => {
  // Show loading screen
  window.showLoading('Authenticating...');

  try {
    if (!user) return window.location.replace("login.html");

    window.showLoading('Loading your profile...');

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return window.location.replace("login.html");

    me = snap.data();

    // Apply college background
    if (me.collegeId) loadAndApplyBackground(me.collegeId);

    window.showLoading('Loading dashboard data...');

    setupUI();
    startRealtimeListeners();
    initClock();

    // Set default date for attendance
    const today = new Date().toISOString().split('T')[0];
    if (attDateFilter) attDateFilter.value = today;

    // Load Security Settings
    const secSnap = await getDoc(doc(db, "settings", "security"));
    if (secSnap.exists()) {
      hodProfileApprovalEnabled = !!secSnap.data().hodProfileApprovalEnabled;
    }

    // Initial section is handled at the bottom of the file

    // Check statuses only AFTER 'me' is loaded to avoid TypeErrors
    await Promise.allSettled([
      calculateTotalDaysStaff(),
      checkDayStatus(),
    ]);

    autoUpdateGpsStatus();
    setInterval(autoUpdateGpsStatus, 5000);
    setInterval(checkDayStatus, 60000);

    // Hide loading screen — data is ready
    window.hideLoading();

  } catch (err) {
    console.error("Dashboard Init Error:", err);
    alert("Error loading dashboard: " + err.message);
    window.hideLoading();
  }
});

function setupUI() {
  // Update greeting with time-based system
  updateTimeBasedGreeting();

  // Sidebar
  sidebarPhoto.src = me.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%233b82f6' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='60' fill='white'%3E" + (me.name ? me.name.charAt(0).toUpperCase() : "?") + "%3C/text%3E%3C/svg%3E";
  sidebarName.innerText = me.name;
  sidebarRole.innerText = (me.role || "staff").toUpperCase();

  // Header Elements
  if (headerName) headerName.innerText = me.name;
  if (headerRole) headerRole.innerText = (me.role || "staff").toUpperCase();

  // Profile Section (Premium)
  if (profilePhoto) profilePhoto.src = me.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%233b82f6' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='60' fill='white'%3E" + (me.name ? me.name.charAt(0).toUpperCase() : "?") + "%3C/text%3E%3C/svg%3E";
  if (profileNameDisplay) profileNameDisplay.innerText = me.name;
  if (profileRoleBadge) profileRoleBadge.innerText = (me.role || "staff").toUpperCase();
  if (pName) pName.innerText = me.name;
  if (pEmail) pEmail.innerText = me.email;
  if (pPhone) pPhone.innerText = me.phone || "-";
  if (pDept) pDept.innerText = me.department || "-";
  if (pId) pId.innerText = me.staffId || "-";

  // Handle Unlocked States with Countdown Timers
  const now = new Date().getTime();
  const expiryMs = 10 * 60 * 1000; // 10 minutes

  if (window.expiryInterval) clearInterval(window.expiryInterval);
  window.expiryInterval = setInterval(() => {
    const currentTime = new Date().getTime();

    // Phone Timer
    if (me.pendingUnlock_phone) {
      const approvedAt = me.pendingUnlock_phone_at?.toDate?.()?.getTime() || 0;
      const diff = currentTime - approvedAt;
      if (diff < expiryMs) {
        if (phoneUnlockedArea) phoneUnlockedArea.classList.remove("hidden");
        if (phoneTimer) {
          const remaining = Math.max(0, expiryMs - diff);
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          phoneTimer.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      } else {
        if (phoneUnlockedArea) phoneUnlockedArea.classList.add("hidden");
      }
    } else {
      if (phoneUnlockedArea) phoneUnlockedArea.classList.add("hidden");
    }

    // Photo Timer - 5 minute expiry for photo upload approval
    if (me.pendingUnlock_photo) {
      const approvedAt = me.pendingUnlock_photo_at?.toDate?.()?.getTime() || 0;
      const diff = currentTime - approvedAt;
      if (diff >= expiryMs) {
        // Expired - clear the flag
        updateDoc(doc(db, "users", me.uid), { pendingUnlock_photo: false }).catch(err => console.error(err));
      }
    }

    // Details Timer (Staff Multi-field)
    if (me.pendingUnlock_details) {
      const approvedAt = me.pendingUnlock_details_at?.toDate?.()?.getTime() || 0;
      const diff = currentTime - approvedAt;
      if (diff < expiryMs) {
        if (detailsUnlockedArea) {
          if (detailsUnlockedArea.classList.contains("hidden")) {
            if (phoneDetailEditInput) phoneDetailEditInput.value = me.phone || "";
            if (deptEditInput) deptEditInput.value = me.department || "";
          }
          detailsUnlockedArea.classList.remove("hidden");
        }
        if (detailsTimer) {
          const remaining = Math.max(0, expiryMs - diff);
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          detailsTimer.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      } else {
        if (detailsUnlockedArea) detailsUnlockedArea.classList.add("hidden");
      }
    } else {
      if (detailsUnlockedArea) detailsUnlockedArea.classList.add("hidden");
    }
  }, 1000);

  // Permission Status Display - Show for all staff roles
  if (hodProfileArea) {
    hodProfileArea.classList.remove("hidden");
    const statusText = document.getElementById("permStatusText");
    if (statusText) {
      statusText.innerText = "📋 REQUEST ADMIN PERMISSION TO PERFORM ACTIONS";
      statusText.style.color = "#64748b";
    }
  }

  checkHolidayStatus();

  // Initialize permission check
  initializePermissionCheck();

  // Load staff profile content with delay to ensure me is available
  setTimeout(() => {
    console.log("Loading staff profile, me:", me);
    loadStaffProfile();
  }, 100);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

async function checkHolidayStatus() {
  const holidayBadge = document.getElementById("holidayBadge");
  if (!holidayBadge) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0 = Sunday

    let isHoliday = false;
    let reason = "";

    if (dayOfWeek === 0) {
      isHoliday = true;
      reason = "Sunday - Weekly Holiday";
    }

    const docSnap = await getDoc(doc(db, "holidays", today));
    if (docSnap.exists()) {
      isHoliday = true;
      reason = docSnap.data().reason || "Holiday";
    }

    if (isHoliday) {
      holidayBadge.innerText = `🏖️ ${reason}`;
      holidayBadge.style.display = "inline-flex";
    } else {
      holidayBadge.style.display = "none";
    }
  } catch (err) {
    console.error("checkHolidayStatus error:", err);
  }
}

/* ========== REALTIME LISTENERS ========== */

function startRealtimeListeners() {
  // 1. Listen for ALL students in the department
  // 1. Listen for ALL students
  // Note: Filtering by department in JS to avoid Firestore composite index requirement
  const studentsQuery = query(
    collection(db, "users"),
    where("role", "==", "student")
  );

  onSnapshot(studentsQuery, snap => {
    studentsCache = [];
    let approvedCount = 0;

    snap.forEach(d => {
      const u = d.data();
      const r = (u.role || "").toLowerCase();
      const myRole = (me.role || "").toLowerCase();

      let isMyStudent = false;
      if (myRole === "incharge") {
        isMyStudent = (u.inchargeId === me.uid);
      } else if (myRole === "hod") {
        isMyStudent = (u.department === me.department);
      } else {
        isMyStudent = (u.department === me.department);
      }

      console.warn("DEBUG STUDENT:", {
        studentName: u.name,
        studentDept: u.department,
        studentInchargeId: u.inchargeId,
        staffDept: me.department,
        staffUid: me.uid,
        staffRole: me.role,
        isMyStudent
      });

      if (isMyStudent) {
        u.uid = d.id;
        studentsCache.push(u);
        if (u.approved) {
          approvedCount++;
        }
      }
    });

    // Update real-time total students (only approved ones)
    if (deptStudentsCount) deptStudentsCount.innerText = approvedCount;

    // Refresh views if they are active
    if (currentSection === "approval") renderApproval();
    if (currentSection === "students") renderStudents();
    if (currentSection === "home") {
      updateSessionStats();
    }
  }, err => {
    console.error("Students Query Error:", err);
    // If composite index fails, fallback to simple query and JS filter
    if (err.code === "failed-precondition") {
      console.warn("Falling back to client-side filtering due to missing missing index.");
      const fallbackQuery = query(collection(db, "users"), where("role", "==", "student"));
      onSnapshot(fallbackQuery, fallbackSnap => {
        studentsCache = [];
        let approvedCount = 0;
        fallbackSnap.forEach(d => {
          const u = d.data();
          const r = (u.role || "").toLowerCase();
          const myRole = (me.role || "").toLowerCase();

          let isMyStudent = false;
          if (myRole === "incharge") {
            isMyStudent = (u.inchargeId === me.uid);
          } else if (myRole === "hod") {
            isMyStudent = (u.department === me.department);
          } else {
            isMyStudent = (u.department === me.department);
          }

          console.warn("DEBUG FALLBACK STUDENT:", {
            studentName: u.name,
            studentDept: u.department,
            studentInchargeId: u.inchargeId,
            staffDept: me.department,
            staffUid: me.uid,
            staffRole: me.role,
            isMyStudent
          });

          if (isMyStudent) {
            u.uid = d.id;
            studentsCache.push(u);
            if (u.approved) {
              approvedCount++;
            }
          }
        });
        if (deptStudentsCount) deptStudentsCount.innerText = approvedCount;
        if (currentSection === "approval") renderApproval();
        if (currentSection === "students") renderStudents();
        if (currentSection === "home") updateSessionStats();
      });
    }
  });

  // 2. Listen for attendance records (with error handling for permissions)
  try {
    const attQuery = query(collection(db, "attendanceRecords"), where("collegeId", "==", me.collegeId));
    onSnapshot(attQuery, snap => {

      attendanceRecords = [];
      snap.forEach(d => {
        const r = d.data();
        // Only keep records of students in this staff's department
        const isMyStudent = studentsCache.some(s => s.uid === r.studentUid);
        if (isMyStudent) attendanceRecords.push(r);
      });

      if (currentSection === "attendance") renderAttendance();
      renderRecentActivity(); // Always update activity on home
      if (currentSection === "home") {
        updateSessionStats();
        calculateTotalDaysStaff();
        // Removed redundant checkDayStatus here; it's handled in main refresh
      }

    }, err => {
      console.error("Attendance Query Error:", err);
      // If permission denied, initialize empty attendance records
      if (err.code === 'permission-denied') {
        attendanceRecords = [];
        console.warn("Staff user doesn't have permission to read attendance records");
      }
    });
  } catch (error) {
    console.error("Failed to set up attendance listener:", error);
    attendanceRecords = [];
  }

  // 3. Listen for session timings (College-specific with global fallback)
  const setupSettingsListener = async () => {
    try {
      const collegeSettingsRef = doc(db, "colleges", me.collegeId, "settings", "attendance");
      const globalSettingsRef = doc(db, "settings", "attendance");

      const updateUI = (snap) => {
        const fnT = document.getElementById("fnTiming");
        const anT = document.getElementById("anTiming");

        if (snap.exists()) {
          attendanceSettings = snap.data();
          window.staffSettings = attendanceSettings;
          if (fnT) fnT.innerText = `${attendanceSettings.fnStart || '--:--'} to ${attendanceSettings.fnEnd || '--:--'}`;
          if (anT) anT.innerText = `${attendanceSettings.anStart || '--:--'} to ${attendanceSettings.anEnd || '--:--'}`;
          updateSessionStats();
          autoUpdateGpsStatus();
          // No direct call to updateSessionMonitoring here; the global interval handles it
          return true;
        }

        return false;
      };

      // Try college-specific first
      onSnapshot(collegeSettingsRef, snap => {
        if (!updateUI(snap)) {
          // Fallback to global if college-specific doesn't exist
          onSnapshot(globalSettingsRef, gSnap => {
            updateUI(gSnap);
          });
        }
      }, err => {
        console.warn("College settings listener error (falling back):", err);
        onSnapshot(globalSettingsRef, gSnap => {
          updateUI(gSnap);
        });
      });
    } catch (err) {
      console.error("Settings setup error:", err);
    }
  };

  setupSettingsListener();


  // 4. Start Notification Listeners
  startNotifyListeners();

  // 5. Start session monitoring timer
  setInterval(updateSessionMonitoring, 1000);
}

/* ========== NOTIFICATIONS ========== */

function startNotifyListeners() {
  if (notifyUsersUnsub) return;

  // Listen for students pending approval specifically for this staff member
  // or just generally pending in their department depending on rules.
  try {
    const notifyQuery = query(collection(db, "users"), where("role", "==", "student"));
    notifyUsersUnsub = onSnapshot(notifyQuery, snap => {
      pendingApprovals = [];
      snap.forEach(d => {
        const u = d.data();
        let relevant = !u.approved && u.department === me.department;
        if (me.role === "incharge" && u.inchargeId && u.inchargeId !== me.uid) {
          relevant = false;
        }
        if (relevant) {
          pendingApprovals.push({ id: d.id, name: u.name || u.email || '-', type: 'registration' });
        }
      });

      // Also listen for profile updates if HOD
      const myRole = (me.role || "").toLowerCase();
      if (myRole === 'hod') {
        const profQ = query(collection(db, "profileUpdateRequests"),
          where("status", "==", "pending"),
          where("department", "==", me.department)
        );
        getDocs(profQ).then(pSnap => {
          pSnap.forEach(pd => {
            const pr = pd.data();
            pendingApprovals.push({ id: pd.id, name: pr.name, type: 'profileUpdate' });
          });
          renderNotifyList();
        });
      } else {
        renderNotifyList();
      }
    });
  } catch (err) {
    console.error("Notify query error:", err);
  }
}

function renderNotifyList() {
  if (!notifyList) return;

  let rows = "";
  if (pendingApprovals.length > 0) {
    pendingApprovals.forEach(u => {
      const label = u.type === 'profileUpdate' ? 'Profile Update' : 'New Student Approval';
      rows += `<div class="notify-item" data-id="${u.id}" data-type="${u.type}">${label}: ${u.name}</div>`;
    });
  } else {
    rows = `<div class="notify-item">No notifications</div>`;
  }

  notifyList.innerHTML = rows;

  if (notifyCount) {
    notifyCount.innerText = pendingApprovals.length;
    if (pendingApprovals.length > 0) {
      notifyCount.classList.remove("hidden");
    } else {
      notifyCount.classList.add("hidden");
    }
  }
}

if (notifyBtn) {
  notifyBtn.onclick = (e) => {
    e.stopPropagation();
    if (notifyList) notifyList.classList.toggle("hidden");
  };
}

// Close notification dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (notifyList && !notifyList.classList.contains('hidden')) {
    if (!notifyBtn.contains(e.target)) {
      notifyList.classList.add('hidden');
    }
  }
});

if (notifyList) {
  notifyList.addEventListener("click", e => {
    const item = e.target.closest(".notify-item");
    if (item && item.dataset.id) {
      notifyList.classList.add("hidden");
      showSection("approval");
      if (item.dataset.type === 'profileUpdate') {
        if (showProfileUpdates) showProfileUpdates.click();
      } else {
        if (showRegistrations) showRegistrations.click();
      }
    }
  });
}

async function calculateTotalDaysStaff() {
  if (!me || !me.collegeId) return;
  try {
    // Get college-specific academic year settings
    let academicYearDoc = await getDoc(doc(db, "colleges", me.collegeId, "settings", "academicYear"));

    // Fallback to global if needed
    if (!academicYearDoc.exists()) {
      academicYearDoc = await getDoc(doc(db, "settings", "academicYear"));
    }

    let startDate, endDate;
    const today = new Date();

    if (academicYearDoc.exists()) {
      const data = academicYearDoc.data();
      startDate = new Date(data.startDate);
      const yearEndDate = new Date(data.endDate);

      // Rule: count only up to today
      endDate = today < yearEndDate ? today : yearEndDate;
    } else {
      // Fallback: Current month
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = today;
    }


    // Fetch all holidays for this college
    const holidaysSnap = await getDocs(collection(db, "colleges", me.collegeId, "holidays"));
    const holidays = new Set();

    holidaysSnap.forEach(doc => {
      holidays.add(doc.data().date);
    });

    // Count working days (excluding Sundays and holidays)
    let workingDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayOfWeek = d.getDay();

      // Skip Sundays (0) and holidays
      if (dayOfWeek !== 0 && !holidays.has(dateStr)) {
        workingDays++;
      }
    }

    if (totalDaysStaff) totalDaysStaff.innerText = workingDays;
  } catch (err) {
    console.error('calculateTotalDaysStaff error', err);
    if (totalDaysStaff) totalDaysStaff.innerText = 0;
  }
}

async function checkDayStatus() {
  if (!me || !me.collegeId) return;
  try {
    const dayStatusEl = document.getElementById("dayStatus");
    if (!dayStatusEl) return;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dayOfWeek = now.getDay(); // 0 = Sunday

    // Check if Sunday
    if (dayOfWeek === 0) {
      dayStatusEl.innerHTML = '<span style="color:#8b5cf6;">📅 Sunday</span>';
      return;
    }

    // Check college-specific holidays collection
    const holidayDoc = await getDoc(doc(db, "colleges", me.collegeId, "holidays", today));

    if (holidayDoc.exists()) {
      const reason = holidayDoc.data().reason || 'Holiday';
      dayStatusEl.innerHTML = `<span style="color:#8b5cf6;">🎉 ${reason}</span>`;
    } else {
      dayStatusEl.innerHTML = '<span style="color:#10b981;">✓ Working Day</span>';
    }
  } catch (err) {
    console.error('checkDayStatus error', err);
    const dayStatusEl = document.getElementById("dayStatus");
    if (dayStatusEl) dayStatusEl.innerHTML = '<span style="color:#64748b;">Unknown</span>';
  }
}

function updateSessionStats() {
  if (!me) return;
  const today = new Date().toISOString().split('T')[0];
  const approvedStudents = studentsCache.filter(s => s.approved);
  const totalCount = approvedStudents.length;

  let fnP = 0, anP = 0;
  attendanceRecords.forEach(r => {
    if (r.date === today && r.status === "present") {
      if (r.session === "FN") fnP++;
      else if (r.session === "AN") anP++;
    }
  });

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const getStatus = (startStr, endStr) => {
    if (!startStr || !endStr) return { active: false, started: false };
    const [h1, m1] = startStr.split(':').map(Number);
    const [h2, m2] = endStr.split(':').map(Number);
    const startM = h1 * 60 + m1;
    const endM = h2 * 60 + m2;
    return {
      active: currentMinutes >= startM && currentMinutes <= endM,
      started: currentMinutes >= startM
    };
  };

  const fnStatus = attendanceSettings ? getStatus(attendanceSettings.fnStart, attendanceSettings.fnEnd) : { active: false, started: false };
  const anStatus = attendanceSettings ? getStatus(attendanceSettings.anStart, attendanceSettings.anEnd) : { active: false, started: false };

  // FN UI
  if (fnPresentCount) {
    if (!fnStatus.started) fnPresentCount.innerText = "0";
    else if (fnStatus.active) fnPresentCount.innerHTML = `${fnP} <span style="font-size:12px; color:#3b82f6;">(Going On)</span>`;
    else fnPresentCount.innerText = fnP;
  }
  if (fnAbsentCount) {
    if (!fnStatus.started) fnAbsentCount.innerText = "0";
    else fnAbsentCount.innerText = Math.max(0, totalCount - fnP);
  }

  // AN UI
  if (anPresentCount) {
    if (!anStatus.started) anPresentCount.innerText = "0";
    else if (anStatus.active) anPresentCount.innerHTML = `${anP} <span style="font-size:12px; color:#3b82f6;">(Going On)</span>`;
    else anPresentCount.innerText = anP;
  }
  if (anAbsentCount) {
    if (!anStatus.started) anAbsentCount.innerText = "0";
    else anAbsentCount.innerText = Math.max(0, totalCount - anP);
  }

  // Daily % UI
  const dailyPercentEl = document.getElementById("dailyAttendancePercent");
  if (dailyPercentEl) {
    let activeSessions = 0;
    if (fnStatus.started) activeSessions++;
    if (anStatus.started) activeSessions++;

    const possibleSessionsToday = totalCount * activeSessions;
    const actualPresentsToday = (fnStatus.started ? fnP : 0) + (anStatus.started ? anP : 0);
    const dailyP = possibleSessionsToday > 0 ? (actualPresentsToday / possibleSessionsToday * 100).toFixed(1) : 0;
    dailyPercentEl.innerText = `${dailyP}%`;
    dailyPercentEl.style.color = dailyP >= 75 ? "#10b981" : "#ef4444";
  }
}
/* ========== SESSION MONITORING ========== */

function updateSessionMonitoring() {
  const currentSessionEl = document.getElementById("currentSession");
  const timeLeftEl = document.getElementById("timeLeft");
  const timeLabelEl = document.getElementById("timeLabel");

  if (!currentSessionEl || !timeLeftEl || !timeLabelEl || !window.staffSettings) return;

  const now = new Date();
  const minNow = now.getHours() * 60 + now.getMinutes();
  const toM = (t) => { const [h, m] = (t || "00:00").split(":"); return parseInt(h) * 60 + parseInt(m); };

  const fnS = toM(window.staffSettings.fnStart);
  const fnE = toM(window.staffSettings.fnEnd);
  const anS = toM(window.staffSettings.anStart);
  const anE = toM(window.staffSettings.anEnd);

  let sessionName = "-- No Active Session --";
  let timeValue = "00:00:00";
  let timeLabel = "";

  if (minNow < fnS) {
    sessionName = "🌅 FN Session";
    const diff = (fnS - minNow) * 60;
    timeValue = formatTime(diff);
    timeLabel = "starts in";
  } else if (minNow <= fnE) {
    sessionName = "🌅 FN Session - Active";
    const diff = (fnE - minNow) * 60;
    timeValue = formatTime(diff);
    timeLabel = "left";
  } else if (minNow < anS) {
    sessionName = "🌤️ AN Session";
    const diff = (anS - minNow) * 60;
    timeValue = formatTime(diff);
    timeLabel = "starts in";
  } else if (minNow <= anE) {
    sessionName = "🌤️ AN Session - Active";
    const diff = (anE - minNow) * 60;
    timeValue = formatTime(diff);
    timeLabel = "left";
  } else {
    // AN ended - show countdown to tomorrow's FN session
    sessionName = "🔒 Today's Attendance Closed";

    // Calculate time until tomorrow's FN start
    const minutesUntilMidnight = (24 * 60) - minNow;
    const minutesFromMidnightToFN = fnS;
    const totalMinutesUntilNextFN = minutesUntilMidnight + minutesFromMidnightToFN;
    const secondsUntilNextFN = totalMinutesUntilNextFN * 60 - now.getSeconds();

    timeValue = formatTime(secondsUntilNextFN);
    timeLabel = "until tomorrow's FN";
  }

  currentSessionEl.innerText = sessionName;
  timeLeftEl.innerText = timeValue;
  timeLabelEl.innerText = timeLabel;
}

// Start the real-time session monitor clock (Once per second)
setInterval(updateSessionMonitoring, 1000);


function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ========== GPS STATUS ========== */

function autoUpdateGpsStatus() {
  const gpsEl = document.getElementById("gpsStatus");
  const timingBadge = document.getElementById("timingStatusBadge");

  if (gpsEl) {
    if (!navigator.geolocation) {
      gpsEl.innerHTML = '❌ UNSUPPORTED';
      gpsEl.style.color = '#ef4444';
    } else {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          gpsEl.innerHTML = '✓ ENABLED';
          gpsEl.style.color = '#10b981';
        } else if (result.state === 'prompt') {
          gpsEl.innerHTML = '⏳ PENDING';
          gpsEl.style.color = '#f59e0b';
          navigator.geolocation.getCurrentPosition(() => { }, () => { }, { timeout: 10000 });
        } else {
          gpsEl.innerHTML = '❌ DISABLED';
          gpsEl.style.color = '#ef4444';
        }
      });
    }
  }

  // Update timing status badge
  if (timingBadge && window.staffSettings) {
    const hasTimings = window.staffSettings.fnStart && window.staffSettings.fnEnd && window.staffSettings.anStart && window.staffSettings.anEnd;
    if (hasTimings) {
      timingBadge.innerHTML = '✓ ENABLED';
      timingBadge.style.color = '#10b981';
    } else {
      timingBadge.innerHTML = '⚪ NOT SET';
      timingBadge.style.color = '#64748b';
    }
  }
}

// Check statuses on load and intervals - MOVED to onAuthStateChanged to ensure 'me' is defined


/* ========== NAVIGATION ========== */
let currentSection = "home";

document.querySelectorAll("[data-sec]").forEach(item => {
  item.onclick = () => {
    const target = item.dataset.sec;
    showSection(target);
  };
});

function showSection(id, isBack = false) {
  if (id === currentSection && !isBack) return;
  currentSection = id;

  // UI Update
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  const targetSec = document.getElementById(id);
  if (targetSec) targetSec.classList.remove("hidden");

  document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
  const activeLi = document.querySelector(`.sidebar li[data-sec="${id}"]`);
  if (activeLi) activeLi.classList.add("active");

  if (sidebar) sidebar.classList.remove("show");

  // Specific Loaders
  if (id === "approval") {
    renderApproval();

    // Ensure request permission button event listener is attached
    setTimeout(() => {
      const requestPermBtn = document.getElementById('requestPermBtn');
      if (requestPermBtn && !requestPermBtn.hasAttribute('data-listener-attached')) {
        requestPermBtn.addEventListener('click', function () {
          console.log("Request permission button clicked (from showSection)");
          if (typeof window.openPermissionRequestModal === 'function') {
            window.openPermissionRequestModal();
          } else {
            console.error("openPermissionRequestModal function not found");
            alert("Permission request function not available. Please refresh the page.");
          }
        });
        requestPermBtn.setAttribute('data-listener-attached', 'true');
        console.log("Event listener attached to request permission button from showSection");
      }
    }, 100);
  }
  if (id === "students") renderStudents();
  if (id === "attendance") renderAttendance();

  // History Management
  if (!isBack) {
    history.pushState({ section: id }, "", `#${id}`);
  }
}

// Initialize history on load with a trap
const initialSection = (location.hash && location.hash !== "#home") ? location.hash.substring(1) : "home";

// 1. Create the trap entry (no state)
history.replaceState(null, "", window.location.pathname + window.location.search);

// 2. Push home state if we are going to a sub-section
if (initialSection !== "home") {
  history.pushState({ section: "home" }, "", "#home");
}

// 3. Push the target section
history.pushState({ section: initialSection }, "", "#" + initialSection);

// Force initial section render
showSection(initialSection, true);

window.onpopstate = (event) => {
  if (event.state && event.state.section) {
    showSection(event.state.section, true);
  } else {
    // If no state or going back from Home, trigger logout
    if (logoutOverlay) {
      logoutOverlay.classList.remove("hidden");
      // If they cancel, we need to push the home state back so they don't exit history
      cancelLogout.onclick = () => {
        logoutOverlay.classList.add("hidden");
        history.pushState({ section: "home" }, "", "#home");
      };
    } else {
      // Navigate to requested section
      showSection(sec);
    }
      history.pushState({ section: "home" }, "", "#home");
    }
  }

/* ================= MENU ================= */

const sidebarOverlay = document.getElementById("sidebarOverlay");

menuBtn.onclick = () => {
	sidebar.classList.toggle("show");
	if (sidebarOverlay) sidebarOverlay.classList.toggle("show");
};

// Close sidebar when clicking overlay
if (sidebarOverlay) {
	sidebarOverlay.onclick = () => {
		sidebar.classList.remove("show");
		sidebarOverlay.classList.remove("show");
	};
}

// Open sidebar on hover
if (sidebar) {
	sidebar.onmouseenter = () => {
		sidebar.classList.add("show");
		if (sidebarOverlay) sidebarOverlay.classList.add("show");
	};
	
	sidebar.onmouseleave = () => {
		sidebar.classList.remove("show");
		if (sidebarOverlay) sidebarOverlay.classList.remove("show");
	};
}

// Also open sidebar when hovering near the left edge
document.addEventListener('mousemove', (e) => {
	if (e.clientX <= 10 && !sidebar.classList.contains('show')) {
		sidebar.classList.add("show");
		if (sidebarOverlay) sidebarOverlay.classList.add("show");
	}
});

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
  if (sidebar.classList.contains('show')) {
    // Check if click is outside sidebar and menu button
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
      sidebar.classList.remove('show');
      if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    }
  }
});

// Close sidebar when clicking on menu items
document.querySelectorAll('.sidebar li[data-sec]').forEach(item => {
  item.addEventListener('click', () => {
    sidebar.classList.remove('show');
  });
});

/* ========== RENDERERS ========== */

function renderRecentActivity() {
  if (!recentActivityBody) return;
  recentActivityBody.innerHTML = "";

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Filter by today and sort by timestamp descending
  const sorted = [...attendanceRecords]
    .filter(r => r.date === today)
    .sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    }).slice(0, 3);

  if (sorted.length === 0) {
    recentActivityBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No recent activity</td></tr>";
    return;
  }

  sorted.forEach(r => {
    const time = r.time || "--:--";
    const row = document.createElement("tr");
    row.innerHTML = `
                <td>${time}</td>
                <td class="clickable-name" onclick="openStudentDetails('${r.studentUid}')">${r.studentName}</td>
                <td>Marked ${r.session} attendance</td>
            `;
    recentActivityBody.appendChild(row);
  });
}

window.openStudentDetails = async uid => {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const s = snap.data();

    const overlay = document.getElementById("detailsOverlay");
    const content = document.getElementById("detailsContent");

    let regOn = "—";
    if (s.createdAt) {
      const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt.seconds * 1000);
      regOn = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    const initial = (s.name || "S").charAt(0).toUpperCase();
    const yearSuffix = ["","st","nd","rd","th"][parseInt(s.year)] || "th";
    const yearLabel = s.year ? `${s.year}${yearSuffix} Year` : "—";

    const avatar = s.photoURL
      ? `<img src="${s.photoURL}" style="width:100%;height:100%;object-fit:cover;">`
      : `<span style="font-size:34px;font-weight:800;color:#fff;">${initial}</span>`;

    const row = (icon, label, val) => `
      <div class="sd-row">
        <div class="sd-row-icon">${icon}</div>
        <div>
          <div class="sd-row-lbl">${label}</div>
          <div class="sd-row-val">${val || "—"}</div>
        </div>
      </div>`;

    content.innerHTML = `
      <div class="sd-header">
        <button class="sd-close" onclick="document.getElementById('detailsOverlay').classList.add('hidden')">✕</button>
        <div class="sd-avatar">${avatar}</div>
        <div class="sd-name">${s.name || "Student"}</div>
        <div class="sd-chips">
          <span class="sd-chip">${(s.department || "No Dept").toUpperCase()}</span>
          <span class="sd-chip">${yearLabel}</span>
          <span class="sd-chip ${s.approved ? 'green' : 'yellow'}">${s.approved ? '✓ Approved' : '⏳ Pending'}</span>
        </div>
      </div>
      <div class="sd-stats">
        <div class="sd-stat">
          <div class="sd-stat-val">${s.studentId || "—"}</div>
          <div class="sd-stat-lbl">Roll No</div>
        </div>
        <div class="sd-stat">
          <div class="sd-stat-val">${s.year || "—"}</div>
          <div class="sd-stat-lbl">Year</div>
        </div>
        <div class="sd-stat">
          <div class="sd-stat-val" style="color:${s.approved ? '#34d399' : '#fbbf24'};">${s.approved ? "✓" : "⏳"}</div>
          <div class="sd-stat-lbl">Status</div>
        </div>
      </div>
      <div class="sd-rows">
        ${row("📧", "Email", s.email)}
        ${row("📞", "Phone", s.phone)}
        ${row("🏫", "College", s.collegeName)}
        ${row("📅", "Registered On", regOn)}
      </div>
    `;

    overlay.classList.remove("hidden");
  } catch (err) {
    console.error("openStudentDetails error", err);
  }
};

function renderApproval() {
  const table = document.getElementById("approvalTable");
  if (!table) return;
  table.innerHTML = "";

  const pending = studentsCache.filter(s => !s.approved);

  if (pending.length === 0) {
    table.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No students pending approval</td></tr>";
    return;
  }

  pending.forEach((s, idx) => {
    table.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td>${s.name}</td>
                <td>${s.studentId || "-"}</td>
                <td>${s.email}</td>
                <td>
                    <button class="btn-primary" onclick="approveUser('${s.uid}')" style="padding: 6px 12px; font-size: 12px;">Approve</button>
                    <button class="btn-secondary" onclick="rejectUser('${s.uid}')" style="padding: 6px 12px; font-size: 12px; color:#ef4444;">Reject</button>
                </td>
            </tr>
        `;
  });
}

window.approveUser = async uid => {
  if (confirm("Approve this student?")) {
    await updateDoc(doc(db, "users", uid), { approved: true });
  }
};

window.rejectUser = async uid => {
  if (confirm("Are you sure you want to reject and delete this student registration?")) {
    // Technically we might want to just set approved=false, but usually rejected registrations should be removable.
    // For now, let's stick to updateDoc as it's safer than deleteDoc.
    await updateDoc(doc(db, "users", uid), { approved: false, profileCompleted: false });
  }
};

function renderStudents() {
  const table = document.getElementById("studentTableBody");
  table.innerHTML = "";

  const key = (document.getElementById("studentSearch").value || "").toLowerCase();
  const yearFilter = document.getElementById("studentYearFilter").value;

  const approved = studentsCache.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(key) || (s.studentId && s.studentId.toLowerCase().includes(key));
    const matchesYear = yearFilter === "all" || String(s.year) === yearFilter;
    return s.approved && matchesSearch && matchesYear;
  });

  if (approved.length === 0) {
    table.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No students found</td></tr>";
    return;
  }

  approved.forEach(s => {
    const row = document.createElement("tr");
    row.innerHTML = `
                <td><img src="${s.photoURL || 'default-avatar.png'}" width="36" height="36" style="border-radius:50%; object-fit:cover;"></td>
                <td class="clickable-name" onclick="openStudentDetails('${s.uid}')">${s.name}</td>
                <td>${s.studentId || "-"}</td>
                <td>${s.year || "-"}</td>
                <td><button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="openStudentDetails('${s.uid}')">View Info</button></td>
            `;
    table.appendChild(row);
  });
}

document.getElementById("studentSearch").oninput = renderStudents;
document.getElementById("studentYearFilter").onchange = renderStudents;

function renderAttendance() {
  const table = attendanceTableBody;
  table.innerHTML = "";

  const targetDate = attDateFilter.value;
  const statusFilter = attStatusFilter.value;
  const searchKey = (attSearch.value || "").toLowerCase();

  // Show only approved students in this department who were registered by targetDate
  const deptStudents = studentsCache.filter(s => s.approved);

  let i = 1;
  let rows = "";

  deptStudents.forEach(s => {
    // Registration date check
    if (s.createdAt && targetDate) {
      let regDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const regStr = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}-${String(regDate.getDate()).padStart(2, '0')}`;
      if (regStr > targetDate) return;
    }

    // Search check
    if (searchKey && !s.name.toLowerCase().includes(searchKey) && !(s.studentId && s.studentId.toLowerCase().includes(searchKey))) return;

    // Group sessions
    const sessions = { FN: null, AN: null };
    attendanceRecords.forEach(r => {
      if (r.studentUid === s.uid && r.date === targetDate) {
        sessions[r.session] = r;
      }
    });

    // Status Filter
    if (statusFilter !== "all") {
      const hasPresent = (sessions.FN && sessions.FN.status === "present") || (sessions.AN && sessions.AN.status === "present");
      if (statusFilter === "present" && !hasPresent) return;
      if (statusFilter === "absent" && hasPresent) return;
    }

    const fn = sessions.FN;
    const an = sessions.AN;

    const stats = getAttendanceData(s.uid, s.createdAt);

    const fnPresent = fn && fn.status === "present";
    const anPresent = an && an.status === "present";
    const bothAbsent = !fnPresent && !anPresent;

    if (bothAbsent) {
      rows += `
            <tr>
                <td>${i++}</td>
                <td class="clickable-name" onclick="openStudentDetails('${s.uid}')">${s.name}</td>
                <td>${s.studentId || "-"}</td>
                <td>${s.year || "-"}</td>
                <td colspan="4" style="text-align:center; font-weight:700; color:#dc2626;">FN &amp; AN — ABSENT</td>
                <td style="font-weight:700; color: ${stats.eligible ? '#10b981' : '#ef4444'}">
                  ${stats.percent}%<br>
                  <small>${stats.eligible ? 'Eligible' : 'Not Eligible'}</small>
                </td>
            </tr>`;
    } else {
      rows += `
            <tr>
                <td rowspan="2">${i++}</td>
                <td rowspan="2" class="clickable-name" onclick="openStudentDetails('${s.uid}')">${s.name}</td>
                <td rowspan="2">${s.studentId || "-"}</td>
                <td rowspan="2">${s.year || "-"}</td>
                <td>FN</td>
                <td>${fn ? (fn.gpsStatus || "✓") : "-"}</td>
                <td>${fn ? (fn.faceStatus || "✓") : "-"}</td>
                <td>${fn ? (fn.method === 'manual' ? "✓" : "-") : "-"}</td>
                <td style="font-weight:700; color: ${fnPresent ? '#10b981' : '#ef4444'}">${fnPresent ? "PRESENT" : "ABSENT"}</td>
                <td rowspan="2" style="font-weight:700; color: ${stats.eligible ? '#10b981' : '#ef4444'}">
                  ${stats.percent}%<br>
                  <small>${stats.eligible ? 'Eligible' : 'Not Eligible'}</small>
                </td>
            </tr>
            <tr>
                <td>AN</td>
                <td>${an ? (an.gpsStatus || "✓") : "-"}</td>
                <td>${an ? (an.faceStatus || "✓") : "-"}</td>
                <td>${an ? (an.method === 'manual' ? "✓" : "-") : "-"}</td>
                <td style="font-weight:700; color: ${anPresent ? '#10b981' : '#ef4444'}">${anPresent ? "PRESENT" : "ABSENT"}</td>
            </tr>`;
    }
  });

  if (rows === "") {
    table.innerHTML = `<tr><td colspan="9" style="text-align:center;">No records found for this date/filter</td></tr>`;
  } else {
    table.innerHTML = rows;
  }
}

attDateFilter.onchange = renderAttendance;
attStatusFilter.onchange = renderAttendance;
attSearch.oninput = renderAttendance;

// Set max date to today for attendance date filter
if (attDateFilter) {
  const today = new Date().toISOString().split('T')[0];
  attDateFilter.max = today;
}

/* ========== CLOCK ========== */

function initClock() {
  const currentTimeEl = document.getElementById("currentTime");
  const currentDateEl = document.getElementById("currentDate");
  const currentDayEl = document.getElementById("currentDay");

  let lastDate = "";

  function update() {
    const now = new Date();
    const dateStr = now.toDateString();

    if (currentTimeEl) currentTimeEl.innerText = now.toLocaleTimeString();
    if (currentDateEl) {
      const day = String(now.getDate()).padStart(2, '0');
      const month = now.toLocaleString('default', { month: 'short' });
      const year = now.getFullYear();
      currentDateEl.innerText = `${day} ${month} ${year}`;
    }
    if (currentDayEl) {
      currentDayEl.innerText = now.toLocaleString('default', { weekday: 'long' });
    }

    // Refresh activity at midnight
    if (lastDate !== "" && lastDate !== dateStr) {
      renderRecentActivity();
      // Also update attendance filter if it was set to today
      const todayVal = now.toISOString().split('T')[0];
      if (attDateFilter) attDateFilter.value = todayVal;
    }
    lastDate = dateStr;

    updateSessionStats();
  }

  update();
  setInterval(update, 1000); // Back to 1s for ticking clock
}

/* ========== LOGOUT ========== */
let isLoggingOut = false;

logoutBtn.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  logoutOverlay.classList.remove("hidden");
};

if (headerLogoutBtn) {
  headerLogoutBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    logoutOverlay.classList.remove("hidden");
  };
}

cancelLogout.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  logoutOverlay.classList.add("hidden");
};

confirmLogout.onclick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Prevent double-click logout
  if (isLoggingOut) return;
  isLoggingOut = true;
  
  // Disable button and show loading state
  confirmLogout.disabled = true;
  confirmLogout.style.opacity = '0.6';
  confirmLogout.innerText = 'Logging out...';
  
  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (error) {
    console.error("Logout error:", error);
    alert("Error logging out. Please try again.");
    isLoggingOut = false;
    confirmLogout.disabled = false;
    confirmLogout.style.opacity = '1';
    confirmLogout.innerText = 'Logout';
  }
};

/* ========== EXCEL EXPORT ========== */
const downloadExcelBtn = document.getElementById("downloadExcel");
if (downloadExcelBtn) {
  downloadExcelBtn.onclick = () => {
    const targetDate = attDateFilter.value;
    if (!targetDate) {
      alert("Please select a date first");
      return;
    }

    const exportData = [];
    const deptStudents = studentsCache.filter(s => s.approved);

    deptStudents.forEach(s => {
      // Registration date check
      if (s.createdAt) {
        let regDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        const regStr = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}-${String(regDate.getDate()).padStart(2, '0')}`;
        if (regStr > targetDate) return;
      }

      const sessions = { FN: null, AN: null };
      attendanceRecords.forEach(r => {
        if (r.studentUid === s.uid && r.date === targetDate) {
          sessions[r.session] = r;
        }
      });

      // FN Session
      exportData.push({
        "Name": s.name,
        "Roll No": s.studentId || "-",
        "Year": s.year || "-",
        "Date": targetDate,
        "Session": "FN",
        "Status": sessions.FN ? "PRESENT" : "ABSENT",
        "GPS": sessions.FN?.gpsStatus || "-",
        "Face": sessions.FN?.faceStatus || "-"
      });

      // AN Session
      exportData.push({
        "Name": s.name,
        "Roll No": s.studentId || "-",
        "Year": s.year || "-",
        "Date": targetDate,
        "Session": "AN",
        "Status": sessions.AN ? "PRESENT" : "ABSENT",
        "GPS": sessions.AN?.gpsStatus || "-",
        "Face": sessions.AN?.faceStatus || "-"
      });
    });

    if (exportData.length === 0) {
      alert("No data to export for the selected date");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `Attendance_${targetDate}.xlsx`);
  };
}

/** 
 * Logic: 
 * - 2 sessions/day (FN, AN)
 * - P=1, A=0
 * - Percentage = (Sessions Attended / Total Sessions possible since registration) * 100
 * - Eligibility: >= 75%
 */
function getAttendanceData(uid, regCreatedAt) {
  if (!regCreatedAt) return { percent: "0.0", eligible: false, attended: 0, totalDays: 0 };

  const regDate = regCreatedAt.toDate ? regCreatedAt.toDate() : new Date(regCreatedAt);

  // Group attendance records by date
  const attendanceByDate = {};
  attendanceRecords.forEach(r => {
    if (r.studentUid === uid) {
      if (!attendanceByDate[r.date]) {
        attendanceByDate[r.date] = { FN: null, AN: null };
      }
      attendanceByDate[r.date][r.session] = r;
    }
  });

  // Count present days (both FN and AN must be present)
  let presentDays = 0;
  Object.keys(attendanceByDate).forEach(date => {
    const fnPresent = attendanceByDate[date].FN && attendanceByDate[date].FN.status === "present";
    const anPresent = attendanceByDate[date].AN && attendanceByDate[date].AN.status === "present";

    // Only count as present day if BOTH sessions are present
    if (fnPresent && anPresent) {
      presentDays++;
    }
  });

  // Count working days from registration to today
  let workingDays = 0;
  let curr = new Date(regDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    if (curr.getDay() !== 0) workingDays++;
    curr.setDate(curr.getDate() + 1);
  }

  const percent = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;
  const eligible = percent >= 75;

  return {
    percent: percent.toFixed(1),
    eligible,
    attended: presentDays,
    totalDays: workingDays
  };
}

/* ================= PROFILE UPDATE LOGIC ================= */

if (showRegistrations) {
  showRegistrations.onclick = () => {
    showRegistrations.style.background = "#3b82f6";
    showRegistrations.style.color = "white";
    showProfileUpdates.style.background = "transparent";
    showProfileUpdates.style.color = "#64748b";
    registrationApprovalsView.classList.remove("hidden");
    profileUpdatesView.classList.add("hidden");
  };
}

if (showProfileUpdates) {
  showProfileUpdates.onclick = () => {
    showProfileUpdates.style.background = "#3b82f6";
    showProfileUpdates.style.color = "white";
    showRegistrations.style.background = "transparent";
    showRegistrations.style.color = "#64748b";
    profileUpdatesView.classList.remove("hidden");
    registrationApprovalsView.classList.add("hidden");
    window.renderProfileUpdateTable();
  };
}

window.renderProfileUpdateTable = async () => {
  if (!profileUpdateTable || me.role !== 'hod') return;
  try {
    // HODs can only approve students in their department
    const q = query(collection(db, "profileUpdateRequests"), where("status", "==", "pending"), where("department", "==", me.department), where("role", "==", "student"));
    const snap = await getDocs(q);
    let rows = "";

    snap.forEach(d => {
      const r = d.data();
      const id = d.id;
      const newVal = r.type === 'photo' ? '<i>New Photo</i>' : r.newValue;

      rows += `
				<tr>
					<td>${r.name}</td>
					<td>${r.type}</td>
					<td>-</td>
					<td style="font-weight:600;">${newVal}</td>
					<td>${r.gps ? '✅' : '❌'}</td>
					<td>
						<button class="approve-profile-btn" data-id="${id}" style="padding:4px 12px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:4px;">Verify & Submit to Admin</button>
						<button class="reject-profile-btn" data-id="${id}" style="padding:4px 8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;">Reject</button>
					</td>
				</tr>
			`;
    });

    if (rows === "") {
      profileUpdateTable.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No pending profile requests for your department</td></tr>";
    } else {
      profileUpdateTable.innerHTML = rows;
      attachProfileRequestHandlers();
    }
  } catch (err) {
    console.error("renderProfileUpdateTable error", err);
  }
};

function attachProfileRequestHandlers() {
  document.querySelectorAll(".approve-profile-btn").forEach(btn => {
    btn.onclick = () => handleProfileRequest(btn.dataset.id, 'hod_verified');
  });
  document.querySelectorAll(".reject-profile-btn").forEach(btn => {
    btn.onclick = () => handleProfileRequest(btn.dataset.id, 'rejected');
  });
}

async function handleProfileRequest(requestId, status) {
  if (status === 'hod_verified' && !hodProfileApprovalEnabled) {
    alert("HOD profile verification is currently disabled by Admin.");
    return;
  }

  try {
    // HOD MUST COMPLETE GPS VERIFICATION FOR STUDENT REQUESTS
    let hodGps = null;
    if (status === 'hod_verified') {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        hodGps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: serverTimestamp()
        };
      } catch (gpsErr) {
        alert("GPS verification failed. This is mandatory for approval.");
        return;
      }
    }

    const reqRef = doc(db, "profileUpdateRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();

    await updateDoc(reqRef, {
      status: status,
      respondedBy: me.uid,
      respondedAt: serverTimestamp(),
      hodGps: hodGps
    });

    if (status === 'approved') {
      const userRef = doc(db, "users", req.uid);
      await updateDoc(userRef, {
        [`pendingUnlock_${req.type}`]: true,
        [`pendingUnlock_${req.type}_at`]: serverTimestamp(),
        currentRequestId: requestId
      });

      // Send notification to user
      await addDoc(collection(db, "notifications"), {
        userId: req.uid,
        title: `${req.type === 'photo' ? 'Photo' : 'Profile'} Update Approved`,
        message: `Your ${req.type} update request has been approved. You have 5 minutes to complete the update.`,
        type: 'approval',
        read: false,
        createdAt: serverTimestamp()
      });
    }

    alert(`Request ${status} successfully`);
    window.renderProfileUpdateTable();
  } catch (err) {
    console.error("handleProfileRequest error", err);
    alert("Action failed");
  }
}

// open modal logic refined
async function openRequestModal(field, label) {
  activeRequestField = field;
  activeRequestLabel = label;
  if (modalTitle) modalTitle.innerHTML = `� REQUEST APPROVAL: ${activeRequestLabel}`;

  // Update modal description to be clearer about approval process
  if (modalDesc) {
    modalDesc.innerHTML = `
      <strong>⚠️ APPROVAL REQUIRED</strong><br><br>
      This form will send a REQUEST to the administrator for approval to edit your profile.<br><br>
      <strong>NO changes will be made immediately.</strong> You must wait for admin approval first.<br><br>
      <strong>⏰ EXPIRATION TIMES:</strong><br>
      • Request expires in 10 minutes if not approved<br>
      • Approval expires in 10 minutes after admin grants it<br><br>
      Fill in the fields below with your desired changes and click "Submit Request".
    `;
  }

  if (activeRequestField === 'photo') {
    if (textRequestArea) textRequestArea.classList.add("hidden");
    if (photoRequestArea) photoRequestArea.classList.remove("hidden");
    if (multiFieldForm) multiFieldForm.classList.add("hidden");
  } else if (activeRequestField === 'details') {
    if (textRequestArea) textRequestArea.classList.remove("hidden");
    if (photoRequestArea) photoRequestArea.classList.add("hidden");
    if (multiFieldForm) {
      multiFieldForm.classList.remove("hidden");

      // Load colleges and populate dropdowns
      await loadCollegesForDropdown();

      // Update labels to show existing values and prepopulate fields
      const phoneLabel = document.querySelector('label[for="reqPhoneInput"]');
      const deptLabel = document.querySelector('label[for="reqDeptInput"]');
      const collegeNameLabel = document.querySelector('label[for="reqCollegeNameSelect"]');
      const collegeIdLabel = document.querySelector('label[for="reqCollegeIdSelect"]');

      // Update Phone field
      if (reqPhoneInput) {
        reqPhoneInput.value = me.phone || "";
        if (phoneLabel) {
          phoneLabel.innerHTML = me.phone ?
            `Update Phone Number <span style="color: #10b981; font-size: 12px;">(Current: ${me.phone})</span>` :
            `Update Phone Number <span style="color: #ef4444; font-size: 12px;">(Not set)</span>`;
        }
      }

      // Update Department field
      if (reqDeptInput) {
        reqDeptInput.value = me.department || "";
        if (deptLabel) {
          deptLabel.innerHTML = me.department ?
            `Update Department <span style="color: #10b981; font-size: 12px;">(Current: ${me.department})</span>` :
            `Update Department <span style="color: #ef4444; font-size: 12px;">(Not set)</span>`;
        }
      }

      // Update College Name dropdown
      const reqCollegeNameSelect = document.getElementById("reqCollegeNameSelect");
      if (reqCollegeNameSelect && collegeNameLabel) {
        collegeNameLabel.innerHTML = me.collegeName ?
          `Update College Name <span style="color: #10b981; font-size: 12px;">(Current: ${me.collegeName})</span>` :
          `Update College Name <span style="color: #ef4444; font-size: 12px;">(Not set)</span>`;
      }

      // Update College ID dropdown
      const reqCollegeIdSelect = document.getElementById("reqCollegeIdSelect");
      if (reqCollegeIdSelect && collegeIdLabel) {
        collegeIdLabel.innerHTML = me.collegeId ?
          `Update College ID <span style="color: #10b981; font-size: 12px;">(Current: ${me.collegeId})</span>` :
          `Update College ID <span style="color: #ef4444; font-size: 12px;">(Not set)</span>`;
      }
    }
    if (newFieldValue) newFieldValue.classList.add("hidden");
  } else {
    if (textRequestArea) textRequestArea.classList.remove("hidden");
    if (photoRequestArea) photoRequestArea.classList.add("hidden");
    if (multiFieldForm) multiFieldForm.classList.add("hidden");
    if (newFieldValue) {
      newFieldValue.classList.remove("hidden");
      newFieldValue.value = "";
    }
  }
  if (requestModal) requestModal.classList.remove("hidden");
}

// (+) Button logic
if (addRequestBtn) {
  addRequestBtn.onclick = () => {
    openRequestModal('details', 'Modification Request');
  };
}

// Avatar click logic - Open photo update modal
if (reqPhotoBtn) {
  reqPhotoBtn.onclick = () => {
    if (photoUpdateModal) photoUpdateModal.classList.remove("hidden");

    // Check if photo update is approved (unlocked)
    if (me.pendingUnlock_photo) {
      // Admin approved - show photo selection with timer
      if (photoSelectionArea) photoSelectionArea.style.display = "block";
      if (photoApprovalTimer) {
        photoApprovalTimer.style.display = "block";

        // Start real-time countdown timer
        if (window.photoTimerInterval) clearInterval(window.photoTimerInterval);
        window.photoTimerInterval = setInterval(() => {
          const approvedAt = me.pendingUnlock_photo_at?.toDate?.()?.getTime() || 0;
          const currentTime = new Date().getTime();
          const expiryMs = 5 * 60 * 1000;
          const remaining = Math.max(0, expiryMs - (currentTime - approvedAt));

          if (remaining > 0) {
            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            if (photoTimerText) photoTimerText.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          } else {
            // Timer expired
            if (photoTimerText) photoTimerText.innerText = "Expired";
            if (photoApprovalTimer) {
              photoApprovalTimer.style.background = "#fee2e2";
              photoApprovalTimer.style.borderColor = "#ef4444";
            }
            clearInterval(window.photoTimerInterval);
            alert("Photo upload approval has expired. Please request again.");
            if (photoUpdateModal) photoUpdateModal.classList.add("hidden");
          }
        }, 1000);
      }
    } else {
      // Not approved yet - show request button only
      if (photoSelectionArea) photoSelectionArea.style.display = "none";
      if (photoApprovalTimer) photoApprovalTimer.style.display = "none";
    }

    selectedPhotoFile = null;
    if (savePhotoUpdate) savePhotoUpdate.disabled = true;
    if (photoPreviewImg) photoPreviewImg.style.display = "none";
    if (photoPlaceholder) photoPlaceholder.style.display = "flex";
  };
}

// Request Photo Button - Submit request for approval first
if (requestPhotoBtn) {
  requestPhotoBtn.onclick = async () => {
    try {
      requestPhotoBtn.disabled = true;
      requestPhotoBtn.innerText = "Sending Request...";

      // Get GPS location
      let gps = null;
      try {
        const pos = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 });
        });
        gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (err) {
        console.warn("GPS failed", err);
      }

      // Submit profile update request for approval
      await addDoc(collection(db, "profileUpdateRequests"), {
        uid: me.uid,
        name: me.name,
        role: me.role,
        type: 'photo',
        newValue: 'Photo Update Request',
        details: null,
        status: "pending",
        gps: gps,
        requestedAt: serverTimestamp(),
        department: me.department || null
      });

      alert("Photo update request sent successfully! You'll be able to upload your photo once admin approves.");
      if (photoUpdateModal) photoUpdateModal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert("Failed to send request: " + err.message);
    } finally {
      requestPhotoBtn.disabled = false;
      requestPhotoBtn.innerText = "Request Photo Update";
    }
  };
}

// Photo Update Modal - File selection
if (photoUpdateInput) {
  photoUpdateInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (re) => {
      if (photoPreviewImg) {
        photoPreviewImg.src = re.target.result;
        photoPreviewImg.style.display = "block";
      }
      if (photoPlaceholder) photoPlaceholder.style.display = "none";
      if (savePhotoUpdate) savePhotoUpdate.disabled = false;
    };
    reader.readAsDataURL(file);
  };
}

// Photo Update Modal - Save button (Submit for approval)
if (savePhotoUpdate) {
  savePhotoUpdate.onclick = async () => {
    if (!selectedPhotoFile) return;

    try {
      savePhotoUpdate.disabled = true;
      savePhotoUpdate.innerText = "Uploading...";

      const reader = new FileReader();
      reader.onload = async (re) => {
        try {
          // Update photo and clear the unlock flag
          await updateDoc(doc(db, "users", me.uid), {
            photoURL: re.target.result,
            pendingUnlock_photo: false
          });

          alert("Photo updated successfully!");
          if (photoUpdateModal) photoUpdateModal.classList.add("hidden");
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert("Failed to update photo: " + err.message);
          savePhotoUpdate.disabled = false;
          savePhotoUpdate.innerText = "Upload Photo";
        }
      };
      reader.readAsDataURL(selectedPhotoFile);
    } catch (err) {
      console.error(err);
      alert("Failed to process photo");
      savePhotoUpdate.disabled = false;
      savePhotoUpdate.innerText = "Upload Photo";
    }
  };
}

// Photo Update Modal - Cancel button
if (cancelPhotoUpdate) {
  cancelPhotoUpdate.onclick = () => {
    if (photoUpdateModal) photoUpdateModal.classList.add("hidden");
    selectedPhotoFile = null;
    if (window.photoTimerInterval) clearInterval(window.photoTimerInterval);
  };
}

// Photo Update Modal - Close button
if (closePhotoModal) {
  closePhotoModal.onclick = () => {
    if (photoUpdateModal) photoUpdateModal.classList.add("hidden");
    selectedPhotoFile = null;
    if (window.photoTimerInterval) clearInterval(window.photoTimerInterval);
  };
}

if (cancelModal) {
  cancelModal.onclick = () => {
    if (requestModal) requestModal.classList.add("hidden");
    activeRequestField = null;
    currentProfilePhotoBase64 = null;
  };
}

if (profilePhotoInput) {
  profilePhotoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      currentProfilePhotoBase64 = re.target.result;
      if (photoPreview) photoPreview.innerText = `Selected: ${file.name}`;
    };
    reader.readAsDataURL(file);
  };
}

if (submitRequestBtn) {
  submitRequestBtn.onclick = async () => {
    try {
      submitRequestBtn.disabled = true;
      submitRequestBtn.innerText = "Processing...";

      let gps = null;
      try {
        const pos = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 });
        });
        gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (err) {
        console.warn("GPS failed", err);
      }

      let newValue = activeRequestField === 'photo' ? currentProfilePhotoBase64 : null;
      let detailsUpdate = null;

      if (activeRequestField === 'details') {
        const reqCollegeNameSelect = document.getElementById("reqCollegeNameSelect");
        const reqCollegeIdSelect = document.getElementById("reqCollegeIdSelect");

        detailsUpdate = {
          phone: reqPhoneInput.value.trim(),
          department: reqDeptInput.value.trim(),
          collegeName: reqCollegeNameSelect ? reqCollegeNameSelect.value.trim() : "",
          collegeId: reqCollegeIdSelect ? reqCollegeIdSelect.value.trim() : ""
        };
        newValue = "Multi-Field Update";
      } else if (activeRequestField !== 'photo') {
        newValue = newFieldValue.value.trim();
      }

      if (!newValue && !detailsUpdate) { alert("Enter details"); return; }

      await addDoc(collection(db, "profileUpdateRequests"), {
        uid: me.uid,
        name: me.name,
        role: me.role,
        type: activeRequestField,
        newValue: newValue,
        details: detailsUpdate,
        status: "pending",
        gps: gps,
        requestedAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        department: me.department || null
      });
      alert("✅ APPROVAL REQUEST SENT!\n\nYour request has been sent to the administrator for approval.\n\n⏰ IMPORTANT: This request will expire in 10 minutes if not approved.\n\nYou will be notified when approved and can then make your changes.");
      if (requestModal) requestModal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert("Failed");
    } finally {
      submitRequestBtn.disabled = false;
      submitRequestBtn.innerText = "Submit Request";
    }
  };
}

if (savePhoneBtn) {
  savePhoneBtn.onclick = async () => {
    const newVal = phoneEditInput.value.trim();
    if (!newVal) return;
    try {
      await updateDoc(doc(db, "users", me.uid), { phone: newVal, pendingUnlock_phone: false });
      alert("Updated");
      window.location.reload();
    } catch (err) { console.error(err); }
  };
}

if (saveDetailsBtn) {
  saveDetailsBtn.onclick = async () => {
    const newPhone = phoneDetailEditInput.value.trim();
    const newDept = deptEditInput.value.trim();
    if (!newDept) return;
    try {
      saveDetailsBtn.disabled = true;
      await updateDoc(doc(db, "users", me.uid), {
        phone: newPhone,
        department: newDept,
        pendingUnlock_details: false
      });
      alert("Details updated and re-locked.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed");
    } finally {
      saveDetailsBtn.disabled = false;
    }
  };
}
// Add Profile Info Button - Main + button functionality
if (addProfileInfoBtn) {
  addProfileInfoBtn.onclick = () => {
    openRequestModal('details', 'Profile Information Update');
  };
}

// Quick Action Buttons
const quickUpdatePhone = document.getElementById('quickUpdatePhone');
const quickUpdateDept = document.getElementById('quickUpdateDept');
const quickUpdatePhoto = document.getElementById('quickUpdatePhoto');

if (quickUpdatePhone) {
  quickUpdatePhone.onclick = () => {
    openRequestModal('phone', 'Phone Number Update');
  };
}

if (quickUpdateDept) {
  quickUpdateDept.onclick = () => {
    openRequestModal('department', 'Department Update');
  };
}

if (quickUpdatePhoto) {
  quickUpdatePhoto.onclick = () => {
    if (photoUpdateModal) photoUpdateModal.classList.remove("hidden");

    // Check if photo update is approved (unlocked)
    if (me.pendingUnlock_photo) {
      if (photoSelectionArea) photoSelectionArea.style.display = "block";
      if (photoApprovalTimer) {
        photoApprovalTimer.style.display = "block";

        if (window.photoTimerInterval) clearInterval(window.photoTimerInterval);
        window.photoTimerInterval = setInterval(() => {
          const approvedAt = me.pendingUnlock_photo_at?.toDate?.()?.getTime() || 0;
          const currentTime = new Date().getTime();
          const expiryMs = 5 * 60 * 1000;
          const remaining = Math.max(0, expiryMs - (currentTime - approvedAt));

          if (remaining > 0) {
            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            if (photoTimerText) photoTimerText.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          } else {
            if (photoTimerText) photoTimerText.innerText = "Expired";
            if (photoApprovalTimer) {
              photoApprovalTimer.style.background = "#fee2e2";
              photoApprovalTimer.style.borderColor = "#ef4444";
            }
            clearInterval(window.photoTimerInterval);
            alert("Photo upload approval has expired. Please request again.");
            if (photoUpdateModal) photoUpdateModal.classList.add("hidden");
          }
        }, 1000);
      }
    } else {
      if (photoSelectionArea) photoSelectionArea.style.display = "none";
      if (photoApprovalTimer) photoApprovalTimer.style.display = "none";
    }

    selectedPhotoFile = null;
    if (savePhotoUpdate) savePhotoUpdate.disabled = true;
    if (photoPreviewImg) photoPreviewImg.style.display = "none";
    if (photoPlaceholder) photoPlaceholder.style.display = "flex";
  };
}

// Add hover effects for quick action buttons
document.addEventListener('DOMContentLoaded', function () {
  const quickButtons = document.querySelectorAll('#quickUpdatePhone, #quickUpdateDept, #quickUpdatePhoto');
  quickButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('mouseenter', function () {
        this.style.background = 'rgba(255, 255, 255, 0.3)';
        this.style.transform = 'translateY(-2px)';
      });

      btn.addEventListener('mouseleave', function () {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
        this.style.transform = 'translateY(0)';
      });
    }
  });

  // Add hover effect for main + button
  const addProfileInfoBtn = document.getElementById('addProfileInfoBtn');
  if (addProfileInfoBtn) {
    addProfileInfoBtn.addEventListener('mouseenter', function () {
      this.style.background = '#059669';
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
    });

    addProfileInfoBtn.addEventListener('mouseleave', function () {
      this.style.background = '#10b981';
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
    });
  }
});

// Load staff profile data and generate content
async function loadStaffProfile() {
  console.log("loadStaffProfile called, me:", me);
  try {
    if (!me) {
      console.log("No me data available");
      return;
    }

    const profileContent = document.getElementById("profileContent");
    if (!profileContent) {
      console.log("No profileContent element found");
      return;
    }

    console.log("Generating staff profile HTML...");

    // Create clean and modern staff profile design
    const profileHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        
        <!-- Profile Header Card -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 32px; margin-bottom: 24px; color: white; position: relative; overflow: hidden;">
          <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
          <div style="position: absolute; bottom: -30px; left: -30px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
          
          <div style="display: flex; align-items: center; gap: 24px; position: relative; z-index: 2;">
            <div style="position: relative;">
              <img src="${me.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ffffff' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='40' fill='%23667eea'%3E" + (me.name ? me.name.charAt(0).toUpperCase() : "S") + "%3C/text%3E%3C/svg%3E"}" 
                   style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
              
              <!-- Camera Icon -->
              <button onclick="requestPhotoChange()" 
                      style="position: absolute; bottom: -5px; right: -5px; background: #10b981; color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); transition: all 0.2s; border: 3px solid white;"
                      onmouseover="this.style.background='#059669'; this.style.transform='scale(1.1)'"
                      onmouseout="this.style.background='#10b981'; this.style.transform='scale(1)'"
                      title="Change Profile Picture">
                📷
              </button>
            </div>
            
            <div style="flex: 1;">
              <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 800; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${me.name || "Staff Member"}</h1>
              <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); color: white; padding: 8px 16px; border-radius: 25px; font-size: 14px; font-weight: 600; display: inline-block; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">${me.role || "STAFF"}</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981;"></div>
                <span style="color: rgba(255,255,255,0.9); font-weight: 500; font-size: 14px;">Active</span>
              </div>
            </div>
            
            <!-- Edit Button -->
            <button onclick="requestProfileEdit()" 
                    style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); color: white; border: 2px solid rgba(255,255,255,0.3); padding: 12px 20px; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: 8px;"
                    onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'"
                    title="Edit Profile Information">
              <span style="font-size: 16px;">✏️</span> Edit Profile
            </button>
          </div>
        </div>

        <!-- Information Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 24px;">
          
          <!-- Personal Information Card -->
          <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">👤</div>
              <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 700;">Personal Information</h3>
            </div>
            
            <div style="space-y: 16px;">
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Full Name</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">${me.name || "Not provided"}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Email Address</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6; word-break: break-all;">${me.email || "Not provided"}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Phone Number</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">${me.phone || "Not provided"}</div>
              </div>
            </div>
          </div>

          <!-- Work Information Card -->
          <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
              <div style="background: linear-gradient(135deg, #10b981, #059669); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">🏢</div>
              <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 700;">Work Information</h3>
            </div>
            
            <div style="space-y: 16px;">
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">College Name</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">${me.collegeName || "Not assigned"}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">College ID</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">${me.collegeId || "Not assigned"}</div>
              </div>

              <div id="collegeCodeContainer" style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">College Code</div>
                <div id="profileCollegeCode" style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">${me.collegeCode || "Loading..."}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Department</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">${me.department || "Not assigned"}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Staff ID</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">${me.staffId || "Not assigned"}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Joined On</div>
                <div style="font-size: 16px; font-weight: 600; color: #1e293b; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">${me.createdAt ? (me.createdAt.toDate ? me.createdAt.toDate() : new Date(me.createdAt.seconds * 1000)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "Unknown"}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Important Notice -->
        <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 16px; padding: 20px; color: white; position: relative; overflow: hidden;">
          <div style="position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
          <div style="display: flex; align-items: center; gap: 16px; position: relative; z-index: 2;">
            <div style="background: rgba(255,255,255,0.2); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔒</div>
            <div>
              <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">Security & Approval Policy</div>
              <div style="font-size: 14px; line-height: 1.5; opacity: 0.95;">
                All profile changes require administrator approval and expire in 10 minutes. Click the camera icon or "Edit Profile" button to request permission.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    console.log("Setting staff profile HTML...");
    profileContent.innerHTML = profileHTML;
    console.log("Staff profile loaded successfully");

    // Fallback: If collegeCode is missing, fetch it
    if (me.collegeId && !me.collegeCode) {
      getDoc(doc(db, "colleges", me.collegeId)).then(collegeSnap => {
        if (collegeSnap.exists()) {
          const code = collegeSnap.data().code || "N/A";
          const codeEl = document.getElementById("profileCollegeCode");
          if (codeEl) codeEl.innerText = code;
          // Cache it for the current session data
          me.collegeCode = code;
        }
      }).catch(err => {
        console.warn("Error fetching college code fallback:", err);
        const codeEl = document.getElementById("profileCollegeCode");
        if (codeEl) codeEl.innerText = "N/A";
      });
    } else if (!me.collegeId) {
      const container = document.getElementById("collegeCodeContainer");
      if (container) container.style.display = "none";
    }

  } catch (err) {
    console.error("loadStaffProfile error:", err);
    const profileContent = document.getElementById("profileContent");
    if (profileContent) {
      profileContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #ef4444;"><h3>⚠️ Error Loading Profile</h3><p>Unable to load profile information. Please refresh the page.</p></div>';
    }
  }
}

// Load colleges for dropdown selection
async function loadCollegesForDropdown() {
  try {
    const reqCollegeNameSelect = document.getElementById("reqCollegeNameSelect");
    const reqCollegeIdSelect = document.getElementById("reqCollegeIdSelect");

    if (!reqCollegeNameSelect || !reqCollegeIdSelect) return;

    // Clear existing options
    reqCollegeNameSelect.innerHTML = '<option value="">Select College Name</option>';
    reqCollegeIdSelect.innerHTML = '<option value="">Select College ID</option>';

    // Load colleges from Firestore
    const collegesSnapshot = await getDocs(collection(db, "colleges"));
    const colleges = [];

    collegesSnapshot.forEach(doc => {
      const collegeData = doc.data();
      colleges.push({
        id: doc.id,
        name: collegeData.name,
        ...collegeData
      });
    });

    // Sort colleges by name
    colleges.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Populate college name dropdown
    colleges.forEach(college => {
      const option = document.createElement("option");
      option.value = college.name;
      option.textContent = `${college.name} (ID: ${college.id})`;
      if (me.collegeName === college.name) {
        option.selected = true;
      }
      reqCollegeNameSelect.appendChild(option);
    });

    // Populate college ID dropdown
    colleges.forEach(college => {
      const option = document.createElement("option");
      option.value = college.id;
      option.textContent = `${college.id} - ${college.name}`;
      if (me.collegeId === college.id) {
        option.selected = true;
      }
      reqCollegeIdSelect.appendChild(option);
    });

    // Add change event listeners to sync selections
    reqCollegeNameSelect.addEventListener('change', function () {
      const selectedCollege = colleges.find(c => c.name === this.value);
      if (selectedCollege) {
        reqCollegeIdSelect.value = selectedCollege.id;
      }
    });

    reqCollegeIdSelect.addEventListener('change', function () {
      const selectedCollege = colleges.find(c => c.id === this.value);
      if (selectedCollege) {
        reqCollegeNameSelect.value = selectedCollege.name;
      }
    });

  } catch (error) {
    console.error("Error loading colleges:", error);

    // Fallback to text inputs if loading fails
    const reqCollegeNameSelect = document.getElementById("reqCollegeNameSelect");
    const reqCollegeIdSelect = document.getElementById("reqCollegeIdSelect");

    if (reqCollegeNameSelect) {
      reqCollegeNameSelect.innerHTML = '<option value="">Error loading colleges</option>';
    }
    if (reqCollegeIdSelect) {
      reqCollegeIdSelect.innerHTML = '<option value="">Error loading colleges</option>';
    }
  }
}

// Request Admin Permission functionality - Use event delegation
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'requestPermBtn') {
    console.log("Request permission button clicked via delegation!");
    e.preventDefault();
    window.openPermissionRequestModal();
  }
});

// Also try direct approach when DOM loads
document.addEventListener('DOMContentLoaded', function () {
  console.log("DOM loaded, looking for requestPermBtn...");

  // Try to find the button immediately
  const requestPermBtn = document.getElementById('requestPermBtn');
  console.log("requestPermBtn found immediately:", requestPermBtn);

  // Also try after a delay to account for dynamic content
  setTimeout(() => {
    const delayedBtn = document.getElementById('requestPermBtn');
    console.log("requestPermBtn found after delay:", delayedBtn);

    if (delayedBtn && !delayedBtn.hasAttribute('data-listener-added')) {
      console.log("Adding direct click listener to requestPermBtn");
      delayedBtn.setAttribute('data-listener-added', 'true');
      delayedBtn.addEventListener('click', function (e) {
        console.log("Request permission button clicked directly!");
        e.preventDefault();
        window.openPermissionRequestModal();
      });
    }
  }, 1000);
});

// Check for existing permission requests on load
async function checkExistingPermissionRequests() {
  if (!me || !auth.currentUser) return;

  try {
    // Check if user has admin permissions by checking their role and permissions
    // Instead of querying permissionRequests collection, check user's current permissions
    const userDoc = await getDoc(doc(db, 'users', me.uid || auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const hasAdminPermission = userData.adminPermission === true || userData.role === 'admin' || userData.role === 'super-admin';

      if (hasAdminPermission) {
        updatePermissionStatus('approved', 'admin');
      } else {
        updatePermissionStatus('none');
      }
    }

  } catch (error) {
    console.error('Error checking user permissions:', error);
    // If there's an error, assume no special permissions
    updatePermissionStatus('none');
  }
}

// Update permission status display
function updatePermissionStatus(status, permissionType = null) {
  const permStatusText = document.getElementById('permStatusText');
  const hodProfileArea = document.getElementById('hodProfileArea');

  if (permStatusText && hodProfileArea) {
    // Show for all staff roles, not just HODs
    hodProfileArea.classList.remove('hidden');

    let typeText = '';
    if (permissionType) {
      switch (permissionType) {
        case 'registrations':
          typeText = ' (REGISTRATIONS)';
          break;
        case 'profile':
          typeText = ' (PROFILE UPDATES)';
          break;
        case 'both':
          typeText = ' (REGISTRATIONS & PROFILE)';
          break;
      }
    }

    switch (status) {
      case 'pending':
        permStatusText.textContent = `⏳ PERMISSION REQUEST: PENDING ADMIN REVIEW${typeText}`;
        permStatusText.style.color = '#f59e0b';
        break;
      case 'approved':
        permStatusText.textContent = `✅ PERMISSION: APPROVED${typeText}`;
        permStatusText.style.color = '#10b981';
        break;
      case 'denied':
        permStatusText.textContent = `❌ PERMISSION: DENIED${typeText}`;
        permStatusText.style.color = '#ef4444';
        break;
      default:
        permStatusText.textContent = '📋 REQUEST ADMIN PERMISSION TO PERFORM ACTIONS';
        permStatusText.style.color = '#64748b';
    }
  }
}


// Add this to the existing auth state change handler to check permission requests after user is loaded
function initializePermissionCheck() {
  if (me && auth.currentUser) {
    checkExistingPermissionRequests();
  }
}
// Add hover effects and better styling for the request permission button
document.addEventListener('DOMContentLoaded', function () {
  const requestPermBtn = document.getElementById('requestPermBtn');
  if (requestPermBtn) {
    // Add hover effects
    requestPermBtn.addEventListener('mouseenter', function () {
      this.style.background = '#2563eb';
      this.style.transform = 'translateY(-1px)';
      this.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
    });

    requestPermBtn.addEventListener('mouseleave', function () {
      this.style.background = '#3b82f6';
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = 'none';
    });

    requestPermBtn.addEventListener('mousedown', function () {
      this.style.transform = 'translateY(0)';
    });
  }
});

// Debug: Confirm function is available
console.log("DEBUG: openPermissionRequestModal function available:", typeof window.openPermissionRequestModal);
console.log("DEBUG: All window functions:", Object.keys(window).filter(key => key.includes('Permission')));

// Add event listener for the request permission button
document.addEventListener('DOMContentLoaded', function () {
  const requestPermBtn = document.getElementById('requestPermBtn');
  if (requestPermBtn) {
    requestPermBtn.addEventListener('click', function () {
      console.log("Request permission button clicked");
      if (typeof window.openPermissionRequestModal === 'function') {
        window.openPermissionRequestModal();
      } else {
        console.error("openPermissionRequestModal function not found");
        alert("Permission request function not available. Please refresh the page.");
      }
    });
    console.log("Event listener added to request permission button");
  } else {
    console.log("Request permission button not found");
  }
});

// Create a simple global function as backup
window.requestAdminPermission = function () {
  console.log("requestAdminPermission called as backup");
  if (typeof window.openPermissionRequestModal === 'function') {
    window.openPermissionRequestModal();
  } else {
    alert("Permission request function not available. Please refresh the page.");
  }
};
