// ================= FIREBASE IMPORT =================
import { auth, db } from "./firebase.js";
import { loadAndApplyBackground } from "./college-background.js";
import { initAutoLogout } from "./auto-logout.js";
import { loadAdSlot } from "./ad-slot.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, collection, serverTimestamp, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// Export to window for non-module scripts (e.g. email-reminder-service.js)
window.db = db;
window.collection = collection;
window.addDoc = addDoc;
window.serverTimestamp = serverTimestamp;
window.getDoc = getDoc;
window.doc = doc;
window.getDocs = getDocs;
window.query = query;
window.where = where;

// ================= GLOBAL VARIABLES =================
let currentUser = null;
let me = null;
let settings = null;
let registeredMesh = null;      // stored face descriptor (Float32Array)
let faceApiReady = false;       // face-api.js models loaded
let otherStudentMeshes = [];    // [{uid, name, descriptor}]
let activeRequestLabel = null;
let currentProfilePhotoBase64 = null;
let userProfileUnsubscribe = null;
let notificationsUnsubscribe = null;
let profileRequestState = { photoPending: false, detailsPending: false };

// ================= ELEMENT REFERENCES =================
const els = {
    // Header
    menuBtn: document.getElementById("menuBtn"),
    sidebar: document.getElementById("sidebar"),
    studentName: document.getElementById("studentName"),
    studentRole: document.getElementById("studentRole"),
    logoutBtn: document.getElementById("logoutBtn"),
    sidebarLogoutBtn: document.getElementById("sidebarLogoutBtn"),

    // Greeting & Status
    greetingText: document.getElementById("greetingText"),
    holidayBadge: document.getElementById("holidayBadge"),
    sessionRange: document.getElementById("sessionRange"),
    attendanceMessage: document.getElementById("attendanceMessage"),
    homeSessionName: document.getElementById("homeSessionName"),
    homeTimeLeft: document.getElementById("homeTimeLeft"),
    fnStatus: document.getElementById("fnStatus"),
    anStatus: document.getElementById("anStatus"),
    homeMarkBtn: document.getElementById("homeMarkBtn"),

    // Profile Page
    profileName: document.getElementById("profileName"),
    profileStudentId: document.getElementById("profileStudentId"),
    profileEmail: document.getElementById("profileEmail"),
    profilePhone: document.getElementById("profilePhone"),
    profileDepartment: document.getElementById("profileDepartment"),
    profileYear: document.getElementById("profileYear"),
    profileIncharge: document.getElementById("profileIncharge"),
    profileHod: document.getElementById("profileHod"),
    profileCollegeName: document.getElementById("profileCollegeName"),
    profileCollegeId: document.getElementById("profileCollegeId"),
    profileCollegeCode: document.getElementById("profileCollegeCode"),
    profileRole: document.getElementById("profileRole"),
    profileRegisteredOn: document.getElementById("profileRegisteredOn"),
    profilePagePhoto: document.getElementById("profilePagePhoto"),
    sidebarStudentName: document.getElementById("sidebarStudentName"),
    sidebarStudentId: document.getElementById("sidebarStudentId"),

    // Statistics
    totalDays: document.getElementById("totalDays"),
    presentDays: document.getElementById("presentDays"),
    absentDays: document.getElementById("absentDays"),
    percentage: document.getElementById("percentage"),

    // Mark Page Elements (Generic/Static)
    markSessionName: document.getElementById("markSessionName"),
    markTimeLeft: document.getElementById("markTimeLeft"),
    recordsTable: document.getElementById("recordsTable"),
    currentTime: document.getElementById("currentTime"),
    currentDate: document.getElementById("currentDate"),
    currentDay: document.getElementById("currentDay"),
    notificationBtn: document.getElementById("notificationBtn"),
    notificationList: document.getElementById("notificationList"),
    notificationCount: document.getElementById("notificationCount"),

    // Profile Update Elements
    requestModal: document.getElementById("requestModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalDesc: document.getElementById("modalDesc"),
    newFieldValue: document.getElementById("newFieldValue"),
    photoRequestArea: document.getElementById("photoRequestArea"),
    textRequestArea: document.getElementById("textRequestArea"),
    profilePhotoInput: document.getElementById("profilePhotoInput"),
    photoPreview: document.getElementById("photoPreview"),
    submitRequestBtn: document.getElementById("submitRequestBtn"),
    cancelModal: document.getElementById("cancelModal"),
    reqPhotoBtn: document.getElementById("reqPhotoBtn"),
    photoUnlockedArea: document.getElementById("photoUnlockedArea"),
    phoneUnlockedArea: document.getElementById("phoneUnlockedArea"),
    photoChangeInput: document.getElementById("photoChangeInput"),
    phoneEditInput: document.getElementById("phoneEditInput"),
    savePhoneBtn: document.getElementById("savePhoneBtn"),
    addRequestBtn: document.getElementById("addRequestBtn"),
    detailsUnlockedArea: document.getElementById("detailsUnlockedArea"),
    detailsTimer: document.getElementById("detailsTimer"),
    yearEditInput: document.getElementById("yearEditInput"),
    inchargeEditInput: document.getElementById("inchargeEditInput"),
    hodEditInput: document.getElementById("hodEditInput"),
    phoneDetailEditInput: document.getElementById("phoneDetailEditInput"),
    saveDetailsBtn: document.getElementById("saveDetailsBtn"),
    reqPhoneInput: document.getElementById("reqPhoneInput"),
    reqYearInput: document.getElementById("reqYearInput"),
    reqInchargeInput: document.getElementById("reqInchargeInput"),
    reqHodInput: document.getElementById("reqHodInput"),
    multiFieldForm: document.getElementById("multiFieldForm"),
    photoTimer: document.getElementById("photoTimer"),
    phoneTimer: document.getElementById("phoneTimer"),

    // Direct edit buttons for approved users
    directPhotoBtn: document.getElementById("directPhotoBtn"),
    directEditBtn: document.getElementById("directEditBtn")
};

// ================= HELPERS =================

function getTodayDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function setSafeText(el, text) {
    if (el) el.innerText = text;
}

function setSafeHTML(el, html) {
    if (el) el.innerHTML = html;
}

function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function addDoc(collectionRef, data) {
    const newDocRef = doc(collectionRef);
    await setDoc(newDocRef, data);
    return newDocRef;
}

function isUnlockActive(unlockFlag, unlockAt) {
    if (!unlockFlag) return false;
    const approvedAt = unlockAt?.toDate?.()?.getTime?.() || 0;
    return approvedAt > 0 && (Date.now() - approvedAt) < (10 * 60 * 1000);
}

async function hasPendingProfileRequest(type) {
    if (!me?.uid || !type) return false;
    const pendingQuery = query(
        collection(db, "profileUpdateRequests"),
        where("uid", "==", me.uid),
        where("type", "==", type),
        where("status", "in", ["pending", "hod_verified"])
    );
    const snap = await getDocs(pendingQuery);
    return !snap.empty;
}

function applyProfileRequestVisuals() {
    if (!me?.uid) return;

    const photoApproved = isUnlockActive(me.pendingUnlock_photo, me.pendingUnlock_photo_at);
    const detailsApproved = isUnlockActive(me.pendingUnlock_details, me.pendingUnlock_details_at);

    if (els.reqPhotoBtn) {
        els.reqPhotoBtn.classList.remove("waiting", "approved");
        if (photoApproved) {
            els.reqPhotoBtn.classList.add("approved");
            els.reqPhotoBtn.innerText = "✓";
            els.reqPhotoBtn.title = "Photo update approved. Use the unlocked upload area below now.";
        } else if (profileRequestState.photoPending) {
            els.reqPhotoBtn.classList.add("waiting");
            els.reqPhotoBtn.innerText = "…";
            els.reqPhotoBtn.title = "Photo update approval is pending.";
        } else {
            els.reqPhotoBtn.innerText = "📷";
            els.reqPhotoBtn.title = "Request profile photo change";
        }
    }

    if (els.addRequestBtn) {
        els.addRequestBtn.classList.remove("waiting", "approved", "cooldown");
        if (detailsApproved) {
            els.addRequestBtn.classList.add("approved");
            els.addRequestBtn.innerText = "+";
            els.addRequestBtn.title = "Details update approved. Use the unlocked form below now.";
        } else if (profileRequestState.detailsPending) {
            els.addRequestBtn.classList.add("waiting");
            els.addRequestBtn.innerText = "+";
            els.addRequestBtn.title = "Details update approval is pending.";
        } else {
            els.addRequestBtn.innerText = "+";
            els.addRequestBtn.title = "Request personal details modification";
        }
    }
}

async function refreshProfileRequestVisuals() {
    if (!me?.uid) return;

    const pendingQuery = query(
        collection(db, "profileUpdateRequests"),
        where("uid", "==", me.uid),
        where("status", "in", ["pending", "hod_verified"])
    );
    const pendingSnap = await getDocs(pendingQuery);

    profileRequestState = { photoPending: false, detailsPending: false };
    pendingSnap.forEach((docSnap) => {
        const req = docSnap.data();
        if (req.type === "photo") profileRequestState.photoPending = true;
        if (req.type === "details") profileRequestState.detailsPending = true;
    });

    applyProfileRequestVisuals();
}

function getNotificationTimestamp(notification) {
    const createdAt = notification.createdAt;
    if (!createdAt) return 0;
    if (typeof createdAt.toDate === "function") return createdAt.toDate().getTime();
    if (createdAt.seconds) return createdAt.seconds * 1000;
    return 0;
}

function getNotificationTarget(notification) {
    if (notification.targetPage) return notification.targetPage;
    if (notification.redirectTo) return notification.redirectTo;
    if (notification.dashboard_link && notification.dashboard_link.includes("#")) {
        return notification.dashboard_link.split("#")[1];
    }

    const title = (notification.title || "").toLowerCase();
    const message = (notification.message || "").toLowerCase();
    const type = (notification.type || "").toLowerCase();
    const combined = `${title} ${message} ${type}`;

    if (combined.includes("profile") || combined.includes("photo") || combined.includes("details")) return "profilePage";
    if (combined.includes("attendance") || combined.includes("mark")) return "markPage";
    return "homePage";
}

function renderNotifications(notificationDocs) {
    if (!els.notificationList || !els.notificationCount) return;

    const unreadNotifications = notificationDocs.filter(item => !item.data.read);
    const unreadCount = unreadNotifications.length;
    if (unreadCount > 0) {
        els.notificationCount.style.display = "inline-flex";
        els.notificationCount.innerText = unreadCount > 99 ? "99+" : String(unreadCount);
    } else {
        els.notificationCount.style.display = "none";
        els.notificationCount.innerText = "0";
    }

    if (unreadNotifications.length === 0) {
        els.notificationList.innerHTML = `<div class="notify-empty">No notifications yet.</div>`;
        return;
    }

    els.notificationList.innerHTML = `
        <div class="notify-header">
            <div class="notify-header-title">Notifications</div>
            <button type="button" id="clearNotificationsBtn" class="notify-clear-btn">Clear All</button>
        </div>
        ${unreadNotifications.map(({ id, data }) => {
        const title = escapeHtml(data.title || "Notification");
        const message = escapeHtml(data.message || "");
        const targetPage = escapeHtml(getNotificationTarget(data));
        const createdTime = getNotificationTimestamp(data);
        const timeLabel = createdTime ? new Date(createdTime).toLocaleString() : "";
        return `
            <div class="notify-item unread" data-id="${id}" data-target-page="${targetPage}">
                <div class="notify-item-title">${title}</div>
                <div class="notify-item-message">${message}</div>
                ${timeLabel ? `<div class="notify-item-time">${escapeHtml(timeLabel)}</div>` : ""}
            </div>
        `;
    }).join("")}
    `;

    document.querySelectorAll(".notify-item").forEach(item => {
        item.onclick = async () => {
            const notificationId = item.dataset.id;
            const targetPage = item.dataset.targetPage || "homePage";
            try {
                await updateDoc(doc(db, "notifications", notificationId), { read: true });
            } catch (err) {
                console.warn("Failed to mark notification as read", err);
            }
            if (els.notificationList) els.notificationList.classList.add("hidden");
            showPage(targetPage);
        };
    });

    const clearBtn = document.getElementById("clearNotificationsBtn");
    if (clearBtn) {
        clearBtn.onclick = async (e) => {
            e.stopPropagation();
            try {
                await Promise.all(unreadNotifications.map(({ id }) => updateDoc(doc(db, "notifications", id), { read: true })));
            } catch (err) {
                console.warn("Failed to clear notifications", err);
            }
        };
    }
}

function subscribeToNotifications(uid) {
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null;
    }
    const notificationsQuery = query(collection(db, "notifications"), where("userId", "==", uid));
    notificationsUnsubscribe = onSnapshot(notificationsQuery, (snap) => {
        const items = [];
        snap.forEach(docSnap => items.push({ id: docSnap.id, data: docSnap.data() }));
        items.sort((a, b) => getNotificationTimestamp(b.data) - getNotificationTimestamp(a.data));
        renderNotifications(items);
    }, (err) => {
        console.error("Notifications load failed:", err);
        if (els.notificationList) {
            els.notificationList.innerHTML = `<div class="notify-empty">Unable to load notifications.</div>`;
        }
    });
}

