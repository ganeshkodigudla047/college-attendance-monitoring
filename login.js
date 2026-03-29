import { auth, db } from "./firebase.js";
import { loadPageAd } from "./ad-loader.js";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ================= BACK REDIRECT ================= */
// Prevents back navigation from login page, redirecting instead to index
history.pushState(null, null, window.location.href);
window.onpopstate = () => {
  window.location.replace("index.html?skipIntro=1");
};

/* ================= DOM ================= */
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const status = document.getElementById("status");
const passwordToggles = document.querySelectorAll(".password-toggle");

// Forgot Password Elements
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const forgotPasswordModal = document.getElementById("forgotPasswordModal");
const closeModal = document.querySelector(".close");
const resetEmailInput = document.getElementById("resetEmail");
const sendResetBtn = document.getElementById("sendResetBtn");
const resetStatus = document.getElementById("resetStatus");

// Login attempt tracking
let loginAttempts = parseInt(sessionStorage.getItem('loginAttempts') || '0');
const maxAttempts = 3;

function redirectToRoleSelection(message, email = "") {
  if (message) {
    sessionStorage.setItem("registrationPromptMessage", message);
  } else {
    sessionStorage.removeItem("registrationPromptMessage");
  }
  if (email) {
    sessionStorage.setItem("userEmail", email);
  }
  window.location.href = "index.html?register=1#roleSelection";
}

async function promptRegistrationForUnauthorizedUser(message, email = "") {
  status.innerText = message;
  status.style.color = "#dc2626";
  const shouldRegister = confirm(`${message}\n\nDo you want to register now?`);
  if (shouldRegister) {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn("Sign out before registration redirect failed", err);
    }
    redirectToRoleSelection("", email);
  }
}

async function hasRegisteredUserProfile(email) {
  if (!email) return false;
  try {
    const usersQuery = query(collection(db, "users"), where("email", "==", email));
    const usersSnap = await getDocs(usersQuery);
    return !usersSnap.empty;
  } catch (err) {
    console.warn("Failed to check registered user profile", err);
    return false;
  }
}

// Check if forgot password should be shown on page load
window.addEventListener('DOMContentLoaded', () => {
  if (loginAttempts >= maxAttempts) {
    enableForgotPassword();
  }
});

/* ================= LOGIN ================= */
// Add support for pressing Enter to login
function handleEnter(e) {
  if (e.key === "Enter") {
    loginBtn.click();
  }
}
emailInput.addEventListener("keydown", handleEnter);
passwordInput.addEventListener("keydown", handleEnter);

passwordToggles.forEach((toggleBtn) => {
  toggleBtn.onclick = () => {
    const targetId = toggleBtn.dataset.target;
    const targetInput = document.getElementById(targetId);
    if (!targetInput) return;
    const isPassword = targetInput.type === "password";
    targetInput.type = isPassword ? "text" : "password";
    toggleBtn.innerText = isPassword ? "🙈" : "👁";
    toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  };
});

