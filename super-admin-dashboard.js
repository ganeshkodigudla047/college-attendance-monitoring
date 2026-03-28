import { auth, db } from "./firebase.js";
import { initAutoLogout } from "./auto-logout.js";

import {
	onAuthStateChanged,
	signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
	collection,
	getDocs,
	getDoc,
	doc,
	updateDoc,
	deleteDoc,
	setDoc,
	addDoc,
	serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
// Additional functions used in notifications
import { query, where, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Global variables for multi-college support
let currentUser = null;
let currentUserData = null;
let currentCollegeId = null;
let currentCollegeName = null;

// Helper function to check if a user is a super admin
function isSuperAdmin(role) {
	if (!role) return false;
	const r = role.toLowerCase();
	return r === 'superadmin' || r === 'super-admin';
}

// Helper: silently ignore Firebase offline errors
function _isOfflineError(err) {
	return err?.code === 'unavailable' ||
		err?.message?.includes('offline') ||
		err?.message?.includes('client is offline') ||
		err?.message?.includes('Failed to get document because the client is offline');
}

// Helper function to get college-filtered query
function getCollegeFilteredQuery(collectionName, additionalFilters = []) {
	let q = collection(db, collectionName);

	// Add college filter if user is not super admin
	if (currentUserData && !isSuperAdmin(currentUserData.role)) {
		q = query(q, where("collegeId", "==", currentCollegeId), ...additionalFilters);
	} else if (additionalFilters.length > 0) {
		q = query(q, ...additionalFilters);
	}

	return q;
}


/* ================= LOADING SCREEN FUNCTIONS ================= */

function showLoading(message = 'Loading...') {
	const loadingScreen = document.getElementById('loadingScreen');
	const loadingStatus = document.getElementById('loadingStatus');
	if (loadingScreen) {
		loadingScreen.classList.remove('fade-out');
		loadingScreen.style.display = 'flex';
		document.body.style.overflow = 'hidden';
	}
	if (loadingStatus && message) {
		loadingStatus.textContent = message;
	}
}

function hideLoading() {
	const loadingScreen = document.getElementById('loadingScreen');
	if (loadingScreen) {
		loadingScreen.classList.add('fade-out');
		document.body.style.overflow = '';
		setTimeout(() => {
			loadingScreen.style.display = 'none';
		}, 300);
	}
}

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

	// Early Morning / Dawn (5 AM - 6 AM)
	if (hour >= 5 && hour < 6) {
		greeting = 'Good Early Morning!';
		subtext = 'The day is just beginning. Time to start fresh!';
		icon = '🌄';
		background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
		textColor = '#ffffff';
		elements = [
			{ top: '-80px', right: '-60px', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' },
			{ bottom: '-100px', left: '-50px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)' },
			{ top: '40%', left: '30%', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }
		];
	}
	// Morning (6 AM - 12 PM)
	else if (hour >= 6 && hour < 12) {
		greeting = 'Good Morning!';
		subtext = 'Rise and shine! Here\'s what\'s happening today.';
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
	// Evening / Sunset (5 PM - 8 PM)
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
	// Night (8 PM - 5 AM) - Dark with stars
	else {
		greeting = 'Good Night!';
		subtext = 'Working late? Don\'t forget to rest when you can.';
		icon = '🌙';
		background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)';
		textColor = '#ffffff';
		elements = [
			// Stars effect
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

	// Apply changes with smooth transition
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
		greetingBlock.style.color = textColor;
	}

	// Update decorative orbs/stars
	if (bgElement1 && elements[0]) Object.assign(bgElement1.style, elements[0]);
	if (bgElement2 && elements[1]) Object.assign(bgElement2.style, elements[1]);
	if (bgElement3 && elements[2]) Object.assign(bgElement3.style, elements[2]);
	
	// Add more stars for night time
	if (hour >= 20 || hour < 5) {
		// Create additional star elements if they don't exist
		for (let i = 3; i < elements.length; i++) {
			const starId = `bgElement${i + 1}`;
			let starElement = document.getElementById(starId);
			
			if (!starElement) {
				starElement = document.createElement('div');
				starElement.id = starId;
				starElement.className = 'sa-greeting-orb';
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
	setInterval(updateTimeBasedGreeting, 60000); // Update every minute
});

// Global state for filtering
let allAdmins = [];
let allColleges = [];
let allUsers = [];
let currentUserFilter = 'all';


/* ================= ELEMENTS ================= */

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");
const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
const notifyBtn = document.getElementById("notifyBtn");
const notifyList = document.getElementById("notifyList");
const currentTime = document.getElementById("currentTime");
const currentDate = document.getElementById("currentDate");
const currentDay = document.getElementById("currentDay");
const adminName = document.getElementById("adminName");
const adminRole = document.getElementById("adminRole");
const sidebarAdminName = document.getElementById("sidebarAdminName");
const sidebarAdminRole = document.getElementById("sidebarAdminRole");

const welcome = document.getElementById("welcome");
const holidayStatus = document.getElementById("holidayStatus");

// System-wide statistics elements
const totalColleges = document.getElementById("totalColleges");
const activeColleges = document.getElementById("activeColleges");
const totalSystemUsers = document.getElementById("totalSystemUsers");
const totalCollegeAdmins = document.getElementById("totalCollegeAdmins");
const pendingCount = document.getElementById("pendingCount");
const systemHealthPercent = document.getElementById("systemHealthPercent");
const notifyCount = document.getElementById("notifyCount");

const currentSession = document.getElementById("currentSession");
const timeLeft = document.getElementById("timeLeft");
const fnTiming = document.getElementById("fnTiming");
const anTiming = document.getElementById("anTiming");
const timingStatusBadge = document.getElementById("timingStatusBadge");
const gpsStatusBadge = document.getElementById("gpsStatusBadge");

const approvalTable = document.getElementById("approvalTable");
const selectAll = document.getElementById("selectAll");
const recentActivityBody = document.getElementById("recentActivityBody");
const systemInfo = document.getElementById("systemInfo");
const settingsStatus = document.getElementById("settingsStatus");

// Profile Update Elements
const showRegistrations = document.getElementById("showRegistrations");
const showProfileUpdates = document.getElementById("showProfileUpdates");
const registrationApprovalsView = document.getElementById("registrationApprovalsView");
const profileUpdatesView = document.getElementById("profileUpdatesView");
const profileUpdateTable = document.getElementById("profileUpdateTable");
const hodProfileApprovalToggle = document.getElementById("hodProfileApprovalToggle");
const saveSecuritySettings = document.getElementById("saveSecuritySettings");
const profileUpdateSearch = document.getElementById("profileUpdateSearch");

// Invite Elements
const inviteEmail = document.getElementById("inviteEmail");
const inviteRole = document.getElementById("inviteRole");
const inviteCollege = document.getElementById("inviteCollege");
const inviteCollegeField = document.getElementById("inviteCollegeField");
const sendInviteBtn = document.getElementById("sendInviteBtn");
const inviteStatusMessage = document.getElementById("inviteMessage");
const invitesTableBody = document.getElementById("invitesTableBody");
const refreshInvitesBtn = document.getElementById("refreshInvitesBtn");
const clearAllInvitesBtn = document.getElementById("clearAllInvitesBtn");

let pendingApprovals = [];
let pendingPerms = [];
let pendingProfileRequests = [];
let pendingManualRequests = [];
const _dismissedNotifyIds = new Set(); // tracks bell-dismissed items (session only)
let notifyUsersUnsub = null;
let notifyPermsUnsub = null;
let notifyProfileUnsub = null;
let notifyManualUnsub = null;
let attendanceRecords = [];
let lastDateAdmin = "";
let navStack = []; // Added for multi-level Back navigation

function renderNotifyList() {
	if (!notifyList) return;
	const rows = [];

	// Filter out dismissed items
	const visibleApprovals = pendingApprovals.filter(u => !_dismissedNotifyIds.has('approval_' + u.id));
	const visiblePerms = pendingPerms.filter(p => !_dismissedNotifyIds.has('perm_' + p.id));
	const visibleProfile = pendingProfileRequests.filter(r => !_dismissedNotifyIds.has('profile_' + r.id));
	const visibleManual = pendingManualRequests.filter(m => !_dismissedNotifyIds.has('manual_' + m.id));

	// Add Clear All button at the top
	if (visibleApprovals.length > 0 || visiblePerms.length > 0 || visibleProfile.length > 0 || visibleManual.length > 0) {
		rows.push(`<button id="clearAllInList" class="notify-clear-btn" type="button">Clear All</button>`);
	}

	visibleApprovals.forEach(u => rows.push(`<div class="notify-item" data-type="approval" data-id="${u.id}">Approval: ${escapeHtml(u.name)}</div>`));
	visiblePerms.forEach(p => rows.push(`<div class="notify-item" data-type="permission" data-id="${p.id}">Permission: ${escapeHtml(p.label)}</div>`));
	visibleProfile.forEach(r => rows.push(`<div class="notify-item" data-type="profileUpdate" data-id="${r.id}">Profile Update: ${escapeHtml(r.name)}</div>`));
	visibleManual.forEach(m => rows.push(`<div class="notify-item" data-type="manualAttendance" data-id="${m.id}">Manual Attendance: ${escapeHtml(m.name)}</div>`));

	if (rows.length === 0) notifyList.innerHTML = '<div class="notify-item">No notifications</div>';
	else notifyList.innerHTML = rows.join('');
	notifyList.setAttribute('aria-hidden', 'false');

	// Attach Clear All button handler if it exists
	const clearBtn = document.getElementById('clearAllInList');
	if (clearBtn) {
		clearBtn.onclick = clearAllNotifications;
	}

	// Attach click handlers to notification items
	notifyList.querySelectorAll('.notify-item[data-type]').forEach(item => {
		item.onclick = () => {
			const type = item.dataset.type;
			notifyList.classList.add('hidden');

			if (type === 'approval') {
				showSection('approvals');
				// Switch to registrations tab
				const regTab = document.getElementById('showRegistrations');
				if (regTab) regTab.click();
			} else if (type === 'permission') {
				showSection('approvals');
				// Switch to permissions tab
				const permTab = document.getElementById('showPermissions');
				if (permTab) permTab.click();
			} else if (type === 'profileUpdate') {
				showSection('approvals');
				// Switch to profile updates tab
				const profileTab = document.getElementById('showProfileUpdates');
				if (profileTab) profileTab.click();
			} else if (type === 'manualAttendance') {
				showSection('approvals');
				// Switch to manual attendance tab
				const manualTab = document.getElementById('showManualAttendance');
				if (manualTab) manualTab.click();
			}
		};
	});

	// update bell count — exclude dismissed items
	const total = (pendingApprovals.filter(u => !_dismissedNotifyIds.has('approval_' + u.id)).length)
		+ (pendingPerms.filter(p => !_dismissedNotifyIds.has('perm_' + p.id)).length)
		+ (pendingProfileRequests.filter(r => !_dismissedNotifyIds.has('profile_' + r.id)).length)
		+ (pendingManualRequests.filter(m => !_dismissedNotifyIds.has('manual_' + m.id)).length);
	if (notifyCount) {
		safeSet(notifyCount, total);
		if (total === 0) notifyCount.classList.add('hidden'); else notifyCount.classList.remove('hidden');
	}
}

function startNotifyListeners() {
	// avoid double subscribing
	if (notifyUsersUnsub || notifyPermsUnsub) return;

	// users snapshot for pending approvals
	try {
		notifyUsersUnsub = onSnapshot(collection(db, 'users'), snap => {
			const items = [];
			snap.forEach(d => {
				const u = d.data();
				if (!u.approved) items.push({ id: d.id, name: u.name || u.email || '-' });
			});
			pendingApprovals = items;
			renderNotifyList();
		}, err => {
			console.error('users onSnapshot error', err);
		});
	} catch (e) {
		console.error('startNotifyListeners users error', e);
	}

	// permissionRequests snapshot for pending permissions
	try {
		const permQ = query(collection(db, 'permissionRequests'), where('status', '==', 'pending'));
		notifyPermsUnsub = onSnapshot(permQ, snap => {
			const items = [];
			snap.forEach(d => {
				const p = d.data();
				items.push({ id: d.id, label: p.staffName || p.role || 'Permission request' });
			});
			pendingPerms = items;
			renderNotifyList();
		}, err => {
			console.error('perm onSnapshot error', err);
		});
	} catch (e) {
		console.error('startNotifyListeners perms error', e);
	}

	// profileUpdateRequests snapshot
	try {
		const profileQ = query(collection(db, 'profileUpdateRequests'), where('status', 'in', ['pending', 'hod_verified']));
		notifyProfileUnsub = onSnapshot(profileQ, snap => {
			const items = [];
			snap.forEach(d => {
				const r = d.data();
				items.push({ id: d.id, name: r.name || 'User' });
			});
			pendingProfileRequests = items;
			renderNotifyList();
			renderProfileUpdateTable();
		}, err => {
			console.error('profile snapshot error', err);
		});
	} catch (e) {
		console.error('startNotifyListeners profile error', e);
	}

	// manualRequests snapshot
	try {
		const manualQ = query(collection(db, 'manualRequests'), where('status', '==', 'pending'));
		notifyManualUnsub = onSnapshot(manualQ, snap => {
			const items = [];
			snap.forEach(d => {
				const m = d.data();
				items.push({ id: d.id, name: m.name || 'Student' });
			});
			pendingManualRequests = items;
			renderNotifyList();
		}, err => {
			console.error('manual requests snapshot error', err);
		});
	} catch (e) {
		console.error('startNotifyListeners manual error', e);
	}
}

function stopNotifyListeners() {
	if (typeof notifyUsersUnsub === 'function') { notifyUsersUnsub(); notifyUsersUnsub = null; }
	if (typeof notifyPermsUnsub === 'function') { notifyPermsUnsub(); notifyPermsUnsub = null; }
	if (typeof notifyProfileUnsub === 'function') { notifyProfileUnsub(); notifyProfileUnsub = null; }
	if (typeof notifyManualUnsub === 'function') { notifyManualUnsub(); notifyManualUnsub = null; }
}

const settingsToggle = document.getElementById("settingsToggle");
const settingsSubmenu = document.getElementById("settingsSubmenu");

// Table selectors
const staffTable = document.getElementById("staffTable");
const staffSearch = document.getElementById("staffSearch");
const studentsTable = document.getElementById("studentsTable");
const studentSearch = document.getElementById("studentSearch");
const studentDeptFilter = document.getElementById("studentDeptFilter");
const studentYearFilter = document.getElementById("studentYearFilter");
const approveSelected = document.getElementById("approveSelected");
const rejectSelected = document.getElementById("rejectSelected");
const approvalSearch = document.getElementById("approvalSearch");

const detailsSection = document.getElementById("detailsSection");
const detailsTitle = document.getElementById("detailsTitle");
const detailsInfo = document.getElementById("detailsInfo");
const detailsSearch = document.getElementById("detailsSearch");
const detailsHead = document.getElementById("detailsHead");
const detailsBody = document.getElementById("detailsBody");
const approvals = document.getElementById("approvals");
const staff = document.getElementById("staff");

const attendanceSearch = document.getElementById("attendanceSearch");
const attendanceCollegeFilter = document.getElementById("attendanceCollegeFilter");
const yearFilter = document.getElementById("yearFilter");
const attendanceDateFilter = document.getElementById("attendanceDateFilter");
const attendanceSessionFilter = document.getElementById("attendanceSessionFilter");
const attendanceStatusFilter = document.getElementById("attendanceStatusFilter");
const downloadCSV = document.getElementById("downloadCSV");
const attTable = document.getElementById("attTable");

const fnStart = document.getElementById("fnStart");
const fnEnd = document.getElementById("fnEnd");
const anStart = document.getElementById("anStart");
const anEnd = document.getElementById("anEnd");
const saveTiming = document.getElementById("saveTiming");

const lat = document.getElementById("lat");
const lng = document.getElementById("lng");
const radius = document.getElementById("radius");
const saveGPS = document.getElementById("saveGPS");

const holidayDate = document.getElementById("holidayDate");
const holidayReason = document.getElementById("holidayReason");
const addHoliday = document.getElementById("addHoliday");
const holidayMode = document.getElementById("holidayMode");
const holidayStart = document.getElementById("holidayStart");
const holidayEnd = document.getElementById("holidayEnd");
const singleHoliday = document.getElementById("singleHoliday");
const rangeHoliday = document.getElementById("rangeHoliday");

const academicStartDate = document.getElementById("academicStartDate");
const academicEndDate = document.getElementById("academicEndDate");
const saveAcademicYear = document.getElementById("saveAcademicYear");
const loadCurrentAcademicYear = document.getElementById("loadCurrentAcademicYear");
const academicYearCollegeSelect = document.getElementById("academicYearCollegeSelect");
const refreshAcademicYearCollegeList = document.getElementById("refreshAcademicYearCollegeList");
const academicYearCollegeListBody = document.getElementById("academicYearCollegeListBody");
const statsStartDate = document.getElementById("statsStartDate");
const statsEndDate = document.getElementById("statsEndDate");
const loadDaysCount = document.getElementById("loadDaysCount");
const daysCountTable = document.getElementById("daysCountTable");

function isoDate(d) {
	return d.toISOString().slice(0, 10);
}

// Helper to safely set text or html if element exists
function safeSet(el, val, type = 'text') {
	if (!el) return;
	if (type === 'html') el.innerHTML = val;
	else el.innerText = val;
}

// Toggle holiday inputs based on mode
if (holidayMode) {
	holidayMode.onchange = () => {
		const m = holidayMode.value;
		if (m === 'single') {
			singleHoliday.classList.remove('hidden');
			rangeHoliday.classList.add('hidden');
		} else {
			singleHoliday.classList.add('hidden');
			rangeHoliday.classList.remove('hidden');
		}
	};
}

// Helper: escape HTML to avoid XSS when inserting user-provided strings
function escapeHtml(str) {
	if (str === undefined || str === null) return "-";
	return String(str)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", "&#39;");
}

// Update time and date display
function updateTimeAndDate() {
	const now = new Date();
	const dateStr = now.toDateString();

	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	if (currentTime) currentTime.innerText = `${hours}:${minutes}:${seconds}`;

	const dayNum = String(now.getDate()).padStart(2, '0');
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const year = now.getFullYear();
	if (currentDate) currentDate.innerText = `${dayNum}/${month}/${year}`;

	const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	if (currentDay) currentDay.innerText = days[now.getDay()];

	// Refresh activity at midnight
	if (lastDateAdmin !== "" && lastDateAdmin !== dateStr) {
		renderRecentActivity();
	}
	lastDateAdmin = dateStr;
}

// Update user info in header and sidebar
function updateUserInfo(user) {
	const name = user.name || user.email || 'Admin';
	const role = user.role ? user.role.toUpperCase() : 'ADMINISTRATOR';

	if (adminName) adminName.innerText = name;
	if (adminRole) adminRole.innerText = role;

	if (sidebarAdminName) sidebarAdminName.innerText = name;
	if (sidebarAdminRole) sidebarAdminRole.innerText = role;
}



/* ================= MENU ================= */

const sidebarOverlay = document.getElementById("sidebarOverlay");

menuBtn.onclick = () => {
	sidebar.classList.toggle("show");
	sidebarOverlay.classList.toggle("show");
};

document.addEventListener('mousemove', (e) => {
	if (!sidebar || !sidebarOverlay) return;
	if (window.innerWidth <= 768) return;
	if (sidebar.classList.contains('show')) return;
	if (e.clientX <= 18) {
		sidebar.classList.add("show");
		sidebarOverlay.classList.add("show");
	}
});

// Close sidebar when clicking overlay
if (sidebarOverlay) {
	sidebarOverlay.onclick = () => {
		sidebar.classList.remove("show");
		sidebarOverlay.classList.remove("show");
	};
}

if (sidebar) {
	sidebar.onmouseleave = () => {
		sidebar.classList.remove("show");
		if (sidebarOverlay) sidebarOverlay.classList.remove("show");
	};
}

document.addEventListener('click', (e) => {
	if (!sidebar || !menuBtn || !sidebar.classList.contains('show')) return;
	if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
		closeSidebar();
	}
});

// Close sidebar when navigating to a section
function closeSidebar() {
	sidebar.classList.remove("show");
	sidebarOverlay.classList.remove("show");
}

/* ================= SETTINGS DROPDOWN ================= */

settingsToggle.onclick = () => {
	const isHidden = settingsSubmenu.classList.toggle("hidden");
	settingsSubmenu.setAttribute('aria-hidden', isHidden);
};

// Helper function to close all settings submenus
function closeAllSettingsSubmenus() {
	const submenus = [
		{ menu: basicSettingsSubmenu, toggle: basicSettingsToggle },
		{ menu: advancedSettingsSubmenu, toggle: advancedSettingsToggle },
		{ menu: emailSettingsSubmenu, toggle: emailSettingsToggle }
	];
	
	submenus.forEach(({ menu, toggle }) => {
		if (menu && toggle) {
			menu.classList.add("hidden");
			const arrow = toggle.querySelector('span:last-child');
			if (arrow) arrow.textContent = '▼';
		}
	});
}

// Basic Settings Toggle
const basicSettingsToggle = document.getElementById("basicSettingsToggle");
const basicSettingsSubmenu = document.getElementById("basicSettingsSubmenu");

if (basicSettingsToggle && basicSettingsSubmenu) {
	basicSettingsToggle.onclick = (e) => {
		e.stopPropagation();
		
		// Check if this submenu is currently open
		const wasHidden = basicSettingsSubmenu.classList.contains("hidden");
		
		// Close all submenus first
		closeAllSettingsSubmenus();
		
		// If it was hidden, open it (accordion behavior)
		if (wasHidden) {
			basicSettingsSubmenu.classList.remove("hidden");
			const arrow = basicSettingsToggle.querySelector('span:last-child');
			if (arrow) arrow.textContent = '▲';
		}
	};
}

// Advanced Settings Toggle
const advancedSettingsToggle = document.getElementById("advancedSettingsToggle");
const advancedSettingsSubmenu = document.getElementById("advancedSettingsSubmenu");

if (advancedSettingsToggle && advancedSettingsSubmenu) {
	advancedSettingsToggle.onclick = (e) => {
		e.stopPropagation();
		
		// Check if this submenu is currently open
		const wasHidden = advancedSettingsSubmenu.classList.contains("hidden");
		
		// Close all submenus first
		closeAllSettingsSubmenus();
		
		// If it was hidden, open it (accordion behavior)
		if (wasHidden) {
			advancedSettingsSubmenu.classList.remove("hidden");
			const arrow = advancedSettingsToggle.querySelector('span:last-child');
			if (arrow) arrow.textContent = '▲';
		}
	};
}

// Email Settings Toggle
const emailSettingsToggle = document.getElementById("emailSettingsToggle");
const emailSettingsSubmenu = document.getElementById("emailSettingsSubmenu");

if (emailSettingsToggle && emailSettingsSubmenu) {
	emailSettingsToggle.onclick = (e) => {
		e.stopPropagation();
		
		// Check if this submenu is currently open
		const wasHidden = emailSettingsSubmenu.classList.contains("hidden");
		
		// Close all submenus first
		closeAllSettingsSubmenus();
		
		// If it was hidden, open it (accordion behavior)
		if (wasHidden) {
			emailSettingsSubmenu.classList.remove("hidden");
			const arrow = emailSettingsToggle.querySelector('span:last-child');
			if (arrow) arrow.textContent = '▲';
		}
	};
}



/* ================= SECTION NAVIGATION ================= */

function showSection(id, isBack = false) {
	// Clear nav stack if this is a fresh navigation from sidebar (not a back action)
	if (!isBack) {
		navStack = [];
	}

	document.querySelectorAll(".section")
		.forEach(sec => sec.classList.remove("active"));

	const target = document.getElementById(id);
	if (target) target.classList.add("active");

	// Auto-load data based on section
	switch (id) {
		case 'home':
			if (typeof loadStats === 'function') loadStats();
			if (typeof loadSystemActivity === 'function') loadSystemActivity();
			break;
		case 'adminlist':
			if (typeof window.loadAdminDirectory === 'function') window.loadAdminDirectory().then(() => initAllCustomSelects());
			break;
		case 'collegelist':
			if (typeof window.loadCollegeDirectory === 'function') window.loadCollegeDirectory().then(() => initAllCustomSelects());
			break;
		case 'userlist':
			if (typeof window.loadUserCategories === 'function') window.loadUserCategories().then(() => initAllCustomSelects());
			break;
		case 'approvals':
			if (typeof loadApprovals === 'function') loadApprovals().then(() => initAllCustomSelects());
			break;
		case 'attendance':
			if (typeof loadAttendance === 'function') loadAttendance().then(() => initAllCustomSelects());
			break;
		case 'messages':
			if (typeof loadMessages === 'function') loadMessages();
			break;
		case 'invite':
			if (typeof loadPendingInvites === 'function') loadPendingInvites();
			if (typeof loadInviteColleges === 'function') loadInviteColleges();
			break;
		case 'profile':
			if (typeof loadAdminProfile === 'function') loadAdminProfile();
			break;
		case 'settings':
			if (typeof loadSecuritySettings === 'function') loadSecuritySettings();
			break;
		case 'dayscount':
			if (typeof initializeAcademicYearManagement === 'function') initializeAcademicYearManagement();
			break;
		case 'bgaudit':
			if (typeof loadBgAudit === 'function') loadBgAudit();
			break;
		case 'superadminbg':
			if (typeof loadSuperAdminBg === 'function') loadSuperAdminBg();
			break;
		case 'admanage':
			if (typeof loadAdSlot === 'function') loadAdSlot();
			break;
		case 'platformbg':
			if (typeof loadPlatformBackground === 'function') loadPlatformBackground();
			break;
	}

	// Close sidebar on mobile
	closeSidebar();

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
		// Back-navigation from Home or start of history
		if (confirm("Are you sure you want to logout?")) {
			signOut(auth).then(() => {
				location = "login.html";
			});
		} else {
			// Stay on home
			history.pushState({ section: "home" }, "", "#home");
		}
	}
};

document.querySelectorAll("[data-sec]").forEach(btn => {
	btn.onclick = () => {
		showSection(btn.dataset.sec);
	};
});



/* ================= LOGOUT ================= */
let isLoggingOut = false;
const logoutOverlay = document.getElementById("logoutOverlay");
const confirmLogoutBtn = document.getElementById("confirmLogout");
const cancelLogoutBtn = document.getElementById("cancelLogout");

async function handleLogout(e) {
	if (e) {
		e.preventDefault();
		e.stopPropagation();
	}
	logoutOverlay.classList.remove("hidden");
}

if (cancelLogoutBtn) {
	cancelLogoutBtn.onclick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		logoutOverlay.classList.add("hidden");
	};
}

if (confirmLogoutBtn) {
	confirmLogoutBtn.onclick = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		
		// Prevent double-click logout
		if (isLoggingOut) return;
		isLoggingOut = true;
		
		// Disable button and show loading state
		confirmLogoutBtn.disabled = true;
		confirmLogoutBtn.style.opacity = '0.6';
		confirmLogoutBtn.innerText = 'Logging out...';
		
		try {
			await signOut(auth);
			location.replace("login.html");
		} catch (error) {
			console.error("Logout error:", error);
			alert("Error logging out. Please try again.");
			isLoggingOut = false;
			confirmLogoutBtn.disabled = false;
			confirmLogoutBtn.style.opacity = '1';
			confirmLogoutBtn.innerText = 'Logout';
		}
	};
}

if (logoutBtn) logoutBtn.onclick = handleLogout;
if (sidebarLogoutBtn) sidebarLogoutBtn.onclick = handleLogout;



/* ================= CLEAR ALL NOTIFICATIONS ================= */

async function clearAllNotifications() {
	// Just dismiss from the bell — do NOT approve users or delete requests
	pendingApprovals.forEach(u => _dismissedNotifyIds.add('approval_' + u.id));
	pendingPerms.forEach(p => _dismissedNotifyIds.add('perm_' + p.id));
	pendingProfileRequests.forEach(r => _dismissedNotifyIds.add('profile_' + r.id));
	pendingManualRequests.forEach(m => _dismissedNotifyIds.add('manual_' + m.id));

	renderNotifyList();
}



/* ================= BELL ================= */

// notifyList is kept up-to-date by realtime listeners (startNotifyListeners)

// Toggle the notify list; list is kept up-to-date by realtime listeners
notifyBtn.onclick = (e) => {
	e.stopPropagation();
	if (!notifyList) return;
	const isHidden = notifyList.classList.contains('hidden');
	if (isHidden) {
		notifyList.classList.remove('hidden');
	} else {
		notifyList.classList.add('hidden');
	}
};

// Close notification dropdown when clicking outside
document.addEventListener('click', (e) => {
	if (notifyList && !notifyList.classList.contains('hidden')) {
		if (!notifyBtn.contains(e.target)) {
			notifyList.classList.add('hidden');
		}
	}
});

// Clicking an item should open approvals and highlight that user
if (notifyList) {
	notifyList.addEventListener('click', async e => {
		const it = e.target.closest('.notify-item');
		if (!it) return;
		const uid = it.dataset.id;
		const type = it.dataset.type || 'approval';
		// hide list
		notifyList.classList.add('hidden');
		notifyList.setAttribute('aria-hidden', 'true');
		if (type === 'approval') {
			// verify user still pending approval
			try {
				const uSnap = await getDoc(doc(db, 'users', uid));
				const uData = uSnap.data();
				if (!uData || uData.approved) {
					// refresh list and inform user
					renderNotifyList();
					alert('This approval has already been handled');
					return;
				}
			} catch (err) {
				console.error('verify approval error', err);
			}
			// open approvals
			document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
			approvals.classList.add('active');
			// ensure approvals loaded, then find and focus the checkbox
			(async () => {
				await loadApprovals();
				setTimeout(() => {
					const cb = approvalTable.querySelector(`input.userCheck[value="${uid}"]`);
					if (cb) {
						const row = cb.closest('tr');
						if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
						cb.focus();
					}
				}, 200);
			})();
		} else if (type === 'permission') {
			// verify permission request still pending
			try {
				const permSnapCheck = await getDoc(doc(db, 'permissionRequests', uid));
				const permDataCheck = permSnapCheck.data();
				if (!permDataCheck || permDataCheck.status !== 'pending') {
					renderNotifyList();
					alert('This permission request has already been handled');
					return;
				}
			} catch (err) {
				console.error('verify permission error', err);
			}
			// Switch to approvals section and permission requests tab
			showSection('approvals');
			const permTab = document.getElementById('showPermissionRequests');
			if (permTab) permTab.click();
		} else if (type === 'profileUpdate') {
			// Redirect to approvals section and show profile updates
			document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
			const approvalsSec = document.getElementById("approvals");
			if (approvalsSec) approvalsSec.classList.add("active");

			if (showProfileUpdates) showProfileUpdates.click();
		}
	});
}



/* ================= AUTH ================= */

onAuthStateChanged(auth, async user => {
	// Show loading screen during authentication
	showLoading('Authenticating...');

	if (!user) {
		location = "login.html";
		return;
	}

	currentUser = user;

	try {
		// Update loading message
		showLoading('Loading your profile...');

		loadSecuritySettings();
		let snap;
		try {
			snap = await getDoc(doc(db, "users", user.uid));
		} catch (fetchErr) {
			if (_isOfflineError(fetchErr)) {
				// Try Firestore cache
				const { getDocFromCache } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
				try { snap = await getDocFromCache(doc(db, "users", user.uid)); } catch (_) {}
			}
			if (!snap) {
				hideLoading();
				alert('No internet connection. Please check your network and try again.');
				return;
			}
		}
		const me = snap.data();

		if (!me) {
			console.warn("User data not found in Firestore for UID:", user.uid);
			alert("User profile not found. Please contact support.");
			await signOut(auth);
			location = "login.html";
			return;
		}

		// Store user data and college information
		currentUserData = me;
		currentCollegeId = me.collegeId;

		// Super Admin doesn't belong to any college, so don't load college info
		// College information is only relevant for college-specific admins

		// Update header and sidebar with user info
		updateUserInfo(me);

		// Start updating time and date
		updateTimeAndDate();
		setInterval(updateTimeAndDate, 1000);

		const hour = new Date().getHours();

		let wish = "Good Evening 🌙";
		let emoji = "🌙";

		if (hour < 12) {
			wish = "Good Morning";
			emoji = "☀️";
		} else if (hour < 18) {
			wish = "Good Afternoon";
			emoji = "😊";
		}

		welcome.innerHTML =
			`<span>${wish} ${emoji}</span> <span style="font-size: 18px; font-weight: 600;">${escapeHtml(me.name)}</span> <span style="font-size: 14px; color: #666;">(${me.role.toUpperCase()})</span>`;

		// Update loading message
		if (typeof showLoading === 'function') {
			showLoading('Loading dashboard data...');
		}

		// Check and display holiday status
		await checkHolidayStatus();

		// Default date filter to today
		if (attendanceDateFilter && !attendanceDateFilter.value) {
			const now = new Date();
			attendanceDateFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		}

		loadStats();
		loadApprovals();
		loadAttendance();
		updateSessionInfo();
		updateSettingsStatus();
		startNotifyListeners();
		setupSystemActivityButtons();
		setupHomeQuickActions();

		// Load super admin's personal dashboard background
		loadSuperAdminBgFromFirestore().then(url => {
			if (url) import('./college-background.js').then(m => m.applyCollegeBackground(url));
		});

		// Load advertisement slot
		loadAdSlot();

		// Online presence tracking
		initPresence(user.uid);

		// Auto logout after 10 min idle
		initAutoLogout(() => signOut(auth), 'login.html', 60);

		// Pre-load invite colleges
		loadInviteColleges();

		// Update session time every second
		setInterval(updateSessionInfo, 1000);

		// Hide loading screen after everything is loaded
		setTimeout(() => {
			hideLoading();
		}, 800);

	} catch (error) {
		console.error('Error during initialization:', error);
		if (_isOfflineError(error)) {
			hideLoading();
			alert('No internet connection. Please check your network and refresh the page.');
		} else {
			alert('Error loading dashboard. Please try again.');
			hideLoading();
		}
	}

});



/* ================= DASHBOARD STATS ================= */

async function calculateTotalDays() {
	try {
		const academicYearCollegeId = await resolveAcademicYearCollegeId();
		if (!academicYearCollegeId) {
			safeSet(totalDaysAdmin, 0);
			return;
		}

		const academicYearDoc = await getDoc(getAcademicYearDocRef(academicYearCollegeId));

		let startDate, endDate;
		const today = new Date();

		if (academicYearDoc.exists()) {
			const data = academicYearDoc.data();
			startDate = new Date(data.startDate);
			endDate = new Date(data.endDate);

			// If today is beyond end date, use end date
			if (today > endDate) {
				endDate = new Date(endDate);
			} else {
				endDate = today;
			}
		} else {
			// Fallback to current month if no academic year set
			const currentYear = today.getFullYear();
			const currentMonth = today.getMonth();
			startDate = new Date(currentYear, currentMonth, 1);
			endDate = today;
		}

		// Fetch all holidays for the selected college
		const holidaysSnap = await getDocs(collection(db, "colleges", academicYearCollegeId, "holidays"));
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

		safeSet(totalDaysAdmin, workingDays);
	} catch (err) {
		console.error('calculateTotalDays error', err);
		safeSet(totalDaysAdmin, 0);
	}
}

function getAcademicYearDocRef(collegeId) {
	return doc(db, "colleges", collegeId, "settings", "academicYear");
}

async function ensureAcademicYearCollegesLoaded() {
	if (allColleges.length > 0) {
		return allColleges;
	}

	const collegesSnapshot = await getDocs(collection(db, "colleges"));
	allColleges = collegesSnapshot.docs.map(collegeDoc => ({
		id: collegeDoc.id,
		name: collegeDoc.data().name || "Unknown College"
	}));
	allColleges.sort((a, b) => a.name.localeCompare(b.name));
	return allColleges;
}

async function populateAcademicYearCollegeSelect(preferredCollegeId = "") {
	if (!academicYearCollegeSelect) return;

	const colleges = await ensureAcademicYearCollegesLoaded();
	const options = ['<option value="">Select a college</option>'];

	colleges.forEach(college => {
		options.push(`<option value="${escapeHtml(college.id)}">${escapeHtml(college.name)}</option>`);
	});

	safeSet(academicYearCollegeSelect, options.join(""), "html");

	const nextCollegeId = preferredCollegeId || academicYearCollegeSelect.dataset.selectedCollegeId || colleges[0]?.id || "";
	academicYearCollegeSelect.value = nextCollegeId;
	academicYearCollegeSelect.dataset.selectedCollegeId = nextCollegeId;
}

async function resolveAcademicYearCollegeId() {
	await populateAcademicYearCollegeSelect();
	return academicYearCollegeSelect?.value || "";
}

function formatAcademicYearTimestamp(value) {
	if (!value) return "-";

	try {
		const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
		if (Number.isNaN(date.getTime())) return "-";
		return date.toLocaleString();
	} catch (error) {
		console.warn("formatAcademicYearTimestamp error", error);
		return "-";
	}
}

async function loadAcademicYearList() {
	if (!academicYearCollegeListBody) return;

	try {
		const colleges = await ensureAcademicYearCollegesLoaded();

		if (colleges.length === 0) {
			safeSet(academicYearCollegeListBody, '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding: 24px;">No colleges found</td></tr>', 'html');
			return;
		}

		safeSet(academicYearCollegeListBody, '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding: 24px;">Loading college academic years...</td></tr>', 'html');

		const settingsDocs = await Promise.all(
			colleges.map(async college => ({
				college,
				snapshot: await getDoc(getAcademicYearDocRef(college.id))
			}))
		);

		const rows = settingsDocs.map(({ college, snapshot }, index) => {
			const data = snapshot.exists() ? snapshot.data() : {};
			return `
				<tr>
					<td>${index + 1}</td>
					<td><strong>${escapeHtml(college.name)}</strong></td>
					<td>${escapeHtml(data.startDate || "-")}</td>
					<td>${escapeHtml(data.endDate || "-")}</td>
					<td>${escapeHtml(formatAcademicYearTimestamp(data.updatedAt))}</td>
				</tr>
			`;
		}).join("");

		safeSet(academicYearCollegeListBody, rows, 'html');
	} catch (err) {
		console.error('loadAcademicYearList error', err);
		safeSet(academicYearCollegeListBody, '<tr><td colspan="5" style="text-align:center; color:#ef4444; padding: 24px;">Failed to load college academic years</td></tr>', 'html');
	}
}

async function initializeAcademicYearManagement() {
	try {
		const selectedCollegeId = academicYearCollegeSelect?.value || academicYearCollegeSelect?.dataset.selectedCollegeId || "";
		await populateAcademicYearCollegeSelect(selectedCollegeId);
		await loadAcademicYearList();
	} catch (err) {
		console.error('initializeAcademicYearManagement error', err);
	}
}

async function loadStats() {
	try {
		// System-wide statistics for Super Admin
		let totalCollegesCount = 0;
		let activeCollegesCount = 0;
		let totalUsersCount = 0;
		let collegeAdminsCount = 0;
		let pendingApprovalsCount = 0;

		// Load colleges data
		try {
			const collegesSnapshot = await getDocs(collection(db, "colleges"));
			totalCollegesCount = collegesSnapshot.size;
		} catch (err) {
			console.warn("Could not load colleges:", err);
		}

		// Load all users for system-wide statistics (and count active colleges = colleges with at least one user)
		const collegesWithUsers = new Set();
		try {
			const usersSnapshot = await getDocs(collection(db, "users"));
			// Total members exclude super admins
			totalUsersCount = 0;

			usersSnapshot.forEach(doc => {
				const user = doc.data();
				const role = (user.role || "").toLowerCase();

				// Skip super admins for system-wide statistics
				if (role === "superadmin" || role === "super-admin") {
					return;
				}

				totalUsersCount++;

				// Active colleges = colleges that have at least one user (currently using the system)
				if (user.collegeId) {
					collegesWithUsers.add(user.collegeId);
				}

				// Count pending approvals
				if (!user.approved) {
					pendingApprovalsCount++;
				}

				// Count college admins
				if (role === "admin" || role === "principal") {
					collegeAdminsCount++;
				}
			});
			activeCollegesCount = collegesWithUsers.size;
		} catch (err) {
			console.warn("Could not load users:", err);
		}

		// Count pending profile update requests
		try {
			const profileRequestsSnapshot = await getDocs(
				query(collection(db, "profileUpdateRequests"),
					where("status", "in", ["pending", "hod_verified"]))
			);
			pendingApprovalsCount += profileRequestsSnapshot.size;
		} catch (err) {
			console.warn("Could not load profile update requests:", err);
		}

		// Count pending permission requests
		try {
			const permRequestsSnapshot = await getDocs(
				query(collection(db, "permissionRequests"), where("status", "==", "pending"))
			);
			pendingApprovalsCount += permRequestsSnapshot.size;
		} catch (err) {
			console.warn("Could not load permission requests:", err);
		}

		// Update main statistics cards
		safeSet(totalColleges, totalCollegesCount);
		safeSet(activeColleges, activeCollegesCount);
		safeSet(totalSystemUsers, totalUsersCount);
		safeSet(totalCollegeAdmins, collegeAdminsCount);
		safeSet(pendingCount, pendingApprovalsCount);

		// Calculate system health percentage
		const healthPercentage = totalCollegesCount > 0 ?
			Math.round((activeCollegesCount / totalCollegesCount) * 100) : 100;
		safeSet(systemHealthPercent, `${healthPercentage}%`);

		// Load recent system activity (today only; clears for next day)
		await loadSystemActivity();

		// Home widgets (pending breakdown, calendar, attention, colleges at a glance, empty state)
		await loadHomeWidgets(totalCollegesCount);
	} catch (err) {
		if (!_isOfflineError(err)) console.error('loadStats error', err);
	}
}

const SYSTEM_ACTIVITY_CLEARED_KEY = "systemActivityCleared";

function getTodayDateString() {
	const n = new Date();
	return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function isClearedForToday() {
	try {
		const cleared = localStorage.getItem(SYSTEM_ACTIVITY_CLEARED_KEY);
		return cleared === getTodayDateString();
	} catch (e) {
		return false;
	}
}

function setClearedForToday() {
	try {
		localStorage.setItem(SYSTEM_ACTIVITY_CLEARED_KEY, getTodayDateString());
	} catch (e) {}
}

function clearClearedForToday() {
	try {
		localStorage.removeItem(SYSTEM_ACTIVITY_CLEARED_KEY);
	} catch (e) {}
}

async function loadSystemActivity() {
	if (!recentActivityBody) return;
	recentActivityBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Loading...</td></tr>";

	const today = getTodayDateString();
	const activities = [];
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

	function toTimeStr(timestamp) {
		if (!timestamp) return "Today";
		const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
		return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
	}
	function isToday(timestamp) {
		if (!timestamp) return false;
		const t = timestamp.toDate ? timestamp.toDate().getTime() : (timestamp.seconds || 0) * 1000;
		return t >= todayStart;
	}

	try {
		// User registrations today (createdAt)
		try {
			const usersSnap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(80)));
			usersSnap.forEach(docSnap => {
				const u = docSnap.data();
				const role = (u.role || "").toLowerCase();
				if (role === "superadmin" || role === "super-admin") return;
				const createdAt = u.createdAt;
				if (!isToday(createdAt)) return;
				activities.push({
					sortKey: createdAt?.toDate?.()?.getTime() ?? createdAt?.seconds * 1000 ?? 0,
					time: toTimeStr(createdAt),
					source: (u.collegeName || "System") + (u.role ? ` (${u.role})` : ""),
					activity: `User registered: ${u.name || u.email || "—"}`
				});
			});
		} catch (e) {
			console.warn("System activity: could not load users", e);
		}

		// Attendance marked today
		try {
			const attSnap = await getDocs(query(collection(db, "attendanceRecords"), where("date", "==", today)));
			const byCollege = {};
			attSnap.forEach(docSnap => {
				const r = docSnap.data();
				const cid = r.collegeId || "Unknown";
				if (!byCollege[cid]) byCollege[cid] = { count: 0, lastTs: r.timestamp };
				byCollege[cid].count++;
				if (r.timestamp && (!byCollege[cid].lastTs || (r.timestamp.toDate?.()?.getTime() > (byCollege[cid].lastTs?.toDate?.()?.getTime() || 0))))
					byCollege[cid].lastTs = r.timestamp;
			});
			Object.keys(byCollege).forEach(cid => {
				const x = byCollege[cid];
				const ts = x.lastTs;
				const t = ts?.toDate ? ts.toDate().getTime() : (ts?.seconds || 0) * 1000;
				activities.push({
					sortKey: t,
					time: ts ? toTimeStr(ts) : "Today",
					source: cid,
					activity: `Attendance marked: ${x.count} record(s) today`
				});
			});
		} catch (e) {
			console.warn("System activity: could not load attendance", e);
		}

		// Profile update requests (created today)
		try {
			const profileSnap = await getDocs(query(collection(db, "profileUpdateRequests"), where("status", "in", ["pending", "hod_verified"])));
			profileSnap.forEach(docSnap => {
				const r = docSnap.data();
				const createdAt = r.createdAt;
				if (!isToday(createdAt)) return;
				activities.push({
					sortKey: createdAt?.toDate?.()?.getTime() ?? (createdAt?.seconds || 0) * 1000,
					time: toTimeStr(createdAt),
					source: r.collegeName || "System",
					activity: `Profile update requested: ${r.name || r.userName || "—"}`
				});
			});
		} catch (e) {
			console.warn("System activity: could not load profile requests", e);
		}

		// Permission requests (created today)
		try {
			const permSnap = await getDocs(query(collection(db, "permissionRequests"), where("status", "==", "pending")));
			permSnap.forEach(docSnap => {
				const r = docSnap.data();
				const createdAt = r.createdAt;
				if (!isToday(createdAt)) return;
				activities.push({
					sortKey: createdAt?.toDate?.()?.getTime() ?? (createdAt?.seconds || 0) * 1000,
					time: toTimeStr(createdAt),
					source: r.collegeName || "System",
					activity: `Permission requested: ${r.userName || r.label || "—"}`
				});
			});
		} catch (e) {
			console.warn("System activity: could not load permission requests", e);
		}

		activities.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
		renderSystemActivity(activities.slice(0, 50));
	} catch (err) {
		console.error("Error loading system activity:", err);
		renderSystemActivity([], true);
	}
}