function getMarkingBlockedMessage(sessionState) {
    if (sessionState === "Holiday") {
        return settings?.holidayReason
            ? `Attendance marking is closed today due to holiday: ${settings.holidayReason}`
            : "Attendance marking is closed today because it is a holiday.";
    }
    if (sessionState === "Waiting") {
        return "Marking section is not open yet. Please wait for the active session timing.";
    }
    return "Marking section is closed for today.";
}

// ================= MENU & NAVIGATION =================

if (els.menuBtn) {
    els.menuBtn.onclick = () => {
        if (els.sidebar) els.sidebar.classList.toggle("show");
    };
}

if (els.sidebar) {
    els.sidebar.onmouseenter = () => {
        els.sidebar.classList.add("show");
    };
    els.sidebar.onmouseleave = () => {
        els.sidebar.classList.remove("show");
    };
}

// Open sidebar when hovering near left edge
document.addEventListener('mousemove', (e) => {
    if (e.clientX <= 10 && els.sidebar && !els.sidebar.classList.contains('show')) {
        els.sidebar.classList.add("show");
    }
});

document.addEventListener('click', (e) => {
    if (!els.sidebar || !els.menuBtn || !els.sidebar.classList.contains('show')) return;
    if (!els.sidebar.contains(e.target) && !els.menuBtn.contains(e.target)) {
        els.sidebar.classList.remove('show');
    }
});

if (els.notificationBtn) {
    els.notificationBtn.onclick = (e) => {
        e.stopPropagation();
        if (els.notificationList) els.notificationList.classList.toggle("hidden");
    };
}

document.addEventListener('click', (e) => {
    if (!els.notificationBtn || !els.notificationList) return;
    if (!els.notificationBtn.contains(e.target)) {
        els.notificationList.classList.add("hidden");
    }
});

window.showPage = function (pageId, isBack = false) {
    if (pageId === "markPage") {
        const currentSession = getCurrentSession();
        if (currentSession !== "FN" && currentSession !== "AN") {
            alert(getMarkingBlockedMessage(currentSession));
            return;
        }
        // Block AN if FN was not marked present (auto-absent)
        if (currentSession === "AN") {
            const fnStatus = window.todayAttendanceStatuses && window.todayAttendanceStatuses["FN"];
            if (!fnStatus || fnStatus !== "Present") {
                alert("⚠️ AN session is locked.\n\nYou did not mark your FN attendance, so it was automatically marked Absent.\nYou cannot mark AN attendance independently.");
                return;
            }
        }
        if (window.todayAttendanceStatuses && window.todayAttendanceStatuses[currentSession] === "Present") {
            alert(`You have already marked your attendance for the ${currentSession} session.`);
            return;
        }
    }

    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add("active");

    if (els.sidebar) els.sidebar.classList.remove("show");

    if (pageId === "markPage" && typeof resetVerification === 'function') {
        resetVerification();
    }

    // History Management
    if (!isBack) {
        if (window.history.state && window.history.state.page === pageId) return;
        history.pushState({ page: pageId }, "", `#${pageId}`);
    }
};

// Initialize history on load with a trap
const initialPage = (location.hash && location.hash !== "#homePage") ? location.hash.substring(1) : "homePage";

// 1. Create the trap entry (no state)
history.replaceState(null, "", window.location.pathname + window.location.search);

// 2. Push home state if we are going to a sub-page
if (initialPage !== "homePage") {
    history.pushState({ page: "homePage" }, "", "#homePage");
}

// 3. Push the current page
history.pushState({ page: initialPage }, "", "#" + initialPage);

// Force initial page render
showPage(initialPage, true);

window.onpopstate = (event) => {
    if (event.state && event.state.page) {
        showPage(event.state.page, true);
    } else {
        // We are at the start of history (leaving the app)
        if (confirm("Are you sure you want to logout?")) {
            signOut(auth).then(() => {
                location.replace("login.html");
            });
        } else {
            // Stay on home
            history.pushState({ page: "homePage" }, "", "#homePage");
        }
    }
};

if (els.homeMarkBtn) {
    els.homeMarkBtn.onclick = () => {
        const currentSession = getCurrentSession();
        if (currentSession !== "FN" && currentSession !== "AN") {
            alert(getMarkingBlockedMessage(currentSession));
            return;
        }
        // Block AN if FN was not marked present (auto-absent)
        if (currentSession === "AN") {
            const fnStatus = window.todayAttendanceStatuses && window.todayAttendanceStatuses["FN"];
            if (!fnStatus || fnStatus !== "Present") {
                alert("⚠️ AN session is locked.\n\nYou did not mark your FN attendance, so it was automatically marked Absent.\nYou cannot mark AN attendance independently.");
                return;
            }
        }
        if (window.todayAttendanceStatuses && window.todayAttendanceStatuses[currentSession] === "Present") {
            alert(`You have already marked your attendance for the ${currentSession} session.`);
            return;
        }
        showPage("markPage");
    };
}

let isLoggingOut = false;
const logoutOverlay = document.getElementById("logoutOverlay");
const confirmLogoutBtn = document.getElementById("confirmLogout");
const cancelLogoutBtn = document.getElementById("cancelLogout");

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

if (els.logoutBtn) {
    els.logoutBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoutOverlay.classList.remove("hidden");
    };
}

if (els.sidebarLogoutBtn) {
    els.sidebarLogoutBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoutOverlay.classList.remove("hidden");
    };
}

// ================= AUTH STATE =================

onAuthStateChanged(auth, async (user) => {
    try {
        if (!user) {
            location = "login.html";
            return;
        }
        if (userProfileUnsubscribe) {
            userProfileUnsubscribe();
            userProfileUnsubscribe = null;
        }
        if (notificationsUnsubscribe) {
            notificationsUnsubscribe();
            notificationsUnsubscribe = null;
        }
        currentUser = user;
        console.log("Logged in:", user.uid);

        // 1. Profile (Critical)
        try {
            await loadProfile();
            // Apply college background after profile loaded
            if (me && me.collegeId) loadAndApplyBackground(me.collegeId);
        } catch (err) {
            console.error("Profile load failed:", err);
        }

        userProfileUnsubscribe = onSnapshot(doc(db, "users", user.uid), async (snap) => {
            if (!snap.exists()) return;
            const latest = snap.data();
            const prevSignature = JSON.stringify({
                pendingUnlock_photo: me?.pendingUnlock_photo || false,
                pendingUnlock_photo_at: me?.pendingUnlock_photo_at?.seconds || 0,
                pendingUnlock_details: me?.pendingUnlock_details || false,
                pendingUnlock_details_at: me?.pendingUnlock_details_at?.seconds || 0,
                phone: me?.phone || "",
                year: me?.year || "",
                photoURL: me?.photoURL || ""
            });
            const nextSignature = JSON.stringify({
                pendingUnlock_photo: latest.pendingUnlock_photo || false,
                pendingUnlock_photo_at: latest.pendingUnlock_photo_at?.seconds || 0,
                pendingUnlock_details: latest.pendingUnlock_details || false,
                pendingUnlock_details_at: latest.pendingUnlock_details_at?.seconds || 0,
                phone: latest.phone || "",
                year: latest.year || "",
                photoURL: latest.photoURL || ""
            });
            if (prevSignature !== nextSignature) {
                await loadProfile();
            } else {
                me = { ...latest, uid: user.uid };
                await refreshProfileRequestVisuals();
            }
        });

        subscribeToNotifications(user.uid);

        // 2. Settings (Critical for Session info)
        try {
            await loadAttendanceSettings();
        } catch (err) {
            console.error("Settings load failed:", err);
            setSafeHTML(els.attendanceMessage, `<span style="color:#ef4444">Permission Error: Settings Unavailable</span>`);
        }

        // 3. Records (Can be slow or permission-restricted)
        try {
            await loadRecords();
        } catch (err) {
            console.error("Records load failed:", err);
        }

        // Hide loading screen — critical data is ready
        if (window.hideLoading) window.hideLoading();
        initAutoLogout(() => signOut(auth), 'login.html', 60);
        loadAdSlot();

        // 4. Background markers
        autoMarkAbsent().catch(err => console.warn("Auto-absent permission error:", err));

        // Background loading — don't await, non-blocking
        loadFaceModels();
        loadFaceDescriptor();

        // Verification UI Init
        setTimeout(() => {
            if (document.getElementById("gpsStep")) {
                resetVerification();
            }
            setupNavigationGuard();
        }, 500);
    } catch (err) {
        console.error("CRITICAL: Dashboard Init Failed", err);
        setSafeHTML(els.attendanceMessage, `<span style="color:#ef4444">Load Error: ${err.message}</span>`);
        if (window.hideLoading) window.hideLoading();
    }
});

