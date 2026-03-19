import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let currentUser = null;
let editingCollegeId = null;
let allColleges = [];

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    // Check if user is super admin (case insensitive)
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
        alert("User profile not found. Please contact support.");
        window.location.href = "index.html";
        return;
    }

    const userData = userDoc.data();
    const userRole = (userData.role || "").toLowerCase();

    if (userRole !== "superadmin") {
        console.log("Access denied. User role:", userData.role, "Normalized:", userRole);
        alert("Access denied. Super admin privileges required.");
        window.location.href = "index.html";
        return;
    }

    console.log("Super admin access granted for user:", userData.email, "Role:", userData.role);

    loadColleges();
});

// Load all colleges
async function loadColleges() {
    try {
        // Check if colleges collection exists by trying to read it
        const collegesQuery = query(collection(db, "colleges"), orderBy("name"));
        const snapshot = await getDocs(collegesQuery);

        const container = document.getElementById("collegesContainer");

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No colleges found</h3>
                    <p>The colleges collection hasn't been initialized yet.</p>
                    <div style="margin-top: 1rem;">
                        <button onclick="initializeCollegesCollection()" style="background: #28a745; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; margin-right: 1rem;">
                            Initialize Colleges Collection
                        </button>
                        <a href="initialize-colleges.html" style="color: #007bff; text-decoration: none;">
                            Or use the initialization wizard →
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        const colleges = [];
        for (const doc of snapshot.docs) {
            const college = { id: doc.id, ...doc.data() };

            // Get college statistics
            const stats = await getCollegeStats(college.id);
            college.stats = stats;

            colleges.push(college);
        }

        allColleges = colleges;
        renderColleges(colleges);

    } catch (error) {
        console.error("Error loading colleges:", error);
        const container = document.getElementById("collegesContainer");

        if (error.code === 'permission-denied' || error.message.includes('permissions')) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>⚠️ Permission Error</h3>
                    <p>Unable to access colleges collection. This usually means:</p>
                    <ul style="text-align: left; margin: 1rem 0;">
                        <li>Firestore rules haven't been updated</li>
                        <li>Colleges collection doesn't exist yet</li>
                        <li>User doesn't have super admin privileges</li>
                    </ul>
                    <div style="margin-top: 1rem;">
                        <a href="initialize-colleges.html" style="background: #007bff; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; display: inline-block;">
                            Fix Permissions & Initialize
                        </a>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Error loading colleges</h3>
                    <p>Error: ${error.message}</p>
                    <p>Please refresh the page and try again.</p>
                </div>
            `;
        }
    }
}

// Get college statistics
async function getCollegeStats(collegeId) {
    try {
        const [studentsSnap, staffSnap, adminSnap] = await Promise.all([
            getDocs(query(collection(db, "users"), where("collegeId", "==", collegeId), where("role", "==", "student"))),
            getDocs(query(collection(db, "users"), where("collegeId", "==", collegeId), where("role", "in", ["incharge", "hod"]))),
            getDocs(query(collection(db, "users"), where("collegeId", "==", collegeId), where("role", "in", ["admin", "principal"])))
        ]);

        return {
            students: studentsSnap.size,
            staff: staffSnap.size,
            admins: adminSnap.size
        };
    } catch (error) {
        console.error("Error getting college stats:", error);
        return { students: 0, staff: 0, admins: 0 };
    }
}

// Render colleges grid
function renderColleges(colleges) {
    const container = document.getElementById("collegesContainer");

    container.innerHTML = `
        <div class="colleges-grid">
            ${colleges.map(college => `
                <div class="college-card">
                    <div class="college-header">
                        <div class="college-logo">
                            ${college.logo ? `<img src="${college.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : '🏫'}
                        </div>
                        <div class="college-info">
                            <h3>${college.name}</h3>
                            <div class="college-code">${college.code}</div>
                        </div>
                        <span class="status-badge ${college.isActive ? 'status-active' : 'status-inactive'}">
                            ${college.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    
                    <div class="college-stats">
                        <div class="stat">
                            <div class="stat-value">${college.stats.students}</div>
                            <div class="stat-label">Students</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${college.stats.staff}</div>
                            <div class="stat-label">Staff</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${college.stats.admins}</div>
                            <div class="stat-label">Admins</div>
                        </div>
                    </div>
                    
                    <div style="margin: 1rem 0; font-size: 0.875rem; color: #64748b;">
                        <div><strong>Email:</strong> ${college.email || 'Not set'}</div>
                        <div><strong>Phone:</strong> ${college.phone || 'Not set'}</div>
                        ${college.website ? `<div><strong>Website:</strong> <a href="${college.website}" target="_blank" style="color: #3b82f6;">${college.website}</a></div>` : ''}
                        ${college.gpsSettings && (college.gpsSettings.latitude || college.gpsSettings.longitude) ?
            `<div><strong>GPS:</strong> ${college.gpsSettings.latitude || 'N/A'}, ${college.gpsSettings.longitude || 'N/A'} (${college.gpsSettings.radius || 100}m radius)</div>` :
            '<div><strong>GPS:</strong> <span style="color: #ef4444;">Pending college admin setup</span></div>'
        }
                    </div>
                    
                    <div class="college-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editCollege('${college.id}')">
                            Edit
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="viewCollegeDetails('${college.id}')">
                            View Details
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="toggleCollegeStatus('${college.id}', ${!college.isActive})">
                            ${college.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCollege('${college.id}', '${college.name}')">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Open add college modal
window.openAddCollegeModal = function () {
    editingCollegeId = null;
    document.getElementById("modalTitle").textContent = "Add New College";
    document.getElementById("collegeForm").reset();

    // Set default values
    document.getElementById("fnStart").value = "09:00";
    document.getElementById("fnEnd").value = "12:00";
    document.getElementById("anStart").value = "13:00";
    document.getElementById("anEnd").value = "16:00";
    document.getElementById("gpsRadius").value = "100";

    document.getElementById("collegeModal").classList.add("show");
};

// Edit college
window.editCollege = async function (collegeId) {
    try {
        const collegeDoc = await getDoc(doc(db, "colleges", collegeId));
        if (!collegeDoc.exists()) {
            alert("College not found");
            return;
        }

        const college = collegeDoc.data();
        editingCollegeId = collegeId;

        document.getElementById("modalTitle").textContent = "Edit College";
        document.getElementById("collegeName").value = college.name || "";
        document.getElementById("collegeCode").value = college.code || "";
        document.getElementById("collegeEmail").value = college.email || "";
        document.getElementById("collegeAddress").value = college.address || "";
        document.getElementById("collegePhone").value = college.phone || "";
        document.getElementById("collegeWebsite").value = college.website || "";

        // GPS settings
        if (college.gpsSettings) {
            document.getElementById("gpsLatitude").value = college.gpsSettings.latitude || "";
            document.getElementById("gpsLongitude").value = college.gpsSettings.longitude || "";
            document.getElementById("gpsRadius").value = college.gpsSettings.radius || 100;
        }

        // Session timings
        if (college.settings && college.settings.sessionTimings) {
            const timings = college.settings.sessionTimings;
            document.getElementById("fnStart").value = timings.forenoon?.start || "09:00";
            document.getElementById("fnEnd").value = timings.forenoon?.end || "12:00";
            document.getElementById("anStart").value = timings.afternoon?.start || "13:00";
            document.getElementById("anEnd").value = timings.afternoon?.end || "16:00";
        }

        document.getElementById("collegeModal").classList.add("show");

    } catch (error) {
        console.error("Error loading college:", error);
        alert("Error loading college data");
    }
};

// Close modal
window.closeCollegeModal = function () {
    document.getElementById("collegeModal").classList.remove("show");
    editingCollegeId = null;
};

// Handle form submission
document.getElementById("collegeForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const collegeData = {
        name: document.getElementById("collegeName").value.trim(),
        code: document.getElementById("collegeCode").value.trim().toUpperCase(),
        email: document.getElementById("collegeEmail").value.trim(),
        address: document.getElementById("collegeAddress").value.trim(),
        phone: document.getElementById("collegePhone").value.trim(),
        website: document.getElementById("collegeWebsite").value.trim(),
        gpsSettings: {
            latitude: parseFloat(document.getElementById("gpsLatitude").value) || null,
            longitude: parseFloat(document.getElementById("gpsLongitude").value) || null,
            radius: parseInt(document.getElementById("gpsRadius").value) || 100
        },
        settings: {
            timezone: "Asia/Kolkata",
            academicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1).toString().slice(-2),
            workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            sessionTimings: {
                forenoon: {
                    start: document.getElementById("fnStart").value,
                    end: document.getElementById("fnEnd").value
                },
                afternoon: {
                    start: document.getElementById("anStart").value,
                    end: document.getElementById("anEnd").value
                }
            }
        },
        isActive: true,
        updatedAt: serverTimestamp()
    };

    // Validation
    if (!collegeData.name || !collegeData.code || !collegeData.email) {
        alert("Please fill in all required fields");
        return;
    }

    try {
        if (editingCollegeId) {
            // Update existing college
            await updateDoc(doc(db, "colleges", editingCollegeId), collegeData);
            alert("College updated successfully!");
        } else {
            // Check if college code already exists
            const existingQuery = query(collection(db, "colleges"), where("code", "==", collegeData.code));
            const existingSnap = await getDocs(existingQuery);

            if (!existingSnap.empty) {
                alert("College code already exists. Please choose a different code.");
                return;
            }

            // Add new college
            collegeData.createdAt = serverTimestamp();
            await addDoc(collection(db, "colleges"), collegeData);
            alert("College added successfully!");
        }

        closeCollegeModal();
        loadColleges();

    } catch (error) {
        console.error("Error saving college:", error);
        alert("Error saving college. Please try again.");
    }
});

// Delete college
window.deleteCollege = async function (collegeId, collegeName) {
    // Show detailed confirmation dialog
    const confirmMessage = `⚠️ WARNING: This action cannot be undone!\n\n` +
        `You are about to permanently delete "${collegeName}" and ALL associated data:\n\n` +
        `• All users (students, staff, admins) from this college\n` +
        `• All attendance records\n` +
        `• All college settings and configurations\n` +
        `• All related data in the system\n\n` +
        `Type "DELETE" to confirm this permanent action:`;

    const userInput = prompt(confirmMessage);

    if (userInput !== "DELETE") {
        if (userInput !== null) {
            alert("Deletion cancelled. You must type 'DELETE' exactly to confirm.");
        }
        return;
    }

    // Second confirmation
    if (!confirm(`Final confirmation: Delete "${collegeName}" permanently?\n\nThis will remove all data associated with this college.`)) {
        return;
    }

    try {
        // Show loading state
        const deleteButton = event.target;
        const originalText = deleteButton.textContent;
        deleteButton.textContent = "🔄 Deleting...";
        deleteButton.disabled = true;

        // Get all users from this college
        const usersQuery = query(collection(db, "users"), where("collegeId", "==", collegeId));
        const usersSnapshot = await getDocs(usersQuery);

        // Get all attendance records from this college
        const attendanceQuery = query(collection(db, "attendance"), where("collegeId", "==", collegeId));
        const attendanceSnapshot = await getDocs(attendanceQuery);

        // Count what will be deleted
        const userCount = usersSnapshot.size;
        const attendanceCount = attendanceSnapshot.size;

        console.log(`Deleting college "${collegeName}":`, {
            collegeId,
            users: userCount,
            attendanceRecords: attendanceCount
        });

        // Delete all users from this college
        const userDeletions = [];
        usersSnapshot.forEach((doc) => {
            userDeletions.push(deleteDoc(doc.ref));
        });

        // Delete all attendance records from this college
        const attendanceDeletions = [];
        attendanceSnapshot.forEach((doc) => {
            attendanceDeletions.push(deleteDoc(doc.ref));
        });

        // Execute all deletions in parallel
        await Promise.all([
            ...userDeletions,
            ...attendanceDeletions,
            deleteDoc(doc(db, "colleges", collegeId))
        ]);

        alert(`✅ College "${collegeName}" deleted successfully!\n\n` +
            `Removed:\n` +
            `• College record\n` +
            `• ${userCount} users\n` +
            `• ${attendanceCount} attendance records`);

        // Reload the colleges list
        loadColleges();

    } catch (error) {
        console.error("Error deleting college:", error);

        // Restore button state
        if (event.target) {
            event.target.textContent = originalText;
            event.target.disabled = false;
        }

        let errorMessage = "Error deleting college: " + error.message;

        if (error.code === 'permission-denied') {
            errorMessage += "\n\nThis might be due to:\n" +
                "• Insufficient permissions\n" +
                "• Firestore security rules restrictions\n" +
                "• Some data still being referenced elsewhere";
        }

        alert("❌ " + errorMessage);
    }
};

// Toggle college status
window.toggleCollegeStatus = async function (collegeId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this college?`)) {
        return;
    }

    try {
        await updateDoc(doc(db, "colleges", collegeId), {
            isActive: newStatus,
            updatedAt: serverTimestamp()
        });

        alert(`College ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        loadColleges();

    } catch (error) {
        console.error("Error updating college status:", error);
        alert("Error updating college status");
    }
};

// View college details
window.viewCollegeDetails = function (collegeId) {
    // Redirect to college-specific admin dashboard
    window.location.href = `college-admin-dashboard.html?college=${collegeId}`;
};

// Close modal when clicking outside
document.getElementById("collegeModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
        closeCollegeModal();
    }
});