function renderSystemActivity(activities, isError) {
	if (!recentActivityBody) return;
	recentActivityBody.innerHTML = "";

	if (isError) {
		recentActivityBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Error loading activity.</td></tr>";
		return;
	}

	const list = activities || [];
	if (list.length === 0) {
		recentActivityBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No recent system activity today.</td></tr>";
		return;
	}

	list.forEach(activity => {
		const row = document.createElement("tr");
		row.innerHTML = `
			<td>${escapeHtml(activity.time)}</td>
			<td><strong>${escapeHtml(activity.source)}</strong></td>
			<td>${escapeHtml(activity.activity)}</td>
		`;
		recentActivityBody.appendChild(row);
	});
}

function setupSystemActivityButtons() {
	const refreshBtn = document.getElementById("systemActivityRefresh");
	if (refreshBtn) {
		refreshBtn.onclick = async () => {
			refreshBtn.disabled = true;
			refreshBtn.textContent = "…";
			await loadSystemActivity();
			refreshBtn.disabled = false;
			refreshBtn.textContent = "🔄 Refresh";
		};
	}
}

function goToApprovalsTab(tabButtonId) {
	showSection('approvals');
	setTimeout(() => {
		const tab = document.getElementById(tabButtonId);
		if (tab) tab.click();
	}, 100);
}

function setupHomeQuickActions() {
	const actionColleges = document.getElementById("saActionColleges");
	const actionInvite = document.getElementById("saActionInvite");
	const actionPending = document.getElementById("saActionPending");
	const actionAddCollege = document.getElementById("saActionAddCollege");
	const emptyAddCollege = document.getElementById("saEmptyAddCollege");
	if (actionColleges) actionColleges.onclick = () => showSection('collegelist');
	if (actionInvite) actionInvite.onclick = () => showSection('invite');
	if (actionPending) actionPending.onclick = () => goToApprovalsTab('showRegistrations');
	if (actionAddCollege) actionAddCollege.onclick = () => { if (currentUserData && ["superadmin", "SuperAdmin"].includes(currentUserData.role)) window.location.href = "college-management.html"; else alert("Super admin access required."); };
	if (emptyAddCollege) emptyAddCollege.onclick = () => { if (currentUserData && ["superadmin", "SuperAdmin"].includes(currentUserData.role)) window.location.href = "college-management.html"; else alert("Super admin access required."); };
}

function initializeAttendanceAuditCard() {
	if (systemInfo && !systemInfo.dataset.auditInitialized) {
		systemInfo.innerHTML = `
			<div id="attendanceAuditMeta" style="margin-bottom:16px; color:#64748b; font-size:13px; font-weight:600;">Today only. It resets automatically for the next day.</div>
			<div class="table-responsive">
				<table>
					<thead>
						<tr>
							<th>S.No</th>
							<th>College Name</th>
							<th>Session</th>
							<th>Session Timing</th>
							<th>Presents</th>
							<th>Absents</th>
							<th>Day Percentage</th>
						</tr>
					</thead>
					<tbody id="attendanceAuditBody">
						<tr>
							<td colspan="7" style="text-align:center; color:#94a3b8;">Loading attendance audit...</td>
						</tr>
					</tbody>
				</table>
			</div>
		`;
		systemInfo.dataset.auditInitialized = "true";
	}

	const configCard = settingsStatus?.closest(".sa-card");
	if (configCard) {
		configCard.style.display = "none";
	}
}

function getAuditLoadingMarkup(message = "Loading attendance audit for all colleges...") {
	return `
		<tr>
			<td colspan="7" style="padding: 24px;">
				<div style="display:flex; align-items:center; justify-content:center; gap:14px; padding:18px; border-radius:14px; background:transparent; border:1px solid rgba(255,255,255,0.15);">
					<div style="width:18px; height:18px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation: spin 0.8s linear infinite;"></div>
					<div style="text-align:left;">
						<div style="font-weight:700; color:#1e3a8a;">${escapeHtml(message)}</div>
						<div style="font-size:12px; color:#64748b; margin-top:2px;">Please wait while we collect today’s session status.</div>
					</div>
				</div>
			</td>
		</tr>
	`;
}

function getCollegeSessionState(timingData, defaultTimingData, isHoliday) {
	const fStart = timingData?.fnStart || timingData?.settings?.sessionTimings?.forenoon?.start || defaultTimingData?.fnStart || "00:00";
	const fEnd = timingData?.fnEnd || timingData?.settings?.sessionTimings?.forenoon?.end || defaultTimingData?.fnEnd || "23:59";
	const aStart = timingData?.anStart || timingData?.settings?.sessionTimings?.afternoon?.start || defaultTimingData?.anStart || "00:00";
	const aEnd = timingData?.anEnd || timingData?.settings?.sessionTimings?.afternoon?.end || defaultTimingData?.anEnd || "23:59";

	const toSeconds = (t) => {
		if (!t) return 0;
		const parts = t.split(':').map(Number);
		return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
	};

	const now = new Date();
	const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
	const fnStartSec = toSeconds(fStart);
	const fnEndSec = toSeconds(fEnd);
	const anStartSec = toSeconds(aStart);
	const anEndSec = toSeconds(aEnd);

	if (isHoliday) {
		return { code: "Holiday", label: "Holiday", timing: "Holiday", active: false };
	}
	if (nowSeconds >= fnStartSec && nowSeconds <= fnEndSec) {
		return { code: "FN", label: "FN", timing: `${fStart} - ${fEnd}`, active: true };
	}
	if (nowSeconds >= anStartSec && nowSeconds <= anEndSec) {
		return { code: "AN", label: "AN", timing: `${aStart} - ${aEnd}`, active: true };
	}
	if (nowSeconds > fnEndSec && nowSeconds < anStartSec) {
		return {
			code: "Between",
			label: "Waiting for AN",
			timing: `FN closed. AN starts at ${aStart}`,
			active: false
		};
	}
	if (nowSeconds < fnStartSec) {
		return {
			code: "BeforeFN",
			label: "Waiting for FN",
			timing: `FN starts at ${fStart}`,
			active: false
		};
	}
	return {
		code: "Closed",
		label: "Sessions Closed",
		timing: "Both FN and AN are closed for today",
		active: false
	};
}

async function loadAttendanceAudit() {
	const attendanceAuditBody = document.getElementById("attendanceAuditBody");
	const attendanceAuditMeta = document.getElementById("attendanceAuditMeta");
	if (!attendanceAuditBody) return;

	const auditDate = getTodayDateString();

	attendanceAuditBody.innerHTML = getAuditLoadingMarkup();

	try {
		const [settingsSnap, collegesSnap, usersSnap, attendanceSnap] = await Promise.all([
			getDoc(doc(db, "settings", "attendance")),
			getDocs(collection(db, "colleges")),
			getDocs(collection(db, "users")),
			getDocs(query(collection(db, "attendanceRecords"), where("date", "==", auditDate)))
		]);
		const defaultTimingData = settingsSnap.exists() ? settingsSnap.data() : {};
		if (attendanceAuditMeta) {
			attendanceAuditMeta.textContent = "Showing the current session status for every college today. Holidays stay closed automatically.";
		}
		safeSet(totalColleges, collegesSnap.size);

		const collegeMap = new Map();
		const collegeDataMap = new Map();
		collegesSnap.forEach(collegeDoc => {
			collegeMap.set(collegeDoc.id, collegeDoc.data().name || collegeDoc.id);
			collegeDataMap.set(collegeDoc.id, collegeDoc.data());
		});

		const approvedStudentsByCollege = new Map();
		const studentCollegeMap = new Map();
		usersSnap.forEach(userDoc => {
			const userData = userDoc.data();
			if ((userData.role || "").toLowerCase() !== "student" || !userData.approved) return;
			const collegeId = userData.collegeId || "unknown";
			approvedStudentsByCollege.set(collegeId, (approvedStudentsByCollege.get(collegeId) || 0) + 1);
			studentCollegeMap.set(userDoc.id, {
				collegeId: collegeId,
				collegeName: userData.collegeName || collegeMap.get(collegeId) || "Unknown College"
			});
			if (!collegeMap.has(collegeId)) {
				collegeMap.set(collegeId, userData.collegeName || collegeId);
			}
		});

		const attendanceByCollegeSession = new Map();
		attendanceSnap.forEach(attDoc => {
			const record = attDoc.data();
			const studentCollege = studentCollegeMap.get(record.studentUid);
			const collegeId = record.collegeId || studentCollege?.collegeId || "unknown";
			const collegeName = studentCollege?.collegeName || collegeMap.get(collegeId) || "Unknown College";
			const session = (record.session || "").toUpperCase();
			if (!["FN", "AN"].includes(session)) return;

			const key = `${collegeId}_${session}`;
			if (!attendanceByCollegeSession.has(key)) {
				attendanceByCollegeSession.set(key, {
					collegeId,
					collegeName,
					session,
					presentStudents: new Set()
				});
			}

			if ((record.status || "").toLowerCase() === "present" && record.studentUid) {
				attendanceByCollegeSession.get(key).presentStudents.add(record.studentUid);
			}
		});

		const [holidayResults, timingResults] = await Promise.all([
			Promise.all(
				Array.from(collegeMap.keys()).map(async (collegeId) => {
					try {
						const holidaySnap = await getDoc(doc(db, "colleges", collegeId, "holidays", auditDate));
						return [collegeId, holidaySnap.exists()];
					} catch (error) {
						console.warn("attendance holiday lookup error", collegeId, error);
						return [collegeId, false];
					}
				})
			),
			Promise.all(
				Array.from(collegeMap.keys()).map(async (collegeId) => {
					try {
						const timingSnap = await getDoc(doc(db, "colleges", collegeId, "settings", "attendance"));
						return [collegeId, timingSnap.exists() ? timingSnap.data() : null];
					} catch (error) {
						console.warn("attendance timing lookup error", collegeId, error);
						return [collegeId, null];
					}
				})
			)
		]);
		const holidayMap = new Map(holidayResults);
		const timingMap = new Map(timingResults);

		const collegeRows = [];
		Array.from(collegeMap.entries())
			.sort((a, b) => (collegeMap.get(a[0]) || a[0]).localeCompare(collegeMap.get(b[0]) || b[0]))
			.forEach(([collegeId, collegeName]) => {
				const timingData = timingMap.get(collegeId) || collegeDataMap.get(collegeId);
				const sessionState = getCollegeSessionState(timingData, defaultTimingData, holidayMap.get(collegeId));
				const totalStudents = approvedStudentsByCollege.get(collegeId) || 0;
				const entry = sessionState.active ? attendanceByCollegeSession.get(`${collegeId}_${sessionState.code}`) : null;
				const presents = sessionState.active ? (entry ? entry.presentStudents.size : 0) : "—";
				const absents = sessionState.active ? Math.max(0, totalStudents - presents) : "—";
				const percentage = sessionState.active && totalStudents > 0 ? ((Number(presents) / totalStudents) * 100).toFixed(1) : (sessionState.active ? "0.0" : "—");
				collegeRows.push({
					collegeName,
					session: sessionState.label,
					timing: sessionState.timing,
					presents: sessionState.active ? presents : "—",
					absents: sessionState.active ? absents : "—",
					percentage: sessionState.active ? percentage : "—"
				});
			});

		if (collegeRows.length === 0) {
			attendanceAuditBody.innerHTML = `
				<tr>
					<td colspan="7" style="padding: 24px;">
						<div style="text-align:center; padding:20px; border-radius:14px; background:transparent; border:1px solid rgba(255,255,255,0.15); color:#64748b; font-weight:600;">
							No college data available for the current session.
						</div>
					</td>
				</tr>
			`;
			return;
		}

		attendanceAuditBody.innerHTML = collegeRows.map((row, index) => `
				<tr>
					<td>${index + 1}</td>
					<td><strong>${escapeHtml(row.collegeName)}</strong></td>
					<td>${escapeHtml(row.session)}</td>
					<td>${escapeHtml(row.timing)}</td>
					<td style="color:#10b981; font-weight:600;">${row.presents}</td>
					<td style="color:#ef4444; font-weight:600;">${row.absents}</td>
					<td style="font-weight:700; color:${row.percentage === "—" ? '#64748b' : Number(row.percentage) >= 75 ? '#10b981' : Number(row.percentage) >= 50 ? '#f59e0b' : '#ef4444'};">${row.percentage === "—" ? row.percentage : `${row.percentage}%`}</td>
				</tr>
		`).join("");
	} catch (error) {
		if (!_isOfflineError(error)) console.error("loadAttendanceAudit error", error);
		if (attendanceAuditBody) attendanceAuditBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Failed to load attendance audit.</td></tr>';
	}
}

async function loadHomeWidgets(totalCollegesCountArg) {
	initializeAttendanceAuditCard();
	const totalEl = document.getElementById("totalColleges");
	const totalColleges = totalCollegesCountArg != null ? totalCollegesCountArg : (totalEl ? parseInt(totalEl.innerText, 10) : 0);
	const isNaNTotal = isNaN(totalColleges);
	const totalCollegesCount = isNaNTotal ? 0 : totalColleges;

	const emptyState = document.getElementById("saEmptyState");
	if (emptyState) emptyState.classList.toggle("hidden", totalCollegesCount > 0);

	// Pending breakdown (from in-memory listener data)
	const pendingWrap = document.getElementById("saPendingWrap");
	if (pendingWrap) {
		const r = pendingApprovals.length;
		const p = pendingPerms.length;
		const pr = pendingProfileRequests.length;
		const m = pendingManualRequests.length;
		const total = r + p + pr + m;
		if (total > 0) {
			pendingWrap.style.display = "grid";
			pendingWrap.innerHTML = `
				<div class="sa-pending-item">Registrations <a href="#" data-approval-tab="showRegistrations">View</a><span class="n">${r}</span></div>
				<div class="sa-pending-item">Profile updates <a href="#" data-approval-tab="showProfileUpdates">View</a><span class="n">${pr}</span></div>
				<div class="sa-pending-item">Permissions <a href="#" data-approval-tab="showPermissionRequests">View</a><span class="n">${p}</span></div>
				<div class="sa-pending-item">Manual attendance <a href="#" data-approval-tab="showManualAttendance">View</a><span class="n">${m}</span></div>
			`;
			pendingWrap.querySelectorAll("[data-approval-tab]").forEach(a => {
				a.onclick = (e) => { e.preventDefault(); goToApprovalsTab(a.getAttribute("data-approval-tab")); };
			});
		} else {
			pendingWrap.style.display = "none";
		}
	}

	// Calendar context (next holiday, academic year)
	const saCalendar = document.getElementById("saCalendar");
	if (saCalendar) {
		const parts = [];
		try {
			const holidaysSnap = await getDocs(collection(db, "holidays"));
			const today = getTodayDateString();
			let nextHoliday = null;
			holidaysSnap.forEach(d => {
				const dStr = d.id;
				if (dStr >= today && (nextHoliday == null || dStr < nextHoliday)) nextHoliday = dStr;
			});
			if (nextHoliday) {
				const data = holidaysSnap.docs.find(d => d.id === nextHoliday)?.data();
				const label = data?.reason || data?.name || "Holiday";
				parts.push(`Next holiday: <strong>${escapeHtml(nextHoliday)} (${escapeHtml(label)})</strong>`);
			}
			const academicYearCollegeId = await resolveAcademicYearCollegeId();
			const ayDoc = academicYearCollegeId ? await getDoc(getAcademicYearDocRef(academicYearCollegeId)) : null;
			if (ayDoc && ayDoc.exists()) {
				const d = ayDoc.data();
				if (d.startDate && d.endDate) parts.push(`Academic year: <strong>${escapeHtml(String(d.startDate).slice(0, 10))} – ${escapeHtml(String(d.endDate).slice(0, 10))}</strong>`);
			}
		} catch (e) { console.warn("Home calendar load:", e); }
		if (parts.length > 0) {
			saCalendar.style.display = "flex";
			saCalendar.innerHTML = parts.join(" &nbsp;·&nbsp; ");
		} else {
			saCalendar.style.display = "none";
		}
	}

	// Needs attention
	const attentionList = document.getElementById("saAttentionList");
	const attentionWrap = document.getElementById("saAttention");
	if (attentionList && attentionWrap) {
		const items = [];
		try {
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
			const sevenDaysStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;
			const collegesSnap = await getDocs(collection(db, "colleges"));
			const collegeIds = new Set(collegesSnap.docs.map(d => d.id));
			const attSnap = await getDocs(query(collection(db, "attendanceRecords"), where("date", ">=", sevenDaysStr)));
			const activeCollegeIds = new Set();
			attSnap.forEach(doc => { if (doc.data().collegeId) activeCollegeIds.add(doc.data().collegeId); });
			collegeIds.forEach(cid => {
				if (!activeCollegeIds.has(cid)) {
					const doc = collegesSnap.docs.find(d => d.id === cid);
					const name = doc?.data()?.name || cid;
					items.push({ type: "no_attendance", text: `College "${escapeHtml(name)}" has no attendance in the last 7 days`, link: "collegelist" });
				}
			});
			const usersSnap = await getDocs(collection(db, "users"));
			usersSnap.forEach(docSnap => {
				const u = docSnap.data();
				if (u.approved) return;
				const role = (u.role || "").toLowerCase();
				if (role === "superadmin" || role === "super-admin") return;
				const created = u.createdAt;
				if (!created) return;
				const t = created.toDate ? created.toDate().getTime() : (created.seconds || 0) * 1000;
				if (t < sevenDaysAgo.getTime()) items.push({ type: "old_pending", text: `User "${escapeHtml(u.name || u.email || "—")}" pending approval for 7+ days`, link: "approvals" });
			});
			collegesSnap.forEach(docSnap => {
				const c = docSnap.data();
				if (c.gpsSettings && c.settings) return;
				items.push({ type: "missing_config", text: `College "${escapeHtml(c.name || docSnap.id)}" needs setup (GPS/timing)`, link: "collegelist" });
			});
		} catch (e) { console.warn("Home needs attention load:", e); }
		attentionList.innerHTML = "";
		const icons = { no_attendance: "📊", old_pending: "👤", missing_config: "⚙️" };
		items.slice(0, 8).forEach(item => {
			const li = document.createElement("li");
			const icon = icons[item.type] || "•";
			const content = item.link
				? `<a href="#" class="sa-attention-link" data-sec="${item.link}">${item.text}</a>`
				: escapeHtml(item.text);
			li.innerHTML = `<span class="icon">${icon}</span><span class="text">${content}</span>`;
			if (item.link) {
				const a = li.querySelector("a");
				if (a) a.onclick = (e) => { e.preventDefault(); showSection(item.link); };
			}
			attentionList.appendChild(li);
		});
		attentionWrap.classList.toggle("empty", items.length === 0);
	}

	// Colleges at a glance (count users from users collection per college)
	const saCollegesBody = document.getElementById("saCollegesBody");
	if (saCollegesBody) {
		try {
			const collegesSnap = await getDocs(collection(db, "colleges"));
			const collegeList = collegesSnap.docs.slice(0, 15).map(d => ({ id: d.id, ...d.data() }));
			const usersSnap = await getDocs(collection(db, "users"));
			const usersByCollege = {};
			usersSnap.forEach(d => {
				const u = d.data();
				const role = (u.role || "").toLowerCase();
				if (role === "superadmin" || role === "super-admin") return;
				const cid = u.collegeId;
				if (cid) { usersByCollege[cid] = (usersByCollege[cid] || 0) + 1; }
			});
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
			const sevenDaysStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;
			let activeSet = new Set();
			try {
				const attSnap = await getDocs(query(collection(db, "attendanceRecords"), where("date", ">=", sevenDaysStr)));
				attSnap.forEach(d => { if (d.data().collegeId) activeSet.add(d.data().collegeId); });
			} catch (e) {}
			let html = "";
			collegeList.forEach(c => {
				const status = c.gpsSettings && c.settings ? "ok" : "warn";
				const statusText = c.gpsSettings && c.settings ? "Ready" : "Setup";
				const lastActivity = activeSet.has(c.id) ? "Active" : "—";
				const count = usersByCollege[c.id] ?? c.userCount ?? c.users;
				html += `<tr>
					<td>${escapeHtml(c.name || c.id)}</td>
					<td><span class="badge ${status}">${statusText}</span></td>
					<td>${count != null && count !== "" ? count : "0"}</td>
					<td>${lastActivity}</td>
					<td><span class="link" data-sec="collegelist">View</span></td>
				</tr>`;
			});
			if (collegeList.length === 0) html = "<tr><td colspan='5' style='text-align:center;color:#94a3b8;'>No colleges yet</td></tr>";
			saCollegesBody.innerHTML = html;
			saCollegesBody.querySelectorAll(".link[data-sec]").forEach(el => {
				el.onclick = () => showSection(el.getAttribute("data-sec"));
			});
		} catch (e) {
			console.warn("Home colleges load:", e);
			saCollegesBody.innerHTML = "<tr><td colspan='5' style='text-align:center;color:#94a3b8;'>Could not load</td></tr>";
		}
	}

	await loadAttendanceAudit();
}

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
		const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
		const isSunday = curr.getDay() === 0;
		const isHoliday = window.holidaysMap && window.holidaysMap[dateStr];

		// Only count working days (not Sunday, not holiday)
		if (!isSunday && !isHoliday) {
			workingDays++;
		}

		curr.setDate(curr.getDate() + 1);
	}

	const percent = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;
	const eligible = percent >= 75;

	return { percent: percent.toFixed(1), eligible };
}