// ================= SESSION LOGIC =================

function getCurrentSession() {
    if (!settings) return "No Session";
    if (settings.holiday) return "Holiday";
    const now = new Date();
    function toD(timeStr, addDay = false) {
        const [h, m, s] = (timeStr || "00:00").split(":").map(Number);
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, s || 0);
        if (addDay && d <= now) d.setDate(d.getDate() + 1);
        return d;
    }
    let fnStart = toD(settings.fnStart);
    let fnEnd = toD(settings.fnEnd);
    if (fnEnd <= fnStart) fnEnd.setDate(fnEnd.getDate() + 1);
    let anStart = toD(settings.anStart);
    let anEnd = toD(settings.anEnd);
    if (anStart <= fnStart) anStart.setDate(anStart.getDate() + 1);
    if (anEnd <= anStart) anEnd.setDate(anEnd.getDate() + 1);

    if (now >= fnStart && now <= fnEnd) return "FN";
    if (now >= anStart && now <= anEnd) return "AN";
    return (now < fnStart || (now > fnEnd && now < anStart)) ? "Waiting" : "No Session";
}

function updateHomeSessionDisplay() {
    if (!settings || !els.homeSessionName || !els.homeTimeLeft) return;
    if (settings.holiday) {
        els.homeSessionName.innerText = "Holiday";
        els.homeTimeLeft.innerText = settings.holidayReason || "Attendance closed for today";
        updateAttendanceStatuses();
        return;
    }
    const now = new Date();
    const nowS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const toS = (t) => { const p = (t || "00:00").split(":").map(Number); return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0); };

    const fnS = toS(settings.fnStart), fnE = toS(settings.fnEnd);
    const anS = toS(settings.anStart), anE = toS(settings.anEnd);

    let label = "No Session", target = null, prefix = "";
    if (nowS < fnS) { label = "Waiting for FN"; target = settings.fnStart; prefix = "Starts in "; }
    else if (nowS <= fnE) { label = "FN (Morning)"; target = settings.fnEnd; prefix = "Ends in "; }
    else if (nowS < anS) { label = "Waiting for AN"; target = settings.anStart; prefix = "Starts in "; }
    else if (nowS <= anE) { label = "AN (Afternoon)"; target = settings.anEnd; prefix = "Ends in "; }

    els.homeSessionName.innerText = label;
    if (target) {
        const [h, m, s] = target.split(":").map(Number);
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, s || 0);
        let rem = d - now; if (rem < 0) rem += 86400000;
        rem = Math.max(0, rem);
        const hh = Math.floor(rem / 3600000), mm = Math.floor((rem % 3600000) / 60000), ss = Math.floor((rem % 60000) / 1000);
        els.homeTimeLeft.innerText = `${prefix}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    } else {
        els.homeTimeLeft.innerText = "All sessions are closed for today";
    }
    updateAttendanceStatuses();
}

function updateMarkSessionDisplay() {
    const msName = document.getElementById("markSessionName");
    const msTime = document.getElementById("markTimeLeft");
    const sessionText = document.getElementById("sessionText");
    if (!settings || !msName || !msTime) return;
    if (settings.holiday) {
        msName.innerText = "Holiday";
        msTime.innerText = settings.holidayReason || "Attendance closed for today";
        if (sessionText) sessionText.innerText = "Holiday";
        return;
    }

    const now = new Date();
    const nowS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const toS = (t) => { const p = (t || "00:00").split(":").map(Number); return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0); };
    const fnS = toS(settings.fnStart), fnE = toS(settings.fnEnd), anS = toS(settings.anStart), anE = toS(settings.anEnd);

    let label = "No Session", target = null, prefix = "";
    if (nowS < fnS) { label = "Waiting for FN"; target = settings.fnStart; prefix = "Starts in "; }
    else if (nowS <= fnE) { label = "FN (Morning)"; target = settings.fnEnd; prefix = "Ends in "; }
    else if (nowS < anS) { label = "Waiting for AN"; target = settings.anStart; prefix = "Starts in "; }
    else if (nowS <= anE) { label = "AN (Afternoon)"; target = settings.anEnd; prefix = "Ends in "; }

    msName.innerText = label;
    if (sessionText) sessionText.innerText = label;
    if (target) {
        const [h, m, s] = target.split(":").map(Number);
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, s || 0);
        let rem = d - now; if (rem < 0) rem += 86400000;
        rem = Math.max(0, rem);
        const hh = Math.floor(rem / 3600000), mm = Math.floor((rem % 3600000) / 60000), ss = Math.floor((rem % 60000) / 1000);
        msTime.innerText = `${prefix}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    } else {
        msTime.innerText = "All sessions are closed for today";
    }
}

function updateDayStatusBadge() {
    if (!els.holidayBadge) return;
    els.holidayBadge.style.display = "inline-flex";
    els.holidayBadge.classList.remove("is-working", "is-holiday");

    if (settings?.holiday) {
        els.holidayBadge.classList.add("is-holiday");
        els.holidayBadge.innerText = `Holiday${settings?.holidayReason ? ` • ${settings.holidayReason}` : ""}`;
        if (els.sessionRange) {
            els.sessionRange.innerText = settings?.holidayReason
                ? `Today is marked as a holiday: ${settings.holidayReason}`
                : "Today is a holiday. Attendance marking is unavailable.";
        }
        return;
    }

    els.holidayBadge.classList.add("is-working");
    els.holidayBadge.innerText = "Working Day";
    if (els.sessionRange) {
        els.sessionRange.innerText = "Attendance marking is available only during the active session shown below.";
    }
}

// ================= SETTINGS & STATUS =================

async function loadAttendanceSettings() {
    const today = getTodayDate();
    const collegeId = me?.collegeId || null;
    const isSunday = new Date(`${today}T00:00:00`).getDay() === 0;
    const collegeSettingsRef = collegeId ? doc(db, "colleges", collegeId, "settings", "attendance") : null;
    const collegeHolidayRef = collegeId ? doc(db, "colleges", collegeId, "holidays", today) : null;
    const [collegeAttSnap, legacyAttSnap, collegeHolidaySnap, legacyHolidaySnap] = await Promise.all([
        collegeSettingsRef ? getDoc(collegeSettingsRef) : Promise.resolve(null),
        getDoc(doc(db, "settings", "attendance")),
        collegeHolidayRef ? getDoc(collegeHolidayRef) : Promise.resolve(null),
        getDoc(doc(db, "holidays", today))
    ]);
    const attSnap = collegeAttSnap?.exists() ? collegeAttSnap : legacyAttSnap;
    const holidaySnap = collegeHolidaySnap?.exists() ? collegeHolidaySnap : legacyHolidaySnap;

    if (!attSnap.exists()) {
        settings = null;
        setSafeText(els.attendanceMessage, "Attendance not started yet");
        return;
    }

    const data = attSnap.data();
    settings = {
        fnStart: data.fnStart || data.FNStart || "00:00",
        fnEnd: data.fnEnd || data.FNEnd || "23:59",
        anStart: data.anStart || data.ANStart || "00:00",
        anEnd: data.anEnd || data.ANEnd || "23:59",
        latitude: data.lat || data.latitude || null,
        longitude: data.lng || data.longitude || null,
        radius: Number(data.radius || data.rad || 0),
        holiday: isSunday || (holidaySnap && holidaySnap.exists()) || !!data.holiday,
        holidayReason: isSunday ? "Sunday - Weekly Holiday" : (holidaySnap.exists() ? holidaySnap.data().reason : (data.holidayReason || "Holiday"))
    };

    updateDayStatusBadge();
    updateAttendanceStatuses();
    updateHomeSessionDisplay();
    updateMarkSessionDisplay();
    updateAdminSettingsDisplay();

    if (!window.sessionIntervalsSet) {
        setInterval(updateHomeSessionDisplay, 1000);
        setInterval(updateMarkSessionDisplay, 1000);
        window.sessionIntervalsSet = true;
    }
}