loginBtn.onclick = async () => {
  status.innerText = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    alert("Please fill in your Email.");
    return;
  }

  if (!password) {
    alert("Please fill in your Password.");
    return;
  }

  // Show loading screen
  const redirectLoading = document.getElementById('redirectLoading');
  
  try {
    /* AUTHENTICATE */
    const cred = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    /* FETCH USER DATA */
    const userRef = doc(db, "users", cred.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // User has valid credentials but no profile - need to determine registration path
      status.innerText = "Your account is not authorized yet. Please complete your registration.";
      status.style.color = "#f59e0b";
      
      // Check if there's an admin/staff invite for this email
      try {
        const invitesRef = collection(db, "adminInvites");
        const inviteQuery = query(
          invitesRef,
          where("email", "==", cred.user.email),
          where("used", "==", false)
        );
        const inviteSnap = await getDocs(inviteQuery);
        
        if (!inviteSnap.empty) {
          // Found an invitation - redirect to registration with token
          const inviteDoc = inviteSnap.docs[0];
          const inviteData = inviteDoc.data();
          const token = inviteDoc.id;
          const role = inviteData.role || "admin";
          
          // Check if invite is still valid (not expired)
          const expiresAt = inviteData.expiresAt.toDate();
          const now = new Date();
          
          if (expiresAt > now) {
            // Display role-specific message
            const roleDisplay = role === "superadmin" ? "Super Admin" : 
                               role === "admin" ? "College Admin" :
                               role === "principal" ? "Principal" :
                               role === "hod" ? "HOD" :
                               role === "incharge" ? "Incharge" : role;
            
            status.innerText = `Redirecting to ${roleDisplay} registration...`;
            setTimeout(() => {
              // Redirect to registration page with token
              window.location.href = `register.html?token=${token}`;
            }, 1500);
            return;
          } else {
            status.innerText = "Your invitation has expired. Please request a new one.";
            status.style.color = "#dc2626";
            await signOut(auth);
            return;
          }
        }
      } catch (inviteErr) {
        console.warn("Could not check for invitations:", inviteErr);
      }
      
      // No invitation found - ask the user to register through role selection
      const normalizedEmail = cred.user.email.toLowerCase();
      
      // Check for privileged roles that require invitations
      if (normalizedEmail.includes("superadmin") || normalizedEmail.includes("super-admin")) {
        status.innerText = "Super Admin accounts require an invitation. Please contact the system administrator.";
        status.style.color = "#dc2626";
        await signOut(auth);
        return;
      } else if (normalizedEmail.includes("admin") || normalizedEmail.includes("principal")) {
        status.innerText = "Admin accounts require an invitation. Please contact your administrator.";
        status.style.color = "#dc2626";
        await signOut(auth);
        return;
      }

      await promptRegistrationForUnauthorizedUser(
        "Unauthorized user detected. Your login exists, but registration is not completed.",
        cred.user.email
      );
      return;
    }

    const user = snap.data();

    /* APPROVAL CHECK */
    if (!user.approved) {
      await signOut(auth);
      status.innerText = "Account not approved yet";
      handleFailedLogin();
      return;
    }

    // Reset login attempts on successful login
    resetLoginAttempts();

    /* ROLE-BASED REDIRECT WITH LOADING SCREEN */
    const userRole = (user.role || "").toLowerCase();
    
    // Show loading screen before redirect
    if (redirectLoading) {
      redirectLoading.classList.remove('hidden');
    }
    
    // Debug logging
    console.log("User role from database:", user.role);
    console.log("Normalized role:", userRole);
    console.log("User approved:", user.approved);
    console.log("Profile completed:", user.profileCompleted);
    
    // Small delay to show loading screen
    setTimeout(() => {
      switch (userRole) {
        case "student":
          window.location.href = "student-dashboard.html?v=20260315b";
          break;

        case "incharge":
        case "hod":
          window.location.href = "staff-dashboard.html";
          break;

        case "admin":
        case "principal":
          window.location.href = "college-admin-dashboard.html";
          break;

        case "superadmin":
          window.location.href = "super-admin-dashboard.html";
          break;

        default:
          console.error("Unrecognized role:", user.role, "Normalized:", userRole);
          // Hide loading and handle error
          if (redirectLoading) {
            redirectLoading.classList.add('hidden');
          }
          signOut(auth).then(() => {
            promptRegistrationForUnauthorizedUser(
              `Unauthorized user role detected: "${user.role}". Please register again with the correct role.`,
              email
            );
          });
          handleFailedLogin();
      }
    }, 500); // 500ms delay to show loading screen

  } catch (err) {
    // Hide loading on error
    const redirectLoading = document.getElementById('redirectLoading');
    if (redirectLoading) {
      redirectLoading.classList.add('hidden');
    }
    
    if (err.code === "auth/user-not-found") {
      await promptRegistrationForUnauthorizedUser(
        "Unauthorized user detected. No approved account was found for this login.",
        email
      );
    } else if (err.code === "auth/invalid-credential") {
      const hasProfile = await hasRegisteredUserProfile(email);
      if (hasProfile) {
        status.innerText = "Invalid email or password.";
        status.style.color = "#dc2626";
      } else {
        await promptRegistrationForUnauthorizedUser(
          "Unauthorized user detected. This email is not registered in the system yet.",
          email
        );
      }
    } else {
      status.innerText = err.message;
    }
    handleFailedLogin();
  }
};

/* ================= LOGIN ATTEMPT TRACKING ================= */
function handleFailedLogin() {
  loginAttempts++;
  sessionStorage.setItem('loginAttempts', loginAttempts.toString());
  
  if (loginAttempts >= maxAttempts) {
    enableForgotPassword();
  }
}

function enableForgotPassword() {
  // Show and enable forgot password option
  const forgotSection = document.querySelector('.forgot-password-section');
  if (forgotSection) {
    forgotSection.style.display = 'block';
  }
  
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.classList.remove('disabled');
  }
}

function showForgotPassword() {
  const forgotSection = document.querySelector('.forgot-password-section');
  if (forgotSection) {
    forgotSection.style.display = 'block';
  }
}