/* ================= CHECK HOLIDAY STATUS ================= */

async function checkHolidayStatus() {
	try {
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

		let isHoliday = false;
		let holidayReason = '';

		// Check if Sunday
		if (dayOfWeek === 0) {
			isHoliday = true;
			holidayReason = '📅 Sunday - Weekly Holiday';
		} else {
			// Check holidays collection
			const holidayDoc = await getDoc(doc(db, "holidays", today));
			if (holidayDoc.exists()) {
				isHoliday = true;
				const reason = holidayDoc.data().reason || 'Holiday';
				holidayReason = `🎉 ${reason}`;
			}
		}

		if (holidayStatus) {
			if (isHoliday) {
				holidayStatus.innerHTML = `<span style="color:#28a745; font-weight:600;">${holidayReason}</span>`;
			} else {
				holidayStatus.innerHTML = `<span style="color:#666;">Working Day</span>`;
			}
		}

		return isHoliday;
	} catch (err) {
		if (_isOfflineError(err)) return false;
		console.error('checkHolidayStatus error', err);
		return false;
	}
}

/* ================= SESSION TIME ================= */

async function updateSessionInfo() {
	try {
		const sets = await getDoc(doc(db, "settings", "attendance"));
		if (!sets.exists()) return;

		const timingData = sets.data();
		const fStart = timingData.fnStart || "00:00";
		const fEnd = timingData.fnEnd || "23:59";
		const aStart = timingData.anStart || "00:00";
		const aEnd = timingData.anEnd || "23:59";

		// Populate inputs if they are empty (initial load)
		if (fnStart && !fnStart.value) fnStart.value = fStart;
		if (fnEnd && !fnEnd.value) fnEnd.value = fEnd;
		if (anStart && !anStart.value) anStart.value = aStart;
		if (anEnd && !anEnd.value) anEnd.value = aEnd;

		// Update Email Reminder timing display
		updateEmailReminderTiming(fEnd, aEnd);

		// Display FN and AN timings
		safeSet(fnTiming, `${fStart} to ${fEnd}`);
		safeSet(anTiming, `${aStart} to ${aEnd}`);

		// Convert HH:MM to seconds for precise comparison
		function toSeconds(t) {
			if (!t) return 0;
			const parts = t.split(':').map(Number);
			return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
		}

		const now = new Date();
		const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

		const fnStartSec = toSeconds(fStart);
		const fnEndSec = toSeconds(fEnd);
		const anStartSec = toSeconds(aStart);
		const anEndSec = toSeconds(aEnd);

		let sessionName = "🔒 Marking session is closed";
		let nextEndTime = null;
		let nextEndTimeStr = null;

		// Determine active session using SECONDS for precision
		if (nowSeconds >= fnStartSec && nowSeconds <= fnEndSec) {
			sessionName = "🌅 FN Active - Marking Available";
			nextEndTimeStr = fEnd;
		}
		else if (nowSeconds >= anStartSec && nowSeconds <= anEndSec) {
			sessionName = "🌤️ AN Active - Marking Available";
			nextEndTimeStr = aEnd;
		}
		// If FN has ended, check if we're waiting for AN
		else if (nowSeconds > fnEndSec) {
			if (nowSeconds < anStartSec) {
				sessionName = "🔒 FN ended · Please wait for AN session";
				nextEndTimeStr = aStart;
			} else if (nowSeconds > anEndSec) {
				sessionName = "🔒 AN ended · Wait for Tomorrow's session";
				nextEndTimeStr = fStart; // Target FN start for tomorrow
			}
		}
		// Before FN starts
		else if (nowSeconds < fnStartSec) {
			sessionName = "⏳ Marking will start at " + fStart + " - Please wait";
			nextEndTimeStr = fStart;
		}

		if (currentSession) currentSession.innerText = sessionName;

		// Always calculate time remaining to next event
		if (nextEndTimeStr) {
			const parts = nextEndTimeStr.split(':').map(Number);
			const endHour = parts[0] || 0;
			const endMin = parts[1] || 0;
			const endSec = parts[2] || 0;
			const nextEventSeconds = endHour * 3600 + endMin * 60 + endSec;

			// Determine if the target time is today or tomorrow
			let targetDate;
			if (sessionName.includes("Wait for Tomorrow")) {
				// Target is explicitly tomorrow
				targetDate = new Date(now);
				targetDate.setDate(targetDate.getDate() + 1);
				targetDate.setHours(endHour, endMin, endSec, 0);
			} else if (sessionName.includes("Wait for AN") || sessionName.includes("Wait for FN") || sessionName.includes("will start at")) {
				// For waiting states, check if target time has already passed today
				if (nextEventSeconds <= nowSeconds) {
					// Target passed today, so it's tomorrow
					targetDate = new Date(now);
					targetDate.setDate(targetDate.getDate() + 1);
					targetDate.setHours(endHour, endMin, endSec, 0);
				} else {
					// Target is later today
					targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin, endSec);
				}
			} else {
				// For active sessions, target is today
				targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin, endSec);
			}

			let remaining = targetDate - now;
			remaining = Math.max(0, remaining);

			const remainHours = Math.floor(remaining / (1000 * 60 * 60));
			const remainMins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
			const remainSecs = Math.floor((remaining % (1000 * 60)) / 1000);

			// Determine if we should show "starts in" or "left"
			const isWaiting = sessionName.includes("wait") || sessionName.includes("Wait") || sessionName.includes("will start");
			const timeLabel = isWaiting ? "starts in" : "left";
			const timeStr = `${String(remainHours).padStart(2, '0')}:${String(remainMins).padStart(2, '0')}:${String(remainSecs).padStart(2, '0')} ${timeLabel}`;
			if (timeLeft) timeLeft.innerText = timeStr;
		} else {
			if (timeLeft) timeLeft.innerText = "00:00:00 left";
		}
	} catch (err) {
		if (err?.code === 'unavailable' || err?.message?.includes('offline') || err?.message?.includes('client is offline')) {
			// Silently ignore — Firebase offline, will retry on reconnect
		} else {
			console.warn('updateSessionInfo error', err);
		}
	}
}

async function updateSettingsStatus() {
	try {
		const attDoc = await getDoc(doc(db, "settings", "attendance"));

		if (!attDoc.exists()) {
			if (gpsStatusBadge) gpsStatusBadge.innerHTML = '<span style="color:#dc3545; font-weight:600;">✗ Disabled</span>';
			if (timingStatusBadge) timingStatusBadge.innerHTML = '<span style="color:#dc3545; font-weight:600;">✗ Disabled</span>';
			return;
		}

		const data = attDoc.data();

		// Check GPS settings
		if (data.lat && data.lng && data.radius) {
			safeSet(gpsStatusBadge, '<span style="color:#28a745; font-weight:600;">✓ Enabled</span>', 'html');
		} else {
			safeSet(gpsStatusBadge, '<span style="color:#dc3545; font-weight:600;">✗ Disabled</span>', 'html');
		}

		// Check Timing settings
		if (data.fnStart && data.fnEnd && data.anStart && data.anEnd) {
			safeSet(timingStatusBadge, '<span style="color:#28a745; font-weight:600;">✓ Enabled</span>', 'html');
		} else {
			safeSet(timingStatusBadge, '<span style="color:#dc3545; font-weight:600;">✗ Disabled</span>', 'html');
		}
	} catch (err) {
		if (!_isOfflineError(err)) console.error('updateSettingsStatus error', err);
	}
}



/* ================= APPROVALS ================= */

async function loadApprovals() {

	try {
		safeSet(approvalTable, "", "html");
		let i = 1;
		const snap = await getDocs(collection(db, "users"));
		let rows = "";
		snap.forEach(d => {
			const u = d.data();
			if (!u.approved) {
				const name = escapeHtml(u.name || "-");
				const email = escapeHtml(u.email || "-");
				const role = escapeHtml(u.role || "-");
				rows += `\n<tr onclick=\"openUserDetails('${d.id}')\">\n<td>\n<input type="checkbox" class="userCheck" value="${d.id}" onclick="event.stopPropagation()">\n</td>\n<td>${i++}</td>\n<td class="clickable-name">${name}</td>\n<td>${email}</td>\n<td>${role}</td>\n<td>\n<button type=\"button\" onclick=\"event.stopPropagation(); approveUser('${d.id}')\">Approve</button>\n<button type=\"button\" onclick=\"event.stopPropagation(); rejectUser('${d.id}')\">Reject</button>\n</td>\n</tr>\n`;
			}
		});
		safeSet(approvalTable, rows, "html");
	} catch (err) {
		console.error('loadApprovals error', err);
		safeSet(approvalTable, '<tr><td colspan="6">Failed to load approvals</td></tr>', "html");
	}

}


/* SELECT ALL */

if (selectAll) {
	selectAll.onclick = () => {
		document.querySelectorAll(".userCheck")
			.forEach(cb => {
				cb.checked = selectAll.checked;
			});
	};
}



/* BULK APPROVE */

if (approveSelected) {
	approveSelected.onclick = async () => {
		try {
			const selected = Array.from(document.querySelectorAll(".userCheck:checked"));
			const userPromises = selected.map(cb => getDoc(doc(db, "users", cb.value)));
			const userDocs = await Promise.all(userPromises);
			const ops = selected.map(cb => updateDoc(doc(db, "users", cb.value), { approved: true }));
			await Promise.all(ops);

			const emailPromises = userDocs.map(async (userDoc) => {
				const userData = userDoc.data();
				if (userData?.email && window.emailApprovalService) {
					try {
						await window.emailApprovalService.sendApprovalNotification(
							userData.email,
							userData.name || userData.email,
							currentUserData?.role || 'Super Administrator',
							'registration'
						);
					} catch (emailError) {
						console.error('Failed to send bulk approval notification:', emailError);
					}
				}
			});
			await Promise.all(emailPromises);
			await loadApprovals();
			await loadStats();
			renderNotifyList();
		} catch (err) {
			console.error('approveSelected error', err);
			alert('Failed to approve selected users');
		}
	};
}



/* BULK REJECT */

if (rejectSelected) {
	rejectSelected.onclick = async () => {
		try {
			const selected = Array.from(document.querySelectorAll(".userCheck:checked"));
			const userPromises = selected.map(cb => getDoc(doc(db, "users", cb.value)));
			const userDocs = await Promise.all(userPromises);

			const emailPromises = userDocs.map(async (userDoc) => {
				const userData = userDoc.data();
				if (userData?.email && window.emailApprovalService) {
					try {
						await window.emailApprovalService.sendRejectionNotification(
							userData.email,
							userData.name || userData.email,
							currentUserData?.role || 'Super Administrator',
							'registration',
							'Account registration was not approved'
						);
					} catch (emailError) {
						console.error('Failed to send bulk rejection notification:', emailError);
					}
				}
			});
			await Promise.all(emailPromises);
			const ops = selected.map(cb => deleteDoc(doc(db, "users", cb.value)));
			await Promise.all(ops);
			await loadApprovals();
			await loadStats();
			renderNotifyList();
		} catch (err) {
			console.error('rejectSelected error', err);
			alert('Failed to reject selected users');
		}
	};
}



/* SINGLE APPROVE */

window.approveUser = async uid => {
	try {
		const userDoc = await getDoc(doc(db, "users", uid));
		const userData = userDoc.data();
		await updateDoc(doc(db, "users", uid), { approved: true });
		if (userData?.email && window.emailApprovalService) {
			try {
				await window.emailApprovalService.sendApprovalNotification(
					userData.email,
					userData.name || userData.email,
					currentUserData?.role || 'Super Administrator',
					'registration'
				);
			} catch (emailError) {
				console.error('Failed to send approval notification:', emailError);
			}
		}
		await loadApprovals();
		await loadStats();
		renderNotifyList();
	} catch (err) {
		console.error('approveUser error', err);
		alert('Failed to approve user');
	}
};



/* SINGLE REJECT */

window.rejectUser = async uid => {
	try {
		const userDoc = await getDoc(doc(db, "users", uid));
		const userData = userDoc.data();
		if (userData?.email && window.emailApprovalService) {
			try {
				await window.emailApprovalService.sendRejectionNotification(
					userData.email,
					userData.name || userData.email,
					currentUserData?.role || 'Super Administrator',
					'registration',
					'Account registration was not approved'
				);
			} catch (emailError) {
				console.error('Failed to send rejection notification:', emailError);
			}
		}
		await deleteDoc(doc(db, "users", uid));
		await loadApprovals();
		await loadStats();
		renderNotifyList();
	} catch (err) {
		console.error('rejectUser error', err);
		alert('Failed to reject user');
	}
};



/* HANDLE PERMISSION REQUEST */

window.handlePermissionRequest = async (requestId, staffUid, action) => {
	try {
		const requestRef = doc(db, "permissionRequests", requestId);
		const requestSnap = await getDoc(requestRef);
		if (!requestSnap.exists()) {
			alert('Permission request not found');
			return;
		}
		const requestData = requestSnap.data();

		if (action === 'approve') {
			const confirmed = confirm(
				"✅ Approve Permission Request\n\n" +
				"This will enable the following permissions for this staff member:\n" +
				"• Student Registration Approvals\n" +
				"• Profile Update Approvals\n\n" +
				"Do you want to proceed?"
			);

			if (!confirmed) return;

			await updateDoc(doc(db, "users", staffUid), {
				adminPermission: true,
				adminPermissionType: requestData.permissionType || 'both',
				adminPermissionGrantedAt: serverTimestamp()
			});

			if (requestData.staffEmail && window.emailApprovalService) {
				try {
					await window.emailApprovalService.sendApprovalNotification(
						requestData.staffEmail,
						requestData.staffName || requestData.staffEmail,
						currentUserData?.name || currentUserData?.role || 'Super Administrator',
						'permission request',
						{
							permissionType: requestData.permissionType || 'both',
							collegeName: requestData.collegeName || ''
						}
					);
				} catch (emailError) {
					console.error('Failed to send permission approval notification:', emailError);
				}
			}

			// Delete the permission request
			await deleteDoc(requestRef);

			// Enable HOD profile approval (this enables both registration and profile update approvals)
			await updateDoc(doc(db, "settings", "config"), {
				hodProfileApprovalEnabled: true
			});

			alert(
				"✅ Permission Request Approved!\n\n" +
				"The staff member can now:\n" +
				"• Approve student registrations\n" +
				"• Verify and approve profile updates\n\n" +
				"These permissions are now active in their dashboard."
			);

		} else if (action === 'deny') {
			const confirmed = confirm(
				"❌ Deny Permission Request\n\n" +
				"This will reject the permission request.\n" +
				"The staff member will not be notified automatically.\n\n" +
				"Do you want to proceed?"
			);

			if (!confirmed) return;

			// Update status to denied
			await updateDoc(requestRef, {
				status: 'denied',
				deniedAt: serverTimestamp()
			});

			await updateDoc(doc(db, "users", staffUid), {
				adminPermission: false,
				adminPermissionType: null
			});

			if (requestData.staffEmail && window.emailApprovalService) {
				try {
					await window.emailApprovalService.sendRejectionNotification(
						requestData.staffEmail,
						requestData.staffName || requestData.staffEmail,
						currentUserData?.name || currentUserData?.role || 'Super Administrator',
						'permission request',
						'Your permission request was denied by the administrator.',
						{
							permissionType: requestData.permissionType || 'both',
							collegeName: requestData.collegeName || ''
						}
					);
				} catch (emailError) {
					console.error('Failed to send permission rejection notification:', emailError);
				}
			}

			alert("❌ Permission request has been denied.");
		}

		// Refresh the permission requests table
		window.renderPermissionRequestTable();

		// Refresh notifications
		renderNotifyList();

	} catch (err) {
		console.error('handlePermissionRequest error', err);
		alert('Failed to process permission request: ' + err.message);
	}
};



/* ================= STUDENTS ================= */

let studentsData = [];

window.loadStudents = async () => {
	try {
		safeSet(studentsTable, "", "html");
		studentsData = [];
		let i = 1;
		const snap = await getDocs(collection(db, "users"));
		let rows = "";

		snap.forEach(d => {
			const u = d.data();
			if (u.role === "student") {
				studentsData.push({ id: d.id, ...u });
				const name = escapeHtml(u.name || "-");
				const studentId = escapeHtml(u.studentId || "-");
				const email = escapeHtml(u.email || "-");
				const dept = escapeHtml(u.department || "-");
				const year = escapeHtml(u.year || "-");
				rows += `\n<tr onclick="openUserDetails('${d.id}')" style="cursor: pointer;">\n<td>${i++}</td>\n<td>${name}</td>\n<td>${studentId}</td>\n<td>${email}</td>\n<td>${dept}</td>\n<td>${year}</td>\n<td><button class="action-btn" onclick="event.stopPropagation(); openUserDetails('${d.id}')">View</button></td>\n</tr>\n`;
			}
		});

		safeSet(studentsTable, rows || '<tr><td colspan="7" style="text-align:center;">No students found</td></tr>', "html");
		filterStudents();
	} catch (err) {
		console.error('loadStudents error', err);
		safeSet(studentsTable, '<tr><td colspan="7">Failed to load students</td></tr>', 'html');
	}
};

function filterStudents() {
	if (!studentsTable) return;

	const searchQuery = studentSearch?.value.toLowerCase() || "";
	const deptFilter = studentDeptFilter?.value || "all";
	const yearFilter = studentYearFilter?.value || "all";

	studentsTable.querySelectorAll("tr").forEach(tr => {
		const text = tr.innerText.toLowerCase();
		const cells = tr.querySelectorAll("td");

		if (cells.length < 6) return;

		const dept = cells[4].innerText;
		const year = cells[5].innerText;

		const matchesSearch = text.includes(searchQuery);
		const matchesDept = deptFilter === "all" || dept === deptFilter;
		const matchesYear = yearFilter === "all" || year === yearFilter;

		tr.style.display = (matchesSearch && matchesDept && matchesYear) ? "" : "none";
	});
}

/* STUDENTS SEARCH & FILTERS */
if (studentSearch) {
	studentSearch.onkeyup = filterStudents;
}

if (studentDeptFilter) {
	studentDeptFilter.onchange = filterStudents;
}

if (studentYearFilter) {
	studentYearFilter.onchange = filterStudents;
}

/* DOWNLOAD STUDENTS EXCEL */
window.downloadStudentsExcel = () => {
	try {
		const data = studentsData.map((s, i) => ({
			"S.No": i + 1,
			"Name": s.name || "-",
			"Student ID": s.studentId || "-",
			"Email": s.email || "-",
			"Department": s.department || "-",
			"Year": s.year || "-",
			"Phone": s.phone || "-",
			"Registered On": s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString() : "-"
		}));

		const ws = XLSX.utils.json_to_sheet(data);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Students");
		XLSX.writeFile(wb, `Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
	} catch (err) {
		console.error('Download error', err);
		alert('Failed to download Excel file');
	}
};


/* ================= STAFF ================= */

let staffData = [];

window.loadStaff = async role => {

	try {
		safeSet(staffTable, "", "html");
		staffData = [];
		let i = 1;
		const snap = await getDocs(collection(db, "users"));
		let rows = "";
		const staffByDept = {}; // For caching staff list by department

		snap.forEach(d => {
			const u = d.data();
			const r = (u.role || "").toLowerCase();
			// show non-students but exclude admins from staff listing
			if (r !== "student" && r !== "admin") {
				if (role === "all" || r === role) {
					staffData.push({ id: d.id, ...u });
					const name = escapeHtml(u.name || "-");
					const email = escapeHtml(u.email || "-");
					const dept = escapeHtml(u.department || "-");
					rows += `\n<tr onclick="openUserDetails('${d.id}')">\n<td>${i++}</td>\n<td>${name}</td>\n<td>${email}</td>\n<td>${dept}</td>\n</tr>\n`;

					// Build staff list by department for student access
					if (u.department) {
						if (!staffByDept[u.department]) {
							staffByDept[u.department] = [];
						}
						staffByDept[u.department].push({
							name: u.name,
							role: u.role,
							email: u.email
						});
					}
				}
			}
		});
		safeSet(staffTable, rows, "html");

		// Update staffList in settings for student access
		if (Object.keys(staffByDept).length > 0) {
			try {
				await setDoc(doc(db, "settings", "staffList"), staffByDept);
				console.log("Staff list cached for student access");
			} catch (err) {
				console.warn("Failed to cache staff list:", err);
			}
		}
	} catch (err) {
		console.error('loadStaff error', err);
		safeSet(staffTable, '<tr><td colspan="4">Failed to load staff</td></tr>', 'html');
	}

};



/* STAFF SEARCH */

if (staffSearch && staffTable) {
	staffSearch.onkeyup = () => {
		const q = staffSearch.value.toLowerCase();
		staffTable.querySelectorAll("tr").forEach(tr => {
			tr.style.display = tr.innerText.toLowerCase().includes(q) ? "" : "none";
		});
	};
}


/* APPROVALS SEARCH */

if (approvalSearch && approvalTable) {
	approvalSearch.onkeyup = () => {
		const q = approvalSearch.value.toLowerCase();
		approvalTable.querySelectorAll("tr").forEach(tr => {
			tr.style.display = tr.innerText.toLowerCase().includes(q) ? "" : "none";
		});
	};
}



/* ================= HIERARCHY ================= */

let detailsData = [];

window.openUserDetails = async uid => {

	try {
		const snap = await getDoc(doc(db, "users", uid));
		const user = snap.data();

		// Check if we are already in the detailsSection (recursive view)
		const currentActiveSection = document.querySelector(".section.active");

		if (currentActiveSection) {
			if (currentActiveSection.id === "detailsSection") {
				// We are already in details, push the "current" user to stack before switching
				// We need to keep track of the current user somewhere or use the current detailsData
				// or just use the current uid from the UI if possible.
				// A better way: store the current UID in a variable before switching.
				if (window.currentViewingUid && window.currentViewingUid !== uid) {
					navStack.push(window.currentViewingUid);
				}
			} else {
				// Fresh entry from a list (students, staff, etc.)
				navStack.push(currentActiveSection.id);
			}
		}

		window.currentViewingUid = uid;

		document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
		if (detailsSection) detailsSection.classList.add("active");

		// Get back button
		const backButton = detailsSection.querySelector('button[onclick="goBack()"]');

		const userRole = (user.role || "").toLowerCase();
		// Show back button always for Admin when stack is not empty
		if (backButton) {
			backButton.style.display = "block";
		}
		let regOn = "-";
		if (user.createdAt) {
			const d = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt.seconds * 1000);
			regOn = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
		}
		let photo = user.photoURL || "default-avatar.png";

		let infoHtml = `
			<div style="border-radius: 20px; padding: 40px; border: 1px solid rgba(255,255,255,0.15);">
				<div style="display: flex; gap: 30px; align-items: start; flex-wrap: wrap;">
					<img src="${photo}" style="width:140px; height:140px; border-radius:16px; object-fit:cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
					<div style="flex: 1; min-width: 250px;">
						<h3 style="margin: 0 0 16px 0; font-size: 28px; color: #0f172a; font-weight: 800;">${escapeHtml(user.name)}</h3>
						<div style="display: grid; gap: 12px;">
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Email:</strong> ${escapeHtml(user.email)}</p>
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Role:</strong> <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-weight: 600; text-transform: uppercase; font-size: 13px;">${escapeHtml(user.role)}</span></p>
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Department:</strong> ${escapeHtml(user.department || "-")}</p>
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">College ID:</strong> ${escapeHtml(user.collegeId || "-")}</p>
							${user.collegeCode ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">College Code:</strong> ${escapeHtml(user.collegeCode)}</p>` : ""}
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">College Name:</strong> ${escapeHtml(user.collegeName || "-")}</p>
							${user.phone ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Phone:</strong> ${escapeHtml(user.phone)}</p>` : ""}
							${user.year ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Year:</strong> ${escapeHtml(user.year)}</p>` : ""}
							${user.staffId ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Staff ID:</strong> ${escapeHtml(user.staffId)}</p>` : ""}
							${user.studentId ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Student ID:</strong> ${escapeHtml(user.studentId)}</p>` : ""}
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Registered On:</strong> ${regOn}</p>
						</div>
					</div>
				</div>
			</div>
		`;
		safeSet(detailsInfo, infoHtml, "html");

		const detailsSearch = document.getElementById("detailsSearch");
		const detailsTable = detailsSection.querySelector("table");

		// Only show subordinates table for HOD and Incharge
		if (userRole === "hod" || userRole === "incharge") {
			detailsTitle.innerText = "Subordinates / Students";
			detailsHead.innerHTML = `<tr><th>S.No</th><th>Name</th><th>Email</th><th>Details</th></tr>`;

			// Show search and table
			if (detailsSearch) detailsSearch.style.display = "block";
			if (detailsTable) detailsTable.style.display = "table";

			safeSet(detailsBody, "", "html");
			detailsData = [];
			let i = 1;
			const all = await getDocs(collection(db, "users"));
			let rows = "";
			all.forEach(d => {
				const u = d.data();
				const r = (u.role || "").toLowerCase();
				if ((userRole === "hod" && u.hodId === uid) || (userRole === "incharge" && u.inchargeId === uid)) {
					detailsData.push({ id: d.id, ...u });
					rows += `\n<tr onclick="openUserDetails('${d.id}')" style="cursor: pointer;">\n<td>${i++}</td>\n<td>${escapeHtml(u.name)}</td>\n<td>${escapeHtml(u.email)}</td>\n<td>${escapeHtml(u.department || u.roll || "-")}</td>\n</tr>\n`;
				}
			});
			safeSet(detailsBody, rows, "html");
		} else {
			// For students and other roles, hide search and table, center the content
			detailsTitle.innerText = "";
			detailsHead.innerHTML = "";
			safeSet(detailsBody, "", "html");

			// Hide search and table
			if (detailsSearch) detailsSearch.style.display = "none";
			if (detailsTable) detailsTable.style.display = "none";

			// Center the info card
			if (detailsInfo) {
				detailsInfo.style.maxWidth = "800px";
				detailsInfo.style.margin = "40px auto";
				detailsInfo.style.textAlign = "left";
			}
		}

	} catch (err) {
		console.error('openUserDetails error', err);
		safeSet(detailsInfo, '<p>Failed to load user details</p>', 'html');
	}

};



window.goBack = () => {
	if (navStack.length > 0) {
		const prev = navStack.pop();
		if (typeof prev === 'string' && document.getElementById(prev)) {
			// It's a section ID
			showSection(prev, true);
			window.currentViewingUid = null;
		} else {
			// It's a UID (recursive)
			window.openUserDetails(prev);
		}
	} else {
		// Fallback
		showSection("home", true);
		window.currentViewingUid = null;
	}
};



/* ================= ATTENDANCE ================= */

let allStudents = [];
let attendanceCollegeOptions = [];
let attendanceHolidayMap = {};
let attendanceSortState = { key: "name", direction: "asc" };

async function legacyLoadAttendance() {

	try {
		// 1. Fetch all holidays first
		const holidaysSnap = await getDocs(collection(db, "holidays"));
		window.holidaysMap = {};
		holidaysSnap.forEach(d => {
			window.holidaysMap[d.id] = d.data();
		});

		// 2. Fetch all approved students
		const usersSnap = await getDocs(collection(db, "users"));
		allStudents = [];
		usersSnap.forEach(d => {
			const u = d.data();
			const r = (u.role || "").toLowerCase();
			if (r === "student" && u.approved) {
				allStudents.push({ id: d.id, ...u });
			}
		});

		// 3. Fetch attendance records
		attendanceRecords = [];
		const snap = await getDocs(collection(db, "attendanceRecords"));
		snap.forEach(d => attendanceRecords.push(d.data()));

		renderAttendance();
	} catch (err) {
		console.error('loadAttendance error', err);
		safeSet(attTable, '<tr><td colspan="9">Failed to load attendance</td></tr>', 'html');
	}

}


if (attendanceSearch) attendanceSearch.onkeyup = () => renderAttendance();
if (attendanceDateFilter) attendanceDateFilter.onchange = () => renderAttendance();



function legacyRenderAttendance() {
	const year = (yearFilter && yearFilter.value) || "all";
	const q = (attendanceSearch && attendanceSearch.value.toLowerCase()) || "";
	const targetDate = (attendanceDateFilter && attendanceDateFilter.value) || "";
	const statusF = (attendanceStatusFilter && attendanceStatusFilter.value) || "all";

	safeSet(attTable, "", "html");

	// Check if target date is a holiday or Sunday
	if (targetDate) {
		const dateObj = new Date(targetDate + 'T00:00:00');
		const isSunday = dateObj.getDay() === 0;
		const isHoliday = window.holidaysMap && window.holidaysMap[targetDate];

		if (isSunday || isHoliday) {
			const holidayText = isSunday ? "Sunday - Weekly Holiday" : (isHoliday.reason || "Holiday");
			safeSet(attTable, `<tr><td colspan="10" style="text-align:center; padding:40px;"><span style="background:#f3e8ff; color:#7c3aed; padding:8px 16px; border-radius:8px; font-weight:700; font-size:16px;">🏖️ ${escapeHtml(holidayText)}</span></td></tr>`, 'html');
			return;
		}
	}

	// We want to show EVERY student for the selected date
	const studentAttendanceMap = {};

	// Initialize map with all students
	allStudents.forEach(s => {
		studentAttendanceMap[s.id] = {
			student: s,
			FN: null,
			AN: null
		};
	});

	// Overlay records for the target date
	attendanceRecords.forEach(r => {
		if (r.date === targetDate && studentAttendanceMap[r.studentUid]) {
			studentAttendanceMap[r.studentUid][r.session] = r;
		}
	});

	let i = 1;
	let rows = "";

	// Filter and Sort based on student details and session records
	const visibleStudents = Object.values(studentAttendanceMap).filter(entry => {
		const s = entry.student;
		const matchesYear = (year === "all" || s.year === year);
		const matchesSearch = ((s.name || "").toLowerCase().includes(q) || (s.studentId || "").toLowerCase().includes(q));

		if (!matchesYear || !matchesSearch) return false;

		// registration check: only show if registered on or before targetDate
		if (s.createdAt && targetDate) {
			try {
				let regDate;
				if (s.createdAt.toDate) regDate = s.createdAt.toDate();
				else regDate = new Date(s.createdAt);

				const regStr = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}-${String(regDate.getDate()).padStart(2, '0')}`;
				if (regStr > targetDate) return false;
			} catch (e) {
				console.warn("Date parse error for student", s.id, e);
			}
		}

		if (statusF !== "all") {
			const fnS = (entry.FN ? entry.FN.status : "absent").toLowerCase();
			const anS = (entry.AN ? entry.AN.status : "absent").toLowerCase();
			if (statusF === "present" && (fnS !== "present" && anS !== "present")) return false;
			if (statusF === "absent" && (fnS === "present" || anS === "present")) return false;
		}

		return true;
	});

	// Sort by name or time if present
	visibleStudents.sort((a, b) => {
		const timeA = a.FN?.time || a.AN?.time || "99:99:99";
		const timeB = b.FN?.time || b.AN?.time || "99:99:99";
		if (timeA !== "99:99:99" || timeB !== "99:99:99") return timeA.localeCompare(timeB);
		return a.student.name.localeCompare(b.student.name);
	});

	visibleStudents.forEach(entry => {
		const s = entry.student;
		const fn = entry.FN;
		const an = entry.AN;

		const stats = getAttendanceData(s.id, s.createdAt);

		// Row 1: Includes S.No, Name, Date, Roll, Year with rowspan="2"
		rows += `\n<tr onclick="openUserDetails('${s.id}')">\n<td rowspan="2">${i++}</td>\n<td rowspan="2" class="clickable-name">${escapeHtml(s.name)}</td>\n<td rowspan="2">${escapeHtml(targetDate)}</td>\n<td rowspan="2">${escapeHtml(s.studentId || s.roll || "-")}</td>\n<td rowspan="2">${escapeHtml(s.year || "-")}</td>\n<td>FN</td>\n<td>${escapeHtml(fn ? (fn.gpsStatus || "-") : "-")}</td>\n<td>${escapeHtml(fn ? (fn.faceStatus || "-") : "-")}</td>\n<td>${escapeHtml(fn ? (fn.status || "Absent").toUpperCase() : "ABSENT")}</td>\n<td rowspan="2" style="font-weight:700; color: ${stats.eligible ? '#28a745' : '#dc3545'}">${stats.percent}%<br><small>${stats.eligible ? 'Eligible' : 'Not Eligible'}</small></td>\n</tr>\n<tr onclick="openUserDetails('${s.id}')">\n<td>AN</td>\n<td>${escapeHtml(an ? (an.gpsStatus || "-") : "-")}</td>\n<td>${escapeHtml(an ? (an.faceStatus || "-") : "-")}</td>\n<td>${escapeHtml(an ? (an.status || "Absent").toUpperCase() : "ABSENT")}</td>\n</tr>\n`;


	});

	safeSet(attTable, rows, "html");
}