function updateAttendanceStatuses() {
    if (!settings) return;
    if (settings.holiday) {
        setSafeText(els.attendanceMessage, settings.holidayReason ? `Holiday: ${settings.holidayReason}` : "Today is Holiday");
        setSafeText(els.fnStatus, "Holiday");
        setSafeText(els.anStatus, "Holiday");
        const fnC = els.fnStatus ? els.fnStatus.closest('.session-card') : null;
        const anC = els.anStatus ? els.anStatus.closest('.session-card') : null;
        if (fnC) fnC.classList.remove('active-session');
        if (anC) anC.classList.remove('active-session');
        if (els.homeMarkBtn) {
            els.homeMarkBtn.textContent = "🏖️ Holiday — No Attendance";
            els.homeMarkBtn.disabled = true;
            els.homeMarkBtn.style.opacity = '0.6';
            els.homeMarkBtn.style.cursor = 'not-allowed';
        }
        return;
    }
    if (!settings.latitude || !settings.longitude) {
        setSafeText(els.attendanceMessage, "GPS not set by admin");
        setSafeText(els.fnStatus, "Unavailable");
        setSafeText(els.anStatus, "Unavailable");
        return;
    }

    const now = new Date();
    const minNow = now.getHours() * 60 + now.getMinutes();
    const toM = (t) => { const [h, m] = (t || "00:00").split(":"); return parseInt(h) * 60 + parseInt(m); };
    const fnS = toM(settings.fnStart), fnE = toM(settings.fnEnd), anS = toM(settings.anStart), anE = toM(settings.anEnd);
    const todayS = window.todayAttendanceStatuses || { FN: null, AN: null };

    const getDisp = (s, minStart, minEnd) => {
        if (s === "Present") return '<span class="status-present">Present</span>';
        if (s === "Absent") return '<span class="status-absent">Absent</span>';
        if (minNow < minStart) return "Not Started";
        if (minNow <= minEnd) return "Pending ⌛";
        return '<span class="status-absent">Absent</span>';
    };

    setSafeHTML(els.fnStatus, getDisp(todayS.FN, fnS, fnE));
    setSafeHTML(els.anStatus, getDisp(todayS.AN, anS, anE));

    const fnC = els.fnStatus ? els.fnStatus.closest('.session-card') : null;
    const anC = els.anStatus ? els.anStatus.closest('.session-card') : null;
    if (fnC) fnC.classList.toggle('active-session', minNow >= fnS && minNow <= fnE);
    if (anC) anC.classList.toggle('active-session', minNow >= anS && minNow <= anE);

    if (minNow < fnS) els.attendanceMessage.innerText = `⏳ Waiting for FN starts at ${settings.fnStart}`;
    else if (minNow <= fnE) els.attendanceMessage.innerText = todayS.FN === "Present" ? "✓ FN Marked" : "✓ All set to mark FN";
    else if (minNow < anS) els.attendanceMessage.innerText = `⏸️ FN ended · Please wait for AN session`;
    else if (minNow <= anE) els.attendanceMessage.innerText = todayS.AN === "Present" ? "✓ AN Marked" : "✓ All set to mark AN";
    else els.attendanceMessage.innerText = "🔒 AN ended · Wait for Tomorrow's session";

    // Update Mark Attendance button state
    if (els.homeMarkBtn) {
        const btn = els.homeMarkBtn;
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';

        if (minNow < fnS) {
            btn.textContent = `⏳ Session starts at ${settings.fnStart}`;
        } else if (minNow <= fnE) {
            if (todayS.FN === "Present") {
                btn.textContent = "✓ FN Already Marked";
            } else {
                btn.textContent = "⏰ Mark Your Attendance in Time";
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        } else if (minNow < anS) {
            btn.textContent = `⏳ AN starts at ${settings.anStart}`;
        } else if (minNow <= anE) {
            if (todayS.AN === "Present") {
                btn.textContent = "✓ AN Already Marked";
            } else {
                btn.textContent = "⏰ Mark Your Attendance in Time";
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        } else {
            btn.textContent = "🔒 Session Closed for Today";
        }
    }
}

function updateAdminSettingsDisplay() {
    const fnT = document.getElementById("adminFnTimings"), anT = document.getElementById("adminAnTimings"), gps = document.getElementById("adminGpsStatus");
    if (!fnT || !anT || !gps || !settings) return;

    const fmt = (t) => { if (!t) return "--:--"; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };
    fnT.innerText = `${fmt(settings.fnStart)} to ${fmt(settings.fnEnd)}`;
    anT.innerText = `${fmt(settings.anStart)} to ${fmt(settings.anEnd)}`;
    gps.innerHTML = settings.latitude ? `<span style="color:#10b981;">Enabled</span> (${settings.radius}m)` : `<span style="color:#ef4444;">Disabled</span>`;
}

// ================= DATA LOADING =================

async function loadProfile() {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const data = snap.data(); if (!data) return;

    // Keep a reference for any profile-unlock / request flows
    me = { ...data, uid: currentUser.uid };

    // Profile changes should always go through request/approval flow first.
    document.querySelectorAll('.req-edit-btn').forEach(btn => btn.style.display = 'inline-block');
    document.querySelectorAll('.direct-edit-btn').forEach(btn => btn.style.display = 'none');

    // Sidebar
    setSafeText(els.sidebarStudentName, data.name);
    setSafeText(els.sidebarStudentId, "ID: " + (data.studentId || "--"));
    if (data.photoURL && document.getElementById("sidebarProfilePhoto")) {
        document.getElementById("sidebarProfilePhoto").src = data.photoURL;
    }

    // Resolve assigned incharge name (registration currently stores inchargeId)
    let inchargeName = data.incharge || data.assignedIncharge;
    if (!inchargeName && data.inchargeId) {
        try {
            const inchargeSnap = await getDoc(doc(db, "users", data.inchargeId));
            if (inchargeSnap.exists()) {
                inchargeName = inchargeSnap.data().name;
                // Keep the resolved name on the local `me` object too
                me.assignedIncharge = inchargeName;
            }
        } catch (err) {
            console.warn("Failed to resolve incharge name", err);
        }
    }

    // Resolve assigned HOD name (registration stores hodId)
    let hodName = data.hod || data.assignedHod;
    if (!hodName && data.hodId) {
        try {
            const hodSnap = await getDoc(doc(db, "users", data.hodId));
            if (hodSnap.exists()) {
                hodName = hodSnap.data().name;
                // Keep the resolved name on the local `me` object too
                me.assignedHod = hodName;
            }
        } catch (err) {
            console.warn("Failed to resolve HOD name", err);
        }
    }

    // Header (if any, but student uses studentName in some layouts)
    setSafeText(els.studentName, data.name);
    setSafeText(els.studentRole, (data.role || "student").toUpperCase());

    // Profile Page (Premium)
    setSafeText(els.profileName, data.name);
    setSafeText(els.profileStudentId, data.studentId || "-");
    setSafeText(els.profileEmail, data.email || "-");
    setSafeText(els.profilePhone, data.phone || "-");
    setSafeText(els.profileDepartment, data.department || "-");
    setSafeText(els.profileYear, data.year || "-");
    setSafeText(els.profileIncharge, inchargeName || "-");
    setSafeText(els.profileHod, hodName || "-");
    setSafeText(els.profileCollegeName, data.collegeName || "-");
    setSafeText(els.profileCollegeId, data.collegeId || "-");
    setSafeText(els.profileCollegeCode, data.collegeCode || "-");
    setSafeText(els.profileRole, (data.role || "student").toUpperCase());

    if (data.photoURL && els.profilePagePhoto) {
        els.profilePagePhoto.src = data.photoURL;
    }

    if (data.createdAt) {
        const d = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
        setSafeText(els.profileRegisteredOn, d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    } else {
        setSafeText(els.profileRegisteredOn, "N/A");
    }

    // Handle Unlocked States with Countdown Timers
    const now = new Date().getTime();
    const expiryMs = 10 * 60 * 1000;

    if (window.expiryInterval) clearInterval(window.expiryInterval);
    window.expiryInterval = setInterval(() => {
        const currentTime = new Date().getTime();

        // Phone Timer
        if (me.pendingUnlock_phone) {
            const approvedAt = me.pendingUnlock_phone_at?.toDate?.()?.getTime() || 0;
            const diff = currentTime - approvedAt;
            if (diff < expiryMs) {
                if (els.phoneUnlockedArea) els.phoneUnlockedArea.classList.remove("hidden");
                if (els.phoneTimer) {
                    const remaining = Math.max(0, expiryMs - diff);
                    const m = Math.floor(remaining / 60000);
                    const s = Math.floor((remaining % 60000) / 1000);
                    els.phoneTimer.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                }
            } else {
                if (els.phoneUnlockedArea) els.phoneUnlockedArea.classList.add("hidden");
            }
        } else {
            if (els.phoneUnlockedArea) els.phoneUnlockedArea.classList.add("hidden");
        }

        // Photo Timer
        if (me.pendingUnlock_photo) {
            const approvedAt = me.pendingUnlock_photo_at?.toDate?.()?.getTime() || 0;
            const diff = currentTime - approvedAt;
            if (diff < expiryMs) {
                if (els.photoUnlockedArea) els.photoUnlockedArea.classList.remove("hidden");
                if (els.photoTimer) {
                    const remaining = Math.max(0, expiryMs - diff);
                    const m = Math.floor(remaining / 60000);
                    const s = Math.floor((remaining % 60000) / 1000);
                    els.photoTimer.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                }
            } else {
                if (els.photoUnlockedArea) els.photoUnlockedArea.classList.add("hidden");
            }
        } else {
            if (els.photoUnlockedArea) els.photoUnlockedArea.classList.add("hidden");
        }

        // Details Timer (Multi-field)
        if (me.pendingUnlock_details) {
            const approvedAt = me.pendingUnlock_details_at?.toDate?.()?.getTime() || 0;
            const diff = currentTime - approvedAt;
            if (diff < expiryMs) {
                if (els.detailsUnlockedArea) {
                    if (els.detailsUnlockedArea.classList.contains("hidden")) {
                        // Pre-fill once when it becomes visible
                        if (els.phoneDetailEditInput) els.phoneDetailEditInput.value = me.phone || "";
                        if (els.yearEditInput) els.yearEditInput.value = me.year || "1";
                        if (els.hodEditInput) {
                            loadHodsForDept(me.collegeId, me.department, els.hodEditInput);
                            els.hodEditInput.value = me.hodId || "";
                        }
                        if (els.inchargeEditInput) {
                            loadInchargesUnderHod(me.hodId, els.inchargeEditInput);
                            els.inchargeEditInput.value = me.inchargeId || "";
                        }
                    }
                    els.detailsUnlockedArea.classList.remove("hidden");
                }
                if (els.detailsTimer) {
                    const remaining = Math.max(0, expiryMs - diff);
                    const m = Math.floor(remaining / 60000);
                    const s = Math.floor((remaining % 60000) / 1000);
                    els.detailsTimer.innerText = `Expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                }
            } else {
                if (els.detailsUnlockedArea) els.detailsUnlockedArea.classList.add("hidden");
            }
        } else {
            if (els.detailsUnlockedArea) els.detailsUnlockedArea.classList.add("hidden");
        }

        applyProfileRequestVisuals();
    }, 1000);

    // Initial check for layout
    if (me.pendingUnlock_phone || me.pendingUnlock_photo) {
        // Just trigger once to avoid flash
    }

    await refreshProfileRequestVisuals();
    setGreeting(data.name);

    // Check if face re-registration is enabled by super admin
    checkFaceReregisterEnabled();
}

function setGreeting(name) {
    const hr = new Date().getHours();
    let g = "Good Evening";
    if (hr < 12) g = "Good Morning";
    else if (hr < 17) g = "Good Afternoon";

    setSafeText(els.greetingText, `${g}, ${name} 👋`);
}

// Enable direct editing for approved users
function enableDirectEditing() {
    // Direct photo edit button
    if (els.directPhotoBtn) {
        els.directPhotoBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        // Show loading
                        els.directPhotoBtn.innerHTML = '⏳';
                        els.directPhotoBtn.disabled = true;

                        // Convert to base64
                        const base64 = await fileToBase64(file);

                        // Update profile photo directly
                        await updateDoc(doc(db, "users", currentUser.uid), {
                            photoURL: base64,
                            updatedAt: serverTimestamp()
                        });

                        // Update UI
                        if (els.profilePagePhoto) els.profilePagePhoto.src = base64;
                        if (document.getElementById("sidebarProfilePhoto")) {
                            document.getElementById("sidebarProfilePhoto").src = base64;
                        }

                        alert('✅ Profile photo updated successfully!');
                        await loadProfile(); // Refresh profile

                    } catch (error) {
                        console.error('Error updating photo:', error);
                        alert('❌ Failed to update profile photo. Please try again.');
                    } finally {
                        // Reset button
                        els.directPhotoBtn.innerHTML = '📷';
                        els.directPhotoBtn.disabled = false;
                    }
                }
            };
            input.click();
        };
    }

    // Direct details edit button
    if (els.directEditBtn) {
        els.directEditBtn.onclick = () => {
            openDirectEditModal();
        };
    }
}

// Open direct edit modal for approved users
function openDirectEditModal() {
    // Create or show direct edit modal
    let modal = document.getElementById('directEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'directEditModal';
        modal.className = 'request-modal-overlay';
        modal.innerHTML = `
            <div class="request-modal-content" style="max-width: 500px;">
                <h3 style="margin-top: 0; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                    ✏️ Edit Profile Details
                </h3>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                    Update your personal information directly.
                </p>

                <div class="edit-form">
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" id="directPhoneInput" placeholder="Enter phone number" value="${me.phone || ''}">
                    </div>

                    <div class="form-group">
                        <label>Year of Study</label>
                        <select id="directYearInput">
                            <option value="1" ${me.year == '1' ? 'selected' : ''}>1st Year</option>
                            <option value="2" ${me.year == '2' ? 'selected' : ''}>2nd Year</option>
                            <option value="3" ${me.year == '3' ? 'selected' : ''}>3rd Year</option>
                            <option value="4" ${me.year == '4' ? 'selected' : ''}>4th Year</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>HOD</label>
                        <select id="directHodInput">
                            <option value="">Select HOD</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Incharge</label>
                        <select id="directInchargeInput">
                            <option value="">Select Incharge</option>
                        </select>
                    </div>
                </div>

                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button id="cancelDirectEdit" class="cancel-btn">Cancel</button>
                    <button id="saveDirectEdit" class="save-btn">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Load HODs and Incharges
        loadHodsForDept(me.collegeId, me.department, document.getElementById('directHodInput'));
        document.getElementById('directHodInput').value = me.hodId || '';

        // HOD change handler
        document.getElementById('directHodInput').onchange = (e) => {
            loadInchargesUnderHod(e.target.value, document.getElementById('directInchargeInput'));
        };

        // Load incharges for current HOD
        if (me.hodId) {
            loadInchargesUnderHod(me.hodId, document.getElementById('directInchargeInput'));
            setTimeout(() => {
                document.getElementById('directInchargeInput').value = me.inchargeId || '';
            }, 500);
        }

        // Cancel button
        document.getElementById('cancelDirectEdit').onclick = () => {
            modal.remove();
        };

        // Save button
        document.getElementById('saveDirectEdit').onclick = async () => {
            try {
                const phone = document.getElementById('directPhoneInput').value.trim();
                const year = document.getElementById('directYearInput').value;
                const hodId = document.getElementById('directHodInput').value;
                const inchargeId = document.getElementById('directInchargeInput').value;

                // Validate phone
                if (phone && !/^[\d\s\-\+\(\)]{10,}$/.test(phone)) {
                    alert('Please enter a valid phone number');
                    return;
                }

                // Update user data
                const updateData = {
                    updatedAt: serverTimestamp()
                };

                if (phone !== me.phone) updateData.phone = phone;
                if (year !== me.year) updateData.year = year;
                if (hodId !== me.hodId) updateData.hodId = hodId;
                if (inchargeId !== me.inchargeId) updateData.inchargeId = inchargeId;

                if (Object.keys(updateData).length > 1) { // More than just updatedAt
                    await updateDoc(doc(db, "users", currentUser.uid), updateData);
                    alert('✅ Profile details updated successfully!');
                    modal.remove();
                    await loadProfile(); // Refresh profile
                } else {
                    alert('No changes detected.');
                }

            } catch (error) {
                console.error('Error updating profile:', error);
                alert('❌ Failed to update profile details. Please try again.');
            }
        };
    }

    modal.classList.remove('hidden');
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadRecords() {
    if (!els.recordsTable) return;
    els.recordsTable.innerHTML = "";
    try {
        // 1. Get Registration Date
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userSnap.data();
        if (!userData || !userData.createdAt) {
            console.warn("No registration date found for student");
            return;
        }
        const regDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt.seconds * 1000);
        regDate.setHours(0, 0, 0, 0);

        // 2. Get Today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayStr = getTodayDate();

        // 3. Fetch all records and holidays
        const recordsQuery = query(collection(db, "attendanceRecords"), where("studentUid", "==", currentUser.uid));
        const [snap, collegeHolidaySnap] = await Promise.all([
            getDocs(recordsQuery),
            userData.collegeId ? getDocs(collection(db, "colleges", userData.collegeId, "holidays")) : Promise.resolve(null)
        ]);

        const dbRecords = {}; // grouped by date and session
        snap.forEach(docSnap => {
            const d = docSnap.data();
            if (!dbRecords[d.date]) dbRecords[d.date] = { FN: null, AN: null };
            dbRecords[d.date][d.session] = d;
        });

        const holidayMap = {};
        if (collegeHolidaySnap) {
            collegeHolidaySnap.forEach(docSnap => {
                holidayMap[docSnap.id] = docSnap.data();
            });
        }

        // 4. Generate full range and calculate stats
        const grouped = {};
        let pre = 0, abs = 0;
        let curr = new Date(regDate);
        window.todayAttendanceStatuses = { FN: null, AN: null };

        while (curr <= today) {
            const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
            const isSunday = curr.getDay() === 0;
            const holidayInfo = holidayMap[dateStr] || null;
            const isHoliday = isSunday || !!holidayInfo;

            grouped[dateStr] = { FN: null, AN: null, isHoliday, holidayReason: isSunday ? "Sunday - Weekly Holiday" : (holidayInfo?.reason || "Holiday") };

            if (!isHoliday) {
                ["FN", "AN"].forEach(sess => {
                    const rec = (dbRecords[dateStr] && dbRecords[dateStr][sess]) || null;
                    if (rec) {
                        grouped[dateStr][sess] = rec;
                        const st = (rec.status || "").toLowerCase();
                        if (st === "present") pre++; else abs++;

                        if (dateStr === todayStr) {
                            window.todayAttendanceStatuses[sess] = st === "present" ? "Present" : "Absent";
                        }
                    } else {
                        // Virtual absent record for history
                        abs++;
                        if (dateStr === todayStr) {
                            window.todayAttendanceStatuses[sess] = "Absent";
                        }
                    }
                });
            } else if (dateStr === todayStr) {
                window.todayAttendanceStatuses = { FN: null, AN: null };
            }
            curr.setDate(curr.getDate() + 1);
        }

        // 5. Render to table (Sorted descending)
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

        // Store data globally so the page-size buttons can re-render without re-fetching
        window._recordsSortedDates = sortedDates;
        window._recordsGrouped = grouped;

        window._renderRecordsPage = function() {
            const limitVal = (document.getElementById('recordsLimitFilter') || {}).value || 'all';
            const statusVal = (document.getElementById('recordsStatusFilter') || {}).value || 'all';

            // Apply limit first (on working days only, holidays excluded from count)
            let workingCount = 0;
            const dates = limitVal === 'all'
                ? sortedDates
                : sortedDates.filter(d => {
                    if (grouped[d].isHoliday) return true; // always include holidays in range
                    workingCount++;
                    return workingCount <= parseInt(limitVal);
                });

            let rows = "";
            let sNo = 0;

            dates.forEach((date) => {
                const sessions = grouped[date];

                if (sessions.isHoliday) {
                    if (statusVal !== 'all') return; // hide holidays when filtering by status
                    rows += `
                        <tr>
                            <td colspan="7" style="text-align:center; padding:28px;">
                                <span class="status-holiday">${sessions.holidayReason || 'Holiday'}</span>
                            </td>
                        </tr>`;
                    return;
                }

                const fnPresent = sessions.FN && (sessions.FN.status || "").toLowerCase() === "present";
                const anPresent = sessions.AN && (sessions.AN.status || "").toLowerCase() === "present";
                const bothAbsent = !fnPresent && !anPresent;
                const bothPresent = fnPresent && anPresent;

                // Status filter
                if (statusVal === 'present' && !fnPresent && !anPresent) return;
                if (statusVal === 'absent' && fnPresent && anPresent) return;

                sNo++;

                if (bothAbsent) {
                    rows += `
                        <tr>
                            <td>${sNo}</td>
                            <td>${date}</td>
                            <td colspan="5" style="text-align:center; font-weight:700; color:#dc2626;">FN &amp; AN — ABSENT</td>
                        </tr>`;
                } else {
                    ["FN", "AN"].forEach((sess, sIdx) => {
                        const rec = sessions[sess];
                        const isPresent = rec && (rec.status || "").toLowerCase() === "present";

                        // When filtering by status, skip rows that don't match
                        if (statusVal === 'present' && !isPresent) return;
                        if (statusVal === 'absent' && isPresent) return;

                        const statusText = isPresent ? "Present" : "Absent";
                        const statusCls = isPresent ? "status-present" : "status-absent";
                        const time = rec ? (rec.time || "--") : "--";
                        const gps = rec ? (rec.gpsStatus || "--") : "--";
                        const method = rec ? (rec.faceStatus === "✓" ? "Facial" : (rec.faceStatus || (rec.method === "Facial" ? "Facial" : rec.method || "--"))) : "--";

                        if (sIdx === 0 && statusVal === 'all') {
                            rows += `
                                <tr>
                                    <td rowspan="2">${sNo}</td>
                                    <td rowspan="2">${date}</td>
                                    <td>${sess}</td><td>${time}</td><td>${gps}</td><td>${method}</td>
                                    <td><span class="${statusCls}">${statusText}</span></td>
                                </tr>`;
                        } else if (sIdx === 1 && statusVal === 'all') {
                            rows += `
                                <tr>
                                    <td>${sess}</td><td>${time}</td><td>${gps}</td><td>${method}</td>
                                    <td><span class="${statusCls}">${statusText}</span></td>
                                </tr>`;
                        } else if (statusVal !== 'all') {
                            rows += `
                                <tr>
                                    <td>${sNo}</td>
                                    <td>${date}</td>
                                    <td>${sess}</td><td>${time}</td><td>${gps}</td><td>${method}</td>
                                    <td><span class="${statusCls}">${statusText}</span></td>
                                </tr>`;
                        }
                    });
                }
            });

            els.recordsTable.innerHTML = rows || `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">No records match the selected filters.</td></tr>`;
        };

        window._renderRecordsPage();

        // 6. Update Stats
        const totalSessions = pre + abs;
        const workingDaysCount = sortedDates.filter(date => !grouped[date]?.isHoliday).length;
        setSafeText(els.totalDays, workingDaysCount);
        setSafeText(els.presentDays, pre);
        setSafeText(els.absentDays, abs);
        if (els.percentage) {
            els.percentage.innerText = (totalSessions > 0 ? Math.round((pre / totalSessions) * 100) : 0) + "%";
        }

    } catch (err) {
        console.error("loadRecords error:", err);
        setSafeText(els.totalDays, "Error");
        setSafeText(els.presentDays, "Error");
        setSafeText(els.absentDays, "Error");
    }
}


async function autoMarkAbsent() {
    if (!settings) return;
    const today = getTodayDate(), now = new Date(), minNow = now.getHours() * 60 + now.getMinutes();
    const toM = (t) => { const [h, m] = t.split(":"); return parseInt(h) * 60 + parseInt(m); };

    const mark = async (session) => {
        const ref = doc(db, "attendance", currentUser.uid, "records", `${today}_${session}`);
        if (!(await getDoc(ref)).exists()) {
            await setDoc(ref, { date: today, session, status: "Absent", method: "--", gps: false, time: "--", timestamp: serverTimestamp() });
        }
    };
    if (minNow > toM(settings.fnEnd)) await mark("FN");
    if (minNow > toM(settings.anEnd)) await mark("AN");
}

// ================= FACE & VERIFICATION =================

async function loadFaceModels() {
    try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        faceApiReady = true;
        console.log('✅ face-api.js models loaded');
    } catch (err) {
        console.error('Face model load failed:', err);
    }
}

async function loadFaceDescriptor() {
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        const data = snap.data();
        if (data && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128) {
            registeredMesh = new Float32Array(data.faceDescriptor);
            console.log('✅ Face descriptor loaded (128-dim)');
        } else {
            console.warn('⚠️ No face descriptor — manual verification required');
            registeredMesh = null;
        }
    } catch (e) {
        console.error('loadFaceDescriptor error:', e);
        registeredMesh = null;
    }
}

async function loadOtherStudentDescriptors() {
    try {
        if (!me?.collegeId) return;
        const q = query(collection(db, "users"),
            where("collegeId", "==", me.collegeId),
            where("role", "==", "student")
        );
        const snap = await getDocs(q);
        otherStudentMeshes = [];
        snap.forEach(d => {
            if (d.id === currentUser.uid) return;
            const data = d.data();
            if (Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128) {
                otherStudentMeshes.push({
                    uid: d.id,
                    name: data.name || 'Unknown',
                    descriptor: new Float32Array(data.faceDescriptor)
                });
            }
        });
        console.log(`✅ Loaded ${otherStudentMeshes.length} other student descriptors`);
    } catch (e) {
        console.warn('loadOtherStudentDescriptors:', e);
    }
}

function euclideanDist(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}

// Kept for backward compat — not used in new flow
function getFaceRMSE() { return Infinity; }
function compareMeshes() { return false; }

let verificationState = { gpsVerified: false, faceVerified: false, manualApproved: false, faceTrialsLeft: 3 };

function resetVerification() {
    verificationState = { gpsVerified: false, faceVerified: false, manualApproved: false, faceTrialsLeft: 3 };
    updateVerificationUI();
    startGPSVerification();

    if (window.vUIInterval) clearInterval(window.vUIInterval);
    window.vUIInterval = setInterval(() => {
        if (document.querySelector(".page.active#markPage")) updateVerificationUI();
    }, 1000);
}

function updateVerificationUI() {
    const gpsStep = document.getElementById("gpsStep"), faceStep = document.getElementById("faceStep"), manualStep = document.getElementById("manualStep");
    if (!gpsStep || !els.homeMarkBtn) return;

    const gStatus = document.getElementById("gpsStatus"), fStatus = document.getElementById("faceStatus"), mStatus = document.getElementById("manualStatus");
    const gMsg = document.getElementById("gpsMessage"), fMsg = document.getElementById("faceMessage"), mMsg = document.getElementById("manualMessage");
    const gBtn = document.getElementById("gpsPermissionBtn"), fBtn = document.getElementById("facePermissionBtn"), mBtn = document.getElementById("manualRequestBtn");
    const markBtn = document.getElementById("markBtn");

    // ── Reset all step states first ──
    gpsStep.classList.remove("completed", "failed");
    faceStep.classList.remove("completed", "failed");
    manualStep.classList.remove("completed", "failed");
    setSafeText(gStatus, "Pending"); setSafeText(fStatus, "Waiting"); setSafeText(mStatus, "Not Needed");
    setSafeText(gMsg, ""); setSafeText(fMsg, ""); if (mMsg) setSafeText(mMsg, "");
    if (gBtn) gBtn.style.display = "block";
    if (fBtn) fBtn.style.display = "none";
    if (mBtn) mBtn.style.display = "none";
    faceStep.classList.add("disabled");
    manualStep.classList.add("disabled");

    // ── GPS ──
    if (verificationState.gpsVerified) {
        gpsStep.classList.add("completed");
        setSafeText(gStatus, "✓ Verified");
        setSafeText(gMsg, "Location verified");
        if (gBtn) gBtn.style.display = "none";
        faceStep.classList.remove("disabled");
        setSafeText(fStatus, "Ready");
        if (fBtn) fBtn.style.display = "block";
    }

    // ── Face ──
    if (verificationState.faceVerified) {
        faceStep.classList.add("completed");
        setSafeText(fStatus, "✓ Verified");
        setSafeText(fMsg, "Face matched");
        if (fBtn) fBtn.style.display = "none";
        const trialsDiv = document.getElementById("faceTrials");
        if (trialsDiv) trialsDiv.style.display = "none";
        manualStep.classList.remove("disabled");
        setSafeText(mStatus, "Not Needed");
    } else if (verificationState.gpsVerified && verificationState.faceTrialsLeft <= 0) {
        faceStep.classList.add("failed");
        setSafeText(fStatus, "✗ Failed");
        setSafeText(fMsg, "All attempts used");
        if (fBtn) fBtn.style.display = "none";
        const trialsDiv = document.getElementById("faceTrials");
        if (trialsDiv) { trialsDiv.style.display = "block"; }
        const countSpan = document.getElementById("faceTrialCount");
        if (countSpan) countSpan.innerText = "0";
        manualStep.classList.remove("disabled");
        setSafeText(mStatus, "Required");
        if (mBtn) mBtn.style.display = "block";
        if (mMsg) setSafeText(mMsg, "Please request manual approval");
    } else if (verificationState.gpsVerified) {
        // GPS done, face pending
        const trialsDiv = document.getElementById("faceTrials");
        if (trialsDiv) trialsDiv.style.display = "block";
        const countSpan = document.getElementById("faceTrialCount");
        if (countSpan) countSpan.innerText = verificationState.faceTrialsLeft;
    }

    // ── Manual ──
    if (verificationState.manualApproved) {
        manualStep.classList.add("completed");
        setSafeText(mStatus, "✓ Approved");
        if (mBtn) mBtn.style.display = "none";
    }

    // ── Mark button ──
    const sess = getCurrentSession();
    const active = sess === "FN" || sess === "AN";
    const ok = (verificationState.gpsVerified && (verificationState.faceVerified || verificationState.manualApproved));

    if (markBtn) {
        markBtn.style.display = "block";
        markBtn.disabled = !ok || !active;
        if (!active) {
            if (sess === "Holiday") markBtn.innerText = "Holiday - Marking Closed";
            else markBtn.innerText = sess === "Waiting" ? "Waiting for Session" : "Session Closed";
        }
        else markBtn.innerText = ok ? `✓ Mark ${sess} Attendance` : "📍 Complete Steps First";
    }
}

function startGPSVerification() {
    const btn = document.getElementById("gpsPermissionBtn");
    if (btn) { btn.style.display = "block"; btn.onclick = verifyGPS; }
}

async function verifyGPS() {
    const msg = document.getElementById("gpsMessage"), btn = document.getElementById("gpsPermissionBtn");
    if (btn) btn.style.display = "none"; if (msg) msg.innerText = "📍 Checking location...";

    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        const c = pos.coords;
        if (c.accuracy > 200) { throw new Error("Accuracy too low"); }
        const dist = getDistance(c.latitude, c.longitude, settings.latitude, settings.longitude);
        if (dist <= settings.radius) {
            verificationState.gpsVerified = true;
            updateVerificationUI();
            startFaceVerification();
        } else { throw new Error(`Too far (${Math.round(dist)}m)`); }
    } catch (e) {
        if (msg) msg.innerText = `❌ ${e.message}`;
        if (btn) { btn.style.display = "block"; btn.innerText = "🔄 Retry"; }
    }
}

function startFaceVerification() {
    const btn = document.getElementById("facePermissionBtn");
    const trialsDiv = document.getElementById("faceTrials");
    const countSpan = document.getElementById("faceTrialCount");

    if (trialsDiv) trialsDiv.style.display = "block";
    if (countSpan) countSpan.innerText = verificationState.faceTrialsLeft;

    if (btn) { btn.style.display = "block"; btn.onclick = verifyFace; }
}

async function verifyFace() {
    const btn = document.getElementById("facePermissionBtn");
    const msg = document.getElementById("faceMessage");
    const vid = document.getElementById("video");
    const countSpan = document.getElementById("faceTrialCount");

    if (!registeredMesh) {
        if (msg) msg.innerText = "⚠️ No face registered. Use manual verification.";
        verificationState.faceTrialsLeft = 0;
        updateVerificationUI();
        return;
    }

    if (!faceApiReady) {
        if (msg) msg.innerText = "⏳ Face models loading, please wait...";
        if (btn) { btn.style.display = "block"; btn.innerText = "🔄 Retry"; }
        return;
    }

    if (btn) btn.style.display = "none";
    if (msg) msg.innerText = "📷 Starting camera...";

    // Load other descriptors lazily on first use
    if (otherStudentMeshes.length === 0) {
        loadOtherStudentDescriptors().catch(() => {});
    }

    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 640, height: 480 }
        });
        vid.srcObject = stream;
        vid.style.display = "block";
        vid.play().catch(() => {});

        // Wait until video has real dimensions
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Camera took too long to start")), 8000);
            const check = setInterval(() => {
                if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
                    clearInterval(check); clearTimeout(timeout); resolve();
                }
            }, 100);
        });

        if (msg) msg.innerText = "🔍 Scanning face — hold still...";

        const FRAMES = 5;
        const NEEDED = 3;
        const MATCH_THRESHOLD = 0.5;   // face-api: same person < 0.5, different > 0.6
        let matches = 0;
        let noFaceCount = 0;
        let spoofName = null;

        const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

        for (let i = 0; i < FRAMES; i++) {
            await new Promise(r => setTimeout(r, 600));
            if (vid.videoWidth === 0 || vid.readyState < 2) { noFaceCount++; continue; }

            if (msg) msg.innerText = `🔍 Scanning... ${i+1}/${FRAMES}`;

            const detection = await faceapi
                .detectSingleFace(vid, detectorOptions)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) { noFaceCount++; continue; }

            const currentDesc = detection.descriptor; // Float32Array 128-dim
            const selfDist = euclideanDist(currentDesc, registeredMesh);

            // Check against all other students
            let bestOtherDist = Infinity;
            let bestOtherName = null;
            for (const other of otherStudentMeshes) {
                const d = euclideanDist(currentDesc, other.descriptor);
                if (d < bestOtherDist) { bestOtherDist = d; bestOtherName = other.name; }
            }

            console.log(`[FaceVerify] Frame ${i+1}: self=${selfDist.toFixed(4)}, bestOther=${bestOtherDist.toFixed(4)} (${bestOtherName || 'none'})`);

            if (selfDist < MATCH_THRESHOLD && selfDist < bestOtherDist) {
                // Matches self and is closer to self than any other student
                matches++;
                spoofName = null;
            } else if (selfDist >= MATCH_THRESHOLD && bestOtherDist < MATCH_THRESHOLD) {
                // Matches another student
                spoofName = bestOtherName;
                if (msg) msg.innerText = `⚠️ Another student's face detected${bestOtherName ? ` (${bestOtherName})` : ''}. Use your own face.`;
            }
            // else: face detected but doesn't match anyone — just doesn't count
        }

        vid.style.display = "none";
        stream.getTracks().forEach(t => t.stop());

        console.log(`[FaceVerify] Result: ${matches}/${FRAMES} matches`);

        if (noFaceCount >= FRAMES) {
            throw new Error("No face detected. Ensure good lighting and face the camera directly.");
        }

        if (spoofName) {
            verificationState.faceTrialsLeft--;
            if (countSpan) countSpan.innerText = verificationState.faceTrialsLeft;
            throw new Error(`⚠️ Another student's face detected (${spoofName}). Only the account holder can mark attendance.`);
        }

        if (matches >= NEEDED) {
            verificationState.faceVerified = true;
            if (msg) msg.innerText = `✅ Identity verified (${matches}/${FRAMES} frames)`;
            updateVerificationUI();
        } else {
            verificationState.faceTrialsLeft--;
            if (countSpan) countSpan.innerText = verificationState.faceTrialsLeft;
            throw new Error(`Face not recognized (${matches}/${FRAMES} frames matched). Ensure you are the registered account holder.`);
        }

    } catch (e) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        vid.style.display = "none";
        vid.srcObject = null;
        if (msg) msg.innerText = `❌ ${e.message}`;
        if (verificationState.faceTrialsLeft > 0) {
            if (btn) { btn.style.display = "block"; btn.innerText = "🔄 Retry"; }
        } else {
            updateVerificationUI();
        }
    }
}
const mReqBtn = document.getElementById("manualRequestBtn");
if (mReqBtn) mReqBtn.onclick = async () => {
    verificationState.manualApproved = true; updateVerificationUI();
};