// Get current GPS location (for reference only)
window.getCurrentLocation = function () {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }

    if (!confirm("This will get your current location for reference only. The college admin should provide the exact campus GPS coordinates. Continue?")) {
        return;
    }

    const button = event.target;
    const originalText = button.textContent;
    button.textContent = "🔄 Getting location...";
    button.disabled = true;

    navigator.geolocation.getCurrentPosition(
        function (position) {
            document.getElementById("gpsLatitude").value = position.coords.latitude.toFixed(6);
            document.getElementById("gpsLongitude").value = position.coords.longitude.toFixed(6);

            button.textContent = "✅ Reference location obtained!";
            alert("⚠️ Important: This is your current location for reference only.\n\nPlease verify with the college admin that these coordinates represent the correct campus location for attendance tracking.");

            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 3000);
        },
        function (error) {
            let errorMessage = "Unable to get location: ";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "Location access denied by user.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "Location information unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage += "Location request timed out.";
                    break;
                default:
                    errorMessage += "Unknown error occurred.";
                    break;
            }
            alert(errorMessage + "\n\nPlease ask the college admin to provide the exact campus GPS coordinates.");

            button.textContent = originalText;
            button.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
};
// Initialize colleges collection
window.initializeCollegesCollection = async function () {
    if (!confirm("This will create the initial colleges collection structure. Continue?")) {
        return;
    }

    try {
        // Create default college
        const defaultCollege = {
            name: "Default College",
            code: "DEFAULT",
            email: "admin@defaultcollege.edu",
            address: "Please update this address",
            phone: "+1234567890",
            website: "",
            gpsSettings: {
                latitude: null,
                longitude: null,
                radius: 100
            },
            settings: {
                timezone: "Asia/Kolkata",
                academicYear: "2024-25",
                workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
                sessionTimings: {
                    forenoon: { start: "09:00", end: "12:00" },
                    afternoon: { start: "13:00", end: "16:00" }
                }
            },
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.uid
        };

        // Create the college document
        await setDoc(doc(db, "colleges", "default-college"), defaultCollege);

        alert("✅ Colleges collection initialized successfully!");
        loadColleges(); // Reload the page

    } catch (error) {
        console.error("Error initializing colleges collection:", error);
        alert("❌ Error initializing colleges collection: " + error.message + "\n\nPlease make sure you've updated your Firestore rules first!");
    }
};

// Filter colleges
window.filterColleges = function () {
    const query = document.getElementById("collegeSearch").value.toLowerCase().trim();
    if (!query) {
        renderColleges(allColleges);
        return;
    }

    const filtered = allColleges.filter(c => {
        const name = (c.name || "").toLowerCase();
        const code = (c.code || "").toLowerCase();
        return name.includes(query) || code.includes(query);
    });

    renderColleges(filtered);
};

// Attach search listener
document.getElementById("collegeSearch")?.addEventListener("input", window.filterColleges);