if (attendanceCollegeFilter) attendanceCollegeFilter.onchange = () => renderAttendance();

function populateAttendanceCollegeFilter() {
	if (!attendanceCollegeFilter) return;
	const selectedCollege = attendanceCollegeFilter.value || "all";
	attendanceCollegeFilter.innerHTML = ['<option value="all">College: All</option>']
		.concat(attendanceCollegeOptions.map(college => `<option value="${escapeHtml(college.id)}">${escapeHtml(college.name)}</option>`))
		.join("");
	attendanceCollegeFilter.value = attendanceCollegeOptions.some(college => college.id === selectedCollege) ? selectedCollege : "all";
}

function parseAttendanceSortValue(row, key) {
	if (key === "percentageValue") {
		return Number.parseFloat(String(row.percentage || "0").replace("%", "")) || 0;
	}
	if (key === "index") {
		return row.index || 0;
	}
	return String(row[key] || "").toLowerCase();
}

function sortAttendanceRows(rows) {
	const { key, direction } = attendanceSortState;
	const factor = direction === "asc" ? 1 : -1;
	return [...rows].sort((a, b) => {
		const left = parseAttendanceSortValue(a, key);
		const right = parseAttendanceSortValue(b, key);
		if (left < right) return -1 * factor;
		if (left > right) return 1 * factor;
		return (a.index || 0) - (b.index || 0);
	});
}

function setupAttendanceTableSorting() {
	document.querySelectorAll("[data-sort-key]").forEach(header => {
		header.style.cursor = "pointer";
		header.onclick = () => {
			const sortKey = header.getAttribute("data-sort-key");
			if (!sortKey) return;
			if (attendanceSortState.key === sortKey) {
				attendanceSortState.direction = attendanceSortState.direction === "asc" ? "desc" : "asc";
			} else {
				attendanceSortState = { key: sortKey, direction: "asc" };
			}
			renderAttendance();
		};
	});
}