const markBtnMain = document.getElementById("markBtn");
if (markBtnMain) markBtnMain.onclick = async () => {
    try {
        await saveAttendance(); await loadRecords(); await loadAttendanceSettings(); resetVerification();
    } catch (e) { alert("Error: " + e); }
};

async function saveAttendance() {
    const today = getTodayDate(), sess = getCurrentSession();
    if (settings?.holiday || sess === "Holiday") {
        alert("Attendance marking is closed today because it is a holiday.");
        return;
    }
    if (sess !== "FN" && sess !== "AN") {
        alert("Attendance marking is available only during the active session.");
        return;
    }
    const docId = `${today}_${currentUser.uid}_${sess}`;

    // 1. Write to student's private records
    await setDoc(doc(db, "attendance", currentUser.uid, "records", `${today}_${sess}`), {
        date: today, session: sess, time: new Date().toLocaleTimeString(),
        gps: true, method: verificationState.faceVerified ? "Facial" : "Manual",
        status: "Present", timestamp: serverTimestamp()
    });

    // 2. Write to public/shared collection for Admin Dashboard
    // We need to fetch user data for the flat record (Name, Roll, Dept etc.)
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const u = snap.data();

    await setDoc(doc(db, "attendanceRecords", docId), {
        studentUid: currentUser.uid,
        studentName: u.name || "Unknown",
        roll: u.studentId || u.roll || "-",
        academicYear: u.year || "-",
        department: u.department || "-",
        date: today,
        session: sess,
        time: new Date().toLocaleTimeString(),
        gpsStatus: "✓",
        faceStatus: verificationState.faceVerified ? "✓" : "Manual",
        status: "present", // admin expected lowercase 'present'
        timestamp: serverTimestamp()
    });

    alert("✓ Marked Present");
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function setupNavigationGuard() {
    window.addEventListener('beforeunload', (e) => { if (currentUser) { e.preventDefault(); e.returnValue = ''; } });
}

function updateTime() {
    const now = new Date();
    setSafeText(els.currentTime, now.toLocaleTimeString());
    setSafeText(els.currentDate, now.toLocaleDateString());
    setSafeText(els.currentDay, now.toLocaleDateString(undefined, { weekday: 'long' }));
}
setInterval(updateTime, 1000);
updateTime();
/* ================= PROFILE UPDATE LOGIC ================= */

// Open modal for specific buttons
document.querySelectorAll(".req-edit-btn").forEach(btn => {
    btn.onclick = () => {
        activeRequestField = btn.dataset.field;
        activeRequestLabel = btn.dataset.label;
        openRequestModal(activeRequestField, activeRequestLabel);
    };
});

// (+) Button logic for Personal Details
if (els.addRequestBtn) {
    els.addRequestBtn.onclick = () => {
        openRequestModal('details', 'Personal Details Modification');
    };
}

// Avatar click logic
if (els.reqPhotoBtn) {
    els.reqPhotoBtn.onclick = () => {
        openRequestModal('photo', 'Profile Photo');
    };
}

function openRequestModal(field, label) {
    activeRequestField = field;
    activeRequestLabel = label;
    if (els.modalTitle) els.modalTitle.innerHTML = `🛡️ Approval Required: ${activeRequestLabel}`;

    if (els.modalDesc) {
        els.modalDesc.innerText = activeRequestField === "photo"
            ? "Ask approval first. After approval, your photo upload will unlock for 10 minutes."
            : "Ask approval first. After approval, your profile details will unlock for 10 minutes so you can update them.";
    }
    if (els.textRequestArea) els.textRequestArea.classList.add("hidden");
    if (els.photoRequestArea) els.photoRequestArea.classList.add("hidden");
    if (els.multiFieldForm) els.multiFieldForm.classList.add("hidden");
    if (els.newFieldValue) {
        els.newFieldValue.classList.add("hidden");
        els.newFieldValue.value = "";
    }
    if (els.photoPreview) els.photoPreview.innerText = "No file selected";
    currentProfilePhotoBase64 = null;
    if (els.submitRequestBtn) els.submitRequestBtn.innerText = "Ask Approval";
    if (els.requestModal) els.requestModal.classList.remove("hidden");
}

if (els.cancelModal) {
    els.cancelModal.onclick = () => {
        if (els.requestModal) els.requestModal.classList.add("hidden");
        activeRequestField = null;
        currentProfilePhotoBase64 = null;
    };
}

if (els.profilePhotoInput) {
    els.profilePhotoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
            currentProfilePhotoBase64 = re.target.result;
            if (els.photoPreview) els.photoPreview.innerText = `Selected: ${file.name}`;
        };
        reader.readAsDataURL(file);
    };
}