function hideForgotPassword() {
  const forgotSection = document.querySelector('.forgot-password-section');
  if (forgotSection) {
    forgotSection.style.display = 'none';
  }
}

function resetLoginAttempts() {
  loginAttempts = 0;
  sessionStorage.removeItem('loginAttempts');
  hideForgotPassword();
}

/* ================= FORGOT PASSWORD ================= */
// Show forgot password modal
forgotPasswordLink.onclick = (e) => {
  e.preventDefault();
  
  // Check if link is disabled
  if (forgotPasswordLink.classList.contains('disabled')) {
    return;
  }
  
  forgotPasswordModal.style.display = "block";
  resetEmailInput.value = emailInput.value; // Pre-fill with login email if available
  resetStatus.innerText = "";
};

// Close modal when clicking X
closeModal.onclick = () => {
  forgotPasswordModal.style.display = "none";
};

// Close modal when clicking outside
window.onclick = (e) => {
  if (e.target === forgotPasswordModal) {
    forgotPasswordModal.style.display = "none";
  }
};

// Handle Enter key in reset email input
resetEmailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendResetBtn.click();
  }
});

// Send password reset email
sendResetBtn.onclick = async () => {
  const email = resetEmailInput.value.trim();
  
  if (!email) {
    resetStatus.innerText = "Please enter your email address";
    resetStatus.className = "error";
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    resetStatus.innerText = "Please enter a valid email address";
    resetStatus.className = "error";
    return;
  }

  try {
    sendResetBtn.disabled = true;
    sendResetBtn.innerText = "Sending...";
    resetStatus.innerText = "";

    // Send reset email regardless of whether user exists (security best practice)
    await sendPasswordResetEmail(auth, email);
    
    resetStatus.innerText = "Password reset email sent! Check your inbox and spam folder.";
    resetStatus.className = "success";
    
    // Clear the input and close modal after delay
    setTimeout(() => {
      forgotPasswordModal.style.display = "none";
      resetEmailInput.value = "";
      resetStatus.innerText = "";
      resetStatus.className = "";
    }, 3000);

  } catch (err) {
    let errorMessage = "Failed to send reset email. Please try again.";
    
    // Handle specific Firebase errors
    switch (err.code) {
      case "auth/user-not-found":
        errorMessage = "No account found with this email address.";
        break;
      case "auth/invalid-email":
        errorMessage = "Invalid email address format.";
        break;
      case "auth/too-many-requests":
        errorMessage = "Too many requests. Please wait before trying again.";
        break;
      case "auth/network-request-failed":
        errorMessage = "Network error. Please check your connection.";
        break;
    }
    
    resetStatus.innerText = errorMessage;
    resetStatus.className = "error";
  } finally {
    sendResetBtn.disabled = false;
    sendResetBtn.innerText = "Send Reset Link";
  }
};

/* ================= PLATFORM BACKGROUND ================= */
(async function applyPlatformBackground() {
    try {
        const snap = await getDoc(doc(db, "system", "platformSettings"));
        // No background set — leave default white container as-is
        if (!snap.exists()) return;
        const { bgUrl, bgType } = snap.data();
        if (!bgUrl) return;

        if (bgType === 'video') {
            const vid = document.createElement('video');
            vid.src = bgUrl; vid.autoplay = true; vid.muted = true;
            vid.loop = true; vid.playsInline = true;
            Object.assign(vid.style, {
                position:'fixed', inset:'0', width:'100%', height:'100%',
                objectFit:'cover', zIndex:'-1', pointerEvents:'none'
            });
            document.body.prepend(vid);
        } else {
            document.body.style.backgroundImage = `url("${bgUrl}")`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        }
        // Background is set — make container fully transparent
        document.documentElement.style.setProperty('--body-bg', 'transparent');
        document.documentElement.style.setProperty('--container-bg', 'transparent');
        document.documentElement.style.setProperty('--container-blur', 'none');
        // Ensure text is visible over background
        document.documentElement.style.setProperty('--container-text', '#ffffff');
        document.documentElement.style.setProperty('--container-input-bg', 'rgba(255,255,255,0.15)');
        document.documentElement.style.setProperty('--container-input-border', 'rgba(255,255,255,0.4)');
        document.documentElement.style.setProperty('--container-input-color', '#ffffff');
        document.documentElement.style.setProperty('--container-placeholder', 'rgba(255,255,255,0.55)');
    } catch (e) { console.warn('Platform background:', e); }
})();


// Load advertisement
loadPageAd();