function buildAttendanceRows() {
	const q = (attendanceSearch && attendanceSearch.value.toLowerCase()) || "";
	const targetDate = (attendanceDateFilter && attendanceDateFilter.value) || "";
	const collegeF = (attendanceCollegeFilter && attendanceCollegeFilter.value) || "all";

	if (!targetDate) {
		return {
			rows: [],
			emptyMessage: "Select a date to view attendance across colleges."
		};
	}

	const studentAttendanceMap = {};
	allStudents.forEach(student => {
		studentAttendanceMap[student.id] = { student, FN: null, AN: null };
	});

	attendanceRecords.forEach(record => {
		if (record.date === targetDate && studentAttendanceMap[record.studentUid]) {
			studentAttendanceMap[record.studentUid][record.session] = record;
		}
	});

	const rows = [];
	Object.values(studentAttendanceMap).forEach(entry => {
		const student = entry.student;
		const collegeId = student.collegeId || "unknown";
		const collegeName = student.collegeName || attendanceCollegeOptions.find(college => college.id === collegeId)?.name || "Unknown College";

		if (collegeF !== "all" && collegeId !== collegeF) return;

		if (student.createdAt) {
			try {
				const regDate = student.createdAt.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
				const regStr = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}-${String(regDate.getDate()).padStart(2, '0')}`;
				if (regStr > targetDate) return;
			} catch (error) {
				console.warn("Date parse error for student", student.id, error);
			}
		}

		const holidayData = attendanceHolidayMap[`${collegeId}_${targetDate}`];
		const dateObj = new Date(`${targetDate}T00:00:00`);
		const isSunday = dateObj.getDay() === 0;

		["FN", "AN"].forEach(session => {
			const record = entry[session];
			const isHoliday = isSunday || !!holidayData;
			const statusLabel = isHoliday ? (isSunday ? "SUNDAY" : (holidayData?.reason || "HOLIDAY").toUpperCase()) : ((record?.status || "Absent").toUpperCase());

			const searchText = [
				student.name,
				student.studentId,
				student.roll,
				student.department,
				collegeName,
				session
			].filter(Boolean).join(" ").toLowerCase();
			if (q && !searchText.includes(q)) return;

			const stats = getAttendanceData(student.id, student.createdAt);
			rows.push({
				index: rows.length + 1,
				uid: student.id,
				collegeName,
				name: student.name || "-",
				date: targetDate,
				roll: student.studentId || student.roll || "-",
				department: student.department || "-",
				year: student.year || "-",
				session,
				gps: isHoliday ? "-" : (record?.gpsStatus || "-"),
				face: isHoliday ? "-" : (record?.faceStatus || "-"),
				status: statusLabel,
				percentage: `${stats.percent}%`,
				eligible: stats.eligible
			});
		});
	});

	rows.sort((a, b) => {
		if (a.collegeName !== b.collegeName) return a.collegeName.localeCompare(b.collegeName);
		if (a.name !== b.name) return a.name.localeCompare(b.name);
		return a.session.localeCompare(b.session);
	});

	return {
		rows,
		emptyMessage: "No attendance records match the selected filters."
	};
}

async function loadAttendance() {
	try {
		const [collegesSnap, usersSnap, attendanceSnap] = await Promise.all([
			getDocs(collection(db, "colleges")),
			getDocs(collection(db, "users")),
			getDocs(collection(db, "attendanceRecords"))
		]);

		attendanceCollegeOptions = collegesSnap.docs.map(d => ({
			id: d.id,
			name: d.data().name || d.id
		})).sort((a, b) => a.name.localeCompare(b.name));
		populateAttendanceCollegeFilter();

		const holidayEntries = await Promise.all(
			attendanceCollegeOptions.map(async college => {
				try {
					const holidaysSnap = await getDocs(collection(db, "colleges", college.id, "holidays"));
					return holidaysSnap.docs.map(docSnap => [`${college.id}_${docSnap.id}`, docSnap.data()]);
				} catch (error) {
					console.warn("attendance holiday load error", college.id, error);
					return [];
				}
			})
		);
		attendanceHolidayMap = Object.fromEntries(holidayEntries.flat());

		allStudents = [];
		usersSnap.forEach(d => {
			const userData = d.data();
			if ((userData.role || "").toLowerCase() === "student" && userData.approved) {
				allStudents.push({ id: d.id, ...userData });
			}
		});

		attendanceRecords = [];
		attendanceSnap.forEach(d => attendanceRecords.push(d.data()));

		setupAttendanceTableSorting();
		renderAttendance();
	} catch (err) {
		console.error("loadAttendance error", err);
		safeSet(attTable, '<tr><td colspan="12">Failed to load attendance</td></tr>', "html");
	}
}

function renderAttendance() {
	safeSet(attTable, "", "html");
	const result = buildAttendanceRows();
	const sortedRows = sortAttendanceRows(result.rows);

	if (sortedRows.length === 0) {
		safeSet(attTable, `<tr><td colspan="12" style="text-align:center; padding:40px; color:#64748b;">${escapeHtml(result.emptyMessage)}</td></tr>`, "html");
		return;
	}

	const rowsHtml = sortedRows.map((row, index) => `
		<tr onclick="openUserDetails('${row.uid}')">
			<td>${index + 1}</td>
			<td>${escapeHtml(row.collegeName)}</td>
			<td class="clickable-name">${escapeHtml(row.name)}</td>
			<td>${escapeHtml(row.date)}</td>
			<td>${escapeHtml(row.roll)}</td>
			<td>${escapeHtml(row.department)}</td>
			<td>${escapeHtml(row.year)}</td>
			<td>${escapeHtml(row.session)}</td>
			<td>${escapeHtml(row.gps)}</td>
			<td>${escapeHtml(row.face)}</td>
			<td style="font-weight:700; color:${row.status === "PRESENT" ? "#16a34a" : row.status === "ABSENT" ? "#dc2626" : "#7c3aed"};">${escapeHtml(row.status)}</td>
			<td style="font-weight:700; color:${row.eligible ? "#28a745" : "#dc3545"}">${escapeHtml(row.percentage)}</td>
		</tr>
	`).join("");

	safeSet(attTable, rowsHtml, "html");
}


/* ================= SETTINGS ================= */

if (saveTiming) {
	saveTiming.onclick = () => {
		try {
			setDoc(doc(db, "settings", "attendance"), {
				fnStart: (fnStart && fnStart.value) || "",
				fnEnd: (fnEnd && fnEnd.value) || "",
				anStart: (anStart && anStart.value) || "",
				anEnd: (anEnd && anEnd.value) || ""
			}, { merge: true });
			updateSessionInfo();
			updateSettingsStatus();

			// Update email reminder timing display
			if (fnEnd && anEnd) {
				updateEmailReminderTiming(fnEnd.value, anEnd.value);
			}

			alert("Timing Saved");
		} catch (err) {
			console.error('saveTiming error', err);
			alert('Failed to save timing');
		}
	};
}



if (saveGPS) {
	saveGPS.onclick = () => {
		try {
			setDoc(doc(db, "settings", "attendance"), {
				lat: (lat && lat.value) || "",
				lng: (lng && lng.value) || "",
				radius: (radius && radius.value) || ""
			}, { merge: true });
			updateSettingsStatus();
			alert("GPS Saved");
		} catch (err) {
			console.error('saveGPS error', err);
			alert('Failed to save GPS settings');
		}
	};
}



if (addHoliday) {
	addHoliday.onclick = () => {
		(async () => {
			try {
				const mode = (holidayMode && holidayMode.value) || 'single';
				const reason = (holidayReason && holidayReason.value) || '';

				if (mode === 'single') {
					if (!holidayDate || !holidayDate.value) { alert('Please pick a date'); return; }
					await setDoc(doc(db, "holidays", holidayDate.value), { date: holidayDate.value, reason });
					alert('Holiday Added');
					return;
				}

				// multiple
				if (!holidayStart || !holidayEnd || !holidayStart.value || !holidayEnd.value) { alert('Please pick start and end dates'); return; }
				const start = new Date(holidayStart.value);
				const end = new Date(holidayEnd.value);
				if (start > end) { alert('Start date must be before or equal to end date'); return; }

				const ops = [];
				for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
					const id = isoDate(new Date(d));
					ops.push(setDoc(doc(db, 'holidays', id), { date: id, reason }));
				}

				await Promise.all(ops);
				alert('Holiday range added');
			} catch (err) {
				console.error('addHoliday error', err);
				alert('Failed to add holiday(s)');
			}
		})();
	};
}

/* ================= EXCEL EXPORT ================= */
const downloadExcelBtn = document.getElementById("downloadExcel");
if (downloadExcelBtn) {
	downloadExcelBtn.onclick = () => {
		const result = buildAttendanceRows();
		if (result.rows.length === 0) {
			alert("No data found for export");
			return;
		}

		const exportData = result.rows.map(row => ({
			"College": row.collegeName,
			"Name": row.name,
			"Date": row.date,
			"Roll No": row.roll,
			"Department": row.department,
			"Year": row.year,
			"Session": row.session,
			"GPS": row.gps,
			"Face": row.face,
			"Status": row.status,
			"Overall %": row.percentage
		}));

		const ws = XLSX.utils.json_to_sheet(exportData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Attendance");
		XLSX.writeFile(wb, `Super_Admin_Attendance_${attendanceDateFilter?.value || "records"}.xlsx`);
	};
}

/* ================= PROFILE UPDATE LOGIC ================= */

if (showRegistrations) {
	showRegistrations.onclick = () => {
		showRegistrations.style.background = "#3b82f6";
		showRegistrations.style.color = "white";
		showProfileUpdates.style.background = "transparent";
		showProfileUpdates.style.color = "#64748b";
		const showManualAttendance = document.getElementById("showManualAttendance");
		const showPermissionRequests = document.getElementById("showPermissionRequests");
		if (showManualAttendance) {
			showManualAttendance.style.background = "transparent";
			showManualAttendance.style.color = "#64748b";
		}
		if (showPermissionRequests) {
			showPermissionRequests.style.background = "transparent";
			showPermissionRequests.style.color = "#64748b";
		}
		registrationApprovalsView.classList.remove("hidden");
		profileUpdatesView.classList.add("hidden");
		const manualAttendanceView = document.getElementById("manualAttendanceView");
		const permissionRequestsView = document.getElementById("permissionRequestsView");
		if (manualAttendanceView) manualAttendanceView.classList.add("hidden");
		if (permissionRequestsView) permissionRequestsView.classList.add("hidden");
	};
}

if (showProfileUpdates) {
	showProfileUpdates.onclick = () => {
		showProfileUpdates.style.background = "#3b82f6";
		showProfileUpdates.style.color = "white";
		showRegistrations.style.background = "transparent";
		showRegistrations.style.color = "#64748b";
		const showManualAttendance = document.getElementById("showManualAttendance");
		const showPermissionRequests = document.getElementById("showPermissionRequests");
		if (showManualAttendance) {
			showManualAttendance.style.background = "transparent";
			showManualAttendance.style.color = "#64748b";
		}
		if (showPermissionRequests) {
			showPermissionRequests.style.background = "transparent";
			showPermissionRequests.style.color = "#64748b";
		}
		profileUpdatesView.classList.remove("hidden");
		registrationApprovalsView.classList.add("hidden");
		const manualAttendanceView = document.getElementById("manualAttendanceView");
		const permissionRequestsView = document.getElementById("permissionRequestsView");
		if (manualAttendanceView) manualAttendanceView.classList.add("hidden");
		if (permissionRequestsView) permissionRequestsView.classList.add("hidden");
		window.renderProfileUpdateTable();
	};
}

const showManualAttendance = document.getElementById("showManualAttendance");
if (showManualAttendance) {
	showManualAttendance.onclick = () => {
		showManualAttendance.style.background = "#3b82f6";
		showManualAttendance.style.color = "white";
		showRegistrations.style.background = "transparent";
		showRegistrations.style.color = "#64748b";
		showProfileUpdates.style.background = "transparent";
		showProfileUpdates.style.color = "#64748b";
		const showPermissionRequests = document.getElementById("showPermissionRequests");
		if (showPermissionRequests) {
			showPermissionRequests.style.background = "transparent";
			showPermissionRequests.style.color = "#64748b";
		}
		const manualAttendanceView = document.getElementById("manualAttendanceView");
		const permissionRequestsView = document.getElementById("permissionRequestsView");
		if (manualAttendanceView) manualAttendanceView.classList.remove("hidden");
		if (permissionRequestsView) permissionRequestsView.classList.add("hidden");
		registrationApprovalsView.classList.add("hidden");
		profileUpdatesView.classList.add("hidden");
		window.renderManualAttendanceTable();
	};
}

const showPermissionRequests = document.getElementById("showPermissionRequests");
if (showPermissionRequests) {
	showPermissionRequests.onclick = () => {
		showPermissionRequests.style.background = "#3b82f6";
		showPermissionRequests.style.color = "white";
		showRegistrations.style.background = "transparent";
		showRegistrations.style.color = "#64748b";
		showProfileUpdates.style.background = "transparent";
		showProfileUpdates.style.color = "#64748b";
		const showManualAttendance = document.getElementById("showManualAttendance");
		if (showManualAttendance) {
			showManualAttendance.style.background = "transparent";
			showManualAttendance.style.color = "#64748b";
		}
		const permissionRequestsView = document.getElementById("permissionRequestsView");
		if (permissionRequestsView) permissionRequestsView.classList.remove("hidden");
		registrationApprovalsView.classList.add("hidden");
		profileUpdatesView.classList.add("hidden");
		const manualAttendanceView = document.getElementById("manualAttendanceView");
		if (manualAttendanceView) manualAttendanceView.classList.add("hidden");
		window.renderPermissionRequestTable();
	};
}


window.renderProfileUpdateTable = async () => {
	if (!profileUpdateTable) return;
	try {
		const q = query(collection(db, "profileUpdateRequests"), where("status", "in", ["pending", "hod_verified"]));
		const snap = await getDocs(q);
		let rows = "";

		const uids = new Set();
		snap.forEach(d => uids.add(d.data().uid));

		const usersData = {};
		for (const uid of uids) {
			const uSnap = await getDoc(doc(db, "users", uid));
			if (uSnap.exists()) usersData[uid] = uSnap.data();
		}

		snap.forEach(d => {
			const r = d.data();
			const id = d.id;
			const userData = usersData[r.uid] || {};
			let newVal = r.type === 'photo' ? '<i>New Photo</i>' : r.newValue;
			let oldVal = r.type === 'photo' ? `<img src="${userData.photoURL || 'default-avatar.png'}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">` : (userData[r.type] || '-');

			if (r.approvalOnly) {
				newVal = '<i>Approval requested before update</i>';
				oldVal = r.type === 'photo'
					? `<img src="${userData.photoURL || 'default-avatar.png'}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">`
					: '<span style="color:#64748b;">Current details will be edited after approval</span>';
			}

			if (r.type === 'details' && r.details) {
				newVal = Object.entries(r.details)
					.map(([key, val]) => `<div style="font-size:11px;"><b>${key}:</b> ${escapeHtml(val)}</div>`)
					.join('');
				oldVal = Object.keys(r.details)
					.map(key => `<div style="font-size:11px;"><b>${key}:</b> ${escapeHtml(userData[key] || '-')}</div>`)
					.join('');
			}

			const hodStatus = r.status === 'hod_verified' ? `<span style="color:#10b981;font-weight:700;">HOD VERIFIED</span>` : `<span style="color:#64748b;">Pending HOD</span>`;

			rows += `
				<tr>
					<td>${escapeHtml(r.name)}</td>
					<td>${escapeHtml(r.type)}</td>
					<td style="font-size:12px;color:#64748b;vertical-align:top;">${oldVal}</td>
					<td style="font-weight:600;vertical-align:top;">${newVal}</td>
					<td>${escapeHtml(r.role)} / ${escapeHtml(userData.department || '-')}</td>
					<td>
						User: ${r.gps ? '✅' : '❌'}<br>
						${hodStatus}
					</td>
					<td>
						<button class="approve-profile-btn" data-id="${id}" style="padding:4px 8px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:4px;">Approve</button>
						<button class="reject-profile-btn" data-id="${id}" style="padding:4px 8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;">Reject</button>
					</td>
				</tr>
			`;
		});

		if (rows === "") {
			profileUpdateTable.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No pending profile requests</td></tr>";
		} else {
			profileUpdateTable.innerHTML = rows;
			attachProfileRequestHandlers();
		}
	} catch (err) {
		console.error("renderProfileUpdateTable error", err);
	}
};

/* ================= MANUAL ATTENDANCE APPROVAL ================= */

window.renderManualAttendanceTable = async () => {
	const manualAttendanceTable = document.getElementById("manualAttendanceTable");
	if (!manualAttendanceTable) return;

	try {
		const q = query(collection(db, "manualRequests"), where("status", "==", "pending"));
		const snap = await getDocs(q);
		let rows = "";
		let sNo = 1;

		snap.forEach(d => {
			const r = d.data();
			const id = d.id;

			const requestedAt = r.requestedAt?.toDate?.() ? r.requestedAt.toDate().toLocaleString() : '--';
			const gpsStatus = r.gps ? `✅ (${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)})` : '❌ No GPS';

			rows += `
				<tr>
					<td>${sNo++}</td>
					<td>${escapeHtml(r.name || 'Unknown')}</td>
					<td>${escapeHtml(r.studentId || '--')}</td>
					<td>${escapeHtml(r.department || '--')}</td>
					<td>${escapeHtml(r.date || '--')}</td>
					<td><span style="font-weight:700;color:${r.session === 'FN' ? '#1e40af' : '#c2410c'};">${r.session || '--'}</span></td>
					<td style="font-size:12px;">${escapeHtml(r.reason || 'No reason provided')}</td>
					<td style="font-size:11px;">${gpsStatus}</td>
					<td style="font-size:11px;">${requestedAt}</td>
					<td>
						<button class="approve-manual-btn" data-id="${id}" style="padding:6px 12px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;margin-right:4px;font-weight:600;">✓ Approve</button>
						<button class="reject-manual-btn" data-id="${id}" style="padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">✗ Reject</button>
					</td>
				</tr>
			`;
		});

		if (rows === "") {
			manualAttendanceTable.innerHTML = "<tr><td colspan='10' style='text-align:center;color:#64748b;padding:40px;'>No pending manual attendance requests</td></tr>";
		} else {
			manualAttendanceTable.innerHTML = rows;
			attachManualAttendanceHandlers();
		}
	} catch (err) {
		console.error("renderManualAttendanceTable error", err);
		manualAttendanceTable.innerHTML = "<tr><td colspan='10' style='text-align:center;color:#ef4444;'>Error loading requests</td></tr>";
	}
};

function attachManualAttendanceHandlers() {
	document.querySelectorAll(".approve-manual-btn").forEach(btn => {
		btn.onclick = () => handleManualAttendanceRequest(btn.dataset.id, 'approved');
	});
	document.querySelectorAll(".reject-manual-btn").forEach(btn => {
		btn.onclick = () => handleManualAttendanceRequest(btn.dataset.id, 'rejected');
	});
}

async function handleManualAttendanceRequest(requestId, status) {
	try {
		const reqRef = doc(db, "manualRequests", requestId);
		const reqSnap = await getDoc(reqRef);
		if (!reqSnap.exists()) {
			alert("Request not found");
			return;
		}

		const req = reqSnap.data();

		// Update request status
		await updateDoc(reqRef, {
			status: status,
			approvedBy: auth.currentUser.uid,
			approvedAt: serverTimestamp()
		});

		if (status === 'approved') {
			// Send notification to student
			await addDoc(collection(db, "notifications"), {
				userId: req.userId,
				title: 'Manual Attendance Approved',
				message: `Your manual attendance request for ${req.session} session on ${req.date} has been approved. You have 5 minutes to mark your attendance.`,
				type: 'manual_approval',
				read: false,
				createdAt: serverTimestamp()
			});

			alert(`✓ Manual attendance approved for ${req.name}. Student has 5 minutes to mark attendance.`);
		} else {
			// Send rejection notification
			await addDoc(collection(db, "notifications"), {
				userId: req.userId,
				title: 'Manual Attendance Rejected',
				message: `Your manual attendance request for ${req.session} session on ${req.date} has been rejected.`,
				type: 'manual_rejection',
				read: false,
				createdAt: serverTimestamp()
			});

			alert(`✗ Manual attendance request rejected for ${req.name}.`);
		}

		// Refresh the table
		window.renderManualAttendanceTable();

		// Update pending count
		loadPendingCount();
	} catch (err) {
		console.error("handleManualAttendanceRequest error", err);
		alert("Failed to process request: " + err.message);
	}
}

/* ================= PERMISSION REQUESTS ================= */

window.renderPermissionRequestTable = async () => {
	const permissionRequestTable = document.getElementById("permissionRequestTable");
	if (!permissionRequestTable) return;

	try {
		const q = query(collection(db, "permissionRequests"), where("status", "==", "pending"));
		const snap = await getDocs(q);
		let rows = "";
		let sNo = 1;
		const now = new Date();

		for (const d of snap.docs) {
			const r = d.data();
			const id = d.id;

			// Check if expired
			const expiresAt = r.expiresAt ? (r.expiresAt.toDate ? r.expiresAt.toDate() : new Date(r.expiresAt)) : null;

			if (expiresAt && now > expiresAt) {
				// Auto-expire the request
				await updateDoc(doc(db, "permissionRequests", id), {
					status: 'expired',
					expiredAt: serverTimestamp()
				});
				continue; // Skip this expired request
			}

			const requestedAt = r.createdAt?.toDate?.() ? r.createdAt.toDate().toLocaleString('en-GB', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}) : '--';

			// Calculate time remaining
			let timeRemaining = '--';
			if (expiresAt) {
				const diffMs = expiresAt - now;
				const diffMins = Math.floor(diffMs / 60000);
				const diffSecs = Math.floor((diffMs % 60000) / 1000);

				if (diffMins > 0) {
					timeRemaining = `${diffMins}m ${diffSecs}s`;
				} else if (diffSecs > 0) {
					timeRemaining = `${diffSecs}s`;
				} else {
					timeRemaining = 'Expiring...';
				}
			}

			const permissions = r.permissions ?
				Object.keys(r.permissions).map(key => {
					if (key === 'studentRegistration') return 'Student Registration';
					if (key === 'profileUpdates') return 'Profile Updates';
					return key;
				}).join(', ') : 'N/A';

			rows += `
				<tr data-request-id="${id}" data-expires="${expiresAt ? expiresAt.getTime() : ''}">
					<td>${sNo++}</td>
					<td>${escapeHtml(r.requestedByName || 'Unknown')}</td>
					<td style="font-size:12px;">${escapeHtml(r.requestedByEmail || '--')}</td>
					<td><span style="font-weight:700;color:#3b82f6;text-transform:uppercase;">${escapeHtml(r.role || '--')}</span></td>
					<td>${escapeHtml(r.department || '--')}</td>
					<td style="font-size:12px;color:#64748b;">${permissions}</td>
					<td style="font-size:11px;">
						<div style="margin-bottom:8px;">${requestedAt}</div>
						<div class="time-remaining-badge" style="display:inline-flex;align-items:center;justify-content:center;position:relative;width:70px;height:70px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:50%;box-shadow:0 4px 12px rgba(59,130,246,0.4);">
							<div style="position:absolute;top:8px;font-size:20px;">⏳</div>
							<div class="time-remaining" style="position:absolute;bottom:12px;color:white;font-weight:700;font-size:11px;text-align:center;line-height:1.2;">${timeRemaining}</div>
						</div>
					</td>
					<td>
						<button class="approve-permission-btn" data-id="${id}" data-staff-uid="${r.staffUid}" style="padding:8px 16px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;margin-right:4px;font-weight:600;box-shadow:0 2px 4px rgba(16,185,129,0.3);">✅ Approve</button>
						<button class="deny-permission-btn" data-id="${id}" data-staff-uid="${r.staffUid}" style="padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;box-shadow:0 2px 4px rgba(239,68,68,0.3);">❌ Deny</button>
					</td>
				</tr>
			`;
		}

		if (rows === "") {
			permissionRequestTable.innerHTML = "<tr><td colspan='8' style='text-align:center;color:#64748b;padding:40px;'>✨ No pending permission requests</td></tr>";
		} else {
			permissionRequestTable.innerHTML = rows;
			attachPermissionRequestHandlers();
			startPermissionRequestCountdown();
		}
	} catch (err) {
		console.error("renderPermissionRequestTable error", err);
		permissionRequestTable.innerHTML = "<tr><td colspan='8' style='text-align:center;color:#ef4444;'>❌ Error loading requests</td></tr>";
	}
};

function attachPermissionRequestHandlers() {
	document.querySelectorAll(".approve-permission-btn").forEach(btn => {
		btn.onclick = () => handlePermissionRequest(btn.dataset.id, btn.dataset.staffUid, 'approve');
	});
	document.querySelectorAll(".deny-permission-btn").forEach(btn => {
		btn.onclick = () => handlePermissionRequest(btn.dataset.id, btn.dataset.staffUid, 'deny');
	});
}

// Permission request countdown timer
let permissionRequestCountdownInterval = null;

function startPermissionRequestCountdown() {
	// Clear existing interval
	if (permissionRequestCountdownInterval) {
		clearInterval(permissionRequestCountdownInterval);
	}

	permissionRequestCountdownInterval = setInterval(() => {
		const permissionRequestTable = document.getElementById("permissionRequestTable");
		if (!permissionRequestTable) {
			clearInterval(permissionRequestCountdownInterval);
			return;
		}

		const rows = permissionRequestTable.querySelectorAll("tr[data-request-id]");
		let hasExpired = false;

		rows.forEach(row => {
			const expiresAtMs = parseInt(row.dataset.expires);
			if (!expiresAtMs) return;

			const now = new Date();
			const expiresAt = new Date(expiresAtMs);
			const diffMs = expiresAt - now;

			const timeRemainingCell = row.querySelector(".time-remaining");
			const badge = row.querySelector(".time-remaining-badge");
			if (!timeRemainingCell || !badge) return;

			if (diffMs <= 0) {
				badge.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
				badge.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
				timeRemainingCell.innerHTML = 'EXPIRED';
				timeRemainingCell.style.fontSize = '10px';
				hasExpired = true;
			} else {
				const diffMins = Math.floor(diffMs / 60000);
				const diffSecs = Math.floor((diffMs % 60000) / 1000);

				// Change badge color based on time remaining
				if (diffMins < 5) {
					badge.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
					badge.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
				} else if (diffMins < 10) {
					badge.style.background = 'linear-gradient(135deg, #10b981, #059669)';
					badge.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
				} else {
					badge.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
					badge.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
				}

				if (diffMins > 0) {
					timeRemainingCell.innerHTML = `${diffMins}m ${diffSecs}s`;
				} else {
					timeRemainingCell.innerHTML = `${diffSecs}s`;
				}
				timeRemainingCell.style.fontSize = '11px';
			}
		});

		// If any request expired, reload the table
		if (hasExpired) {
			window.renderPermissionRequestTable();
		}
	}, 1000); // Update every second
}

// Clear countdown when leaving the page
window.addEventListener('beforeunload', () => {
	if (permissionRequestCountdownInterval) {
		clearInterval(permissionRequestCountdownInterval);
	}
});


function attachProfileRequestHandlers() {
	document.querySelectorAll(".approve-profile-btn").forEach(btn => {
		btn.onclick = () => handleProfileRequest(btn.dataset.id, 'approved');
	});
	document.querySelectorAll(".reject-profile-btn").forEach(btn => {
		btn.onclick = () => handleProfileRequest(btn.dataset.id, 'rejected');
	});
}

async function handleProfileRequest(requestId, status) {
	try {
		const reqRef = doc(db, "profileUpdateRequests", requestId);
		const reqSnap = await getDoc(reqRef);
		if (!reqSnap.exists()) return;
		const req = reqSnap.data();

		await updateDoc(reqRef, {
			status: status,
			respondedBy: auth.currentUser.uid,
			respondedAt: serverTimestamp()
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
				targetPage: 'profilePage',
				read: false,
				createdAt: serverTimestamp()
			});
		} else {
			await addDoc(collection(db, "notifications"), {
				userId: req.uid,
				title: `${req.type === 'photo' ? 'Photo' : 'Profile'} Update Rejected`,
				message: `Your ${req.type} update request was rejected. Open your profile to review and submit again if needed.`,
				type: 'rejection',
				targetPage: 'profilePage',
				read: false,
				createdAt: serverTimestamp()
			});
		}

		if (req.email && window.emailApprovalService) {
			try {
				if (status === 'approved') {
					await window.emailApprovalService.sendApprovalNotification(
						req.email,
						req.name || req.email,
						currentUserData?.name || currentUserData?.role || 'Super Administrator',
						`${req.type} profile update request`,
						{ collegeName: req.collegeName || '' }
					);
				} else {
					await window.emailApprovalService.sendRejectionNotification(
						req.email,
						req.name || req.email,
						currentUserData?.name || currentUserData?.role || 'Super Administrator',
						`${req.type} profile update request`,
						'Your profile update request was rejected.',
						{ collegeName: req.collegeName || '' }
					);
				}
			} catch (emailError) {
				console.error("Failed to send profile request notification:", emailError);
			}
		}

		alert(`Request ${status} successfully`);
		window.renderProfileUpdateTable();
	} catch (err) {
		console.error("handleProfileRequest error", err);
		alert("Action failed");
	}
}

/* ================= SECURITY SETTINGS ================= */

if (saveSecuritySettings) {
	saveSecuritySettings.onclick = async () => {
		try {
			await setDoc(doc(db, "settings", "security"), {
				hodProfileApprovalEnabled: hodProfileApprovalToggle.checked
			}, { merge: true });
			alert("Security settings saved");
		} catch (err) {
			console.error("saveSecuritySettings error", err);
			alert("Failed to save settings");
		}
	};
}

async function loadSecuritySettings() {
	try {
		const snap = await getDoc(doc(db, "settings", "security"));
		if (snap.exists()) {
			const data = snap.data();
			if (hodProfileApprovalToggle) hodProfileApprovalToggle.checked = !!data.hodProfileApprovalEnabled;
		}
	} catch (err) {
		if (!_isOfflineError(err)) console.warn('loadSecuritySettings error:', err);
	}
}


/* ================= ADMIN PROFILE UPDATE ================= */

let currentAdminData = null;
let adminProfileUpdateType = null;

// Load admin profile data
async function loadAdminProfile() {
	try {
		if (!auth.currentUser) return;

		const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
		if (!userSnap.exists()) return;

		currentAdminData = userSnap.data();

		// Update profile section
		const adminProfileName = document.getElementById("adminProfileName");
		const adminProfileRole = document.getElementById("adminProfileRole");
		const adminProfileEmail = document.getElementById("adminProfileEmail");
		const adminProfilePhone = document.getElementById("adminProfilePhone");
		const adminProfileDept = document.getElementById("adminProfileDept");
		const adminProfileRoleText = document.getElementById("adminProfileRoleText");
		const adminProfileRegisteredOn = document.getElementById("adminProfileRegisteredOn");
		const adminProfilePhoto = document.getElementById("adminProfilePhoto");
		const sidebarProfilePhoto = document.getElementById("sidebarProfilePhoto");

		if (adminProfileName) adminProfileName.innerText = currentAdminData.name || "Super Admin";
		if (adminProfileRole) adminProfileRole.innerText = (currentAdminData.role || "superadmin").toUpperCase();
		if (adminProfileEmail) adminProfileEmail.innerText = currentAdminData.email || "--";
		if (adminProfilePhone) adminProfilePhone.innerText = currentAdminData.phone || "--";
		if (adminProfileDept) adminProfileDept.innerText = currentAdminData.department || "--";
		if (adminProfileRoleText) adminProfileRoleText.innerText = (currentAdminData.role || "superadmin").toUpperCase();

		if (currentAdminData.createdAt) {
			const d = currentAdminData.createdAt.toDate ? currentAdminData.createdAt.toDate() : new Date(currentAdminData.createdAt.seconds * 1000);
			if (adminProfileRegisteredOn) {
				adminProfileRegisteredOn.innerText = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
			}
		}

		// Update photos
		if (currentAdminData.photoURL) {
			if (adminProfilePhoto) adminProfilePhoto.src = currentAdminData.photoURL;
			if (sidebarProfilePhoto) sidebarProfilePhoto.src = currentAdminData.photoURL;
		}

	} catch (err) {
		console.error("loadAdminProfile error:", err);
	}
}

// Photo button click
const adminPhotoBtn = document.getElementById("adminPhotoBtn");
if (adminPhotoBtn) {
	adminPhotoBtn.onclick = () => {
		adminProfileUpdateType = "photo";
		openAdminProfileModal();
	};
}

// Edit profile button click
const adminEditProfileBtn = document.getElementById("adminEditProfileBtn");
if (adminEditProfileBtn) {
	adminEditProfileBtn.onclick = () => {
		adminProfileUpdateType = "details";
		openAdminProfileModal();
	};
}

// Open modal
function openAdminProfileModal() {
	const modal = document.getElementById("adminProfileModal");
	const photoArea = document.getElementById("adminPhotoUpdateArea");
	const detailsArea = document.getElementById("adminDetailsUpdateArea");
	const adminPhoneInput = document.getElementById("adminPhoneInput");
	const adminDeptInput = document.getElementById("adminDeptInput");

	if (!modal) return;

	if (adminProfileUpdateType === "photo") {
		if (photoArea) photoArea.classList.remove("hidden");
		if (detailsArea) detailsArea.classList.add("hidden");
	} else {
		if (photoArea) photoArea.classList.add("hidden");
		if (detailsArea) detailsArea.classList.remove("hidden");

		// Pre-fill current values
		if (currentAdminData) {
			if (adminPhoneInput) adminPhoneInput.value = currentAdminData.phone || "";
			if (adminDeptInput) adminDeptInput.value = currentAdminData.department || "";
		}
	}

	modal.classList.remove("hidden");
}

// Cancel modal
const adminCancelModal = document.getElementById("adminCancelModal");
if (adminCancelModal) {
	adminCancelModal.onclick = () => {
		const modal = document.getElementById("adminProfileModal");
		if (modal) modal.classList.add("hidden");
		adminProfileUpdateType = null;
	};
}

// Photo input change
let adminNewPhotoBase64 = null;
const adminPhotoInput = document.getElementById("adminPhotoInput");
if (adminPhotoInput) {
	adminPhotoInput.onchange = (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (re) => {
			adminNewPhotoBase64 = re.target.result;
			const preview = document.getElementById("adminPhotoPreview");
			if (preview) preview.innerText = `Selected: ${file.name}`;
		};
		reader.readAsDataURL(file);
	};
}

// Save profile changes
const adminSaveProfileBtn = document.getElementById("adminSaveProfileBtn");
if (adminSaveProfileBtn) {
	adminSaveProfileBtn.onclick = async () => {
		try {
			if (!auth.currentUser) return;

			adminSaveProfileBtn.disabled = true;
			adminSaveProfileBtn.innerText = "Saving...";

			const userRef = doc(db, "users", auth.currentUser.uid);

			if (adminProfileUpdateType === "photo") {
				if (!adminNewPhotoBase64) {
					alert("Please select a photo");
					return;
				}

				await updateDoc(userRef, {
					photoURL: adminNewPhotoBase64
				});

				alert("✓ Profile photo updated successfully!");
			} else {
				const adminPhoneInput = document.getElementById("adminPhoneInput");
				const adminDeptInput = document.getElementById("adminDeptInput");

				const updates = {};
				if (adminPhoneInput && adminPhoneInput.value.trim()) {
					updates.phone = adminPhoneInput.value.trim();
				}
				if (adminDeptInput && adminDeptInput.value.trim()) {
					updates.department = adminDeptInput.value.trim();
				}

				if (Object.keys(updates).length === 0) {
					alert("No changes to save");
					return;
				}

				await updateDoc(userRef, updates);

				alert("✓ Profile updated successfully!");
			}

			// Close modal and reload profile
			const modal = document.getElementById("adminProfileModal");
			if (modal) modal.classList.add("hidden");

			await loadAdminProfile();
			adminProfileUpdateType = null;
			adminNewPhotoBase64 = null;

		} catch (err) {
			console.error("Save profile error:", err);
			alert("Failed to update profile: " + err.message);
		} finally {
			adminSaveProfileBtn.disabled = false;
			adminSaveProfileBtn.innerText = "Save Changes";
		}
	};
}

// Load profile when auth state changes
onAuthStateChanged(auth, async (user) => {
	if (user) {
		await loadAdminProfile();
	}
});


/* ================= DAYS COUNT MANAGEMENT ================= */

// Save academic year
if (saveAcademicYear) {
	saveAcademicYear.onclick = async () => {
		try {
			const academicYearCollegeId = await resolveAcademicYearCollegeId();
			const startDate = academicStartDate?.value;
			const endDate = academicEndDate?.value;

			if (!academicYearCollegeId) {
				alert('Please select a college');
				return;
			}

			if (!startDate || !endDate) {
				alert('Please select both start and end dates');
				return;
			}

			if (startDate > endDate) {
				alert('Start date must be before end date');
				return;
			}

			await setDoc(getAcademicYearDocRef(academicYearCollegeId), {
				collegeId: academicYearCollegeId,
				startDate: startDate,
				endDate: endDate,
				updatedAt: serverTimestamp()
			});

			alert('Academic year saved successfully!');
			await loadAcademicYearList();
			await calculateTotalDays();

		} catch (err) {
			console.error('saveAcademicYear error', err);
			alert('Failed to save academic year: ' + err.message);
		}
	};
}

// Load current academic year
if (loadCurrentAcademicYear) {
	loadCurrentAcademicYear.onclick = async () => {
		try {
			const academicYearCollegeId = await resolveAcademicYearCollegeId();
			if (!academicYearCollegeId) {
				alert('Please select a college');
				return;
			}

			const academicYearDoc = await getDoc(getAcademicYearDocRef(academicYearCollegeId));

			if (academicYearDoc.exists()) {
				const data = academicYearDoc.data();
				if (academicStartDate) academicStartDate.value = data.startDate;
				if (academicEndDate) academicEndDate.value = data.endDate;
				alert('Academic year loaded successfully!');
			} else {
				alert('No academic year settings found');
			}

		} catch (err) {
			console.error('loadCurrentAcademicYear error', err);
			alert('Failed to load academic year: ' + err.message);
		}
	};
}

// Load attendance statistics
async function loadAttendanceStatistics() {
	try {
		const academicYearCollegeId = await resolveAcademicYearCollegeId();
		if (!daysCountTable) {
			console.error('daysCountTable element not found');
			return;
		}

		if (!academicYearCollegeId) {
			safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">Please select a college</td></tr>', 'html');
			return;
		}

		if (!statsStartDate || !statsEndDate) {
			console.error('Date input elements not found');
			safeSet(daysCountTable, '<tr><td colspan="6" style="text-align:center;">Error: Date inputs not found</td></tr>', 'html');
			return;
		}

		let startDate = statsStartDate.value;
		let endDate = statsEndDate.value;

		if (!startDate || !endDate) {
			const academicYearDoc = await getDoc(getAcademicYearDocRef(academicYearCollegeId));
			if (academicYearDoc.exists()) {
				const ayData = academicYearDoc.data();
				startDate = ayData.startDate;
				endDate = new Date().toISOString().split('T')[0];
				statsStartDate.value = startDate;
				statsEndDate.value = endDate;
			}
		}

		if (!startDate || !endDate) {
			safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">Please select both start and end dates</td></tr>', 'html');
			return;
		}

		if (startDate > endDate) {
			safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">Start date must be before end date</td></tr>', 'html');
			return;
		}

		safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>', 'html');

		// Get total approved students
		const usersSnap = await getDocs(query(collection(db, "users"), where("collegeId", "==", academicYearCollegeId)));
		let totalStudents = 0;
		usersSnap.forEach(d => {
			const u = d.data();
			if (u.role === "student" && u.approved) {
				totalStudents++;
			}
		});

		if (totalStudents === 0) {
			safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">No approved students found</td></tr>', 'html');
			return;
		}

		// Get attendance records
		const attSnap = await getDocs(query(collection(db, "attendanceRecords"), where("collegeId", "==", academicYearCollegeId)));
		const dateStats = {};

		attSnap.forEach(d => {
			const record = d.data();
			const date = record.date;

			if (date >= startDate && date <= endDate) {
				if (!dateStats[date]) {
					dateStats[date] = { fnPresent: 0, anPresent: 0 };
				}

				if (record.status === "present") {
					if (record.session === "FN") {
						dateStats[date].fnPresent++;
					} else if (record.session === "AN") {
						dateStats[date].anPresent++;
					}
				}
			}
		});

		// Generate all dates in range
		const dates = [];
		const current = new Date(startDate);
		const end = new Date(endDate);

		while (current <= end) {
			const dateStr = current.toISOString().split('T')[0];
			dates.push(dateStr);
			current.setDate(current.getDate() + 1);
		}

		if (dates.length === 0) {
			safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">No dates in range</td></tr>', 'html');
			return;
		}

		// Generate table rows
		let rows = "";
		dates.forEach((date, index) => {
			const dateObj = new Date(date + 'T00:00:00');
			const isSunday = dateObj.getDay() === 0;

			if (isSunday) {
				rows += `
					<tr>
						<td>${index + 1}</td>
						<td><strong>${date}</strong></td>
						<td colspan="6" style="text-align: center; color: #8b5cf6; font-weight: 600;">Holiday</td>
					</tr>
				`;
			} else {
				const stats = dateStats[date] || { fnPresent: 0, anPresent: 0 };
				const fnAbsent = totalStudents - stats.fnPresent;
				const anAbsent = totalStudents - stats.anPresent;
				const totalPresent = stats.fnPresent + stats.anPresent;
				const totalPossible = totalStudents * 2; // FN + AN
				const percentage = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) : 0;
				const percentColor = percentage >= 75 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';

				rows += `
					<tr>
						<td>${index + 1}</td>
						<td><strong>${date}</strong></td>
						<td style="color: #10b981;">${stats.fnPresent}</td>
						<td style="color: #ef4444;">${fnAbsent}</td>
						<td style="color: #10b981;">${stats.anPresent}</td>
						<td style="color: #ef4444;">${anAbsent}</td>
						<td><strong>${totalPresent}</strong></td>
						<td style="color: ${percentColor}; font-weight: 600;">${percentage}%</td>
					</tr>
				`;
			}
		});

		safeSet(daysCountTable, rows, 'html');

	} catch (err) {
		console.error('loadAttendanceStatistics error', err);
		safeSet(daysCountTable, '<tr><td colspan="8" style="text-align:center;">Failed to load statistics</td></tr>', 'html');
	}
}

// Load button click
if (loadDaysCount) {
	loadDaysCount.onclick = loadAttendanceStatistics;
}

if (academicYearCollegeSelect) {
	academicYearCollegeSelect.onchange = async () => {
		academicYearCollegeSelect.dataset.selectedCollegeId = academicYearCollegeSelect.value;
		if (academicStartDate) academicStartDate.value = "";
		if (academicEndDate) academicEndDate.value = "";
		if (statsStartDate) statsStartDate.value = "";
		if (statsEndDate) statsEndDate.value = "";
		await calculateTotalDays();
	};
}

if (refreshAcademicYearCollegeList) {
	refreshAcademicYearCollegeList.onclick = async () => {
		allColleges = [];
		await initializeAcademicYearManagement();
	};
}

// Set max date to today for statistics date inputs
if (statsStartDate && statsEndDate) {
	const today = new Date().toISOString().split('T')[0];
	statsStartDate.max = today;
	statsEndDate.max = today;
}

// Set max date to today for all other date inputs
if (attendanceDateFilter) {
	const today = new Date().toISOString().split('T')[0];
	attendanceDateFilter.max = today;
}

if (holidayDate) {
	const today = new Date().toISOString().split('T')[0];
	holidayDate.max = today;
}

if (holidayStart && holidayEnd) {
	const today = new Date().toISOString().split('T')[0];
	holidayStart.max = today;
	holidayEnd.max = today;
}


/* ================= INVITE ADMIN/PRINCIPAL ================= */

// EmailJS Configuration - Replace with your actual keys
const EMAILJS_PUBLIC_KEY = "pZ5Z7DtClyskT-d5S"; // ⚠️ Add your EmailJS public key
const EMAILJS_SERVICE_ID = "service_17odv2l";
const EMAILJS_TEMPLATE_ID = "template_g3rbkxk";

// Website URL - Your Vercel production URL	
const WEBSITE_URL = window.location.origin;

// Initialize EmailJS (only if keys are configured)
if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== "YOUR_EMAILJS_PUBLIC_KEY") {
	emailjs.init(EMAILJS_PUBLIC_KEY);
}

// Load colleges into the invite college dropdown
async function loadInviteColleges() {
	if (!inviteCollege) return;
	try {
		const snap = await getDocs(collection(db, "colleges"));
		inviteCollege.innerHTML = '<option value="" disabled selected>Select College</option>';
		const colleges = [];
		snap.forEach(d => colleges.push({ id: d.id, ...d.data() }));
		colleges.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
		colleges.forEach(c => {
			const opt = document.createElement("option");
			opt.value = c.id;
			opt.textContent = `${c.name} (${c.code || 'N/A'})`;
			opt.dataset.name = c.name;
			inviteCollege.appendChild(opt);
		});
	} catch (e) { console.warn("loadInviteColleges:", e); }
}

// Show/hide college field based on role — superadmin is system-wide, no college needed
if (inviteRole) {
	inviteRole.addEventListener("change", () => {
		if (!inviteCollegeField) return;
		if (inviteRole.value === "superadmin") {
			inviteCollegeField.style.display = "none";
			if (inviteCollege) inviteCollege.required = false;
		} else {
			inviteCollegeField.style.display = "";
			if (inviteCollege) inviteCollege.required = true;
		}
	});
}

// Refresh Invites
if (refreshInvitesBtn) {
	refreshInvitesBtn.onclick = () => loadPendingInvites(true);
}

// Clear All Invites (Only Completed/Registered ones)
if (clearAllInvitesBtn) {
	clearAllInvitesBtn.onclick = async () => {
		// Proceed with deletion
		const clearIcon = clearAllInvitesBtn.querySelector('span');
		clearAllInvitesBtn.disabled = true;
		if (clearIcon) clearIcon.style.animation = "spin 1s linear infinite";

		try {
			console.log("Clearing completed invitation audit logs...");

			// Fetch only USED/REGISTERED invitations
			const invitesQuery = query(
				collection(db, "adminInvites"),
				where("used", "==", true)
			);
			const snapshot = await getDocs(invitesQuery);

			if (snapshot.empty) {
				showInviteMessage("✨ No completed invitation records to clear. The log is already clean!", "info");
				return;
			}

			// Show confirmation dialog
			const confirmMessage = `⚠️ This will permanently delete ${snapshot.size} COMPLETED/REGISTERED invitation record${snapshot.size !== 1 ? 's' : ''} from the audit log.\n\nPending invitations will NOT be affected (use 'Revoke' for those).\n\nAre you sure you want to continue?`;

			if (!confirm(confirmMessage)) {
				return;
			}

			const totalRecords = snapshot.size;
			let deletedCount = 0;
			let failedCount = 0;

			// Delete each completed invitation
			const deletePromises = [];
			snapshot.forEach((docSnapshot) => {
				deletePromises.push(
					deleteDoc(doc(db, "adminInvites", docSnapshot.id))
						.then(() => deletedCount++)
						.catch((error) => {
							console.error(`Failed to delete invite ${docSnapshot.id}:`, error);
							failedCount++;
						})
				);
			});

			// Wait for all deletions to complete
			await Promise.all(deletePromises);

			console.log(`Cleared ${deletedCount} completed invitation records, ${failedCount} failed`);

			// Show result message
			if (failedCount === 0) {
				showInviteMessage(`✅ Successfully cleared ${deletedCount} completed invitation record${deletedCount !== 1 ? 's' : ''}`, "success");
			} else {
				showInviteMessage(`⚠️ Cleared ${deletedCount} records, but ${failedCount} failed to delete`, "warning");
			}

			// Reload the audit log
			loadPendingInvites();

		} catch (error) {
			console.error("Error clearing completed invitation logs:", error);
			showInviteMessage(`❌ Failed to clear invitation logs: ${error.message}`, "error");
		} finally {
			clearAllInvitesBtn.disabled = false;
			if (clearIcon) clearIcon.style.animation = "none";
		}
	};
}

// Send Invite
if (sendInviteBtn) {
	sendInviteBtn.onclick = async () => {
		const email = inviteEmail?.value.trim();
		const role = inviteRole?.value;
		const selectedCollegeId = inviteCollege?.value || null;
		const selectedCollegeName = inviteCollege?.options[inviteCollege.selectedIndex]?.dataset?.name || inviteCollege?.options[inviteCollege.selectedIndex]?.text?.split(' (')[0] || null;

		if (!email || !role) {
			showInviteMessage("Please fill in all fields", "error");
			return;
		}

		// College is required for all non-superadmin roles
		if (role !== "superadmin" && !selectedCollegeId) {
			showInviteMessage("Please select a college for this invitation", "error");
			return;
		}

		// Email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			showInviteMessage("Please enter a valid email address", "error");
			return;
		}

		// Check if EmailJS is configured
		if (typeof emailjs === 'undefined' || EMAILJS_PUBLIC_KEY === "YOUR_EMAILJS_PUBLIC_KEY") {
			showInviteMessage("EmailJS is not configured. Please update the configuration in admin-dashboard.js", "error");
			return;
		}

		setInviteLoading(true);

		try {
			// Check if invite already exists
			const existingInvites = await getDocs(
				query(collection(db, "adminInvites"), where("email", "==", email), where("used", "==", false))
			);

			if (!existingInvites.empty) {
				showInviteMessage("An active invitation already exists for this email", "error");
				setInviteLoading(false);
				return;
			}

			// Generate secure token
			const token = crypto.randomUUID();

			// Calculate expiration (2 hours from now)
			const now = new Date();
			const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

			// Save invite to Firestore using token as ID
			const inviteData = {
				email: email,
				role: role,
				token: token,
				createdAt: serverTimestamp(),
				expiresAt: expiresAt,
				used: false,
				createdBy: auth.currentUser.uid
			};

			// Add college information for non-super admin roles
			if (role !== "superadmin") {
				inviteData.collegeId = selectedCollegeId;
				inviteData.collegeName = selectedCollegeName;
			}

			await setDoc(doc(db, "adminInvites", token), inviteData);

			// Send email via EmailJS
			const registrationLink = `${WEBSITE_URL}/register.html?token=${token}`;

			const emailParams = {
				to_email: email,
				to_name: email.split('@')[0],
				role: role.toUpperCase(),
				registration_link: registrationLink,
				expires_in: "2 hours",
				college_name: role === "superadmin" ? "Multi-College System" : selectedCollegeName
			};

			await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, emailParams);

			let successMessage = `✓ Invitation sent successfully to ${email}`;
			if (role === "superadmin") {
				successMessage += `\n🔑 Super Admin invite created - This user will have system-wide access to manage multiple colleges.`;
			}

			showInviteMessage(successMessage, "success");
			inviteEmail.value = "";
			inviteRole.value = "";
			if (inviteCollege) inviteCollege.value = "";
			if (inviteCollegeField) inviteCollegeField.style.display = "";
			loadPendingInvites();

		} catch (error) {
			console.error("Error sending invite:", error);
			console.error("Error details:", {
				text: error.text,
				status: error.status,
				message: error.message,
				fullError: JSON.stringify(error, null, 2)
			});

			// Show more detailed error message
			let errorMessage = "Failed to send invitation. ";
			if (error.text) {
				errorMessage += `Error: ${error.text}`;
			} else if (error.status) {
				errorMessage += `Status: ${error.status}`;
			} else if (error.message) {
				errorMessage += `Error: ${error.message}`;
			} else {
				errorMessage += "Check console (F12) for details.";
			}

			showInviteMessage(errorMessage, "error");
		} finally {
			setInviteLoading(false);
		}
	};
}

// Load invitations (Audit Log)
async function loadPendingInvites(showMessage = false) {
	if (!invitesTableBody) {
		console.warn("invitesTableBody element not found");
		return;
	}

	const refreshIcon = refreshInvitesBtn?.querySelector('span');
	if (refreshInvitesBtn) refreshInvitesBtn.disabled = true;
	if (refreshIcon) refreshIcon.style.animation = "spin 1s linear infinite";
	if (refreshIcon) refreshIcon.style.display = "inline-block";

	try {
		console.log("Loading Audit Log...");
		// Fetch ALL invitations for a true audit log (sorted by date)
		const invitesQuery = query(
			collection(db, "adminInvites"),
			orderBy("createdAt", "desc")
		);

		const snapshot = await getDocs(invitesQuery);
		const now = new Date();

		console.log(`Audit Log: Found ${snapshot.size} records`);

		if (snapshot.empty) {
			invitesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: #94a3b8;"><div style="font-size: 48px; margin-bottom: 12px;">📭</div><div style="font-size: 16px; font-weight: 600; color: #64748b;">No invitation records found</div><div style="font-size: 13px; margin-top: 4px;">Send your first invitation to get started!</div></td></tr>';
			if (showMessage) {
				showInviteMessage("✨ Audit log is empty. No invitations have been sent yet.", "info");
			}
			return;
		}

		let html = "";
		const inviteData = []; // Store invite data for real-time updates

		snapshot.forEach((doc) => {
			const invite = doc.data();
			console.log("Processing invite:", invite.email, "Created:", invite.createdAt?.toDate());

			const expiresAt = invite.expiresAt ? invite.expiresAt.toDate() : new Date();
			const createdAt = invite.createdAt ? invite.createdAt.toDate() : new Date();
			const isExpired = expiresAt < now;
			const isUsed = invite.used === true;

			// Calculate time left in milliseconds
			const timeLeftMs = Math.max(0, expiresAt - now);
			const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
			const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
			const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

			let statusClass = "status-pending";
			let statusLabel = "";

			if (isUsed) {
				statusClass = "status-registered";
				statusLabel = "Registered";
			} else if (isExpired) {
				statusClass = "status-expired";
				statusLabel = "Expired";
			} else {
				// Format time left as HH:MM:SS
				statusLabel = `Pending (${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`;
			}

			const sentAt = createdAt.toLocaleString('en-GB', {
				day: '2-digit',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			});

			// Store data for real-time countdown
			if (!isUsed && !isExpired) {
				inviteData.push({
					id: doc.id,
					expiresAt: expiresAt
				});
			}

			html += `
				<tr data-invite-id="${doc.id}">
					<td style="font-weight: 500;">${escapeHtml(invite.email)}</td>
					<td><span style="background: #eff6ff; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${escapeHtml(invite.role)}</span></td>
					<td style="color: #64748b; font-size: 13px;">${sentAt}</td>
					<td><span class="status-badge ${statusClass}" data-countdown="${doc.id}">${statusLabel}</span></td>
					<td>
						${!isUsed ? `
							<button class="revoke-btn" onclick="revokeInvite('${doc.id}')">
								Revoke
							</button>
						` : '<span style="color:#94a3b8; font-size:11px;">Completed</span>'}
					</td>
				</tr>
			`;
		});

		invitesTableBody.innerHTML = html;

		// Start real-time countdown for pending invitations
		startInviteCountdown(inviteData);

		// Show success message only when explicitly requested (button click)
		if (showMessage) {
			showInviteMessage(`✅ Audit log refreshed. Found ${snapshot.size} invitation record${snapshot.size !== 1 ? 's' : ''}.`, "success");
		}

	} catch (error) {
		console.error("Error loading invitations:", error);
		invitesTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #dc2626;"><div style="font-size: 48px; margin-bottom: 12px;">❌</div><div style="font-size: 16px; font-weight: 600;">Failed to load audit records</div><div style="font-size: 13px; margin-top: 4px;">Error: ${error.message}</div></td></tr>`;
		if (showMessage) {
			showInviteMessage(`❌ Failed to refresh: ${error.message}`, "error");
		}
	} finally {
		if (refreshInvitesBtn) refreshInvitesBtn.disabled = false;
		if (refreshIcon) refreshIcon.style.animation = "none";
	}
}

// Real-time countdown for pending invitations
let inviteCountdownInterval = null;

function startInviteCountdown(inviteData) {
	// Clear any existing countdown
	if (inviteCountdownInterval) {
		clearInterval(inviteCountdownInterval);
	}

	if (!inviteData || inviteData.length === 0) {
		return;
	}

	// Update countdown every second
	inviteCountdownInterval = setInterval(() => {
		const now = new Date();
		let hasExpired = false;

		inviteData.forEach(invite => {
			const countdownElement = document.querySelector(`[data-countdown="${invite.id}"]`);
			if (!countdownElement) return;

			const timeLeftMs = Math.max(0, invite.expiresAt - now);

			if (timeLeftMs === 0) {
				// Invitation has expired
				countdownElement.textContent = "Expired";
				countdownElement.className = "status-badge status-expired";
				hasExpired = true;
			} else {
				// Calculate time components
				const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
				const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
				const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

				// Update display
				countdownElement.textContent = `Pending (${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')})`;
			}
		});

		// If any invitation expired, reload the table
		if (hasExpired) {
			clearInterval(inviteCountdownInterval);
			setTimeout(() => loadPendingInvites(), 1000);
		}
	}, 1000);
}

// Clear countdown when leaving the page
window.addEventListener('beforeunload', () => {
	if (inviteCountdownInterval) {
		clearInterval(inviteCountdownInterval);
	}
});

// Revoke invite
window.revokeInvite = async (inviteId) => {
	if (!confirm("Are you sure you want to revoke this invitation?")) {
		return;
	}

	try {
		await deleteDoc(doc(db, "adminInvites", inviteId));
		showInviteMessage("Invitation revoked successfully", "success");
		loadPendingInvites();
	} catch (error) {
		console.error("Error revoking invite:", error);
		showInviteMessage("Failed to revoke invitation", "error");
	}
};

// Helper functions for invite system
function showInviteMessage(message, type) {
	if (!inviteStatusMessage) return;

	inviteStatusMessage.textContent = message;
	inviteStatusMessage.className = "";
	inviteStatusMessage.classList.remove("hidden");

	if (type === "success") {
		inviteStatusMessage.style.background = "#d1fae5";
		inviteStatusMessage.style.color = "#065f46";
		inviteStatusMessage.style.border = "1px solid #6ee7b7";
		alert("✅ SUCCESS: " + message);
	} else {
		inviteStatusMessage.style.background = "#fee2e2";
		inviteStatusMessage.style.color = "#991b1b";
		inviteStatusMessage.style.border = "1px solid #fca5a5";
		alert("❌ ERROR: " + message);
	}

	setTimeout(() => {
		inviteStatusMessage.classList.add("hidden");
	}, 10000); // Keep visible longer
}

function setInviteLoading(loading) {
	if (!sendInviteBtn) return;

	if (loading) {
		sendInviteBtn.disabled = true;
		sendInviteBtn.textContent = "📤 Sending...";
		sendInviteBtn.style.opacity = "0.6";
	} else {
		sendInviteBtn.disabled = false;
		sendInviteBtn.textContent = "📤 Send Invite";
		sendInviteBtn.style.opacity = "1";
	}
}

// Load invites when section is shown
const inviteAdminSection = document.getElementById("invite");
if (inviteAdminSection) {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.target.classList.contains('active')) {
				loadPendingInvites();
			}
		});
	});

	observer.observe(inviteAdminSection, {
		attributes: true,
		attributeFilter: ['class']
	});
}