if (els.submitRequestBtn) {
    els.submitRequestBtn.onclick = async () => {
        try {
            if (activeRequestField === "photo" && isUnlockActive(me?.pendingUnlock_photo, me?.pendingUnlock_photo_at)) {
                alert("Photo update is already approved. Use the unlocked upload area below before it expires.");
                return;
            }
            if (activeRequestField === "details" && isUnlockActive(me?.pendingUnlock_details, me?.pendingUnlock_details_at)) {
                alert("Details update is already approved. Use the unlocked form below before it expires.");
                return;
            }
            if (await hasPendingProfileRequest(activeRequestField)) {
                alert("An approval request for this profile change is already pending.");
                return;
            }

            els.submitRequestBtn.disabled = true;
            els.submitRequestBtn.innerText = "Sending...";

            // Mandatory GPS capture for request
            let gps = null;
            try {
                const pos = await new Promise((res, rej) => {
                    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 });
                });
                gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            } catch (err) {
                console.warn("GPS capture failed for request", err);
            }

            const requestRef = doc(collection(db, "profileUpdateRequests"));
            await setDoc(requestRef, {
                uid: me.uid,
                name: me.name,
                role: me.role,
                type: activeRequestField,
                newValue: "Approval requested before update",
                details: null,
                approvalOnly: true,
                status: "pending",
                gps: gps,
                requestedAt: serverTimestamp(),
                department: me.department || null
            });

            await addDoc(collection(db, "notifications"), {
                userId: me.uid,
                title: activeRequestField === "photo" ? "Photo Update Request Sent" : "Profile Details Request Sent",
                message: "Your approval request has been submitted and is waiting for admin review.",
                type: "profile_request",
                targetPage: "profilePage",
                read: false,
                createdAt: serverTimestamp()
            });

            alert("Approval request submitted successfully. After approval, the update section will unlock for 10 minutes.");
            if (els.requestModal) els.requestModal.classList.add("hidden");
            await refreshProfileRequestVisuals();
        } catch (err) {
            console.error("Submit Request Error:", err);
            alert("Failed to submit request: " + err.message);
        } finally {
            els.submitRequestBtn.disabled = false;
            els.submitRequestBtn.innerText = "Ask Approval";
        }
    };
}

