import { auth, db } from "./firebase.js";
import { loadAndApplyBackground, saveCollegeBackground, deleteCollegeBackground } from "./college-background.js";

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
import { query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Global variables for multi-college support
let currentUser = null;
let currentUserData = null;
let currentCollegeId = null;
let currentCollegeName = null;

// Helper function to get college-filtered query
function getCollegeFilteredQuery(collectionName, additionalFilters = []) {
	let q = collection(db, collectionName);

	// Add college filter if user is not super admin
	if (currentUserData && !["superadmin", "SuperAdmin"].includes(currentUserData.role)) {
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

function updateTimeBasedGreeting(adminName, adminRole) {
	const greetingBlock = document.getElementById('greetingBlock');
	const welcome = document.getElementById('welcome');
	const greetingSubtext = document.getElementById('greetingSubtext');
	const timeIcon = document.getElementById('timeIcon');
	const bgElement1 = document.getElementById('bgElement1');
	const bgElement2 = document.getElementById('bgElement2');
	const bgElement3 = document.getElementById('bgElement3');

	if (!greetingBlock) return;

	// Persist name/role across interval calls
	if (adminName) updateTimeBasedGreeting._name = adminName;
	if (adminRole) updateTimeBasedGreeting._role = adminRole;
	const name = updateTimeBasedGreeting._name || '';
	const role = updateTimeBasedGreeting._role || '';

	const hour = new Date().getHours();
	let greeting, subtext, icon, background, elements;

	// Early Morning (5 AM - 6 AM)
	if (hour >= 5 && hour < 6) {
		greeting = 'Good Early Morning';
		subtext = 'The day is just beginning. Time to start fresh!';
		icon = '🌄';
		background = 'linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #e74c3c 100%)';
		elements = [
			{ top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(52, 152, 219, 0.2)' },
			{ bottom: '-30px', left: '-30px', width: '150px', height: '150px', background: 'rgba(231, 76, 60, 0.15)' },
			{ top: '50%', left: '50%', width: '100px', height: '100px', background: 'rgba(255, 255, 255, 0.1)' }
		];
	}
	// Morning (6 AM - 12 PM)
	else if (hour >= 6 && hour < 12) {
		greeting = 'Good Morning';
		subtext = "Rise and shine! Let's make today productive!";
		icon = '🌅';
		background = 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 50%, #6BCB77 100%)';
		elements = [
			{ top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255, 217, 61, 0.3)' },
			{ bottom: '-30px', left: '-30px', width: '150px', height: '150px', background: 'rgba(107, 203, 119, 0.2)' },
			{ top: '50%', left: '20%', width: '120px', height: '120px', background: 'rgba(255, 255, 255, 0.15)' }
		];
	}
	// Afternoon (12 PM - 5 PM)
	else if (hour >= 12 && hour < 17) {
		greeting = 'Good Afternoon';
		subtext = "Keep up the great work! You're doing amazing!";
		icon = '☀️';
		background = 'linear-gradient(135deg, #F7971E 0%, #FFD200 50%, #FF6B6B 100%)';
		elements = [
			{ top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255, 210, 0, 0.3)' },
			{ bottom: '-30px', left: '-30px', width: '150px', height: '150px', background: 'rgba(255, 107, 107, 0.2)' },
			{ top: '40%', right: '30%', width: '100px', height: '100px', background: 'rgba(255, 255, 255, 0.15)' }
		];
	}
	// Evening (5 PM - 8 PM)
	else if (hour >= 17 && hour < 20) {
		greeting = 'Good Evening';
		subtext = 'Winding down the day. Great job today!';
		icon = '🌆';
		background = 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)';
		elements = [
			{ top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(118, 75, 162, 0.3)' },
			{ bottom: '-30px', left: '-30px', width: '150px', height: '150px', background: 'rgba(240, 147, 251, 0.2)' },
			{ top: '30%', left: '40%', width: '130px', height: '130px', background: 'rgba(255, 255, 255, 0.1)' }
		];
	}
	// Night (8 PM - 5 AM)
	else {
		greeting = 'Good Night';
		subtext = "Working late? Don't forget to rest!";
		icon = '🌙';
		background = 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';
		elements = [
			{ top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(32, 58, 67, 0.4)' },
			{ bottom: '-30px', left: '-30px', width: '150px', height: '150px', background: 'rgba(44, 83, 100, 0.3)' },
			{ top: '20%', right: '20%', width: '80px', height: '80px', background: 'rgba(255, 255, 255, 0.1)' }
		];
	}

	// Build greeting with name if available
	if (welcome) {
		if (name) {
			welcome.innerHTML = `${greeting}, <span style="font-weight:900;">${escapeHtml(name)}</span>! ${icon}`;
		} else {
			welcome.textContent = `${greeting}! ${icon}`;
		}
	}
	if (greetingSubtext) {
		greetingSubtext.textContent = role
			? `${subtext} (${role.toUpperCase()})`
			: subtext;
	}
	if (timeIcon) timeIcon.textContent = icon;
	if (greetingBlock) greetingBlock.style.background = background;

	if (bgElement1 && elements[0]) Object.assign(bgElement1.style, elements[0]);
	if (bgElement2 && elements[1]) Object.assign(bgElement2.style, elements[1]);
	if (bgElement3 && elements[2]) Object.assign(bgElement3.style, elements[2]);
}

// Update greeting on page load and every minute
document.addEventListener('DOMContentLoaded', () => {
	updateTimeBasedGreeting();
	setInterval(updateTimeBasedGreeting, 60000); // Update every minute
});


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

const totalStudents = document.getElementById("totalStudents");
const totalIncharge = document.getElementById("totalIncharge");
const totalHod = document.getElementById("totalHod");
const totalDaysAdmin = document.getElementById("totalDaysAdmin");
const pendingCount = document.getElementById("pendingCount");
const presentCount = document.getElementById("presentCount");
const absentCount = document.getElementById("absentCount");
const notifyCount = document.getElementById("notifyCount");
const fnPresentEl = document.getElementById("fnPresent");
const fnAbsentEl = document.getElementById("fnAbsent");
const anPresentEl = document.getElementById("anPresent");
const anAbsentEl = document.getElementById("anAbsent");
const currentSession = document.getElementById("currentSession");
const timeLeft = document.getElementById("timeLeft");
const fnTiming = document.getElementById("fnTiming");
const anTiming = document.getElementById("anTiming");
const timingStatusBadge = document.getElementById("timingStatusBadge");
const gpsStatusBadge = document.getElementById("gpsStatusBadge");

const approvalTable = document.getElementById("approvalTable");
const selectAll = document.getElementById("selectAll");
const recentActivityBody = document.getElementById("recentActivityBody");

// Profile Update Elements
const showRegistrations = document.getElementById("showRegistrations");
const showProfileUpdates = document.getElementById("showProfileUpdates");
const registrationApprovalsView = document.getElementById("registrationApprovalsView");
const profileUpdatesView = document.getElementById("profileUpdatesView");
const profileUpdateTable = document.getElementById("profileUpdateTable");
const hodProfileApprovalToggle = document.getElementById("hodProfileApprovalToggle");
const saveSecuritySettings = document.getElementById("saveSecuritySettings");
const profileUpdateSearch = document.getElementById("profileUpdateSearch");

let pendingApprovals = [];
let pendingPerms = [];
let pendingProfileRequests = [];
let pendingManualRequests = [];
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

	// Add Clear All button at the top
	if (pendingApprovals.length > 0 || pendingPerms.length > 0) {
		rows.push(`<button id="clearAllInList" class="notify-clear-btn" type="button">Clear All</button>`);
	}

	pendingApprovals.forEach(u => rows.push(`<div class="notify-item" data-type="approval" data-id="${u.id}">Approval: ${escapeHtml(u.name)}</div>`));
	pendingPerms.forEach(p => rows.push(`<div class="notify-item" data-type="permission" data-id="${p.id}">Permission: ${escapeHtml(p.label)}</div>`));
	pendingProfileRequests.forEach(r => rows.push(`<div class="notify-item" data-type="profileUpdate" data-id="${r.id}">Profile Update: ${escapeHtml(r.name)}</div>`));
	pendingManualRequests.forEach(m => rows.push(`<div class="notify-item" data-type="manualAttendance" data-id="${m.id}">Manual Attendance: ${escapeHtml(m.name)}</div>`));

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

	// update bell count
	const total = pendingApprovals.length + pendingPerms.length + pendingProfileRequests.length + pendingManualRequests.length;
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
		const usersQ = getCollegeFilteredQuery('users');
		notifyUsersUnsub = onSnapshot(usersQ, snap => {
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
		const permQ = getCollegeFilteredQuery('permissionRequests');
		notifyPermsUnsub = onSnapshot(permQ, snap => {
			const items = [];
			snap.forEach(d => {
				const p = d.data();
				if (p.status === 'pending') {
					items.push({ id: d.id, label: p.staffName || p.role || 'Permission request' });
				}
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
		const profileQ = getCollegeFilteredQuery('profileUpdateRequests');
		notifyProfileUnsub = onSnapshot(profileQ, snap => {
			const items = [];
			snap.forEach(d => {
				const r = d.data();
				if (r.status === 'pending' || r.status === 'hod_verified') {
					items.push({ id: d.id, name: r.name || 'User' });
				}
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
		const manualQ = getCollegeFilteredQuery('manualRequests');
		notifyManualUnsub = onSnapshot(manualQ, snap => {
			const items = [];
			snap.forEach(d => {
				const m = d.data();
				if (m.status === 'pending') {
					items.push({ id: d.id, name: m.name || 'Student' });
				}
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
const yearFilter = document.getElementById("yearFilter");
const attendanceDateFilter = document.getElementById("attendanceDateFilter");
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

// Helper function to close all settings submenus
function closeAllSettingsSubmenus() {
	const submenus = ['basicSettingsSubmenu', 'advancedSettingsSubmenu'];
	submenus.forEach(id => {
		const submenu = document.getElementById(id);
		const toggle = document.getElementById(id.replace('Submenu', 'Toggle'));
		if (submenu && toggle) {
			submenu.classList.add('hidden');
			const arrow = toggle.querySelector('span:last-child');
			if (arrow) arrow.textContent = '▼';
		}
	});
}

settingsToggle.onclick = () => {
	const isHidden = settingsSubmenu.classList.toggle("hidden");
	settingsSubmenu.setAttribute('aria-hidden', isHidden);
	const arrow = settingsToggle.querySelector('.submenu-arrow');
	if (arrow) arrow.textContent = isHidden ? '▼' : '▲';
};

// Basic Settings Toggle
const basicSettingsToggle = document.getElementById("basicSettingsToggle");
const basicSettingsSubmenu = document.getElementById("basicSettingsSubmenu");

if (basicSettingsToggle && basicSettingsSubmenu) {
	basicSettingsToggle.onclick = (e) => {
		e.stopPropagation();
		const wasHidden = basicSettingsSubmenu.classList.contains('hidden');
		closeAllSettingsSubmenus();
		if (wasHidden) {
			basicSettingsSubmenu.classList.remove('hidden');
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
		const wasHidden = advancedSettingsSubmenu.classList.contains('hidden');
		closeAllSettingsSubmenus();
		if (wasHidden) {
			advancedSettingsSubmenu.classList.remove('hidden');
			const arrow = advancedSettingsToggle.querySelector('span:last-child');
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

	// Close sidebar on mobile
	closeSidebar();

	// History Management
	if (!isBack) {
		history.pushState({ section: id }, "", `#${id}`);
	}
}

// Expose for any remaining inline onclick usage
window.showSection = showSection;

// Wire up settings status badge clicks
document.getElementById('timingStatusBadge')?.addEventListener('click', () => showSection('timing'));
document.getElementById('gpsStatusBadge')?.addEventListener('click', () => showSection('gps'));

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
	try {
		// Approve all pending users
		const allApprovals = [...pendingApprovals];
		const ops = allApprovals.map(u => updateDoc(doc(db, "users", u.id), { approved: true }));
		await Promise.all(ops);

		// Mark all pending permissions as read (delete them or mark as handled)
		const allPerms = [...pendingPerms];
		const permOps = allPerms.map(p => deleteDoc(doc(db, "permissionRequests", p.id)));
		await Promise.all(permOps);

		await loadApprovals();
		await loadStats();
		renderNotifyList();
	} catch (err) {
		console.error('clearAll error', err);
		alert('Failed to clear notifications');
	}
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
	// Show loading screen
	showLoading('Authenticating...');

	if (!user) {
		location = "login.html";
		return;
	}

	currentUser = user;

	try {
		showLoading('Loading your profile...');
		
		loadSecuritySettings();
		const snap = await getDoc(doc(db, "users", user.uid));
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

		// Validate user role - only admin and principal can access college admin dashboard
		const userRole = (me.role || "").toLowerCase();
		if (!["admin", "principal"].includes(userRole)) {
			console.warn("Access denied. User role:", me.role);
			alert("Access denied. College administrator privileges required.");
			await signOut(auth);
			location = "login.html";
			return;
		}

		showLoading('Loading dashboard data...');

	// Load college information if available
	if (currentCollegeId) {
		try {
			const collegeDoc = await getDoc(doc(db, "colleges", currentCollegeId));
			if (collegeDoc.exists()) {
				const collegeData = collegeDoc.data();
				currentCollegeName = collegeData.name;
				// Update header with college name
				const headerCenter = document.querySelector('.header-center');
				if (headerCenter) {
					const collegeInfo = document.createElement('div');
					collegeInfo.style.fontSize = '12px';
					collegeInfo.style.color = '#64748b';
					collegeInfo.textContent = currentCollegeName;
					headerCenter.appendChild(collegeInfo);
				}
				// Apply college background if set
				if (collegeData.backgroundImage) {
					loadAndApplyBackground(currentCollegeId);
				}
				// Pre-fill background preview if already set
				const bgImg = document.getElementById('bgPreviewImg');
				const bgEmpty = document.getElementById('bgPreviewEmpty');
				const bgInput = document.getElementById('bgUrlInput');
				if (collegeData.backgroundImage) {
					if (bgImg) { bgImg.src = collegeData.backgroundImage; bgImg.style.display = 'block'; }
					if (bgEmpty) bgEmpty.style.display = 'none';
					if (bgInput) bgInput.value = collegeData.backgroundImage;
				}
			}
		} catch (error) {
			console.warn("Could not load college information:", error);
		}
	}

	// Update header and sidebar with user info
	updateUserInfo(me);

	// Start updating time and date
	updateTimeAndDate();
	setInterval(updateTimeAndDate, 1000);

	// Update greeting with admin's name
	updateTimeBasedGreeting(me.name, me.role);

	// Check and display holiday status
	await checkHolidayStatus();


	// Default date filter to today
	if (attendanceDateFilter && !attendanceDateFilter.value) {
		const now = new Date();
		attendanceDateFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	}

	// Staff filter buttons
	document.getElementById('staffFilterAll')?.addEventListener('click', () => loadStaff('all'));
	document.getElementById('staffFilterHod')?.addEventListener('click', () => loadStaff('hod'));
	document.getElementById('staffFilterIncharge')?.addEventListener('click', () => loadStaff('incharge'));

	updateSessionInfo();
	updateSettingsStatus();
	startNotifyListeners();
	setInterval(updateSessionInfo, 1000);

	// Await critical data loads in parallel, then hide loading
	await Promise.allSettled([
		loadStats(),
		loadApprovals(),
		loadStaff("all"),
		loadStudents(),
		loadAttendance(),
	]);

	hideLoading();
	setTimeout(initAllCustomSelects, 300);

	// Initialize email approval service (non-blocking)
	if (window.emailApprovalService) {
		window.emailApprovalService.initialize().catch(() => {});
	}

	} catch (error) {
		console.error('Error during initialization:', error);
		alert('Error loading dashboard. Please try again.');
		hideLoading();
	}

});



/* ================= DASHBOARD STATS ================= */

async function calculateTotalDays() {
	try {
		// Get college-specific academic year settings
		if (!currentCollegeId) return;
		const academicYearDoc = await getDoc(getAcademicYearDocRef(currentCollegeId));


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

		// Fetch all holidays for this college
		const holidaysSnap = await getDocs(collection(db, "colleges", currentCollegeId, "holidays"));

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
		const totalDaysEl = document.getElementById("totalDays");
		if (totalDaysEl) safeSet(totalDaysEl, workingDays);
	} catch (err) {
		console.error('calculateTotalDays error', err);
		safeSet(totalDaysAdmin, 0);
	}
}

function getAcademicYearDocRef(collegeId) {
	return doc(db, "colleges", collegeId, "settings", "academicYear");
}

async function loadStats() {

	try {
		let students = 0, incharges = 0, hods = 0, pending = 0;

		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		// Use college-filtered query for users
		const usersQuery = getCollegeFilteredQuery("users");
		const users = await getDocs(usersQuery);
		users.forEach(d => {
			const u = d.data();
			const r = (u.role || "").toLowerCase();
			if (!u.approved) {
				pending++;
			} else {
				if (r === "student") students++;
				else if (r === "incharge") incharges++;
				else if (r === "hod") hods++;
			}
		});

		// Count pending profile update requests
		try {
			const profileRequestsQuery = getCollegeFilteredQuery("profileUpdateRequests");
			const profileRequests = await getDocs(profileRequestsQuery);
			profileRequests.forEach(d => {
				const req = d.data();
				if (req.status === "pending" || req.status === "hod_verified") {
					pending++;
				}
			});
		} catch (err) {
			console.warn("Could not load profile update requests:", err);
		}

		// Count pending permission requests
		try {
			const permRequestsQuery = getCollegeFilteredQuery("permissionRequests");
			const permRequests = await getDocs(permRequestsQuery);
			permRequests.forEach(d => {
				const req = d.data();
				if (req.status === "pending") {
					pending++;
				}
			});
		} catch (err) {
			console.warn("Could not load permission requests:", err);
		}

		// Use college-filtered query for attendance records
		const attQuery = getCollegeFilteredQuery("attendanceRecords");
		const att = await getDocs(attQuery);
		let fnPresent = 0, anPresent = 0;
		attendanceRecords = [];
		att.forEach(d => {
			const a = d.data();
			attendanceRecords.push({ ...a, id: d.id });
			if (a.date === today) {
				const s = (a.session || "").toString().toUpperCase();
				const st = (a.status || "").toLowerCase();
				if (st === "present") {
					if (s === "FN") fnPresent++;
					else if (s === "AN") anPresent++;
				}
			}
		});

		safeSet(totalStudents, students);
		safeSet(totalIncharge, incharges);
		safeSet(totalHod, hods);
		safeSet(pendingCount, pending);

		// Align to HTML ids if they exist
		const totalStaffEl = document.getElementById("totalStaff");
		if (totalStaffEl) safeSet(totalStaffEl, incharges + hods);
		const pendingApprovalsEl = document.getElementById("pendingApprovals");
		if (pendingApprovalsEl) safeSet(pendingApprovalsEl, pending);

		// Calculate total working days
		await calculateTotalDays();

		safeSet(fnPresentEl, fnPresent);
		safeSet(fnAbsentEl, Math.max(0, students - fnPresent));
		safeSet(anPresentEl, anPresent);
		safeSet(anAbsentEl, Math.max(0, students - anPresent));

		// Total present/absent across both sessions
		const totalPresentToday = fnPresent + anPresent;
		const totalAbsentToday = Math.max(0, students - fnPresent) + Math.max(0, students - anPresent);
		safeSet(presentCount, totalPresentToday);
		safeSet(absentCount, totalAbsentToday);

		// College Percentage
		const totalPossibleToday = students * 2;
		const collegeP = totalPossibleToday > 0 ? (totalPresentToday / totalPossibleToday * 100).toFixed(1) : 0;
		const collPercentEl = document.getElementById("collegeAttendancePercent");
		if (collPercentEl) {
			collPercentEl.innerText = `${collegeP}%`;
			collPercentEl.style.color = Number(collegeP) >= 75 ? "#10b981" : "#dc2626";
		}
		renderRecentActivity();

	} catch (err) {
		console.error('loadStats error', err);
	}

}

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
			<td><strong>${escapeHtml(r.studentName)}</strong><br><small>${r.department || '-'}</small></td>
			<td>Marked <strong>${r.session}</strong> ${r.status.toUpperCase()}</td>
		`;
		recentActivityBody.appendChild(row);
	});
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
			// Check college-specific holidays collection
			if (!currentCollegeId) return false;
			const holidayDoc = await getDoc(doc(db, "colleges", currentCollegeId, "holidays", today));

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
		console.error('checkHolidayStatus error', err);
		return false;
	}
}

/* ================= SESSION TIME ================= */

async function updateSessionInfo() {
	try {
		const collegeSettingsRef = currentCollegeId ? doc(db, "colleges", currentCollegeId, "settings", "attendance") : null;
		const [collegeSettingsSnap, legacySettingsSnap] = await Promise.all([
			collegeSettingsRef ? getDoc(collegeSettingsRef) : Promise.resolve(null),
			getDoc(doc(db, "settings", "attendance"))
		]);
		const timingData = collegeSettingsSnap?.exists() ? collegeSettingsSnap.data() : (legacySettingsSnap.exists() ? legacySettingsSnap.data() : null);
		if (!timingData) return;

		const fStart = timingData.fnStart || "00:00";
		const fEnd = timingData.fnEnd || "23:59";
		const aStart = timingData.anStart || "00:00";
		const aEnd = timingData.anEnd || "23:59";

		// Populate timing inputs if they are empty (initial load)
		if (fnStart && !fnStart.value) fnStart.value = fStart;
		if (fnEnd && !fnEnd.value) fnEnd.value = fEnd;
		if (anStart && !anStart.value) anStart.value = aStart;
		if (anEnd && !anEnd.value) anEnd.value = aEnd;

		// Populate GPS inputs if they exist and are empty
		if (lat && !lat.value && timingData.lat) lat.value = timingData.lat;
		if (lng && !lng.value && timingData.lng) lng.value = timingData.lng;
		if (radius && !radius.value && timingData.radius) radius.value = timingData.radius;

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
		console.error('updateSessionInfo error', err);
	}
}

async function updateSettingsStatus() {
	function setBadge(el, type) {
		if (!el) return;
		const styles = {
			ok:      { html: type === 'gps' ? '✅ Active' : '✅ Set',  bg: '#dcfce7', color: '#166534', border: '2px solid #bbf7d0' },
			notset:  { html: '✗ Not Set',  bg: '#fee2e2', color: '#991b1b', border: '2px solid #fecaca' },
			na:      { html: '— N/A',      bg: '#f1f5f9', color: '#64748b', border: '2px solid #e2e8f0' },
			error:   { html: '⚠ Error',    bg: '#fef3c7', color: '#92400e', border: '2px solid #fde68a' }
		};
		const s = styles[type] || styles.notset;
		el.innerHTML = s.html;
		el.style.background = s.bg;
		el.style.color = s.color;
		el.style.border = s.border;
	}

	try {
		// Prefer college-scoped path, fall back to legacy global path
		let data = null;

		if (currentCollegeId) {
			const snap = await getDoc(doc(db, "colleges", currentCollegeId, "settings", "attendance"));
			if (snap.exists()) data = snap.data();
		}

		// Fall back to legacy path only if no college-scoped data found
		if (!data) {
			const legacySnap = await getDoc(doc(db, "settings", "attendance"));
			if (legacySnap.exists()) {
				const legacyData = legacySnap.data();
				// Only use legacy data if it belongs to this college (or no college filter)
				if (!currentCollegeId || !legacyData.collegeId || legacyData.collegeId === currentCollegeId) {
					data = legacyData;
				}
			}
		}

		if (!data) {
			setBadge(gpsStatusBadge, 'notset');
			setBadge(timingStatusBadge, 'notset');
			return;
		}

		// GPS: treat "0" / 0 as valid values — only blank/null/undefined means not set
		const gpsOk = data.lat !== "" && data.lat != null &&
		              data.lng !== "" && data.lng != null &&
		              data.radius !== "" && data.radius != null;
		setBadge(gpsStatusBadge, gpsOk ? 'ok' : 'notset');

		// Timing: all four fields must be non-empty
		const timingOk = data.fnStart && data.fnEnd && data.anStart && data.anEnd;
		setBadge(timingStatusBadge, timingOk ? 'ok' : 'notset');

	} catch (err) {
		console.error('updateSettingsStatus error', err);
		const badgeType = err.code === 'permission-denied' ? 'na' : 'error';
		setBadge(gpsStatusBadge, badgeType);
		setBadge(timingStatusBadge, badgeType);
	}
}



/* ================= APPROVALS ================= */

async function loadApprovals() {

	try {
		safeSet(approvalTable, "", "html");
		let i = 1;
		const usersQ = getCollegeFilteredQuery('users');
		const snap = await getDocs(usersQ);
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

			// Get user data for each selected user before approval
			const userPromises = selected.map(cb => getDoc(doc(db, "users", cb.value)));
			const userDocs = await Promise.all(userPromises);

			// Approve all users
			const approvalOps = selected.map(cb => updateDoc(doc(db, "users", cb.value), { approved: true }));
			await Promise.all(approvalOps);

			// Send approval emails
			const emailPromises = userDocs.map(async (userDoc, index) => {
				const userData = userDoc.data();
				if (userData && userData.email) {
					try {
						await window.emailApprovalService.sendApprovalNotification(
							userData.email,
							userData.name || userData.email,
							currentUserData?.role || 'College Administrator',
							'registration'
						);
						console.log('✅ Bulk approval notification sent to:', userData.email);
					} catch (emailError) {
						console.error('❌ Failed to send bulk approval notification:', emailError);
					}
				}
			});
			await Promise.all(emailPromises);

			await loadApprovals();
			await loadStats();
			renderNotifyList();
			alert(`✅ ${selected.length} users approved successfully! Notification emails sent.`);
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
							currentUserData?.role || 'College Administrator',
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
		// Get user data before approval
		const userDoc = await getDoc(doc(db, "users", uid));
		const userData = userDoc.data();

		// Approve the user
		await updateDoc(doc(db, "users", uid), { approved: true });

		// Send approval notification email
		if (userData && userData.email) {
			try {
				await window.emailApprovalService.sendApprovalNotification(
					userData.email,
					userData.name || userData.email,
					currentUserData?.role || 'College Administrator',
					'registration'
				);
				console.log('✅ Approval notification sent to:', userData.email);
			} catch (emailError) {
				console.error('❌ Failed to send approval notification:', emailError);
				// Don't fail the approval if email fails
			}
		}

		await loadApprovals();
		await loadStats();
		renderNotifyList();
		alert('✅ User approved successfully! Notification email sent.');
	} catch (err) {
		console.error('approveUser error', err);
		alert('Failed to approve user');
	}
};



/* SINGLE REJECT */

window.rejectUser = async uid => {
	try {
		// Get user data before deletion
		const userDoc = await getDoc(doc(db, "users", uid));
		const userData = userDoc.data();

		// Send rejection notification email before deleting
		if (userData && userData.email) {
			try {
				await window.emailApprovalService.sendRejectionNotification(
					userData.email,
					userData.name || userData.email,
					currentUserData?.role || 'College Administrator',
					'registration',
					'Account registration was not approved'
				);
				console.log('✅ Rejection notification sent to:', userData.email);
			} catch (emailError) {
				console.error('❌ Failed to send rejection notification:', emailError);
				// Don't fail the rejection if email fails
			}
		}

		// Delete the user
		await deleteDoc(doc(db, "users", uid));
		await loadApprovals();
		await loadStats();
		renderNotifyList();
		alert('❌ User rejected and notification email sent.');
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
						currentUserData?.name || currentUserData?.role || 'College Administrator',
						'permission request',
						{
							permissionType: requestData.permissionType || 'both',
							collegeName: requestData.collegeName || currentCollegeName || ''
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
						currentUserData?.name || currentUserData?.role || 'College Administrator',
						'permission request',
						'Your permission request was denied by the administrator.',
						{
							permissionType: requestData.permissionType || 'both',
							collegeName: requestData.collegeName || currentCollegeName || ''
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
		console.log('Loading students for college:', currentCollegeId);
		safeSet(studentsTable, "", "html");
		studentsData = [];
		let i = 1;
		const usersQ = getCollegeFilteredQuery('users');
		const snap = await getDocs(usersQ);
		let rows = "";
		let approvedCount = 0;

		snap.forEach(d => {
			const u = d.data();
			// Only show approved students
			if (u.role === "student" && u.approved) {
				approvedCount++;
				studentsData.push({ id: d.id, ...u });
				const name = escapeHtml(u.name || "-");
				const studentId = escapeHtml(u.studentId || "-");
				const email = escapeHtml(u.email || "-");
				const dept = escapeHtml(u.department || "-");
				const year = escapeHtml(u.year || "-");
				rows += `\n<tr onclick="openUserDetails('${d.id}')" style="cursor: pointer;">\n<td>${i++}</td>\n<td>${name}</td>\n<td>${studentId}</td>\n<td>${email}</td>\n<td>${dept}</td>\n<td>${year}</td>\n<td><button class="action-btn" onclick="event.stopPropagation(); openUserDetails('${d.id}')">View</button></td>\n</tr>\n`;
			}
		});

		console.log('Loaded approved students:', approvedCount);
		safeSet(studentsTable, rows || '<tr><td colspan="7" style="text-align:center;">No approved students found. Please approve students from the Approvals section.</td></tr>', "html");
		filterStudents();
	} catch (err) {
		console.error('loadStudents error:', err);
		console.error('Error code:', err.code);

		let errorMsg = 'Failed to load students';
		if (err.code === 'permission-denied') {
			errorMsg = 'Permission denied. Please check your access rights.';
		}
		safeSet(studentsTable, `<tr><td colspan="7" style="text-align:center; color: #dc2626;">${errorMsg}</td></tr>`, 'html');
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
		console.log('Loading staff for college:', currentCollegeId, 'role:', role);
		safeSet(staffTable, "", "html");
		staffData = [];
		let i = 1;
		const usersQ = getCollegeFilteredQuery('users');
		const snap = await getDocs(usersQ);
		let rows = "";
		const staffByDept = {}; // For caching staff list by department
		let approvedCount = 0;

		snap.forEach(d => {
			const u = d.data();
			const r = (u.role || "").toLowerCase();
			// only show actual staff roles — exclude students, admins, principals, superadmins
			const isStaffRole = ["hod", "incharge"].includes(r);
			if (isStaffRole && u.approved) {
				if (role === "all" || r === role) {
					approvedCount++;
					staffData.push({ id: d.id, ...u });
					const name = escapeHtml(u.name || "-");
					const email = escapeHtml(u.email || "-");
					const dept = escapeHtml(u.department || "-");
					rows += `\n<tr onclick="openUserDetails('${d.id}')" style="cursor: pointer;">\n<td>${i++}</td>\n<td>${name}</td>\n<td>${email}</td>\n<td>${dept}</td>\n</tr>\n`;

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

		console.log('Loaded approved staff:', approvedCount);
		safeSet(staffTable, rows || '<tr><td colspan="4" style="text-align:center;">No approved staff found. Please approve staff from the Approvals section.</td></tr>', "html");

		// Update staffList in settings for student access
		if (Object.keys(staffByDept).length > 0 && currentCollegeId) {
			try {
				await setDoc(doc(db, "settings", `staffList_${currentCollegeId}`), { ...staffByDept, collegeId: currentCollegeId });
				console.log("Staff list cached for student access");
			} catch (err) {
				console.warn("Failed to cache staff list:", err);
			}
		}
	} catch (err) {
		console.error('loadStaff error:', err);
		console.error('Error code:', err.code);

		let errorMsg = 'Failed to load staff';
		if (err.code === 'permission-denied') {
			errorMsg = 'Permission denied. Please check your access rights.';
		}
		safeSet(staffTable, `<tr><td colspan="4" style="text-align:center; color: #dc2626;">${errorMsg}</td></tr>`, 'html');
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
			<div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid rgba(0, 0, 0, 0.05);">
				<div style="display: flex; gap: 30px; align-items: start; flex-wrap: wrap;">
					<img src="${photo}" style="width:140px; height:140px; border-radius:16px; object-fit:cover; border: 4px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
					<div style="flex: 1; min-width: 250px; position:relative;">
						<div style="display:flex; justify-content:space-between; align-items:flex-start;">
							<h3 style="margin: 0 0 16px 0; font-size: 28px; color: #0f172a; font-weight: 800;">${escapeHtml(user.name)}</h3>
						</div>
						<div style="display: grid; gap: 12px;">
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Email:</strong> ${escapeHtml(user.email)}</p>
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Role:</strong> <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-weight: 600; text-transform: uppercase; font-size: 13px;">${escapeHtml(user.role)}</span></p>
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Department:</strong> ${escapeHtml(user.department || "-")}</p>
							${user.phone ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Phone:</strong> ${escapeHtml(user.phone)}</p>` : ""}
							${user.year ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Year:</strong> ${escapeHtml(user.year)}</p>` : ""}
							${user.staffId ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Staff ID:</strong> ${escapeHtml(user.staffId)}</p>` : ""}
							${user.studentId ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">Student ID:</strong> ${escapeHtml(user.studentId)}</p>` : ""}
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">College ID:</strong> ${escapeHtml(user.collegeId || "-")}</p>
							${user.collegeCode ? `<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">College Code:</strong> ${escapeHtml(user.collegeCode)}</p>` : ""}
							<p style="margin: 0; color: #475569; font-size: 15px;"><strong style="color: #0f172a; display: inline-block; min-width: 140px;">College Name:</strong> ${escapeHtml(user.collegeName || "-")}</p>
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
			const usersQ = getCollegeFilteredQuery('users');
			const all = await getDocs(usersQ);
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

/* ================= EDIT USER FROM DETAILS ================= */

window.openUserEditModal = async (uid) => {
	try {
		const docSnap = await getDoc(doc(db, "users", uid));
		if (!docSnap.exists()) return alert("User not found!");
		const data = docSnap.data();

		document.getElementById("editUserId").value = uid;
		document.getElementById("editUserName").value = data.name || "";
		document.getElementById("editUserEmail").value = data.email || "";
		document.getElementById("editUserRole").value = (data.role || "student").toLowerCase();
		document.getElementById("editUserDept").value = data.department || "";
		document.getElementById("editUserPhone").value = data.phone || "";
		document.getElementById("editUserYear").value = data.year || "";
		document.getElementById("editUserStudentId").value = data.studentId || "";
		document.getElementById("editUserStaffId").value = data.staffId || "";

		// Fill college info, explicitly added for super admins looking into specific colleges
		document.getElementById("editUserCollegeName").value = data.collegeName || "";
		document.getElementById("editUserCollegeId").value = data.collegeId || "";

		document.getElementById("userEditModal").classList.remove("hidden");
	} catch (e) {
		console.error("Error opening edit user modal:", e);
		alert("Could not load user data.");
	}
};

window.saveUserEdit = async () => {
	const btn = document.getElementById("saveUserEditBtn");
	const uid = document.getElementById("editUserId").value;
	if (!uid) return;

	try {
		btn.disabled = true;
		btn.innerText = "Saving...";

		const updates = {
			name: document.getElementById("editUserName").value.trim(),
			role: document.getElementById("editUserRole").value,
			department: document.getElementById("editUserDept").value.trim(),
			phone: document.getElementById("editUserPhone").value.trim(),
			year: document.getElementById("editUserYear").value.trim(),
			studentId: document.getElementById("editUserStudentId").value.trim(),
			staffId: document.getElementById("editUserStaffId").value.trim(),
			collegeName: document.getElementById("editUserCollegeName").value.trim(),
			collegeId: document.getElementById("editUserCollegeId").value.trim()
		};

		// Remove entirely empty fields
		Object.keys(updates).forEach(key => {
			if (updates[key] === "") delete updates[key];
		});

		await updateDoc(doc(db, "users", uid), updates);

		document.getElementById("userEditModal").classList.add("hidden");

		// Reload current view
		window.openUserDetails(uid);
	} catch (e) {
		console.error("Error saving user data:", e);
		alert("Failed to update user. Please ensure you have permission.");
	} finally {
		btn.disabled = false;
		btn.innerText = "Save Updates";
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

async function loadAttendance() {

	try {
		console.log('Loading attendance records for college:', currentCollegeId);

		// 1. Fetch all holidays first
		const holidaysSnap = currentCollegeId
			? await getDocs(collection(db, "colleges", currentCollegeId, "holidays"))
			: await getDocs(collection(db, "holidays"));
		window.holidaysMap = {};
		holidaysSnap.forEach(d => {
			window.holidaysMap[d.id] = d.data();
		});
		console.log('Loaded holidays:', Object.keys(window.holidaysMap).length);

		// 2. Fetch all approved students
		const usersQ = getCollegeFilteredQuery('users');
		const usersSnap = await getDocs(usersQ);
		allStudents = [];
		usersSnap.forEach(d => {
			const u = d.data();
			const r = (u.role || "").toLowerCase();
			if (r === "student" && u.approved) {
				allStudents.push({ id: d.id, ...u });
			}
		});
		console.log('Loaded approved students:', allStudents.length);

		// 3. Fetch attendance records
		attendanceRecords = [];
		const attQ = getCollegeFilteredQuery('attendanceRecords');
		const snap = await getDocs(attQ);
		snap.forEach(d => attendanceRecords.push({ id: d.id, ...d.data() }));
		console.log('Loaded attendance records:', attendanceRecords.length);

		renderAttendance();
	} catch (err) {
		console.error('loadAttendance error:', err);
		console.error('Error code:', err.code);
		console.error('Error message:', err.message);

		let errorMsg = 'Failed to load attendance';
		if (err.code === 'permission-denied') {
			errorMsg = 'Permission denied. Please check your access rights.';
		}
		safeSet(attTable, `<tr><td colspan="10" style="text-align:center; color: #dc2626;">${errorMsg}</td></tr>`, 'html');
	}

}


if (yearFilter) yearFilter.onchange = renderAttendance;
if (attendanceSearch) attendanceSearch.onkeyup = renderAttendance;
if (attendanceDateFilter) attendanceDateFilter.onchange = renderAttendance;
if (attendanceStatusFilter) attendanceStatusFilter.onchange = renderAttendance;



function renderAttendance() {
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

		const fnStatus = (fn ? fn.status : "absent").toLowerCase();
		const anStatus = (an ? an.status : "absent").toLowerCase();
		const bothAbsent = fnStatus !== "present" && anStatus !== "present";

		if (bothAbsent) {
			// Single merged row for full-day absent
			rows += `
<tr onclick="openUserDetails('${s.id}')">
  <td>${i++}</td>
  <td class="clickable-name">${escapeHtml(s.name)}</td>
  <td>${escapeHtml(targetDate)}</td>
  <td>${escapeHtml(s.studentId || s.roll || "-")}</td>
  <td>${escapeHtml(s.year || "-")}</td>
  <td colspan="3" style="text-align:center; font-weight:700; color:#dc2626;">FN &amp; AN — ABSENT</td>
  <td style="font-weight:700; color: ${stats.eligible ? '#28a745' : '#dc3545'}">${stats.percent}%<br><small>${stats.eligible ? 'Eligible' : 'Not Eligible'}</small></td>
</tr>`;
		} else {
			rows += `
<tr onclick="openUserDetails('${s.id}')">
  <td rowspan="2">${i++}</td>
  <td rowspan="2" class="clickable-name">${escapeHtml(s.name)}</td>
  <td rowspan="2">${escapeHtml(targetDate)}</td>
  <td rowspan="2">${escapeHtml(s.studentId || s.roll || "-")}</td>
  <td rowspan="2">${escapeHtml(s.year || "-")}</td>
  <td>FN</td>
  <td>${escapeHtml(fn ? (fn.gpsStatus || "-") : "-")}</td>
  <td>${escapeHtml(fn ? (fn.faceStatus || "-") : "-")}</td>
  <td style="font-weight:700; color:${fnStatus === 'present' ? '#16a34a' : '#dc2626'}">${fnStatus === 'present' ? 'PRESENT' : 'ABSENT'}</td>
  <td rowspan="2" style="font-weight:700; color: ${stats.eligible ? '#28a745' : '#dc3545'}">${stats.percent}%<br><small>${stats.eligible ? 'Eligible' : 'Not Eligible'}</small></td>
</tr>
<tr onclick="openUserDetails('${s.id}')">
  <td>AN</td>
  <td>${escapeHtml(an ? (an.gpsStatus || "-") : "-")}</td>
  <td>${escapeHtml(an ? (an.faceStatus || "-") : "-")}</td>
  <td style="font-weight:700; color:${anStatus === 'present' ? '#16a34a' : '#dc2626'}">${anStatus === 'present' ? 'PRESENT' : 'ABSENT'}</td>
</tr>`;
		}
	});

	safeSet(attTable, rows, "html");
}


/* ================= SETTINGS ================= */

if (saveTiming) {
	saveTiming.onclick = async () => {
		try {
			const settingsData = {
				fnStart: (fnStart && fnStart.value) || "",
				fnEnd: (fnEnd && fnEnd.value) || "",
				anStart: (anStart && anStart.value) || "",
				anEnd: (anEnd && anEnd.value) || ""
			};

			if (!currentCollegeId) {
				alert("College information is missing. Please sign in again.");
				return;
			}

			await setDoc(doc(db, "colleges", currentCollegeId, "settings", "attendance"), settingsData, { merge: true });

			updateSessionInfo();
			updateSettingsStatus();

			if (fnEnd && anEnd) {
				updateEmailReminderTiming(fnEnd.value, anEnd.value);
			}

			alert("Timing Saved");
		} catch (err) {
			console.error('saveTiming error', err);
			alert('Failed to save timing: ' + err.message);
		}
	};
}



if (saveGPS) {
	saveGPS.onclick = async () => {
		try {
			const settingsData = {
				lat: (lat && lat.value) || "",
				lng: (lng && lng.value) || "",
				radius: (radius && radius.value) || ""
			};

			if (!currentCollegeId) {
				alert("College information is missing. Please sign in again.");
				return;
			}

			await setDoc(doc(db, "colleges", currentCollegeId, "settings", "attendance"), settingsData, { merge: true });

			updateSettingsStatus();
			alert("GPS Saved");
		} catch (err) {
			console.error('saveGPS error', err);
			alert('Failed to save GPS settings: ' + err.message);
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
					if (!currentCollegeId) { alert('College not found'); return; }
					await setDoc(doc(db, "colleges", currentCollegeId, "holidays", holidayDate.value), { date: holidayDate.value, reason, collegeId: currentCollegeId });
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
					ops.push(setDoc(doc(db, "colleges", currentCollegeId, "holidays", id), { date: id, reason, collegeId: currentCollegeId }));
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
		const targetDate = attendanceDateFilter ? attendanceDateFilter.value : "";
		if (!targetDate) {
			alert("Please select a date first");
			return;
		}

		const exportData = [];
		const studentAttendanceMap = {};

		allStudents.forEach(s => {
			studentAttendanceMap[s.id] = { student: s, FN: null, AN: null };
		});

		attendanceRecords.forEach(r => {
			if (r.date === targetDate && studentAttendanceMap[r.studentUid]) {
				studentAttendanceMap[r.studentUid][r.session] = r;
			}
		});

		Object.values(studentAttendanceMap).forEach(entry => {
			const s = entry.student;
			// registration check
			if (s.createdAt) {
				let regDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
				const regStr = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}-${String(regDate.getDate()).padStart(2, '0')}`;
				if (regStr > targetDate) return;
			}

			["FN", "AN"].forEach(sess => {
				const rec = entry[sess];
				exportData.push({
					"Name": s.name,
					"Roll No": s.studentId || s.roll || "-",
					"Year": s.year || "-",
					"Date": targetDate,
					"Session": sess,
					"Status": rec ? "PRESENT" : "ABSENT",
					"GPS": rec?.gpsStatus || "-",
					"Face": rec?.faceStatus || "-"
				});
			});
		});

		if (exportData.length === 0) {
			alert("No data found for export");
			return;
		}

		const ws = XLSX.utils.json_to_sheet(exportData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Attendance");
		XLSX.writeFile(wb, `Admin_Attendance_${targetDate}.xlsx`);
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
		const q = getCollegeFilteredQuery('profileUpdateRequests', [where("status", "in", ["pending", "hod_verified"])]);
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
		const q = getCollegeFilteredQuery('manualRequests', [where("status", "==", "pending")]);
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
		const q = getCollegeFilteredQuery('permissionRequests', [where("status", "==", "pending")]);
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
						currentUserData?.name || currentUserData?.role || 'College Administrator',
						`${req.type} profile update request`,
						{ collegeName: currentCollegeName || '' }
					);
				} else {
					await window.emailApprovalService.sendRejectionNotification(
						req.email,
						req.name || req.email,
						currentUserData?.name || currentUserData?.role || 'College Administrator',
						`${req.type} profile update request`,
						'Your profile update request was rejected.',
						{ collegeName: currentCollegeName || '' }
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
	const snap = await getDoc(doc(db, "settings", "security"));
	if (snap.exists()) {
		const data = snap.data();
		if (hodProfileApprovalToggle) hodProfileApprovalToggle.checked = !!data.hodProfileApprovalEnabled;
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
		const resolvedCollegeId = currentAdminData.collegeId || currentCollegeId || null;
		let collegeData = null;
		if (resolvedCollegeId) {
			try {
				const collegeSnap = await getDoc(doc(db, "colleges", resolvedCollegeId));
				if (collegeSnap.exists()) {
					collegeData = collegeSnap.data();
				}
			} catch (collegeErr) {
				console.warn("Failed to load college details for admin profile", collegeErr);
			}
		}
		const resolvedCollegeName = currentAdminData.collegeName || collegeData?.name || currentCollegeName || "--";
		const resolvedCollegeCode = currentAdminData.collegeCode || collegeData?.code || "--";

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

		// College information elements
		const adminProfileCollegeName = document.getElementById("adminProfileCollegeName");
		const adminProfileCollegeId = document.getElementById("adminProfileCollegeId");
		const adminProfileCollegeCode = document.getElementById("adminProfileCollegeCode");

		if (adminProfileName) adminProfileName.innerText = currentAdminData.name || "Admin";
		if (adminProfileRole) adminProfileRole.innerText = (currentAdminData.role || "admin").toUpperCase();
		if (adminProfileEmail) adminProfileEmail.innerText = currentAdminData.email || "--";
		if (adminProfilePhone) adminProfilePhone.innerText = currentAdminData.phone || "--";
		if (adminProfileDept) adminProfileDept.innerText = currentAdminData.department || "--";
		if (adminProfileRoleText) adminProfileRoleText.innerText = (currentAdminData.role || "admin").toUpperCase();

		// Update college information
		if (adminProfileCollegeName) adminProfileCollegeName.innerText = resolvedCollegeName;
		if (adminProfileCollegeId) adminProfileCollegeId.innerText = resolvedCollegeId || "--";
		if (adminProfileCollegeCode) adminProfileCollegeCode.innerText = resolvedCollegeCode;

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
	const adminCollegeNameInput = document.getElementById("adminCollegeNameInput");
	const adminCollegeIdInput = document.getElementById("adminCollegeIdInput");

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
			if (adminCollegeNameInput) adminCollegeNameInput.value = currentAdminData.collegeName || "";
			if (adminCollegeIdInput) adminCollegeIdInput.value = currentAdminData.collegeId || "";
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
				const adminCollegeNameInput = document.getElementById("adminCollegeNameInput");
				const adminCollegeIdInput = document.getElementById("adminCollegeIdInput");

				const updates = {};
				if (adminPhoneInput && adminPhoneInput.value.trim()) {
					updates.phone = adminPhoneInput.value.trim();
				}
				if (adminDeptInput && adminDeptInput.value.trim()) {
					updates.department = adminDeptInput.value.trim();
				}
				if (adminCollegeNameInput && adminCollegeNameInput.value.trim()) {
					updates.collegeName = adminCollegeNameInput.value.trim();
				}
				if (adminCollegeIdInput && adminCollegeIdInput.value.trim()) {
					updates.collegeId = adminCollegeIdInput.value.trim();
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
			if (!currentCollegeId) {
				alert('No college assigned to this admin');
				return;
			}

			const startDate = academicStartDate?.value;
			const endDate = academicEndDate?.value;

			if (!startDate || !endDate) {
				alert('Please select both start and end dates');
				return;
			}

			if (startDate > endDate) {
				alert('Start date must be before end date');
				return;
			}

			await setDoc(getAcademicYearDocRef(currentCollegeId), {
				collegeId: currentCollegeId,
				startDate: startDate,
				endDate: endDate,
				updatedAt: serverTimestamp()
			});

			alert('Academic year saved successfully!');
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
			if (!currentCollegeId) {
				alert('No college assigned to this admin');
				return;
			}

			let academicYearDoc = await getDoc(getAcademicYearDocRef(currentCollegeId));

			if (!academicYearDoc.exists()) {
				academicYearDoc = await getDoc(doc(db, "settings", "academicYear"));
			}

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
		if (!daysCountTable) {
			console.error('daysCountTable element not found');
			return;
		}

		if (!statsStartDate || !statsEndDate) {
			console.error('Date input elements not found');
			safeSet(daysCountTable, '<tr><td colspan="6" style="text-align:center;">Error: Date inputs not found</td></tr>', 'html');
			return;
		}

		let startDate = statsStartDate.value;
		let endDate = statsEndDate.value;

		// Default to current academic year if not set
		if (!startDate || !endDate) {
			const academicYearDoc = await getDoc(getAcademicYearDocRef(currentCollegeId));
			if (academicYearDoc.exists()) {
				const ayData = academicYearDoc.data();
				startDate = ayData.startDate;
				endDate = new Date().toISOString().split('T')[0]; // Upto today
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
		const usersQ = getCollegeFilteredQuery('users');
		const usersSnap = await getDocs(usersQ);
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
		const attQ = getCollegeFilteredQuery('attendanceRecords');
		const attSnap = await getDocs(attQ);
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

const inviteEmail = document.getElementById("inviteEmail");
const inviteRole = document.getElementById("inviteRole");
const sendInviteBtn = document.getElementById("sendInviteBtn");
const inviteStatusMessage = document.getElementById("inviteMessage");
const invitesTableBody = document.getElementById("invitesTableBody");
const refreshInvitesBtn = document.getElementById("refreshInvitesBtn");
const clearAllInvitesBtn = document.getElementById("clearAllInvitesBtn");

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

		if (!email || !role) {
			showInviteMessage("Please fill in all fields", "error");
			return;
		}

		// Prevent college admin from inviting super admin
		if (role === "superadmin") {
			showInviteMessage("College admins cannot invite super admins. Please contact system administrator.", "error");
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
				inviteData.collegeId = currentCollegeId;
				inviteData.collegeName = currentCollegeName || "Your College";
			}

			await setDoc(doc(db, "adminInvites", token), inviteData);

			// Send email via EmailJS
			const registrationLink = `${window.location.origin}/register.html?token=${token}`;

			const emailParams = {
				to_email: email,
				to_name: email.split('@')[0],
				role: role.toUpperCase(),
				registration_link: registrationLink,
				expires_in: "2 hours",
				college_name: role === "superadmin" ? "Multi-College System" : (currentCollegeName || "Your College")
			};

			await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, emailParams);

			let successMessage = `✓ Invitation sent successfully to ${email}`;
			if (role === "superadmin") {
				successMessage += `\n🔑 Super Admin invite created - This user will have system-wide access to manage multiple colleges.`;
			}

			showInviteMessage(successMessage, "success");
			inviteEmail.value = "";
			inviteRole.value = "";
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

/* ================= COLLEGE BACKGROUND IMAGE ================= */

(function initBgUI() {
	const bgTabUrl    = document.getElementById('bgTabUrl');
	const bgTabFile   = document.getElementById('bgTabFile');
	const bgPanelUrl  = document.getElementById('bgPanelUrl');
	const bgPanelFile = document.getElementById('bgPanelFile');
	const bgPreviewBtn = document.getElementById('bgPreviewBtn');
	const bgSaveBtn    = document.getElementById('bgSaveBtn');
	const bgRemoveBtn  = document.getElementById('bgRemoveBtn');
	const bgUrlInput   = document.getElementById('bgUrlInput');
	const bgFileInput  = document.getElementById('bgFileInput');
	const bgFileName   = document.getElementById('bgFileName');
	const bgPreviewImg = document.getElementById('bgPreviewImg');
	const bgEmpty      = document.getElementById('bgPreviewEmpty');

	let activeTab = 'url'; // 'url' | 'file'
	let pendingBase64 = null; // holds base64 from file upload

	// --- Tab switching ---
	function setTab(tab) {
		activeTab = tab;
		if (tab === 'url') {
			bgPanelUrl.style.display = '';
			bgPanelFile.style.display = 'none';
			bgTabUrl.style.background = '#fff';
			bgTabUrl.style.color = '#0284c7';
			bgTabUrl.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
			bgTabFile.style.background = 'transparent';
			bgTabFile.style.color = '#64748b';
			bgTabFile.style.boxShadow = 'none';
		} else {
			bgPanelUrl.style.display = 'none';
			bgPanelFile.style.display = '';
			bgTabFile.style.background = '#fff';
			bgTabFile.style.color = '#0284c7';
			bgTabFile.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
			bgTabUrl.style.background = 'transparent';
			bgTabUrl.style.color = '#64748b';
			bgTabUrl.style.boxShadow = 'none';
		}
	}

	if (bgTabUrl) bgTabUrl.onclick = () => setTab('url');
	if (bgTabFile) bgTabFile.onclick = () => setTab('file');

	// --- Preview helper ---
	function showPreview(url) {
		if (!url || !bgPreviewImg) return;
		bgPreviewImg.src = url;
		bgPreviewImg.style.display = 'block';
		bgPreviewImg.onerror = () => {
			bgPreviewImg.style.display = 'none';
			if (bgEmpty) { bgEmpty.style.display = ''; bgEmpty.textContent = '⚠ Could not load image'; }
		};
		if (bgEmpty) bgEmpty.style.display = 'none';
	}

	// --- URL preview button ---
	if (bgPreviewBtn) {
		bgPreviewBtn.onclick = () => {
			const url = bgUrlInput && bgUrlInput.value.trim();
			if (!url) { alert('Enter an image URL first'); return; }
			showPreview(url);
		};
	}

	// --- File input: read as base64 and preview instantly ---
	if (bgFileInput) {
		bgFileInput.onchange = () => {
			const file = bgFileInput.files[0];
			if (!file) return;

			// Warn if too large (>2MB)
			if (file.size > 2 * 1024 * 1024) {
				if (!confirm(`This image is ${(file.size/1024/1024).toFixed(1)} MB. Large images may be slow to load. Continue?`)) {
					bgFileInput.value = '';
					return;
				}
			}

			if (bgFileName) bgFileName.textContent = `📎 ${file.name} (${(file.size/1024).toFixed(0)} KB)`;

			const reader = new FileReader();
			reader.onload = (e) => {
				pendingBase64 = e.target.result; // data:image/...;base64,...
				showPreview(pendingBase64);
			};
			reader.readAsDataURL(file);
		};
	}

	// --- Save ---
	if (bgSaveBtn) {
		bgSaveBtn.onclick = async () => {
			if (!currentCollegeId) { alert('College not found'); return; }

			let imageData = null;
			if (activeTab === 'url') {
				imageData = bgUrlInput && bgUrlInput.value.trim();
				if (!imageData) { alert('Enter an image URL first'); return; }
			} else {
				imageData = pendingBase64;
				if (!imageData) { alert('Select an image file first'); return; }
			}

			try {
				bgSaveBtn.disabled = true;
				bgSaveBtn.textContent = 'Saving...';
				await saveCollegeBackground(currentCollegeId, imageData);
				showPreview(imageData);
				alert('Background saved! All users will see it on next load.');
			} catch (err) {
				console.error('bgSave error', err);
				alert('Failed to save: ' + err.message);
			} finally {
				bgSaveBtn.disabled = false;
				bgSaveBtn.textContent = 'Save Background';
			}
		};
	}

	// --- Remove ---
	if (bgRemoveBtn) {
		bgRemoveBtn.onclick = async () => {
			if (!currentCollegeId) { alert('College not found'); return; }
			if (!confirm('Remove the college background image?')) return;
			try {
				bgRemoveBtn.disabled = true;
				await deleteCollegeBackground(currentCollegeId);
				if (bgPreviewImg) { bgPreviewImg.src = ''; bgPreviewImg.style.display = 'none'; }
				if (bgEmpty) { bgEmpty.style.display = ''; bgEmpty.textContent = 'No background set'; }
				if (bgUrlInput) bgUrlInput.value = '';
				if (bgFileName) bgFileName.textContent = '';
				pendingBase64 = null;
			} catch (err) {
				console.error('bgRemove error', err);
				alert('Failed to remove: ' + err.message);
			} finally {
				bgRemoveBtn.disabled = false;
			}
		};
	}
})();

/* ================= CUSTOM SELECT DROPDOWNS ================= */
function initCustomSelect(selectEl) {
    if (!selectEl || selectEl.dataset.customized) return;
    selectEl.dataset.customized = '1';

    const wrap = document.createElement('div');
    wrap.className = 'custom-select-wrap';
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `<span class="custom-select-label"></span><span class="custom-select-arrow">▼</span>`;
    wrap.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'custom-select-panel';
    wrap.appendChild(panel);

    function buildOptions() {
        panel.innerHTML = '';
        Array.from(selectEl.options).forEach(opt => {
            const div = document.createElement('div');
            const isSel = opt.value === selectEl.value;
            div.className = 'custom-select-option' + (isSel ? ' selected' : '');
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
        document.querySelectorAll('.custom-select-panel.open').forEach(p => {
            p.classList.remove('open');
            p.previousElementSibling?.classList.remove('open');
        });
        buildOptions();
        panel.classList.add('open');
        trigger.classList.add('open');
    }

    function closePanel() {
        panel.classList.remove('open');
        trigger.classList.remove('open');
    }

    trigger.onclick = (e) => { e.stopPropagation(); panel.classList.contains('open') ? closePanel() : openPanel(); };
    document.addEventListener('click', () => closePanel());

    const mo = new MutationObserver(() => { buildOptions(); updateLabel(); });
    mo.observe(selectEl, { childList: true });

    buildOptions();
    updateLabel();
}

function initAllCustomSelects() {
    document.querySelectorAll('.controls-bar select').forEach(initCustomSelect);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAllCustomSelects, 800);
});
window.initAllCustomSelects = initAllCustomSelects;