/* ================= MESSAGES & FEEDBACK MANAGEMENT ================= */

// Messages elements
const messagesSearch = document.getElementById("messagesSearch");
const messagesFilter = document.getElementById("messagesFilter");
const refreshMessagesBtn = document.getElementById("refreshMessagesBtn");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const messagesTableBody = document.getElementById("messagesTableBody");
const messageModal = document.getElementById("messageModal");

// Modal elements
const modalMessageName = document.getElementById("modalMessageName");
const modalMessageEmail = document.getElementById("modalMessageEmail");
const modalMessageInstitution = document.getElementById("modalMessageInstitution");
const modalMessageSubject = document.getElementById("modalMessageSubject");
const modalMessageDate = document.getElementById("modalMessageDate");
const modalMessageContent = document.getElementById("modalMessageContent");
const replyMessageBtn = document.getElementById("replyMessageBtn");
const markReadBtn = document.getElementById("markReadBtn");
const deleteMessageBtn = document.getElementById("deleteMessageBtn");

let currentMessages = [];
let currentMessageId = null;

// Load messages from Firestore or localStorage
// Test function to add a sample message (for debugging)
window.addTestMessage = function () {
	const testMessage = {
		name: 'Test User',
		email: 'test@example.com',
		institution: 'Test Institution',
		subject: 'demo',
		message: 'This is a test message to verify the system is working.',
		timestamp: new Date().toISOString(),
		read: false,
		id: Date.now().toString()
	};

	const existingMessages = JSON.parse(localStorage.getItem('contactMessages') || '[]');
	existingMessages.unshift(testMessage);
	localStorage.setItem('contactMessages', JSON.stringify(existingMessages));

	console.log('Test message added:', testMessage);
	console.log('All messages:', existingMessages);

	// If we're on the admin dashboard, reload messages
	if (typeof loadMessages === 'function') {
		loadMessages();
	}
};

async function loadMessages() {
	try {
		// For now, use localStorage as fallback
		// In production, you would load from Firestore
		const messages = JSON.parse(localStorage.getItem('contactMessages') || '[]');
		console.log('Loading messages from localStorage:', messages); // Debug log
		currentMessages = messages;
		renderMessagesTable();
	} catch (error) {
		console.error('Error loading messages:', error);
		if (messagesTableBody) {
			messagesTableBody.innerHTML = `
				<tr>
					<td colspan="8" style="text-align: center; padding: 40px; color: #dc2626;">
						Failed to load messages. Error: ${error.message}
					</td>
				</tr>
			`;
		}
	}
}

// Render messages table
function renderMessagesTable() {
	console.log('renderMessagesTable called, messagesTableBody:', messagesTableBody); // Debug log
	console.log('currentMessages:', currentMessages); // Debug log

	if (!messagesTableBody) return;

	if (currentMessages.length === 0) {
		messagesTableBody.innerHTML = `
			<tr>
				<td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
					No messages found
				</td>
			</tr>
		`;
		return;
	}

	// Apply filters
	let filteredMessages = currentMessages;

	const searchTerm = messagesSearch?.value.toLowerCase() || '';
	const filterValue = messagesFilter?.value || 'all';

	if (searchTerm) {
		filteredMessages = filteredMessages.filter(msg =>
			msg.name.toLowerCase().includes(searchTerm) ||
			msg.email.toLowerCase().includes(searchTerm) ||
			msg.subject.toLowerCase().includes(searchTerm) ||
			msg.message.toLowerCase().includes(searchTerm) ||
			(msg.institution && msg.institution.toLowerCase().includes(searchTerm))
		);
	}

	if (filterValue !== 'all') {
		if (filterValue === 'read') {
			filteredMessages = filteredMessages.filter(msg => msg.read);
		} else if (filterValue === 'unread') {
			filteredMessages = filteredMessages.filter(msg => !msg.read);
		} else {
			filteredMessages = filteredMessages.filter(msg => msg.subject === filterValue);
		}
	}

	// Render table rows
	const rows = filteredMessages.map((msg, index) => {
		const date = new Date(msg.timestamp);
		const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
		const preview = msg.message.length > 50 ? msg.message.substring(0, 50) + '...' : msg.message;

		return `
			<tr style="cursor: pointer;" onclick="openMessageModal('${msg.id}')">
				<td>
					<span class="message-status ${msg.read ? 'read' : 'unread'}">
						${msg.read ? '✓ Read' : '● Unread'}
					</span>
				</td>
				<td>${formattedDate}</td>
				<td>${escapeHtml(msg.name)}</td>
				<td>${escapeHtml(msg.email)}</td>
				<td>${escapeHtml(msg.institution)}</td>
				<td>${escapeHtml(msg.subject)}</td>
				<td class="message-preview">${escapeHtml(preview)}</td>
				<td>
					<button onclick="event.stopPropagation(); openMessageModal('${msg.id}')" 
							class="btn-primary" style="padding: 4px 8px; font-size: 12px;">
						View
					</button>
				</td>
			</tr>
		`;
	}).join('');

	messagesTableBody.innerHTML = rows;
}

// Open message modal
function openMessageModal(messageId) {
	const message = currentMessages.find(msg => msg.id === messageId);
	if (!message || !messageModal) return;

	currentMessageId = messageId;

	// Populate modal fields
	if (modalMessageName) modalMessageName.textContent = message.name;
	if (modalMessageEmail) modalMessageEmail.textContent = message.email;
	if (modalMessageInstitution) modalMessageInstitution.textContent = message.institution;
	if (modalMessageSubject) modalMessageSubject.textContent = message.subject;
	if (modalMessageDate) {
		const date = new Date(message.timestamp);
		modalMessageDate.textContent = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
	}
	if (modalMessageContent) modalMessageContent.textContent = message.message;

	// Update button states
	if (markReadBtn) {
		markReadBtn.textContent = message.read ? '✓ Mark as Unread' : '✓ Mark as Read';
	}

	// Show modal
	messageModal.style.display = 'flex';

	// Mark as read if it wasn't already
	if (!message.read) {
		markMessageAsRead(messageId, true);
	}
}

// Close message modal
function closeMessageModal() {
	if (messageModal) {
		messageModal.style.display = 'none';
	}
	currentMessageId = null;
}

// Mark message as read/unread
function markMessageAsRead(messageId, isRead) {
	const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
	if (messageIndex !== -1) {
		currentMessages[messageIndex].read = isRead;
		localStorage.setItem('contactMessages', JSON.stringify(currentMessages));
		renderMessagesTable();

		// Update button text if modal is open
		if (currentMessageId === messageId && markReadBtn) {
			markReadBtn.textContent = isRead ? '✓ Mark as Unread' : '✓ Mark as Read';
		}
	}
}

// Delete message
function deleteMessage(messageId) {
	if (confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
		currentMessages = currentMessages.filter(msg => msg.id !== messageId);
		localStorage.setItem('contactMessages', JSON.stringify(currentMessages));
		renderMessagesTable();
		closeMessageModal();
	}
}

// Mark all messages as read
function markAllMessagesAsRead() {
	if (confirm('Mark all messages as read?')) {
		currentMessages.forEach(msg => msg.read = true);
		localStorage.setItem('contactMessages', JSON.stringify(currentMessages));
		renderMessagesTable();
	}
}

// Reply to message (opens email client)
function replyToMessage() {
	const message = currentMessages.find(msg => msg.id === currentMessageId);
	if (!message) return;

	const subject = `Re: ${message.subject}`;
	const body = `\n\n--- Original Message ---\nFrom: ${message.name} <${message.email}>\nDate: ${new Date(message.timestamp).toLocaleString()}\nSubject: ${message.subject}\n\n${message.message}`;

	const mailtoLink = `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	window.open(mailtoLink);
}

// Event listeners
if (refreshMessagesBtn) {
	refreshMessagesBtn.addEventListener('click', loadMessages);
}

if (markAllReadBtn) {
	markAllReadBtn.addEventListener('click', markAllMessagesAsRead);
}

if (messagesSearch) {
	messagesSearch.addEventListener('input', renderMessagesTable);
}

if (messagesFilter) {
	messagesFilter.addEventListener('change', renderMessagesTable);
}

if (replyMessageBtn) {
	replyMessageBtn.addEventListener('click', replyToMessage);
}

if (markReadBtn) {
	markReadBtn.addEventListener('click', () => {
		if (currentMessageId) {
			const message = currentMessages.find(msg => msg.id === currentMessageId);
			if (message) {
				markMessageAsRead(currentMessageId, !message.read);
			}
		}
	});
}

if (deleteMessageBtn) {
	deleteMessageBtn.addEventListener('click', () => {
		if (currentMessageId) {
			deleteMessage(currentMessageId);
		}
	});
}

// Close modal when clicking outside
if (messageModal) {
	messageModal.addEventListener('click', (e) => {
		if (e.target === messageModal) {
			closeMessageModal();
		}
	});
}

// Make functions globally available
window.openMessageModal = openMessageModal;
window.closeMessageModal = closeMessageModal;

// Load messages when messages section is shown
document.addEventListener('DOMContentLoaded', () => {
	// Check if we're on the messages section
	if (window.location.hash === '#messages') {
		loadMessages();
	}
});

// Load messages when section changes to messages
const originalShowSection = window.showSection;
if (originalShowSection) {
	window.showSection = function (id) {
		originalShowSection(id);
		if (id === 'messages') {
			loadMessages();
		}
	};
}
/* ================= NOTIFICATION MANAGEMENT ================= */

/* ================= EMAIL REMINDER MANAGEMENT ================= */

let emailReminderSettings = {
	emailRemindersEnabled: true,
	reminderMinutes: 10,
	emailjsPublicKey: 'pZ5Z7DtClyskT-d5S',
	emailjsServiceId: 'service_17odv2l',
	emailjsTemplateId: 'template_o8c4fyw'
};

// Initialize email reminder management
function initializeEmailReminderManagement() {
	// Load saved settings
	const savedSettings = localStorage.getItem('emailReminderSettings');
	if (savedSettings) {
		emailReminderSettings = { ...emailReminderSettings, ...JSON.parse(savedSettings) };
	}

	// Update UI
	updateEmailReminderUI();
	setupEmailReminderListeners();
	updateEmailReminderStats();
}

// Function to update email reminder timing display
function updateEmailReminderTiming(fnEndTime, anEndTime) {
	const reminderMinutesInput = document.getElementById('emailReminderMinutes');
	const fnReminderTimeEl = document.getElementById('fnReminderTime');
	const anReminderTimeEl = document.getElementById('anReminderTime');
	const scheduleInfoEl = document.getElementById('scheduleInfo');

	if (!reminderMinutesInput || !fnReminderTimeEl || !anReminderTimeEl) return;

	const reminderMinutes = parseInt(reminderMinutesInput.value) || 10;

	// Function to subtract minutes from time string
	function subtractMinutes(timeStr, minutes) {
		const [hours, mins] = timeStr.split(':').map(Number);
		const totalMinutes = hours * 60 + mins - minutes;
		const newHours = Math.floor(totalMinutes / 60);
		const newMins = totalMinutes % 60;
		return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
	}

	// Function to format time to 12-hour format
	function formatTo12Hour(timeStr) {
		const [hours, mins] = timeStr.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${displayHours}:${String(mins).padStart(2, '0')} ${period}`;
	}

	// Calculate reminder times
	const fnReminderTime = subtractMinutes(fnEndTime, reminderMinutes);
	const anReminderTime = subtractMinutes(anEndTime, reminderMinutes);

	// Update display
	fnReminderTimeEl.textContent = formatTo12Hour(fnReminderTime);
	anReminderTimeEl.textContent = formatTo12Hour(anReminderTime);

	// Update schedule info
	if (scheduleInfoEl) {
		scheduleInfoEl.textContent = `${reminderMinutes} min before FN (${formatTo12Hour(fnReminderTime)}) & AN (${formatTo12Hour(anReminderTime)})`;
	}
}

function updateEmailReminderUI() {
	const emailToggle = document.getElementById('emailRemindersToggle');
	const reminderMinutes = document.getElementById('emailReminderMinutes');
	const publicKey = document.getElementById('emailjsPublicKey');
	const serviceId = document.getElementById('emailjsServiceId');
	const templateId = document.getElementById('emailjsTemplateId');

	if (emailToggle) emailToggle.checked = emailReminderSettings.emailRemindersEnabled;
	if (reminderMinutes) reminderMinutes.value = emailReminderSettings.reminderMinutes;
	if (publicKey) publicKey.value = emailReminderSettings.emailjsPublicKey;
	if (serviceId) serviceId.value = emailReminderSettings.emailjsServiceId;
	if (templateId) templateId.value = emailReminderSettings.emailjsTemplateId;
}

function setupEmailReminderListeners() {
	const emailToggle = document.getElementById('emailRemindersToggle');
	const reminderMinutes = document.getElementById('emailReminderMinutes');
	const publicKey = document.getElementById('emailjsPublicKey');
	const serviceId = document.getElementById('emailjsServiceId');
	const templateId = document.getElementById('emailjsTemplateId');
	const saveBtn = document.getElementById('saveEmailSettings');
	const testBtn = document.getElementById('testEmailReminderBtn');
	const bulkTestBtn = document.getElementById('bulkTestEmailBtn');
	const bulkReminderBtn = document.getElementById('bulkReminderBtn');

	if (emailToggle) {
		emailToggle.addEventListener('change', (e) => {
			emailReminderSettings.emailRemindersEnabled = e.target.checked;
			saveEmailReminderSettings();
			showEmailReminderMessage(
				e.target.checked ? '✅ Email reminders enabled' : '🔕 Email reminders disabled',
				'info'
			);
		});
	}

	if (reminderMinutes) {
		reminderMinutes.addEventListener('change', (e) => {
			emailReminderSettings.reminderMinutes = parseInt(e.target.value);
			saveEmailReminderSettings();
			showEmailReminderMessage('⏰ Reminder timing updated', 'info');

			// Update timing display
			const fnEndInput = document.getElementById('fnEnd');
			const anEndInput = document.getElementById('anEnd');
			if (fnEndInput && anEndInput) {
				updateEmailReminderTiming(fnEndInput.value, anEndInput.value);
			}
		});
	}

	if (saveBtn) {
		saveBtn.addEventListener('click', () => {
			saveEmailConfiguration();
		});
	}

	if (testBtn) {
		testBtn.addEventListener('click', async () => {
			await sendTestEmailReminder();
		});
	}

	if (bulkTestBtn) {
		bulkTestBtn.addEventListener('click', async () => {
			await sendBulkTestEmails();
		});
	}

	if (bulkReminderBtn) {
		bulkReminderBtn.addEventListener('click', async () => {
			await sendBulkReminders();
		});
	}
}

function saveEmailConfiguration() {
	const emailToggle = document.getElementById('emailRemindersToggle')?.checked;
	const reminderMinutes = document.getElementById('emailReminderMinutes')?.value;

	if (!reminderMinutes || reminderMinutes < 5 || reminderMinutes > 60) {
		showEmailReminderMessage('❌ Please enter a valid reminder time (5-60 minutes)', 'error');
		return;
	}

	// Update settings with pre-configured EmailJS values
	emailReminderSettings.emailRemindersEnabled = emailToggle;
	emailReminderSettings.reminderMinutes = parseInt(reminderMinutes);

	// Use pre-configured EmailJS settings
	emailReminderSettings.emailjsPublicKey = 'pZ5Z7DtClyskT-d5S';
	emailReminderSettings.emailjsServiceId = 'service_17odv2l';
	emailReminderSettings.emailjsTemplateId = 'template_o8c4fyw';

	saveEmailReminderSettings();

	// Update the email reminder service
	if (window.emailReminderService) {
		window.emailReminderService.emailjsPublicKey = emailReminderSettings.emailjsPublicKey;
		window.emailReminderService.serviceId = emailReminderSettings.emailjsServiceId;
		window.emailReminderService.templateId = emailReminderSettings.emailjsTemplateId;
		window.emailReminderService.sessionSettings.reminderMinutes = emailReminderSettings.reminderMinutes;
	}

	showEmailReminderMessage('✅ Email reminder settings saved successfully', 'success');
	updateEmailReminderStats();
}

async function sendTestEmailReminder() {
	showEmailReminderMessage('📤 Sending test email reminder...', 'info');

	try {
		// Validate configuration first
		const publicKey = document.getElementById('emailjsPublicKey')?.value;
		const serviceId = document.getElementById('emailjsServiceId')?.value;
		const templateId = document.getElementById('emailjsTemplateId')?.value;

		if (!publicKey || !serviceId || !templateId) {
			showEmailReminderMessage('❌ Please configure EmailJS settings first', 'error');
			return;
		}

		// Initialize EmailJS with current settings
		if (typeof emailjs !== 'undefined') {
			emailjs.init(publicKey);
		} else {
			showEmailReminderMessage('❌ EmailJS library not loaded', 'error');
			return;
		}

		// Get current user info (admin)
		let adminEmail = 'test@gmail.com'; // Default test email

		// Try to get actual admin email from various sources
		if (window.currentUser && window.currentUser.email) {
			adminEmail = window.currentUser.email;
		} else if (typeof currentUser !== 'undefined' && currentUser && currentUser.email) {
			adminEmail = currentUser.email;
		} else if (window.auth && window.auth.currentUser && window.auth.currentUser.email) {
			adminEmail = window.auth.currentUser.email;
		} else {
			// Try localStorage
			const userStr = localStorage.getItem('currentUser');
			if (userStr) {
				try {
					const user = JSON.parse(userStr);
					if (user.email) adminEmail = user.email;
				} catch (e) { }
			}
		}

		const adminUser = {
			name: document.getElementById('adminName')?.textContent || 'Admin',
			email: adminEmail,
			studentId: 'ADMIN001'
		};

		// Prepare test email parameters
		const templateParams = {
			to_name: adminUser.name,
			to_email: adminUser.email,
			student_id: adminUser.studentId,
			session_name: 'Test Session',
			session_type: 'TEST',
			minutes_left: '10',
			session_end_time: '12:00',
			current_time: new Date().toLocaleTimeString(),
			current_date: new Date().toLocaleDateString(),
			dashboard_link: window.location.origin + '/student-dashboard.html?v=20260315b#markPage'
		};

		// Debug: Log what we're sending
		console.log('📧 Sending email with parameters:', templateParams);
		console.log('📧 Admin email being used:', adminUser.email);
		console.log('📧 EmailJS config:', { serviceId, templateId, publicKey });

		// Send test email
		const response = await emailjs.send(serviceId, templateId, templateParams);

		console.log('✅ Test email sent:', response);
		showEmailReminderMessage('✅ Test email sent successfully! Check your inbox.', 'success');

		// Log the test
		logEmailReminderActivity('test_email_sent', 'Test email sent successfully', adminUser);

	} catch (error) {
		console.error('❌ Test email failed:', error);

		// Better error handling and logging
		let errorMessage = 'Unknown error';

		if (error && typeof error === 'object') {
			if (error.message) {
				errorMessage = error.message;
			} else if (error.text) {
				errorMessage = error.text;
			} else if (error.status) {
				errorMessage = `Status ${error.status}: ${error.text || 'Unknown error'}`;
			} else {
				errorMessage = JSON.stringify(error);
			}
		} else if (typeof error === 'string') {
			errorMessage = error;
		}

		console.log('📊 Full error object:', error);
		console.log('📊 Error type:', typeof error);
		console.log('📊 Error keys:', error ? Object.keys(error) : 'No keys');

		showEmailReminderMessage(`❌ Test email failed: ${errorMessage}`, 'error');

		// Log the error
		logEmailReminderActivity('test_email_failed', errorMessage, null);
	}
}

// Send bulk test emails to all students
async function sendBulkTestEmails() {
	showEmailReminderMessage('📧 Sending test emails to all students...', 'info');

	try {
		if (!window.emailReminderService) {
			showEmailReminderMessage('❌ Email reminder service not available', 'error');
			return;
		}

		const success = await window.emailReminderService.sendTestEmailToAllStudents();

		if (success) {
			showEmailReminderMessage('✅ Bulk test emails completed! Check logs for details.', 'success');
		} else {
			showEmailReminderMessage('❌ Bulk test emails failed', 'error');
		}

		// Update stats after bulk operation
		updateEmailReminderStats();

	} catch (error) {
		console.error('❌ Bulk test emails failed:', error);
		showEmailReminderMessage(`❌ Bulk test emails failed: ${error.message}`, 'error');
	}
}

// Send bulk reminders to all students NOW
async function sendBulkReminders() {
	// Confirm before sending bulk reminders
	const confirmed = confirm(
		'🚨 BULK REMINDER ALERT 🚨\n\n' +
		'This will send email reminders to ALL students who haven\'t marked attendance for the current session.\n\n' +
		'Are you sure you want to proceed?'
	);

	if (!confirmed) {
		return;
	}

	showEmailReminderMessage('🚨 Sending bulk reminders to all students...', 'info');

	try {
		if (!window.emailReminderService) {
			showEmailReminderMessage('❌ Email reminder service not available', 'error');
			return;
		}

		const success = await window.emailReminderService.sendBulkRemindersNow();

		if (success) {
			showEmailReminderMessage('✅ Bulk reminders sent successfully! Check logs for details.', 'success');
		} else {
			showEmailReminderMessage('❌ Bulk reminders failed or no active session', 'error');
		}

		// Update stats after bulk operation
		updateEmailReminderStats();

	} catch (error) {
		console.error('❌ Bulk reminders failed:', error);
		showEmailReminderMessage(`❌ Bulk reminders failed: ${error.message}`, 'error');
	}
}

function updateEmailReminderStats() {
	const totalEmailsEl = document.getElementById('totalEmailsSent');
	const todayEmailsEl = document.getElementById('todayEmailsSent');
	const configStatusEl = document.getElementById('emailConfigStatus');
	const lastEmailEl = document.getElementById('lastEmailSent');

	// Get email logs
	const logs = JSON.parse(localStorage.getItem('emailReminderLogs') || '[]');
	const today = new Date().toISOString().split('T')[0];
	const todayLogs = logs.filter(log => log.date === today);

	if (totalEmailsEl) totalEmailsEl.textContent = logs.length;
	if (todayEmailsEl) todayEmailsEl.textContent = todayLogs.length;

	// Configuration status
	const isConfigured = emailReminderSettings.emailjsPublicKey &&
		emailReminderSettings.emailjsServiceId &&
		emailReminderSettings.emailjsTemplateId;

	if (configStatusEl) {
		configStatusEl.textContent = isConfigured ? 'Configured' : 'Not Configured';
		configStatusEl.style.color = isConfigured ? '#10b981' : '#ef4444';
	}

	// Last email sent
	if (lastEmailEl && logs.length > 0) {
		const lastLog = logs[logs.length - 1];
		const lastTime = new Date(lastLog.timestamp).toLocaleString();
		lastEmailEl.textContent = `${lastTime} (${lastLog.status})`;
	} else if (lastEmailEl) {
		lastEmailEl.textContent = 'No emails sent yet';
	}
}

function logEmailReminderActivity(action, details, user) {
	const log = {
		action: action,
		details: details,
		user: user,
		timestamp: new Date().toISOString(),
		date: new Date().toISOString().split('T')[0],
		time: new Date().toLocaleTimeString()
	};

	const logs = JSON.parse(localStorage.getItem('emailReminderActivityLogs') || '[]');
	logs.push(log);

	// Keep only last 200 logs
	if (logs.length > 200) {
		logs.splice(0, logs.length - 200);
	}

	localStorage.setItem('emailReminderActivityLogs', JSON.stringify(logs));
}

function saveEmailReminderSettings() {
	localStorage.setItem('emailReminderSettings', JSON.stringify(emailReminderSettings));
}