// Logic for saving after unlock
if (els.savePhoneBtn) {
    els.savePhoneBtn.onclick = async () => {
        const newVal = els.phoneEditInput.value.trim();
        if (!newVal) return;
        try {
            els.savePhoneBtn.disabled = true;
            await updateDoc(doc(db, "users", me.uid), {
                phone: newVal,
                pendingUnlock_phone: false
            });
            alert("Phone number updated successfully and field re-locked.");
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Save failed");
        }
    };
}

if (els.saveDetailsBtn) {
    els.saveDetailsBtn.onclick = async () => {
        const newPhone = els.phoneDetailEditInput.value.trim();
        const newYear = els.yearEditInput.value;
        const newInchargeId = els.inchargeEditInput.value;
        const newHodId = els.hodEditInput.value;
        try {
            els.saveDetailsBtn.disabled = true;
            await updateDoc(doc(db, "users", me.uid), {
                phone: newPhone,
                year: newYear,
                inchargeId: newInchargeId,
                hodId: newHodId,
                pendingUnlock_details: false
            });
            alert("Details updated successfully and fields re-locked.");
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Update failed");
        } finally {
            els.saveDetailsBtn.disabled = false;
        }
    };
}

if (els.hodEditInput) {
    els.hodEditInput.onchange = () => {
        const selectedHod = els.hodEditInput.value;
        if (selectedHod && els.inchargeEditInput) {
            loadInchargesUnderHod(selectedHod, els.inchargeEditInput);
        } else if (els.inchargeEditInput) {
            els.inchargeEditInput.innerHTML = `<option value="">-- Select HOD first --</option>`;
        }
    };
}

