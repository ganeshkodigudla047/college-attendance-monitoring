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
    updateDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let collegeData = null;

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    currentUser = user;
    
    try {
        // Get user data
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            showError("User profile not found. Please contact support.");
            return;
        }
        
        currentUserData = userDoc.data();
        const userRole = (currentUserData.role || "").toLowerCase();
        
        // Check if user is college admin or principal (not super admin)
        if (!["admin", "principal"].includes(userRole)) {
            showError("Access denied. College admin or principal privileges required.");
            return;
        }
        
        // Check if user has a college assigned
        if (!currentUserData.collegeId) {
            showError("No college assigned to your account. Please contact super admin.");
            return;
        }
        
        console.log("College admin access granted for:", currentUserData.email, "College:", currentUserData.collegeId);
        
        // Load college data
        await loadCollegeSettings();
        
    } catch (error) {
        console.error("Error during initialization:", error);
        showError("Error loading user data: " + error.message);
    }
});

// Load college settings
async function loadCollegeSettings() {
    try {
        // Get college data
        const collegeDoc = await getDoc(doc(db, "colleges", currentUserData.collegeId));
        if (!collegeDoc.exists()) {
            showError("College not found. Please contact super admin.");
            return;
        }
        
        collegeData = { id: collegeDoc.id, ...collegeDoc.data() };
        
        // Populate form
        populateForm();
        
        // Show the settings form
        document.getElementById("loadingMessage").style.display = "none";
        document.getElementById("collegeSettings").style.display = "block";
        
    } catch (error) {
        console.error("Error loading college settings:", error);
        showError("Error loading college settings: " + error.message);
    }
}

// Populate form with college data
function populateForm() {
    // Update header display
    document.getElementById("collegeDisplayName").textContent = collegeData.name || "College Name";
    document.getElementById("collegeDisplayCode").textContent = collegeData.code || "CODE";
    
    // Populate form fields
    document.getElementById("collegeName").value = collegeData.name || "";
    document.getElementById("collegeCode").value = collegeData.code || "";
    document.getElementById("collegeEmail").value = collegeData.email || "";
    document.getElementById("collegeAddress").value = collegeData.address || "";
    document.getElementById("collegePhone").value = collegeData.phone || "";
    document.getElementById("collegeWebsite").value = collegeData.website || "";
    
    // GPS settings
    if (collegeData.gpsSettings) {
        document.getElementById("gpsLatitude").value = collegeData.gpsSettings.latitude || "";
        document.getElementById("gpsLongitude").value = collegeData.gpsSettings.longitude || "";
        document.getElementById("gpsRadius").value = collegeData.gpsSettings.radius || 100;
    }
    
    // Session timings
    if (collegeData.settings && collegeData.settings.sessionTimings) {
        const timings = collegeData.settings.sessionTimings;
        document.getElementById("fnStart").value = timings.forenoon?.start || "09:00";
        document.getElementById("fnEnd").value = timings.forenoon?.end || "12:00";
        document.getElementById("anStart").value = timings.afternoon?.start || "13:00";
        document.getElementById("anEnd").value = timings.afternoon?.end || "16:00";
    }
}

// Handle form submission
document.getElementById("collegeSettingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Validate GPS coordinates
    const latitude = parseFloat(document.getElementById("gpsLatitude").value);
    const longitude = parseFloat(document.getElementById("gpsLongitude").value);
    
    if (!latitude || !longitude) {
        alert("GPS coordinates are required for attendance tracking. Please provide valid latitude and longitude.");
        return;
    }
    
    if (latitude < -90 || latitude > 90) {
        alert("Invalid latitude. Must be between -90 and 90.");
        return;
    }
    
    if (longitude < -180 || longitude > 180) {
        alert("Invalid longitude. Must be between -180 and 180.");
        return;
    }
    
    const updatedData = {
        name: document.getElementById("collegeName").value.trim(),
        email: document.getElementById("collegeEmail").value.trim(),
        address: document.getElementById("collegeAddress").value.trim(),
        phone: document.getElementById("collegePhone").value.trim(),
        website: document.getElementById("collegeWebsite").value.trim(),
        gpsSettings: {
            latitude: latitude,
            longitude: longitude,
            radius: parseInt(document.getElementById("gpsRadius").value) || 100
        },
        settings: {
            ...collegeData.settings,
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
        updatedAt: serverTimestamp(),
        lastUpdatedBy: currentUser.uid
    };
    
    // Validation
    if (!updatedData.name || !updatedData.email) {
        alert("College name and email are required.");
        return;
    }
    
    try {
        // Update college document
        await updateDoc(doc(db, "colleges", currentUserData.collegeId), updatedData);
        
        // Show success message
        showSuccess("✅ College settings updated successfully!");
        
        // Update local data
        collegeData = { ...collegeData, ...updatedData };
        
        // Update header display
        document.getElementById("collegeDisplayName").textContent = updatedData.name;
        
    } catch (error) {
        console.error("Error updating college settings:", error);
        alert("❌ Error updating college settings: " + error.message);
    }
});

// Reset form to original values
window.resetForm = function() {
    if (confirm("Are you sure you want to reset all changes?")) {
        populateForm();
        showSuccess("Form reset to original values.");
    }
};

// Show error message
function showError(message) {
    document.getElementById("loadingMessage").style.display = "none";
    document.getElementById("collegeSettings").style.display = "none";
    document.getElementById("errorMessage").style.display = "block";
    document.getElementById("errorText").textContent = message;
}

// Show success message
function showSuccess(message) {
    // Remove any existing success messages
    const existingSuccess = document.querySelector('.success-message');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    // Create and show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    const form = document.getElementById('collegeSettingsForm');
    form.parentNode.insertBefore(successDiv, form);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 5000);
}

// Validate coordinates in real-time
document.getElementById("gpsLatitude").addEventListener("input", function() {
    const value = parseFloat(this.value);
    if (value && (value < -90 || value > 90)) {
        this.style.borderColor = "#ef4444";
        this.title = "Latitude must be between -90 and 90";
    } else {
        this.style.borderColor = "#d1d5db";
        this.title = "";
    }
});

document.getElementById("gpsLongitude").addEventListener("input", function() {
    const value = parseFloat(this.value);
    if (value && (value < -180 || value > 180)) {
        this.style.borderColor = "#ef4444";
        this.title = "Longitude must be between -180 and 180";
    } else {
        this.style.borderColor = "#d1d5db";
        this.title = "";
    }
});