function showEmailReminderMessage(message, type = 'info') {
	// Create or update email reminder message element
	let messageEl = document.getElementById('emailReminderMessage');
	if (!messageEl) {
		messageEl = document.createElement('div');
		messageEl.id = 'emailReminderMessage';
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
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            white-space: pre-line;
        `;
		document.body.appendChild(messageEl);
	}

	// Set message and color based on type
	messageEl.textContent = message;
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

	// Show message
	messageEl.style.transform = 'translateX(0)';
	messageEl.style.opacity = '1';

	// Hide after 6 seconds
	setTimeout(() => {
		messageEl.style.transform = 'translateX(100%)';
		messageEl.style.opacity = '0';
	}, 6000);
}

// Initialize email reminder management when page loads
document.addEventListener('DOMContentLoaded', () => {
	// Make Firestore functions available globally for email reminder service
	window.db = db;
	window.collection = collection;
	window.getDocs = getDocs;
	window.getDoc = getDoc;
	window.doc = doc;
	window.query = query;
	window.where = where;

	console.log('🔥 Firestore functions made available globally for email reminder service');

	setTimeout(initializeEmailReminderManagement, 2000);
});

// Export functions for global access
window.adminEmailReminder = {
	saveConfig: saveEmailConfiguration,
	testEmail: sendTestEmailReminder,
	bulkTestEmails: sendBulkTestEmails,
	bulkReminders: sendBulkReminders,
	getStats: updateEmailReminderStats,
	clearLogs: () => {
		localStorage.removeItem('emailReminderLogs');
		localStorage.removeItem('emailReminderActivityLogs');
		showEmailReminderMessage('🗑️ Email reminder logs cleared', 'success');
		updateEmailReminderStats();
	},

	// Debug function to test Firestore access
	testFirestore: async () => {
		try {
			console.log('🔥 Testing Firestore access from admin dashboard...');

			if (typeof window.db === 'undefined') {
				console.error('❌ window.db not available');
				return false;
			}

			const studentsQuery = window.collection(window.db, 'users');
			const snapshot = await window.getDocs(studentsQuery);

			const students = [];
			snapshot.forEach(doc => {
				const userData = doc.data();
				if (userData.role === 'student' && userData.approved && userData.email) {
					students.push({
						uid: doc.id,
						name: userData.name || 'Student',
						email: userData.email
					});
				}
			});

			console.log(`✅ Found ${students.length} students:`, students);
			showEmailReminderMessage(`✅ Firestore test: Found ${students.length} students`, 'success');
			return true;

		} catch (error) {
			console.error('❌ Firestore test failed:', error);
			showEmailReminderMessage(`❌ Firestore test failed: ${error.message}`, 'error');
			return false;
		}
	}
};

/* ================= MULTI-COLLEGE NAVIGATION ================= */

// College Management Link
const collegeManagementLink = document.getElementById("collegeManagementLink");
if (collegeManagementLink) {
	collegeManagementLink.onclick = () => {
		// Check if user has super admin privileges
		if (currentUserData && ["superadmin", "SuperAdmin"].includes(currentUserData.role)) {
			window.location.href = "college-management.html";
		} else {
			alert("Super admin privileges required to access college management.");
		}
	};
}

// My College Settings Link (for college admins)
const myCollegeSettingsLink = document.getElementById("myCollegeSettingsLink");
if (myCollegeSettingsLink) {
	myCollegeSettingsLink.onclick = () => {
		// Check if user is college admin or principal (not super admin)
		if (currentUserData && ["admin", "principal", "Admin", "Principal"].includes(currentUserData.role)) {
			window.location.href = "my-college-settings.html";
		} else {
			alert("Access denied. College admin or principal privileges required.");
		}
	};
}

// Migration Link
const migrationLink = document.getElementById("migrationLink");
if (migrationLink) {
	migrationLink.onclick = () => {
		// Check if user has admin privileges
		if (currentUserData && ["admin", "principal", "superadmin", "Admin", "Principal", "SuperAdmin"].includes(currentUserData.role)) {
			window.location.href = "migrate-multi-college.html";
		} else {
			alert("Admin privileges required to access migration tools.");
		}
	};
}

// Show/hide college management links based on user role
function updateCollegeManagementVisibility() {
	if (!currentUserData) return;

	const role = currentUserData.role;
	const isSuperAdmin = ["superadmin", "SuperAdmin"].includes(role);
	const isCollegeAdmin = ["admin", "principal", "Admin", "Principal"].includes(role);
	const isAdmin = ["admin", "principal", "superadmin", "Admin", "Principal", "SuperAdmin"].includes(role);

	// Show college management only for super admins
	if (collegeManagementLink) {
		collegeManagementLink.style.display = isSuperAdmin ? "block" : "none";
	}

	// Show my college settings only for college admins (not super admins)
	if (myCollegeSettingsLink) {
		myCollegeSettingsLink.style.display = (isCollegeAdmin && !isSuperAdmin) ? "block" : "none";
	}

	// Show migration link only for admins
	if (migrationLink) {
		migrationLink.style.display = isAdmin ? "block" : "none";
	}
}

// Call this after user data is loaded
if (currentUserData) {
	updateCollegeManagementVisibility();
}
/* ================= QUICK SUPER ADMIN CREATION ================= */

// Quick Super Admin Creation (No Email Required)
const createQuickSuperAdmin = document.getElementById("createQuickSuperAdmin");
const quickSuperAdminEmail = document.getElementById("quickSuperAdminEmail");
const quickSuperAdminResult = document.getElementById("quickSuperAdminResult");
const quickSuperAdminLink = document.getElementById("quickSuperAdminLink");

if (createQuickSuperAdmin) {
	createQuickSuperAdmin.onclick = async () => {
		const email = quickSuperAdminEmail?.value.trim();

		if (!email) {
			alert("Please enter an email address");
			return;
		}

		// Email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			alert("Please enter a valid email address");
			return;
		}

		createQuickSuperAdmin.disabled = true;
		createQuickSuperAdmin.textContent = "Creating...";

		try {
			// Check if invite already exists
			const existingInvites = await getDocs(
				query(collection(db, "adminInvites"), where("email", "==", email), where("used", "==", false))
			);

			if (!existingInvites.empty) {
				alert("An active invitation already exists for this email");
				return;
			}

			// Generate secure token
			const token = crypto.randomUUID();

			// Calculate expiration (24 hours for super admin setup)
			const now = new Date();
			const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

			// Save invite to Firestore using token as ID
			await setDoc(doc(db, "adminInvites", token), {
				email: email,
				role: "superadmin",
				token: token,
				createdAt: serverTimestamp(),
				expiresAt: expiresAt,
				used: false,
				createdBy: auth.currentUser?.uid || "system",
				isQuickSetup: true
			});

			// Show registration link
			const registrationLink = `${window.location.origin}/register.html?token=${token}`;
			quickSuperAdminLink.textContent = registrationLink;
			quickSuperAdminResult.style.display = "block";

			alert("✅ Super Admin invite token created successfully!\nUse the registration link below to create the super admin account.");

		} catch (error) {
			console.error("Error creating super admin invite:", error);
			alert("Failed to create super admin invite. Check console for details.");
		} finally {
			createQuickSuperAdmin.disabled = false;
			createQuickSuperAdmin.textContent = "Create Token";
		}
	};
}

// Copy quick super admin link
window.copyQuickSuperAdminLink = function () {
	const link = quickSuperAdminLink.textContent;
	navigator.clipboard.writeText(link).then(() => {
		alert("Registration link copied to clipboard!");
	}).catch(() => {
		// Fallback for older browsers
		const textArea = document.createElement("textarea");
		textArea.value = link;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
		alert("Registration link copied to clipboard!");
	});
};

// Load admin directory
window.loadAdminDirectory = async function () {
	try {
		// Fetch all colleges first for filters
		const collegesSnapshot = await getDocs(collection(db, "colleges"));
		const collegeMap = {};
		const collegeListForFilter = [];
		collegesSnapshot.forEach(doc => {
			const data = doc.data();
			collegeMap[doc.id] = data;
			collegeListForFilter.push({ id: doc.id, name: data.name });
		});

		// Update college filter dropdown early with ALL colleges
		updateAdminCollegeFilter(collegeListForFilter);

		const adminsSnapshot = await getDocs(collection(db, "users"));
		const adminList = [];

		adminsSnapshot.forEach(doc => {
			const adminData = doc.data();
			const role = (adminData.role || "").toLowerCase();

			// Filter out superadmins and non-admins
			if (!["admin", "principal"].includes(role)) {
				return;
			}

			const collegeInfo = collegeMap[adminData.collegeId];

			adminList.push({
				id: doc.id,
				name: adminData.name || "Unknown",
				email: adminData.email || "No email",
				role: adminData.role || "admin",
				department: adminData.department || "Not specified",
				phone: adminData.phone || "Not provided",
				collegeId: adminData.collegeId || "unknown",
				collegeName: collegeInfo?.name || "Unknown College",
				isActive: adminData.lastActive ? isActiveToday(adminData.lastActive) : false
			});
		});

		// Sort by name in JavaScript instead of using orderBy in query
		adminList.sort((a, b) => a.name.localeCompare(b.name));

		// Update statistics
		updateAdminStats(adminList);

		// Render admin list
		allAdmins = adminList;
		filterAdminList();

	} catch (error) {
		console.error("Error loading admin directory:", error);
		showAdminError("Error loading administrators: " + error.message);
	}
};

// Update admin statistics
function updateAdminStats(adminList) {
	const totalAdmins = adminList.length;
	const activeToday = adminList.filter(admin => admin.isActive).length;
	const superAdmins = adminList.filter(admin => isSuperAdmin(admin.role)).length;
	const principals = adminList.filter(admin => admin.role === "principal").length;

	safeSet(document.getElementById("totalAdminsCount"), totalAdmins);
	safeSet(document.getElementById("activeAdminsCount"), activeToday);
	safeSet(document.getElementById("superAdminsCount"), superAdmins);
	safeSet(document.getElementById("principalsCount"), principals);
}

window.filterAdminList = function () {
	const searchTerm = document.getElementById("adminSearch")?.value.toLowerCase() || "";
	const collegeFilter = document.getElementById("adminCollegeFilter")?.value || "all";
	const roleFilter = document.getElementById("adminRoleFilter")?.value || "all";

	const filteredAdmins = allAdmins.filter(admin => {
		const matchesSearch = admin.name.toLowerCase().includes(searchTerm) ||
			admin.email.toLowerCase().includes(searchTerm) ||
			admin.phone.toLowerCase().includes(searchTerm);

		const matchesCollege = collegeFilter === "all" || admin.collegeId === collegeFilter;
		const matchesRole = roleFilter === "all" || admin.role.toLowerCase() === roleFilter.toLowerCase();

		return matchesSearch && matchesCollege && matchesRole;
	});

	renderAdminList(filteredAdmins);
};

// Render admin list
function renderAdminList(adminList) {
	const container = document.getElementById("adminListContainer");
	if (!container) return;

	if (adminList.length === 0) {
		container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #64748b;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">👨‍💼</div>
                <p>No administrators found</p>
            </div>
        `;
		return;
	}

	const adminCards = adminList.map(admin => `
        <div class="admin-card" style="border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.15);">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: ${getRoleColor(admin.role)}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.25rem;">
                    ${admin.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;">${escapeHtml(admin.name)}</h3>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                        <span style="background: ${getRoleColor(admin.role)}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">
                            ${admin.role}
                        </span>
                        ${admin.isActive ? '<span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">🟢 Active</span>' : ''}
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">📧 Email</div>
                    <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(admin.email)}</div>
                </div>
                <div>
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">📞 Phone</div>
                    <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(admin.phone)}</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">🏢 Department</div>
                    <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(admin.department)}</div>
                </div>
                <div>
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">🏫 College</div>
                    <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(admin.collegeName)}</div>
                </div>
            </div>
        </div>
    `).join('');

	container.innerHTML = adminCards;
}

// Helper functions
function getRoleColor(role) {
	switch (role?.toLowerCase()) {
		case 'superadmin': return '#f59e0b';
		case 'principal': return '#8b5cf6';
		case 'admin': return '#3b82f6';
		default: return '#64748b';
	}
}

function isActiveToday(lastActive) {
	if (!lastActive) return false;
	const today = new Date().toDateString();
	const activeDate = lastActive.toDate ? lastActive.toDate().toDateString() : new Date(lastActive).toDateString();
	return today === activeDate;
}

function updateAdminCollegeFilter(colleges) {
	const filter = document.getElementById("adminCollegeFilter");
	if (!filter) return;

	const currentValue = filter.value;
	filter.innerHTML = '<option value="all">All Colleges</option>';

	colleges.forEach(college => {
		const option = document.createElement('option');
		option.value = college.id;
		option.textContent = college.name;
		filter.appendChild(option);
	});

	filter.value = currentValue;
}

function showAdminError(message) {
	const container = document.getElementById("adminListContainer");
	if (container) {
		container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
	}
}
/* ================= COLLEGE DIRECTORY ================= */

// Load college directory
window.loadCollegeDirectory = async function () {
	try {
		const collegesSnapshot = await getDocs(collection(db, "colleges"));
		allColleges = [];

		for (const doc of collegesSnapshot.docs) {
			const collegeData = doc.data();

			// Get user count for this college
			const usersQuery = query(collection(db, "users"), where("collegeId", "==", doc.id));
			const usersSnapshot = await getDocs(usersQuery);

			allColleges.push({
				id: doc.id,
				name: collegeData.name || "Unknown",
				code: collegeData.code || "N/A",
				email: collegeData.email || "No email",
				phone: collegeData.phone || "No phone",
				address: collegeData.address || "No address",
				website: collegeData.website || "",
				isActive: collegeData.isActive !== false,
				userCount: usersSnapshot.size,
				createdAt: collegeData.createdAt,
				gpsConfigured: !!(collegeData.gpsSettings?.latitude && collegeData.gpsSettings?.longitude)
			});
		}

		// Update statistics
		updateCollegeStats(allColleges);

		// Render college list
		filterCollegeList();

	} catch (error) {
		console.error("Error loading college directory:", error);
		showCollegeError("Error loading colleges: " + error.message);
	}
};

window.filterCollegeList = function () {
	const searchTerm = document.getElementById("collegeSearch")?.value.toLowerCase() || "";
	const statusFilter = document.getElementById("collegeStatusFilter")?.value || "all";

	const filtered = allColleges.filter(c => {
		const matchesSearch = c.name.toLowerCase().includes(searchTerm) ||
			c.code.toLowerCase().includes(searchTerm);
		const matchesStatus = statusFilter === "all" ||
			(statusFilter === "active" && c.isActive) ||
			(statusFilter === "inactive" && !c.isActive);
		return matchesSearch && matchesStatus;
	});

	renderCollegeList(filtered);
};

// Update college statistics
function updateCollegeStats(collegeList) {
	const totalColleges = collegeList.length;
	const activeColleges = collegeList.filter(college => college.isActive).length;
	const pendingSetup = collegeList.filter(college => !college.gpsConfigured).length;
	const avgUsers = totalColleges > 0 ? Math.round(collegeList.reduce((sum, c) => sum + c.userCount, 0) / totalColleges) : 0;

	safeSet(document.getElementById("totalCollegesCount"), totalColleges);
	safeSet(document.getElementById("activeCollegesCount"), activeColleges);
	safeSet(document.getElementById("pendingCollegesCount"), pendingSetup);
	safeSet(document.getElementById("avgUsersPerCollege"), avgUsers);
}

// Render college list
function renderCollegeList(collegeList) {
	const container = document.getElementById("collegeListContainer");
	if (!container) return;

	if (collegeList.length === 0) {
		container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #64748b;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">🏫</div>
                <p>No colleges found</p>
                <button onclick="window.open('college-management.html', '_blank')" style="margin-top: 1rem; background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">
                    Add First College
                </button>
            </div>
        `;
		return;
	}

	const collegeCards = collegeList.map(college => `
        <div class="college-card" style="border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.15);">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="width: 60px; height: 60px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.5rem;">
                    🏫
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #1e293b;">${escapeHtml(college.name)}</h3>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                        <span style="background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                            ${escapeHtml(college.code)}
                        </span>
                        <span style="background: ${college.isActive ? '#dcfce7' : '#fee2e2'}; color: ${college.isActive ? '#166534' : '#991b1b'}; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                            ${college.isActive ? '🟢 Active' : '🔴 Inactive'}
                        </span>
                        ${college.gpsConfigured ? '<span style="background: #dbeafe; color: #1e40af; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">📍 GPS Setup</span>' : '<span style="background: #fef3c7; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">⚠️ GPS Pending</span>'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">${college.userCount}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">Total Users</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">📧 Email</div>
                    <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(college.email)}</div>
                </div>
                <div>
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">📞 Phone</div>
                    <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(college.phone)}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">📍 Address</div>
                <div style="color: #1e293b; font-size: 0.875rem; font-weight: 500;">${escapeHtml(college.address)}</div>
            </div>
            
            ${college.website ? `
                <div style="margin-bottom: 1rem;">
                    <div style="color: #64748b; font-size: 0.875rem; margin-bottom: 0.25rem;">🌐 Website</div>
                    <a href="${college.website}" target="_blank" style="color: #3b82f6; font-size: 0.875rem; text-decoration: none;">${escapeHtml(college.website)}</a>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button onclick="window.open('college-management.html', '_blank')" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; cursor: pointer;">
                    ⚙️ Manage
                </button>
                <button onclick="viewCollegeDetails('${college.id}')" style="background: #f1f5f9; color: #475569; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; cursor: pointer;">
                    👁️ View Details
                </button>
            </div>
        </div>
    `).join('');

	container.innerHTML = collegeCards;
}

function showCollegeError(message) {
	const container = document.getElementById("collegeListContainer");
	if (container) {
		container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
	}
}

window.viewCollegeDetails = function (collegeId) {
	// This could open a detailed view or redirect to college-specific dashboard
	alert(`College details for ${collegeId} - Feature coming soon!`);
};
/* ================= USER CATEGORIES ================= */


// Load user categories
window.loadUserCategories = async function () {
	try {
		// Get college information first for filters
		const collegesSnapshot = await getDocs(collection(db, "colleges"));
		const collegeMap = {};
		const collegeListForFilter = [];
		collegesSnapshot.forEach(doc => {
			const data = doc.data();
			collegeMap[doc.id] = data;
			collegeListForFilter.push({ id: doc.id, name: data.name });
		});

		const usersSnapshot = await getDocs(collection(db, "users"));
		allUsers = [];
		const deptSet = new Set();

		usersSnapshot.forEach(doc => {
			const userData = doc.data();
			const role = (userData.role || "").toLowerCase();

			// Filter out superadmins
			if (role === "superadmin" || role === "super-admin") {
				return;
			}

			const collegeInfo = collegeMap[userData.collegeId];

			allUsers.push({
				id: doc.id,
				name: userData.name || "Unknown",
				email: userData.email || "No email",
				role: userData.role || "student",
				department: userData.department || "Not specified",
				phone: userData.phone || "Not provided",
				collegeId: userData.collegeId || "unknown",
				collegeName: collegeInfo?.name || "Unknown College",
				approved: userData.approved !== false,
				year: userData.year || "N/A",
				rollNumber: userData.rollNumber || userData.staffId || "N/A",
				createdAt: userData.createdAt
			});

			if (userData.department) {
				deptSet.add(userData.department);
			}
		});

		// Update filter options with ALL colleges
		updateUserFilters(collegeListForFilter, Array.from(deptSet));

		// Update statistics
		updateUserStats(allUsers);

		// Render user list
		filterUserList();

	} catch (error) {
		console.error("Error loading user categories:", error);
		showUserError("Error loading users: " + error.message);
	}
};

// Update user statistics
function updateUserStats(users) {
	const filteredUsers = users.filter(u => {
		const role = (u.role || "").toLowerCase();
		return role !== "superadmin" && role !== "super-admin";
	});

	const students = filteredUsers.filter(u => u.role === "student").length;
	const staff = filteredUsers.filter(u => ["incharge", "hod"].includes(u.role)).length;
	const admins = filteredUsers.filter(u => ["admin", "principal"].includes(u.role.toLowerCase())).length;
	const approved = filteredUsers.filter(u => u.approved).length;
	const pending = filteredUsers.filter(u => !u.approved).length;
	const total = filteredUsers.length;

	safeSet(document.getElementById("totalStudentsCount"), students);
	safeSet(document.getElementById("totalStaffCount"), staff);
	safeSet(document.getElementById("totalAdminsUserCount"), admins);
	safeSet(document.getElementById("approvedUsersCount"), approved);
	safeSet(document.getElementById("pendingUsersCount"), pending);
	safeSet(document.getElementById("totalSystemUsersCount"), total);
}