// ================= PROFILE EDIT FUNCTIONS =================

async function loadHodsForDept(collegeId, dept, targetSelect) {
    if (!collegeId || !dept || !targetSelect) return;

    targetSelect.innerHTML = `<option value="">Loading HODs...</option>`;

    try {
        const q = query(
            collection(db, "users"),
            where("role", "==", "hod"),
            where("collegeId", "==", collegeId),
            where("department", "==", dept),
            where("approved", "==", true)
        );
        const snap = await getDocs(q);

        targetSelect.innerHTML = `<option value="">-- Select HOD --</option>`;
        snap.forEach(d => {
            const u = d.data();
            targetSelect.innerHTML += `<option value="${d.id}">${u.name}</option>`;
        });

        if (snap.empty) {
            targetSelect.innerHTML = `<option value="">No HODs found</option>`;
        }
    } catch (error) {
        console.error("Error loading HODs:", error);
        targetSelect.innerHTML = `<option value="">Error loading</option>`;
    }
}

async function loadInchargesUnderHod(hodId, targetSelect) {
    if (!hodId || !targetSelect) return;

    targetSelect.innerHTML = `<option value="">Loading Incharges...</option>`;

    try {
        const q = query(
            collection(db, "users"),
            where("role", "==", "incharge"),
            where("hodId", "==", hodId),
            where("approved", "==", true)
        );
        const snap = await getDocs(q);

        targetSelect.innerHTML = `<option value="">-- Select Incharge --</option>`;
        snap.forEach(d => {
            const u = d.data();
            targetSelect.innerHTML += `<option value="${d.id}">${u.name}</option>`;
        });

        if (snap.empty) {
            targetSelect.innerHTML = `<option value="">No Incharges found</option>`;
        }
    } catch (error) {
        console.error("Error loading incharges:", error);
        targetSelect.innerHTML = `<option value="">Error loading</option>`;
    }
}

if (els.photoChangeInput) {
    els.photoChangeInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (re) => {
            if (confirm("Update profile photo now?")) {
                try {
                    await updateDoc(doc(db, "users", me.uid), {
                        photoURL: re.target.result,
                        pendingUnlock_photo: false
                    });
                    alert("Profile photo updated successfully and field re-locked.");
                    window.location.reload();
                } catch (err) {
                    console.error(err);
                    alert("Update failed");
                }
            }
        };
        reader.readAsDataURL(file);
    };
}

// ================= RECORDS FILTERS =================
document.addEventListener('change', (e) => {
    if (e.target.id === 'recordsLimitFilter' || e.target.id === 'recordsStatusFilter') {
        if (typeof window._renderRecordsPage === 'function') window._renderRecordsPage();
    }
});

// ================= CUSTOM SELECT (records filters) =================
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

    trigger.onclick = (e) => {
        e.stopPropagation();
        panel.classList.contains('open') ? closePanel() : openPanel();
    };
    document.addEventListener('click', () => closePanel());
    buildOptions();
    updateLabel();
}

// Init after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ['recordsStatusFilter', 'recordsLimitFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) initCustomSelect(el);
    });
});


/* ================= FACE RE-REGISTRATION ================= */

async function checkFaceReregisterEnabled() {
    try {
        const snap = await getDoc(doc(db, "settings", "security"));
        const enabled = snap.exists() && snap.data().faceReregisterEnabled === true;
        const section = document.getElementById("faceReregisterSection");
        if (section) section.style.display = enabled ? "block" : "none";
    } catch (e) {
        console.warn('checkFaceReregisterEnabled:', e);
    }
}

let faceReregStream = null;

document.getElementById("faceReregStartBtn")?.addEventListener("click", async () => {
    const vid = document.getElementById("faceReregVideo");
    const msg = document.getElementById("faceReregMsg");
    const startBtn = document.getElementById("faceReregStartBtn");
    const captureBtn = document.getElementById("faceReregCaptureBtn");
    const cancelBtn = document.getElementById("faceReregCancelBtn");

    if (!faceApiReady) {
        if (msg) msg.innerText = "⏳ Face AI still loading, please wait...";
        return;
    }

    try {
        faceReregStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
        vid.srcObject = faceReregStream;
        vid.style.display = "block";
        vid.play();
        if (msg) msg.innerText = "📷 Camera ready. Position your face clearly and click Capture.";
        startBtn.style.display = "none";
        captureBtn.style.display = "inline-block";
        cancelBtn.style.display = "inline-block";
    } catch (e) {
        if (msg) msg.innerText = `❌ Camera error: ${e.message}`;
    }
});

document.getElementById("faceReregCaptureBtn")?.addEventListener("click", async () => {
    const vid = document.getElementById("faceReregVideo");
    const msg = document.getElementById("faceReregMsg");
    const captureBtn = document.getElementById("faceReregCaptureBtn");

    if (!vid.srcObject) return;
    if (msg) msg.innerText = "📸 Capturing face...";
    captureBtn.disabled = true;

    try {
        const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
        const detection = await faceapi
            .detectSingleFace(vid, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            if (msg) msg.innerText = "❌ No face detected. Ensure good lighting and face the camera.";
            captureBtn.disabled = false;
            return;
        }

        const newDescriptor = Array.from(detection.descriptor);
        await updateDoc(doc(db, "users", currentUser.uid), { faceDescriptor: newDescriptor });
        registeredMesh = new Float32Array(newDescriptor);

        if (msg) msg.innerText = "✅ Face re-registered successfully!";
        if (faceReregStream) { faceReregStream.getTracks().forEach(t => t.stop()); faceReregStream = null; }
        vid.style.display = "none";
        vid.srcObject = null;

        document.getElementById("faceReregStartBtn").style.display = "inline-block";
        captureBtn.style.display = "none";
        document.getElementById("faceReregCancelBtn").style.display = "none";
        captureBtn.disabled = false;

        setTimeout(() => { if (msg) msg.innerText = ""; }, 3000);
    } catch (e) {
        if (msg) msg.innerText = `❌ Error: ${e.message}`;
        captureBtn.disabled = false;
    }
});

document.getElementById("faceReregCancelBtn")?.addEventListener("click", () => {
    const vid = document.getElementById("faceReregVideo");
    const msg = document.getElementById("faceReregMsg");
    if (faceReregStream) { faceReregStream.getTracks().forEach(t => t.stop()); faceReregStream = null; }
    vid.style.display = "none";
    vid.srcObject = null;
    if (msg) msg.innerText = "";
    document.getElementById("faceReregStartBtn").style.display = "inline-block";
    document.getElementById("faceReregCaptureBtn").style.display = "none";
    document.getElementById("faceReregCancelBtn").style.display = "none";
});