// Render user list
function renderUserList(users, category = 'all') {
	const container = document.getElementById("userListContainer");
	if (!container) return;

	let filteredUsers = users;

	// Filter by category
	switch (category) {
		case 'students':
			filteredUsers = users.filter(u => u.role === "student");
			break;
		case 'staff':
			filteredUsers = users.filter(u => ["incharge", "hod"].includes(u.role));
			break;
		case 'admins':
			filteredUsers = users.filter(u => ["admin", "principal", "superadmin", "super-admin"].includes(u.role.toLowerCase()));
			break;
		case 'pending':
			filteredUsers = users.filter(u => !u.approved);
			break;
	}

	if (filteredUsers.length === 0) {
		container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #64748b;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">👥</div>
                <p>No users found in this category</p>
            </div>
        `;
		return;
	}

	// Group users by college for better organization
	const usersByCollege = {};
	filteredUsers.forEach(user => {
		if (!usersByCollege[user.collegeName]) {
			usersByCollege[user.collegeName] = [];
		}
		usersByCollege[user.collegeName].push(user);
	});

	const collegeGroups = Object.keys(usersByCollege).map(collegeName => {
		const collegeUsers = usersByCollege[collegeName];

		return `
            <div style="margin-bottom: 2rem;">
                <h3 style="margin: 0 0 1rem 0; padding: 1rem; background: transparent; border-radius: 8px; color: #1e293b; font-size: 1.1rem; font-weight: 700; border-left: 4px solid #3b82f6;">
                    🏫 ${escapeHtml(collegeName)} (${collegeUsers.length} users)
                </h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
                    ${collegeUsers.map(user => `
                        <div class="user-card" onclick="openUserDetails('${user.id}')" style="border-radius: 8px; padding: 1rem; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;">
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${getUserRoleColor(user.role)}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1rem;">
                                    ${user.name.charAt(0).toUpperCase()}
                                </div>
                                <div style="flex: 1;">
                                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">${escapeHtml(user.name)}</h4>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                        <span style="background: ${getUserRoleColor(user.role)}; color: white; padding: 0.125rem 0.5rem; border-radius: 8px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
                                            ${user.role}
                                        </span>
                                        ${!user.approved ? '<span style="background: #fee2e2; color: #991b1b; padding: 0.125rem 0.5rem; border-radius: 8px; font-size: 0.7rem; font-weight: 600;">⏳ Pending</span>' : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">
                                <div style="margin-bottom: 0.25rem;">📧 ${escapeHtml(user.email)}</div>
                                <div style="margin-bottom: 0.25rem;">🏢 ${escapeHtml(user.department)}</div>
                                ${user.role === 'student' ? `<div>🎓 Year ${user.year} • ID: ${escapeHtml(user.rollNumber)}</div>` : `<div>🆔 ${escapeHtml(user.rollNumber)}</div>`}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
	}).join('');

	container.innerHTML = collegeGroups;
}

// Helper functions for user categories
function getUserRoleColor(role) {
	switch (role?.toLowerCase()) {
		case 'student': return '#3b82f6';
		case 'incharge': return '#10b981';
		case 'hod': return '#f59e0b';
		case 'admin': return '#8b5cf6';
		case 'principal': return '#ef4444';
		case 'superadmin': return '#f59e0b';
		default: return '#64748b';
	}
}

function updateUserFilters(colleges, departments) {
	// Update college filter
	const collegeFilter = document.getElementById("userCollegeFilter");
	if (collegeFilter) {
		const currentValue = collegeFilter.value;
		collegeFilter.innerHTML = '<option value="all">All Colleges</option>';

		colleges.forEach(college => {
			const option = document.createElement('option');
			option.value = college.id;
			option.textContent = college.name;
			collegeFilter.appendChild(option);
		});

		collegeFilter.value = currentValue;
	}

	// Update department filter
	const deptFilter = document.getElementById("userDeptFilter");
	if (deptFilter) {
		const currentValue = deptFilter.value;
		deptFilter.innerHTML = '<option value="all">All Departments</option>';

		departments.forEach(dept => {
			const option = document.createElement('option');
			option.value = dept;
			option.textContent = dept;
			deptFilter.appendChild(option);
		});

		deptFilter.value = currentValue;
	}
}

function showUserError(message) {
	const container = document.getElementById("userListContainer");
	if (container) {
		container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
	}
}

// Tab switching for user categories
window.switchUserCategory = function (category) {
	currentUserFilter = category;

	// Update active tab
	document.querySelectorAll('.sub-tab-btn').forEach(btn => {
		btn.style.background = 'transparent';
		btn.style.color = '#64748b';
	});

	const activeBtn = document.getElementById(`show${category.charAt(0).toUpperCase() + category.slice(1)}`);
	if (activeBtn) {
		activeBtn.style.background = '#3b82f6';
		activeBtn.style.color = 'white';
	}

	// Render filtered list
	filterUserList(category);
};

window.filterUserList = function (category) {
	if (!category) category = currentUserFilter || 'all';
	currentUserFilter = category;

	const searchTerm = document.getElementById("userSearch")?.value.toLowerCase() || "";
	const collegeFilter = document.getElementById("userCollegeFilter")?.value || "all";

	const filteredUsers = allUsers.filter(user => {
		const matchesSearch = user.name.toLowerCase().includes(searchTerm) ||
			user.email.toLowerCase().includes(searchTerm) ||
			user.rollNumber.toLowerCase().includes(searchTerm) ||
			user.department.toLowerCase().includes(searchTerm) ||
			user.collegeName.toLowerCase().includes(searchTerm);

		const matchesCollege = collegeFilter === "all" || user.collegeId === collegeFilter;

		return matchesSearch && matchesCollege;
	});

	renderUserList(filteredUsers, category);
};
/* ================= EVENT LISTENERS FOR NEW SECTIONS ================= */

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
	// Admin Directory event listeners
	const refreshAdminsBtn = document.getElementById('refreshAdminsBtn');
	if (refreshAdminsBtn) {
		refreshAdminsBtn.addEventListener('click', loadAdminDirectory);
	}

	const downloadAdminsBtn = document.getElementById('downloadAdminsBtn');
	if (downloadAdminsBtn) {
		downloadAdminsBtn.addEventListener('click', downloadAdminsList);
	}

	// Admin Search and Filters
	const adminSearch = document.getElementById('adminSearch');
	if (adminSearch) {
		adminSearch.addEventListener('input', filterAdminList);
	}
	const adminCollegeFilter = document.getElementById('adminCollegeFilter');
	if (adminCollegeFilter) {
		adminCollegeFilter.addEventListener('change', filterAdminList);
	}
	const adminRoleFilter = document.getElementById('adminRoleFilter');
	if (adminRoleFilter) {
		adminRoleFilter.addEventListener('change', filterAdminList);
	}

	// College Directory event listeners
	const refreshCollegesBtn = document.getElementById('refreshCollegesBtn');
	if (refreshCollegesBtn) {
		refreshCollegesBtn.addEventListener('click', loadCollegeDirectory);
	}

	const downloadCollegesBtn = document.getElementById('downloadCollegesBtn');
	if (downloadCollegesBtn) {
		downloadCollegesBtn.addEventListener('click', downloadCollegesList);
	}

	// User Categories event listeners
	const refreshUsersBtn = document.getElementById('refreshUsersBtn');
	if (refreshUsersBtn) {
		refreshUsersBtn.addEventListener('click', loadUserCategories);
	}

	const downloadUsersBtn = document.getElementById('downloadUsersBtn');
	if (downloadUsersBtn) {
		downloadUsersBtn.addEventListener('click', downloadUsersList);
	}

	// User Search
	const userSearch = document.getElementById('userSearch');
	if (userSearch) {
		userSearch.addEventListener('input', () => filterUserList());
	}

	const userCollegeFilter = document.getElementById('userCollegeFilter');
	if (userCollegeFilter) {
		userCollegeFilter.addEventListener('change', () => filterUserList());
	}

	// User category tab buttons
	const showAllUsers = document.getElementById('showAllUsers');
	if (showAllUsers) {
		showAllUsers.addEventListener('click', () => switchUserCategory('all'));
	}

	const showStudentsList = document.getElementById('showStudentsList');
	if (showStudentsList) {
		showStudentsList.addEventListener('click', () => switchUserCategory('students'));
	}

	const showStaffList = document.getElementById('showStaffList');
	if (showStaffList) {
		showStaffList.addEventListener('click', () => switchUserCategory('staff'));
	}

	const showAdminsList = document.getElementById('showAdminsList');
	if (showAdminsList) {
		showAdminsList.addEventListener('click', () => switchUserCategory('admins'));
	}

	const showPendingUsers = document.getElementById('showPendingUsers');
	if (showPendingUsers) {
		showPendingUsers.addEventListener('click', () => switchUserCategory('pending'));
	}

	// College Search listener
	const collegeSearch = document.getElementById('collegeSearch');
	if (collegeSearch) {
		collegeSearch.addEventListener('input', window.filterCollegeList);
	}
	const collegeStatusFilter = document.getElementById('collegeStatusFilter');
	if (collegeStatusFilter) {
		collegeStatusFilter.addEventListener('change', window.filterCollegeList);
	}
});

// Download functions
window.downloadAdminsList = function () {
	if (!allAdmins || allAdmins.length === 0) {
		alert('No admin data to download');
		return;
	}

	try {
		const exportData = allAdmins.map(admin => ({
			'Name': admin.name || '',
			'Email': admin.email || '',
			'Role': admin.role || '',
			'College': admin.collegeName || 'N/A',
			'Department': admin.department || 'N/A',
			'Phone': admin.phone || 'N/A',
			'Status': admin.approved ? 'Approved' : 'Pending'
		}));

		const ws = XLSX.utils.json_to_sheet(exportData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Admins");
		XLSX.writeFile(wb, `Admin_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
	} catch (error) {
		console.error('Error downloading admins:', error);
		alert('Error downloading Excel file');
	}
};

window.downloadCollegesList = function () {
	if (!allColleges || allColleges.length === 0) {
		alert('No college data to download');
		return;
	}

	try {
		const exportData = allColleges.map(college => ({
			'College Name': college.name || '',
			'College Code': college.code || '',
			'Location': college.location || 'N/A',
			'Total Users': college.userCount || 0,
			'Status': college.active ? 'Active' : 'Inactive',
			'Created Date': college.createdAt ? new Date(college.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'
		}));

		const ws = XLSX.utils.json_to_sheet(exportData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Colleges");
		XLSX.writeFile(wb, `College_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
	} catch (error) {
		console.error('Error downloading colleges:', error);
		alert('Error downloading Excel file');
	}
};

window.downloadUsersList = function () {
	if (!allUsers || allUsers.length === 0) {
		alert('No user data to download');
		return;
	}

	try {
		const exportData = allUsers.map(user => ({
			'Name': user.name || '',
			'Email': user.email || '',
			'Roll Number': user.rollNumber || 'N/A',
			'Department': user.department || 'N/A',
			'Year': user.year || 'N/A',
			'College': user.collegeName || 'N/A',
			'Phone': user.phone || 'N/A',
			'Status': user.approved ? 'Approved' : 'Pending'
		}));

		const ws = XLSX.utils.json_to_sheet(exportData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Users");
		XLSX.writeFile(wb, `User_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
	} catch (error) {
		console.error('Error downloading users:', error);
		alert('Error downloading Excel file');
	}
};


// Load data when sections are shown

/* ================= BACKGROUND AUDIT ================= */
async function loadBgAudit() {
    const grid = document.getElementById('bgAuditGrid');
    const setCount = document.getElementById('bgAuditSetCount');
    const noneCount = document.getElementById('bgAuditNoneCount');
    if (!grid) return;

    grid.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;grid-column:1/-1;"><div style="font-size:2rem;margin-bottom:8px;">⏳</div><p>Loading...</p></div>`;

    try {
        const snap = await getDocs(collection(db, 'colleges'));
        const colleges = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Collect uids that need name lookup (have bgUploadedBy but no bgUploadedByName)
        const uidsToFetch = [...new Set(
            colleges
                .filter(c => c.backgroundImage && c.bgUploadedBy && !c.bgUploadedByName)
                .map(c => c.bgUploadedBy)
        )];

        // Batch-fetch user names by uid
        const userNameMap = {};
        if (uidsToFetch.length > 0) {
            await Promise.all(uidsToFetch.map(async uid => {
                try {
                    const uSnap = await getDoc(doc(db, 'users', uid));
                    if (uSnap.exists()) {
                        const u = uSnap.data();
                        userNameMap[uid] = u.name || u.email || uid;
                        const college = colleges.find(c => c.bgUploadedBy === uid && !c.bgUploadedByName);
                        if (college) {
                            updateDoc(doc(db, 'colleges', college.id), { bgUploadedByName: userNameMap[uid] }).catch(() => {});
                        }
                    }
                } catch (_) {}
            }));
        }

        // For colleges with a background but NO bgUploadedBy at all (legacy),
        // query the college's admin/principal from users collection
        const legacyColleges = colleges.filter(c => c.backgroundImage && !c.bgUploadedBy);
        const legacyAdminMap = {}; // collegeId -> name
        if (legacyColleges.length > 0) {
            await Promise.all(legacyColleges.map(async c => {
                try {
                    const q = query(
                        collection(db, 'users'),
                        where('collegeId', '==', c.id),
                        where('role', 'in', ['admin', 'principal', 'Admin', 'Principal'])
                    );
                    const snap2 = await getDocs(q);
                    if (!snap2.empty) {
                        const u = snap2.docs[0].data();
                        legacyAdminMap[c.id] = u.name || u.email || null;
                    }
                } catch (_) {}
            }));
        }

        let hasCount = 0, noCount = 0;
        const cards = colleges.map(c => {
            const bg = c.backgroundImage || null;
            if (bg) hasCount++; else noCount++;
            const thumb = bg
                ? `<div class="bg-audit-thumb"><img src="${escapeHtml(bg)}" alt="" onerror="this.parentElement.innerHTML='🖼️'"></div>`
                : `<div class="bg-audit-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px;">🏫</div>`;

            let uploaderLine = '';
            if (bg) {
                // Resolve name: stored name → fetched by uid → legacy college admin lookup
                const resolvedName = c.bgUploadedByName
                    || (c.bgUploadedBy ? userNameMap[c.bgUploadedBy] : null)
                    || legacyAdminMap[c.id]
                    || null;
                const uploaderName = resolvedName ? escapeHtml(resolvedName) : '<em style="opacity:0.5">Unknown</em>';

                let uploadedDate = '';
                if (c.bgUploadedAt) {
                    try {
                        const d = c.bgUploadedAt.toDate ? c.bgUploadedAt.toDate() : new Date(c.bgUploadedAt);
                        uploadedDate = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
                    } catch (_) {}
                }
                uploaderLine = `<div class="bg-audit-uploader">👤 ${uploaderName}${uploadedDate ? ` &nbsp;·&nbsp; 📅 ${uploadedDate}` : ''}</div>`;
            }

            return `
                <div class="bg-audit-card">
                    ${thumb}
                    <div class="bg-audit-info">
                        <div class="bg-audit-name">${escapeHtml(c.name || c.id)}</div>
                        <div class="bg-audit-status ${bg ? 'has' : 'none'}">${bg ? '✅ Background set' : '⚠️ No background'}</div>
                        ${uploaderLine}
                        <div class="bg-audit-actions">
                            <button class="btn btn-primary" style="font-size:12px;padding:4px 10px;" onclick="window.setBgForCollege('${c.id}','${escapeHtml(c.name || c.id)}')">🖼️ Manage</button>
                        </div>
                    </div>
                </div>`;
        });

        if (setCount) setCount.textContent = hasCount;
        if (noneCount) noneCount.textContent = noCount;
        grid.innerHTML = cards.length ? cards.join('') : `<div style="text-align:center;padding:40px;color:#94a3b8;grid-column:1/-1;">No colleges found</div>`;
    } catch (e) {
        if (!_isOfflineError(e)) console.error('loadBgAudit error', e);
        grid.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;grid-column:1/-1;">Failed to load. Check connection.</div>`;
    }
}


window.setBgForCollege = async (collegeId, collegeName) => {
    // Fetch current college data first
    let collegeData = {};
    try {
        const snap = await getDoc(doc(db, 'colleges', collegeId));
        if (snap.exists()) collegeData = snap.data();
    } catch (e) { console.warn('setBgForCollege fetch:', e); }

    const currentBg = collegeData.backgroundImage || null;
    let uploaderName = collegeData.bgUploadedByName || null;
    const uploaderUidStored = collegeData.bgUploadedBy || null;

    // If we have a uid but no name, fetch it from users collection
    if (currentBg && uploaderUidStored && !uploaderName) {
        try {
            const uSnap = await getDoc(doc(db, 'users', uploaderUidStored));
            if (uSnap.exists()) {
                const u = uSnap.data();
                uploaderName = u.name || u.email || null;
                if (uploaderName) {
                    updateDoc(doc(db, 'colleges', collegeId), { bgUploadedByName: uploaderName }).catch(() => {});
                }
            }
        } catch (_) {}
    }

    // Legacy: no uid stored at all — find the college's admin/principal
    if (currentBg && !uploaderUidStored && !uploaderName) {
        try {
            const q = query(
                collection(db, 'users'),
                where('collegeId', '==', collegeId),
                where('role', 'in', ['admin', 'principal', 'Admin', 'Principal'])
            );
            const adminSnap = await getDocs(q);
            if (!adminSnap.empty) {
                const u = adminSnap.docs[0].data();
                uploaderName = u.name || u.email || null;
            }
        } catch (_) {}
    }

    const uploadedAt = collegeData.bgUploadedAt || null;
    let uploadedDateStr = '';
    if (uploadedAt) {
        try {
            const d = uploadedAt.toDate ? uploadedAt.toDate() : new Date(uploadedAt);
            uploadedDateStr = d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        } catch (_) {}
    }

    // Build or reuse overlay
    let overlay = document.getElementById('bgSetOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bgSetOverlay';
        overlay.className = 'overlay hidden';
        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
    }

    const metaHtml = currentBg ? `
        <div id="bgSetCurrentWrap" style="margin-bottom:18px;">
            <div style="font-size:12px;font-weight:700;opacity:0.6;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Current Background</div>
            <div style="display:flex;gap:12px;align-items:flex-start;">
                <img id="bgSetThumb" src="${escapeHtml(currentBg)}" alt="Current BG"
                    style="width:100px;height:68px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.2);flex-shrink:0;"
                    onerror="this.style.display='none'">
                <div style="font-size:13px;line-height:1.7;opacity:0.85;">
                    ${uploaderName ? `<div>👤 <strong>${escapeHtml(uploaderName)}</strong></div>` : (collegeData.bgUploadedBy ? '<div>👤 Unknown</div>' : '<div style="opacity:0.5;font-size:12px;">📌 Set before audit tracking</div>')}
                    ${uploadedDateStr ? `<div>📅 ${uploadedDateStr}</div>` : ''}
                </div>
            </div>
        </div>` : `<div style="margin-bottom:18px;font-size:13px;opacity:0.6;">⚠️ No background currently set.</div>`;

    overlay.innerHTML = `
        <div class="modal" style="max-width:500px;">
            <h3 style="margin:0 0 4px;font-size:17px;">🖼️ Manage Background</h3>
            <p style="margin:0 0 18px;font-size:13px;opacity:0.7;">${escapeHtml(collegeName)}</p>
            ${metaHtml}
            <div style="font-size:12px;font-weight:700;opacity:0.6;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Set New Background URL</div>
            <input id="bgSetUrl" type="url" placeholder="https://example.com/image.jpg"
                style="width:100%;padding:11px 14px;border-radius:9px;border:1px solid rgba(255,255,255,0.25);
                background:rgba(255,255,255,0.12);color:inherit;font-size:14px;box-sizing:border-box;margin-bottom:14px;outline:none;">
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button id="bgSetSave" class="btn btn-primary" style="flex:1;min-width:100px;">💾 Save</button>
                ${currentBg ? `<button id="bgSetRemove" class="btn btn-danger" style="flex:1;min-width:100px;">🗑️ Remove</button>` : ''}
                <button id="bgSetCancel" class="btn btn-secondary" style="flex:1;min-width:80px;">Cancel</button>
            </div>
            <p id="bgSetStatus" style="margin:10px 0 0;font-size:13px;font-weight:600;min-height:18px;"></p>
        </div>`;

    overlay.classList.remove('hidden');

    document.getElementById('bgSetCancel').onclick = () => overlay.classList.add('hidden');

    document.getElementById('bgSetSave').onclick = async () => {
        const url = document.getElementById('bgSetUrl').value.trim();
        const status = document.getElementById('bgSetStatus');
        if (!url) { status.style.color = '#ef4444'; status.textContent = 'Please enter a URL.'; return; }
        status.style.color = '#94a3b8'; status.textContent = 'Saving…';
        try {
            const uploaderUid = currentUser?.uid || auth.currentUser?.uid || null;
            const uploaderDisplayName = currentUserData?.name || currentUserData?.email || 'Super Admin';
            await updateDoc(doc(db, 'colleges', collegeId), {
                backgroundImage: url,
                bgUploadedBy: uploaderUid,
                bgUploadedByName: uploaderDisplayName,
                bgUploadedAt: serverTimestamp()
            });
            status.style.color = '#22c55e'; status.textContent = '✅ Saved!';
            setTimeout(() => { overlay.classList.add('hidden'); loadBgAudit(); }, 800);
        } catch (e) {
            status.style.color = '#ef4444'; status.textContent = 'Error: ' + e.message;
        }
    };

    const removeBtn = document.getElementById('bgSetRemove');
    if (removeBtn) {
        removeBtn.onclick = async () => {
            const status = document.getElementById('bgSetStatus');
            if (!confirm(`Remove background for ${collegeName}?`)) return;
            status.style.color = '#94a3b8'; status.textContent = 'Removing…';
            try {
                await updateDoc(doc(db, 'colleges', collegeId), {
                    backgroundImage: null,
                    bgUploadedBy: null,
                    bgUploadedByName: null,
                    bgUploadedAt: null
                });
                status.style.color = '#22c55e'; status.textContent = '✅ Removed!';
                setTimeout(() => { overlay.classList.add('hidden'); loadBgAudit(); }, 800);
            } catch (e) {
                status.style.color = '#ef4444'; status.textContent = 'Error: ' + e.message;
            }
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshBgAudit');
    if (refreshBtn) refreshBtn.addEventListener('click', loadBgAudit);
});

// The original showSection wrapper has been removed as per instructions.
// If window.showSection is defined elsewhere, it will be used directly.
// If not, ensure it's defined before being called.


/* ================= SUPER ADMIN DASHBOARD BACKGROUND ================= */
const SA_BG_DOC = () => doc(db, "system", "superAdminSettings");

async function loadSuperAdminBgFromFirestore() {
    try {
        const snap = await getDoc(SA_BG_DOC());
        if (!snap.exists()) return null;
        return snap.data().bgUrl || null;
    } catch (e) {
        if (!_isOfflineError(e)) console.warn('superAdminBg load:', e);
        return null;
    }
}

// Called when section is opened — populate the preview
async function loadSuperAdminBg() {
    const url = await loadSuperAdminBgFromFirestore();
    _saBgApplyPreview(url);
    const input = document.getElementById('saBgUrlInput');
    if (input && url && !url.startsWith('data:')) input.value = url;
    // Reset file tab state
    const fileInput = document.getElementById('saBgFileInput');
    const fileNameLabel = document.getElementById('saBgFileName');
    if (fileInput) fileInput.value = '';
    if (fileNameLabel) fileNameLabel.textContent = 'No file chosen — click to browse';
}

function _saBgApplyPreview(url) {
    const img = document.getElementById('saBgPreviewImg');
    const empty = document.getElementById('saBgPreviewEmpty');
    if (!img) return;
    if (url) {
        img.src = url; img.style.display = 'block';
        if (empty) empty.style.display = 'none';
    } else {
        img.src = ''; img.style.display = 'none';
        if (empty) empty.style.display = 'block';
    }
}

function _saBgStatus(msg, ok = true) {
    const el = document.getElementById('saBgStatus');
    if (el) { el.textContent = msg; el.style.color = ok ? '#16a34a' : '#dc2626'; }
}

async function saveSuperAdminBg(url) {
    if (!url) return _saBgStatus('Please enter a URL.', false);
    try {
        await setDoc(SA_BG_DOC(), { bgUrl: url, updatedAt: serverTimestamp() }, { merge: true });
        // Apply immediately to the current page
        const { applyCollegeBackground } = await import('./college-background.js');
        applyCollegeBackground(url);
        _saBgApplyPreview(url);
        _saBgStatus('✅ Background saved and applied!');
    } catch (e) { _saBgStatus('Error: ' + e.message, false); }
}

async function removeSuperAdminBg() {
    try {
        await setDoc(SA_BG_DOC(), { bgUrl: null }, { merge: true });
        const { removeCollegeBackground } = await import('./college-background.js');
        removeCollegeBackground();
        _saBgApplyPreview(null);
        const input = document.getElementById('saBgUrlInput');
        if (input) input.value = '';
        _saBgStatus('Background removed.');
    } catch (e) { _saBgStatus('Error: ' + e.message, false); }
}

// Wire up the section buttons
document.addEventListener('DOMContentLoaded', () => {
    // ── Tab switching ──
    const tabUrl  = document.getElementById('saBgTabUrl');
    const tabFile = document.getElementById('saBgTabFile');
    const panelUrl  = document.getElementById('saBgPanelUrl');
    const panelFile = document.getElementById('saBgPanelFile');

    function _saBgSwitchTab(mode) {
        const isUrl = mode === 'url';
        if (tabUrl)  { tabUrl.style.background  = isUrl  ? '#3b82f6' : 'transparent'; tabUrl.style.color  = isUrl  ? '#fff' : '#64748b'; }
        if (tabFile) { tabFile.style.background = !isUrl ? '#3b82f6' : 'transparent'; tabFile.style.color = !isUrl ? '#fff' : '#64748b'; }
        if (panelUrl)  panelUrl.style.display  = isUrl  ? 'block' : 'none';
        if (panelFile) panelFile.style.display = !isUrl ? 'block' : 'none';
    }

    if (tabUrl)  tabUrl.addEventListener('click',  () => _saBgSwitchTab('url'));
    if (tabFile) tabFile.addEventListener('click', () => _saBgSwitchTab('file'));

    // ── File picker ──
    const fileInput     = document.getElementById('saBgFileInput');
    const filePickerBtn = document.getElementById('saBgFilePickerBtn');
    const fileNameLabel = document.getElementById('saBgFileName');
    let _saBgFileDataUrl = null;

    if (filePickerBtn && fileInput) {
        filePickerBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (file.size > 1.5 * 1024 * 1024) {
                _saBgStatus('Image too large. Please use an image under 1.5 MB.', false);
                return;
            }
            if (fileNameLabel) fileNameLabel.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                _saBgFileDataUrl = e.target.result;
                _saBgApplyPreview(_saBgFileDataUrl);
                _saBgStatus('Image loaded — click Save to apply.', true);
            };
            reader.readAsDataURL(file);
        });
    }

    // ── Preview button (URL tab) ──
    const previewBtn = document.getElementById('saBgPreviewBtn');
    if (previewBtn) previewBtn.addEventListener('click', () => {
        const url = document.getElementById('saBgUrlInput')?.value.trim();
        if (!url) return _saBgStatus('Enter a URL to preview.', false);
        _saBgApplyPreview(url);
        _saBgStatus('Preview loaded.', true);
    });

    // ── Save button ──
    const saveBtn = document.getElementById('saBgSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const activeTab = panelFile && panelFile.style.display !== 'none' ? 'file' : 'url';
        if (activeTab === 'file') {
            if (!_saBgFileDataUrl) return _saBgStatus('Please choose an image file first.', false);
            saveSuperAdminBg(_saBgFileDataUrl);
        } else {
            const url = document.getElementById('saBgUrlInput')?.value.trim();
            saveSuperAdminBg(url);
        }
    });

    const removeBtn = document.getElementById('saBgRemoveBtn');
    if (removeBtn) removeBtn.addEventListener('click', removeSuperAdminBg);

    // ── Adaptive Color Detector toggle ──
    const toggle    = document.getElementById('adaptiveDetectorToggle');
    const track     = document.getElementById('adaptiveDetectorTrack');
    const thumb     = document.getElementById('adaptiveDetectorThumb');
    const label     = document.getElementById('adaptiveDetectorLabel');

    function _applyToggleUI(enabled) {
        if (!toggle) return;
        toggle.checked      = enabled;
        track.style.background  = enabled ? '#3b82f6' : '#cbd5e1';
        thumb.style.transform   = enabled ? 'translateX(22px)' : 'translateX(0)';
        label.textContent       = enabled ? 'ON' : 'OFF';
        label.style.color       = enabled ? '#3b82f6' : '#94a3b8';
    }

    if (toggle) {
        // Init from saved preference
        import('./college-background.js').then(m => {
            const enabled = m.isAdaptiveDetectorEnabled();
            _applyToggleUI(enabled);

            toggle.addEventListener('change', () => {
                const on = toggle.checked;
                _applyToggleUI(on);
                m.setAdaptiveDetector(on);
            });
            // Also allow clicking the track/thumb area
            track.addEventListener('click', () => {
                toggle.checked = !toggle.checked;
                toggle.dispatchEvent(new Event('change'));
            });
        });
    }
});

/* ================= PLATFORM BACKGROUND ================= */
const PLATFORM_BG_DOC = () => doc(db, "system", "platformSettings");

async function loadPlatformBackground() {
    try {
        const snap = await getDoc(PLATFORM_BG_DOC());
        if (!snap.exists()) return;
        const { bgUrl, bgType } = snap.data();
        if (bgUrl) _applyPbPreview(bgUrl, bgType);
    } catch (e) { console.warn("platformbg load:", e); }
}

function _ytEmbedUrl(url) {
    // Convert any YouTube URL to embed format
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

function _applyPbPreview(url, type) {
    const img = document.getElementById('pbPreviewImg');
    const vid = document.getElementById('pbPreviewVideo');
    const empty = document.getElementById('pbPreviewEmpty');
    const wrap = document.getElementById('pbPreviewWrap');
    if (!img) return;

    // Remove any existing iframe
    const existingIframe = wrap?.querySelector('iframe.pb-yt-frame');
    if (existingIframe) existingIframe.remove();

    // Check if it's a YouTube URL
    const ytEmbed = _ytEmbedUrl(url);
    if (ytEmbed) {
        const iframe = document.createElement('iframe');
        iframe.className = 'pb-yt-frame';
        iframe.src = ytEmbed;
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'width:100%;height:100%;border:none;position:absolute;inset:0;';
        wrap.appendChild(iframe);
        img.style.display = 'none';
        vid.style.display = 'none';
        empty.style.display = 'none';
    } else if (type === 'video') {
        vid.src = url;
        vid.load();
        vid.play().catch(() => {});
        vid.style.display = 'block';
        img.style.display = 'none';
        empty.style.display = 'none';
    } else {
        img.src = url;
        img.style.display = 'block';
        vid.style.display = 'none';
        empty.style.display = 'none';
    }

    // Also populate URL input
    const urlInput = document.getElementById('pbUrlInput');
    if (urlInput) urlInput.value = url;
}

function _pbStatus(msg, ok = true) {
    const el = document.getElementById('pbStatus');
    if (el) { el.textContent = msg; el.style.color = ok ? '#16a34a' : '#dc2626'; }
}

async function savePlatformBackground(url, type) {
    if (!url) return _pbStatus('Please enter a URL or upload a file.', false);
    try {
        await setDoc(PLATFORM_BG_DOC(), { bgUrl: url, bgType: type, updatedAt: serverTimestamp() }, { merge: true });
        _applyPbPreview(url, type);
        _pbStatus('✅ Background saved! It will appear on Login & Register pages.');
    } catch (e) { _pbStatus('Error saving: ' + e.message, false); }
}

async function removePlatformBackground() {
    try {
        await setDoc(PLATFORM_BG_DOC(), { bgUrl: null, bgType: null }, { merge: true });
        const img = document.getElementById('pbPreviewImg');
        const vid = document.getElementById('pbPreviewVideo');
        const empty = document.getElementById('pbPreviewEmpty');
        const wrap = document.getElementById('pbPreviewWrap');
        if (img) { img.src = ''; img.style.display = 'none'; }
        if (vid) { vid.src = ''; vid.style.display = 'none'; }
        if (empty) empty.style.display = 'block';
        wrap?.querySelector('iframe.pb-yt-frame')?.remove();
        const urlInput = document.getElementById('pbUrlInput');
        if (urlInput) urlInput.value = '';
        _pbStatus('Background removed.');
    } catch (e) { _pbStatus('Error: ' + e.message, false); }
}

// Convert uploaded file to base64
function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabUrl = document.getElementById('pbTabUrl');
    const tabFile = document.getElementById('pbTabFile');
    const panelUrl = document.getElementById('pbPanelUrl');
    const panelFile = document.getElementById('pbPanelFile');

    if (tabUrl) tabUrl.addEventListener('click', () => {
        panelUrl.style.display = 'block'; panelFile.style.display = 'none';
        tabUrl.style.background = '#3b82f6'; tabUrl.style.color = '#fff';
        tabFile.style.background = 'transparent'; tabFile.style.color = '#64748b';
    });
    if (tabFile) tabFile.addEventListener('click', () => {
        panelFile.style.display = 'block'; panelUrl.style.display = 'none';
        tabFile.style.background = '#3b82f6'; tabFile.style.color = '#fff';
        tabUrl.style.background = 'transparent'; tabUrl.style.color = '#64748b';
    });

    // File input preview
    const fileInput = document.getElementById('pbFileInput');
    if (fileInput) fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const type = file.type.startsWith('video') ? 'video' : 'image';

        if (type === 'video') {
            // Use object URL for video preview (base64 is too large for video)
            const objectUrl = URL.createObjectURL(file);
            _applyPbPreview(objectUrl, 'video');
            _pbStatus('⚠️ Video preview shown. To save, use a hosted URL (e.g. from Google Drive or Cloudinary) — file upload is too large for video.', false);
            document.getElementById('pbUrlInput').value = '';
        } else {
            const base64 = await _fileToBase64(file);
            _applyPbPreview(base64, type);
            document.getElementById('pbUrlInput').value = base64;
        }
    });

    // URL input live preview (on Enter key)
    const urlInput = document.getElementById('pbUrlInput');
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const url = urlInput.value.trim();
                if (!url) return;
                const type = /\.(mp4|webm|ogg)$/i.test(url) ? 'video' : 'image';
                _applyPbPreview(url, type);
            }
        });
    }

    // Preview button
    const previewBtn = document.getElementById('pbPreviewBtn');
    if (previewBtn) previewBtn.addEventListener('click', () => {
        const url = document.getElementById('pbUrlInput')?.value.trim();
        if (!url) return _pbStatus('Enter a URL to preview.', false);
        const type = _ytEmbedUrl(url) ? 'youtube' : (/\.(mp4|webm|ogg)$/i.test(url) ? 'video' : 'image');
        _applyPbPreview(url, type);
        _pbStatus('Preview loaded.', true);
    });

    // Save
    const saveBtn = document.getElementById('pbSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const url = document.getElementById('pbUrlInput')?.value.trim();
        const type = _ytEmbedUrl(url) ? 'youtube' : (/\.(mp4|webm|ogg)$/i.test(url) || url?.startsWith('data:video') ? 'video' : 'image');
        savePlatformBackground(url, type);
    });

    // Remove
    const removeBtn = document.getElementById('pbRemoveBtn');
    if (removeBtn) removeBtn.addEventListener('click', removePlatformBackground);

    // Load existing on section open
    const observer = new MutationObserver(() => {
        const sec = document.getElementById('platformbg');
        if (sec && !sec.classList.contains('hidden') && sec.classList.contains('active')) {
            loadPlatformBackground();
        }
    });
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true, attributes: true });

    // Also load immediately if section is active
    loadPlatformBackground();
});

/* ================= CUSTOM SELECT DROPDOWNS ================= */
function initCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized) return;
    selectEl.dataset.customized = '1';

    // Wrap
    const wrap = document.createElement('div');
    wrap.className = 'custom-select-wrap';
    // Copy width style if any
    if (selectEl.style.maxWidth) wrap.style.maxWidth = selectEl.style.maxWidth;
    if (selectEl.style.minWidth) wrap.style.minWidth = selectEl.style.minWidth;
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);

    // Trigger button
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `<span class="custom-select-label"></span><span class="custom-select-arrow">▼</span>`;
    wrap.appendChild(trigger);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'custom-select-panel';
    wrap.appendChild(panel);

    function buildOptions() {
        panel.innerHTML = '';
        Array.from(selectEl.options).forEach(opt => {
            const div = document.createElement('div');
            const isSelected = opt.value === selectEl.value;
            div.className = 'custom-select-option' + (isSelected ? ' selected' : '');
            div.textContent = opt.text;
            div.dataset.value = opt.value;
            div.onclick = (e) => {
                e.stopPropagation();
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                updateLabel();
                closePanel();
            };
            panel.appendChild(div);
        });
    }

    function updateLabel() {
        const sel = selectEl.options[selectEl.selectedIndex];
        trigger.querySelector('.custom-select-label').textContent = sel ? sel.text : '';
        panel.querySelectorAll('.custom-select-option').forEach(d => {
            d.classList.toggle('selected', d.dataset.value === selectEl.value);
        });
    }

    function openPanel() {
        document.querySelectorAll('.custom-select-panel').forEach(p => {
            if (p !== panel) { p.classList.remove('open'); p.previousElementSibling?.classList.remove('open'); }
        });
        buildOptions();
        panel.classList.add('open');
        trigger.classList.add('open');
    }

    function closePanel() {
        panel.classList.remove('open');
        trigger.classList.remove('open');
    }

    trigger.onclick = (e) => {
        e.stopPropagation();
        panel.classList.contains('open') ? closePanel() : openPanel();
    };

    // Close on outside click
    document.addEventListener('click', () => closePanel());

    // Watch for option changes (e.g. dynamically populated college lists)
    const mo = new MutationObserver(() => { buildOptions(); updateLabel(); });
    mo.observe(selectEl, { childList: true });

    buildOptions();
    updateLabel();
}

// Initialize all filter selects inside .controls-bar and .admin-controls
function initAllCustomSelects() {
    document.querySelectorAll('.controls-bar select, .admin-controls select').forEach(initCustomSelect);
}

// Run on DOM ready and re-run when sections load (since some selects are populated dynamically)
document.addEventListener('DOMContentLoaded', () => {
    initAllCustomSelects();
    // Re-init after a short delay to catch dynamically populated selects
    setTimeout(initAllCustomSelects, 1500);
});

// Also expose so showSection can call it after loading data
window.initAllCustomSelects = initAllCustomSelects;

/* ================= ADVERTISEMENT SLOT ================= */
const AD_DOC = () => doc(db, 'system', 'superAdminSettings');

function _ytEmbedUrlAd(url) {
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

function _adAdjustFrame(w, h) {
    const slot = document.getElementById('adSlot');
    if (!slot || !w || !h) return;
    if (h > w) {
        // Portrait
        slot.style.width = '200px';
        slot.style.aspectRatio = '9 / 16';
    } else {
        // Landscape
        slot.style.width = '300px';
        slot.style.aspectRatio = '16 / 9';
    }
}

function _applyAdSlot(url, type) {
    const slot = document.getElementById('adSlot');
    if (!slot) return;
    if (!url) { slot.classList.remove('visible'); return; }

    const img = slot.querySelector('img');
    const vid = slot.querySelector('video');
    let iframe = slot.querySelector('iframe');

    // Remove old iframe if any
    if (iframe) iframe.remove();

    if (type === 'youtube') {
        // YouTube — assume landscape 16/9
        _adAdjustFrame(16, 9);
        iframe = document.createElement('iframe');
        iframe.src = _ytEmbedUrlAd(url);
        iframe.allow = 'autoplay; encrypted-media';
        iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
        slot.insertBefore(iframe, slot.querySelector('#adSlotClose'));
        if (img) img.style.display = 'none';
        if (vid) vid.style.display = 'none';
    } else if (type === 'video') {
        if (vid) {
            vid.src = url; vid.load(); vid.play().catch(() => {}); vid.style.display = 'block';
            vid.onloadedmetadata = () => _adAdjustFrame(vid.videoWidth, vid.videoHeight);
        }
        if (img) img.style.display = 'none';
    } else {
        if (img) {
            img.src = url; img.style.display = 'block';
            img.onload = () => _adAdjustFrame(img.naturalWidth, img.naturalHeight);
        }
        if (vid) vid.style.display = 'none';
    }
    slot.classList.add('visible');
}

// Preview in the manage section
function _applyAdPreview(url, type) {
    const img = document.getElementById('adPreviewImg');
    const vid = document.getElementById('adPreviewVideo');
    const iframe = document.getElementById('adPreviewIframe');
    const empty = document.getElementById('adPreviewEmpty');
    if (!img) return;

    if (type === 'youtube') {
        const yt = _ytEmbedUrlAd(url);
        iframe.src = yt; iframe.style.display = 'block';
        img.style.display = 'none'; vid.style.display = 'none'; empty.style.display = 'none';
    } else if (type === 'video') {
        vid.src = url; vid.load(); vid.play().catch(() => {});
        vid.style.display = 'block';
        img.style.display = 'none'; iframe.style.display = 'none'; empty.style.display = 'none';
    } else if (url) {
        img.src = url; img.style.display = 'block';
        vid.style.display = 'none'; iframe.style.display = 'none'; empty.style.display = 'none';
    } else {
        img.style.display = 'none'; vid.style.display = 'none';
        iframe.style.display = 'none'; empty.style.display = 'block';
    }
}

function _adStatus(msg, ok = true) {
    const el = document.getElementById('adStatus');
    if (el) { el.textContent = msg; el.style.color = ok ? '#16a34a' : '#dc2626'; }
}

async function loadAdSlot() {
    try {
        const snap = await getDoc(AD_DOC());
        if (!snap.exists()) return;
        const { adUrl, adType } = snap.data();
        if (adUrl) {
            _applyAdSlot(adUrl, adType);
            _applyAdPreview(adUrl, adType);
            const input = document.getElementById('adUrlInput');
            if (input) input.value = adUrl;
        }
    } catch (e) { if (!_isOfflineError(e)) console.warn('adSlot load:', e); }
}

async function saveAd(url) {
    if (!url) return _adStatus('Please enter a URL.', false);
    const type = _ytEmbedUrlAd(url) ? 'youtube' : (/\.(mp4|webm|ogg)$/i.test(url) ? 'video' : 'image');
    try {
        await setDoc(AD_DOC(), { adUrl: url, adType: type }, { merge: true });
        _applyAdSlot(url, type);
        _applyAdPreview(url, type);
        _adStatus('✅ Ad saved and now showing on your dashboard!');
    } catch (e) { _adStatus('Error: ' + e.message, false); }
}

async function removeAd() {
    try {
        await setDoc(AD_DOC(), { adUrl: null, adType: null }, { merge: true });
        _applyAdSlot(null, null);
        _applyAdPreview(null, null);
        const input = document.getElementById('adUrlInput');
        if (input) input.value = '';
        _adStatus('Ad removed.');
    } catch (e) { _adStatus('Error: ' + e.message, false); }
}

// Track current ad tab and selected file blob URL
let _adCurrentTab = 'url';
let _adBlobUrl = null;

function adSwitchTab(tab) {
    _adCurrentTab = tab;
    const urlPanel = document.getElementById('adPanelUrl');
    const filePanel = document.getElementById('adPanelFile');
    const tabUrl = document.getElementById('adTabUrl');
    const tabFile = document.getElementById('adTabFile');
    if (!urlPanel || !filePanel) return;
    if (tab === 'url') {
        urlPanel.style.display = 'block';
        filePanel.style.display = 'none';
        tabUrl.style.background = '#3b82f6'; tabUrl.style.color = '#fff';
        tabFile.style.background = 'transparent'; tabFile.style.color = '#64748b';
    } else {
        urlPanel.style.display = 'none';
        filePanel.style.display = 'block';
        tabFile.style.background = '#3b82f6'; tabFile.style.color = '#fff';
        tabUrl.style.background = 'transparent'; tabUrl.style.color = '#64748b';
    }
}

// Save a local blob URL (session only — not persisted to Firestore)
function saveAdLocal(blobUrl, type) {
    _applyAdSlot(blobUrl, type);
    _applyAdPreview(blobUrl, type);
    _adStatus('✅ Ad is now showing on your dashboard! (session only — reloading will clear it)', true);
}

document.addEventListener('DOMContentLoaded', () => {
    // Tab switcher
    document.getElementById('adTabUrl')?.addEventListener('click', () => adSwitchTab('url'));
    document.getElementById('adTabFile')?.addEventListener('click', () => adSwitchTab('file'));

    // File picker div click → trigger hidden input
    document.getElementById('adFilePickerBtn')?.addEventListener('click', () => {
        document.getElementById('adFileInput')?.click();
    });

    const previewBtn = document.getElementById('adPreviewBtn');
    if (previewBtn) previewBtn.addEventListener('click', () => {
        const url = document.getElementById('adUrlInput')?.value.trim();
        if (!url) return _adStatus('Enter a URL to preview.', false);
        const type = _ytEmbedUrlAd(url) ? 'youtube' : (/\.(mp4|webm|ogg)$/i.test(url) ? 'video' : 'image');
        _applyAdPreview(url, type);
    });

    // File input — generate blob URL and preview immediately
    const fileInput = document.getElementById('adFileInput');
    if (fileInput) fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (_adBlobUrl) URL.revokeObjectURL(_adBlobUrl);
        _adBlobUrl = URL.createObjectURL(file);
        document.getElementById('adFileName').textContent = file.name;
        const type = file.type.startsWith('video') ? 'video' : 'image';
        _applyAdPreview(_adBlobUrl, type);
        _adStatus('File loaded — click 💾 Save Ad to confirm.', true);
    });

    const saveBtn = document.getElementById('adSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        if (_adCurrentTab === 'file') {
            if (!_adBlobUrl) return _adStatus('Please choose a file first.', false);
            const fi = document.getElementById('adFileInput');
            const file = fi?.files[0];
            const type = file && file.type.startsWith('video') ? 'video' : 'image';
            saveAdLocal(_adBlobUrl, type);
        } else {
            saveAd(document.getElementById('adUrlInput')?.value.trim());
        }
    });

    const removeBtn = document.getElementById('adRemoveBtn');
    if (removeBtn) removeBtn.addEventListener('click', () => {
        if (_adBlobUrl) { URL.revokeObjectURL(_adBlobUrl); _adBlobUrl = null; }
        const fn = document.getElementById('adFileName');
        if (fn) fn.textContent = 'No file chosen';
        const fi = document.getElementById('adFileInput');
        if (fi) fi.value = '';
        removeAd();
    });

    const closeBtn = document.getElementById('adSlotClose');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        document.getElementById('adSlot')?.classList.remove('visible');
    });
});

/* ================= ONLINE PRESENCE ================= */
const PRESENCE_COL = 'onlinePresence';
const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min = considered online
let _presenceUid = null;
let _presenceInterval = null;
let _presenceUnsubscribe = null;

async function initPresence(uid) {
    _presenceUid = uid;
    const ref = doc(db, PRESENCE_COL, uid);

    async function heartbeat() {
        try {
            await setDoc(ref, { uid, lastSeen: serverTimestamp(), role: 'superadmin' }, { merge: true });
        } catch (e) { /* offline — ignore */ }
    }

    await heartbeat();
    _presenceInterval = setInterval(heartbeat, 60 * 1000); // ping every 1 min

    // Listen to all presence docs and count those active in last 5 min
    _presenceUnsubscribe = onSnapshot(collection(db, PRESENCE_COL), snap => {
        const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
        let count = 0;
        snap.forEach(d => {
            const ls = d.data().lastSeen?.toMillis?.();
            if (ls && ls >= cutoff) count++;
        });
        const el = document.getElementById('onlineUsersCount');
        if (el) el.textContent = count;
    }, err => {
        // Permission errors are non-critical — just show own presence
        console.warn('Presence listener:', err.code);
        const el = document.getElementById('onlineUsersCount');
        if (el) el.textContent = '1';
    });

    // Remove presence on tab close
    window.addEventListener('beforeunload', () => {
        navigator.sendBeacon && navigator.sendBeacon('/'); // keep alive trick
        clearInterval(_presenceInterval);
    });
}

/* ================= AUTO LOGOUT (10 min idle) ================= */
// initAutoLogout is imported from auto-logout.js and called directly at line ~1132

