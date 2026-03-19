import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// MediaPipe ESM Import
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";


/* ================= PROTOCOL CHECK ================= */
if (window.location.protocol === "file:") {
  alert("WARNING: Firebase Auth may not work with 'file://' protocol. Please use a local server (e.g., VS Code Live Server).");
}

/* ================= TOKEN VALIDATION ================= */

let validatedToken = null;
let validatedEmail = null;
let validatedRole = null;
let validatedCollegeId = null;
let validatedCollegeName = null;

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const tokenStatus = document.getElementById("tokenStatus");

async function validateToken() {
  if (!token) {
    return; // No token, proceed with normal registration
  }

  try {
    // Fetch invitation directly by ID (token is the document ID)
    const inviteDocRef = doc(db, "adminInvites", token);
    const inviteDocSnapshot = await getDoc(inviteDocRef);

    if (!inviteDocSnapshot.exists()) {
      tokenStatus.innerText = "❌ Invalid invitation link";
      tokenStatus.style.color = "#dc2626";
      disableRegistration();
      return;
    }

    const invite = inviteDocSnapshot.data();

    // Check if already used
    if (invite.used) {
      tokenStatus.innerText = "❌ This invitation has already been used";
      tokenStatus.style.color = "#dc2626";
      disableRegistration();
      return;
    }

    // Check if expired
    const expiresAt = invite.expiresAt.toDate();
    const now = new Date();

    if (expiresAt < now) {
      tokenStatus.innerText = "❌ This invitation has expired";
      tokenStatus.style.color = "#dc2626";
      disableRegistration();
      return;
    }

    // Valid token
    validatedToken = token;
    validatedEmail = invite.email;
    validatedRole = invite.role;
    validatedCollegeId = invite.collegeId; // NEW: College context
    validatedCollegeName = invite.collegeName;

    tokenStatus.innerText = `✓ Valid invitation for ${invite.role.toUpperCase()} at ${invite.collegeName || 'College'}`;
    tokenStatus.style.color = "#059669";

    // Pre-fill email and set role
    email.value = validatedEmail;
    email.disabled = true;

    // Override role from localStorage with token role
    localStorage.setItem("userRole", validatedRole);
    localStorage.setItem("collegeId", validatedCollegeId); // Store college context

    // Update the global role variable and UI
    role = validatedRole;
    document.getElementById("roleBadge").innerText = validatedRole.toUpperCase() + " REGISTRATION";

  } catch (error) {
    console.error("Token validation error:", error);
    tokenStatus.innerText = "❌ Error validating invitation";
    tokenStatus.style.color = "#dc2626";
    disableRegistration();
  }
}

function disableRegistration() {
  registerBtn.disabled = true;
  registerBtn.style.opacity = "0.5";
  registerBtn.style.cursor = "not-allowed";
}

// Validate token on page load
if (token) {
  validateToken();
}

/* ================= ROLE ================= */

let role = localStorage.getItem("userRole");
const passwordToggles = document.querySelectorAll(".password-toggle");

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

// If no role but we have a token, allow the page to load and let token validation handle it
if (!role && !token) {
  window.location.href = "index.html";
  throw new Error("Role not selected");
}

// Set role badge if we have a role (token validation will update this later if needed)
if (role) {
  document.getElementById("roleBadge").innerText = role.toUpperCase() + " REGISTRATION";
} else if (token) {
  // Show loading state while validating token
  document.getElementById("roleBadge").innerText = "VALIDATING INVITATION...";
}


/* ================= ELEMENTS ================= */

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");

const email = document.getElementById("email");
const password = document.getElementById("password");

const registerBtn = document.getElementById("registerBtn");
const continueBtn = document.getElementById("continueBtn");

const photo = document.getElementById("photo");
const preview = document.getElementById("preview");

const name = document.getElementById("name");
const phone = document.getElementById("phone");

// College selection elements
const collegeSelection = document.getElementById("collegeSelection");
const collegeSelect = document.getElementById("collegeSelect");
const collegeErr = document.getElementById("collegeErr");

const studentFields = document.getElementById("studentFields");
const staffFields = document.getElementById("staffFields");
const adminFields = document.getElementById("adminFields");

const studentId = document.getElementById("studentId");
const studentDept = document.getElementById("studentDept");
const year = document.getElementById("year");
const studentHodId = document.getElementById("studentHodId");
const inchargeId = document.getElementById("inchargeId");

const staffId = document.getElementById("staffId");
const staffDept = document.getElementById("staffDept");
const staffHodId = document.getElementById("staffHodId");

const adminCollegeName = document.getElementById("adminCollegeName");
const adminStaffId = document.getElementById("adminStaffId");

const submitBtn = document.getElementById("submitBtn");

const msg = document.getElementById("msg");

const nameErr = document.getElementById("nameErr");
const phoneErr = document.getElementById("phoneErr");

// Face Capture
const faceCaptureSection = document.getElementById("faceCaptureSection");
const video = document.getElementById("video");
const faceMsg = document.getElementById("faceMsg");
const captureBtn = document.getElementById("captureBtn");
const captureFeedback = document.getElementById("captureFeedback");

let faceDescriptor = null;
let stream = null;


/* ================= INITIAL ================= */

function setupRoleBasedFields() {
  // Hide all role-specific fields initially
  step2.classList.add("hidden");
  continueBtn.classList.add("hidden");
  studentFields.classList.add("hidden");
  staffFields.classList.add("hidden");
  adminFields.classList.add("hidden");

  // Show fields based on role
  if (role === "student") {
    studentFields.classList.remove("hidden");
    faceCaptureSection.classList.remove("hidden");
    loadFaceModels(); // Preload for students
    // Hide sequential fields initially
    studentDept.style.display = "none";
    year.style.display = "none";
    studentHodId.style.display = "none";
    inchargeId.style.display = "none";
  }

  if (role === "incharge") {
    staffFields.classList.remove("hidden");
    staffHodId.classList.remove("hidden");
    staffHodId.options[0].textContent = "Select HOD (Mandatory)";
    // Hide sequential
    staffDept.style.display = "none";
    staffHodId.style.display = "none";
  }

  if (role === "hod") {
    staffFields.classList.remove("hidden");
    staffHodId.classList.add("hidden");
    // Show department for HOD
    staffDept.style.display = "block";
  }

  if (role === "admin" || role === "principal" || role === "superadmin") {
    adminFields.classList.remove("hidden");
  }

  // Load colleges and show selection if no token
  // Super Admin doesn't need college selection
  if (!validatedToken && role !== "superadmin") {
    loadColleges();
    collegeSelection.classList.remove("hidden");
  } else if (role === "superadmin") {
    // Hide college selection for super admin
    collegeSelection.classList.add("hidden");
  }
  updateAdminCollegeField();
}

// Setup fields immediately if we have a role, or wait for token validation
if (role) {
  setupRoleBasedFields();
} else if (token) {
  // Initial setup for token-based registration
  step2.classList.add("hidden");
  continueBtn.classList.add("hidden");
  studentFields.classList.add("hidden");
  staffFields.classList.add("hidden");
  adminFields.classList.add("hidden");

  // Wait for token validation to complete, then setup fields
  validateToken().then(() => {
    if (validatedRole) {
      role = validatedRole;
      setupRoleBasedFields();
    }
  });
} else {
  // No role and no token - this shouldn't happen due to earlier check
  setupRoleBasedFields();
}

/* ================= COLLEGE LOADING ================= */

let collegesCache = [];

function updateAdminCollegeField() {
  if (!adminCollegeName) return;
  if (role === "superadmin") {
    adminCollegeName.value = "System Admin";
    return;
  }
  if (validatedCollegeName) {
    adminCollegeName.value = validatedCollegeName;
    return;
  }
  if (collegeSelect && collegeSelect.value) {
    const selectedCollege = collegesCache.find(college => college.id === collegeSelect.value);
    adminCollegeName.value = selectedCollege ? selectedCollege.name : "";
    return;
  }
  adminCollegeName.value = "";
}

async function loadColleges() {
  try {
    const collegesQuery = query(
      collection(db, "colleges"),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(collegesQuery);

    collegesCache = [];
    snapshot.forEach(doc => {
      collegesCache.push({ id: doc.id, ...doc.data() });
    });

    const colleges = [...collegesCache];

    // Sort in memory to avoid needing a composite index
    colleges.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    collegeSelect.innerHTML = '<option value="" disabled selected>Select College/Institution</option>';

    colleges.forEach(college => {
      const option = document.createElement("option");
      option.value = college.id;
      option.textContent = `${college.name} (${college.code || "N/A"})`;
      collegeSelect.appendChild(option);
    });

    updateAdminCollegeField();

  } catch (error) {
    console.error("Error loading colleges:", error);
    collegeSelect.innerHTML = '<option value="" disabled>Error loading colleges</option>';
    updateAdminCollegeField();
  }
}

// Global listeners for context changes
if (collegeSelect) {
  collegeSelect.addEventListener("change", () => {
    const selectedCollegeId = collegeSelect.value;
    updateAdminCollegeField();
    if (role === "student") {
      studentDept.style.display = "block";
    } else if (role === "incharge") {
      staffDept.style.display = "block";
    }
    checkForm();
  });
}

if (studentDept) {
  studentDept.addEventListener("change", () => {
    const selectedCollegeId = collegeSelect.value;
    const selectedDept = studentDept.value;
    if (selectedCollegeId && selectedDept) {
      year.style.display = "block";
      studentHodId.style.display = "block";
      loadHodsByCollegeAndDept(selectedCollegeId, selectedDept, studentHodId);
    }
    checkForm();
  });
}

if (staffDept) {
  staffDept.addEventListener("change", () => {
    const selectedCollegeId = collegeSelect.value;
    const selectedDept = staffDept.value;
    if (selectedCollegeId && selectedDept) {
      staffHodId.style.display = "block";
      loadHodsByCollegeAndDept(selectedCollegeId, selectedDept, staffHodId);
    }
    checkForm();
  });
}

if (studentHodId) {
  studentHodId.addEventListener("change", () => {
    const selectedHodId = studentHodId.value;
    if (role === "student" && selectedHodId) {
      inchargeId.style.display = "block";
      loadInchargesUnderHod(selectedHodId, inchargeId);
    }
    checkForm();
  });
}

if (staffHodId) {
  staffHodId.addEventListener("change", checkForm);
}

async function getCollegeName(collegeId) {
  if (!collegeId) return "Unknown College";

  try {
    const collegeDoc = await getDoc(doc(db, "colleges", collegeId));
    return collegeDoc.exists() ? collegeDoc.data().name : "Unknown College";
  } catch (error) {
    console.error("Error getting college name:", error);
    return "Unknown College";
  }
}


/* ================= STEP 1 REGISTER ================= */

registerBtn.onclick = async () => {

  if (!email.value || !password.value) {

    msg.innerText = "Enter email and password";

    return;

  }

  try {

    const cred =
      await createUserWithEmailAndPassword(
        auth,
        email.value.trim(),
        password.value
      );

    try {
      await sendEmailVerification(cred.user);
      msg.innerText = "Verification email sent. Verify and click Continue.";
    } catch (emailErr) {
      if (emailErr.code === "auth/too-many-requests") {
        msg.innerText = "Account created! Too many email requests. Please wait 15 minutes or login directly.";
      } else {
        msg.innerText = "Account created! Verification email may be delayed. You can login now.";
      }
      console.warn("Email verification error:", emailErr);
    }

    continueBtn.classList.remove("hidden");

  }
  catch (err) {
    if (err.code === "auth/email-already-in-use") {
      msg.innerText = "Account exists. Signing in...";
      try {
        const cred = await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
        checkUserProfile(cred.user, true); // Pass true to auto-resend if not verified
      } catch (signInErr) {
        if (signInErr.code === "auth/network-request-failed") {
          msg.innerText = "Network Error! Check your internet, disable VPN or Ad-blockers, and try again.";
        } else {
          msg.innerText = "Account exists. Please use the correct password.";
        }
      }
    } else if (err.code === "auth/network-request-failed") {
      msg.innerText = "Network Error! Check your internet, disable VPN or Ad-blockers, and try again.";
    } else {
      console.error("Registration Error (Full Object):", err);
      msg.innerText = err.message || "An error occurred during registration.";
    }
  }

};

async function checkUserProfile(user, autoResend = false) {
  if (!user.emailVerified) {
    if (autoResend) {
      try {
        await sendEmailVerification(user);
        msg.innerText = "Verification email resent. Check your inbox and click Continue.";
      } catch (emailErr) {
        if (emailErr.code === "auth/too-many-requests") {
          msg.innerText = "Too many requests. Please wait 15 minutes before requesting another verification email.";
        } else {
          msg.innerText = "Could not send verification email. You can try again later or contact support.";
        }
        console.warn("Email verification error:", emailErr);
      }
    } else {
      msg.innerText = "Email not verified. Check your inbox or click Register again to resend.";
    }
    continueBtn.classList.remove("hidden");
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (snap.exists() && snap.data().profileCompleted) {
    msg.innerText = "Registration complete. Redirecting to login...";
    setTimeout(() => window.location.href = "login.html", 2000);
  } else {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    if (role === "student") startCamera();
  }
}


/* ================= CONTINUE ================= */

continueBtn.onclick = async () => {

  const user = auth.currentUser;

  if (!user) {

    alert("Session expired");

    return;

  }

  await user.reload();
  await user.getIdToken(true);

  if (!user.emailVerified) {
    alert("Email still not verified. Please check your inbox.");
    return;
  }

  // Use the common check logic to proceed
  checkUserProfile(user);
};


/* ================= PHOTO PREVIEW ================= */

const uploadHint = document.getElementById("uploadHint");

photo.onchange = () => {

  const file = photo.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {

    preview.src = reader.result;

    preview.style.display = "block";
    uploadHint.style.display = "none";

  };

  reader.readAsDataURL(file);

  checkForm();

};


/* ================= VALIDATION ================= */

name.oninput = checkForm;

phone.oninput = () => {

  phone.value =
    phone.value.replace(/\D/g, "").slice(0, 10);

  if (phone.value.length !== 10 && phone.value.length > 0) {
    phoneErr.classList.remove("hidden");
  } else {
    phoneErr.classList.add("hidden");
  }

  checkForm();

};

if (studentId) studentId.oninput = checkForm;

if (year) year.onchange = checkForm;

if (inchargeId) inchargeId.onchange = checkForm;

if (staffId) staffId.oninput = checkForm;

if (staffDept) staffDept.onchange = checkForm;

if (studentHodId) studentHodId.onchange = checkForm;
if (staffHodId) staffHodId.onchange = checkForm;

if (adminStaffId) adminStaffId.oninput = checkForm;

// College selection validation
if (collegeSelect) collegeSelect.onchange = checkForm;


function checkForm() {

  let valid = true;

  if (!name.value.trim()) {
    valid = false;
    // nameErr.classList.remove("hidden"); // Only show on submit attempt or blur if desired
  } else {
    nameErr.classList.add("hidden");
  }

  if (phone.value.length !== 10) valid = false;

  if (!photo.files.length) valid = false;

  // College validation (only if no token and not super admin)
  if (!validatedToken && role !== "superadmin" && !collegeSelect.value) {
    valid = false;
    collegeErr.classList.remove("hidden");
  } else {
    collegeErr.classList.add("hidden");
  }

  if (role === "student") {

    if (
      !studentId.value ||
      !studentDept.value ||
      !year.value ||
      !studentHodId.value ||
      !inchargeId.value ||
      (role === "student" && !faceDescriptor)
    ) valid = false;

  }


  if (role === "incharge" || role === "hod") {
    if (!staffId.value || !staffDept.value) {
      valid = false;
    }
    // HOD selection is mandatory only for Incharges
    if (role === "incharge" && !staffHodId.value) {
      valid = false;
    }
  }


  if (role === "admin" || role === "principal" || role === "superadmin") {

    if (!adminStaffId.value)
      valid = false;

  }

  submitBtn.disabled = !valid;

}


/* ================= LOAD INCHARGES ================= */

async function loadStaffByRole(targetRole, dept, targetSelect, targetCollegeId) {
  if (!dept || !targetSelect) return;

  const currentCollegeId = targetCollegeId || validatedCollegeId || collegeSelect.value;
  if (!currentCollegeId) {
    targetSelect.innerHTML = `<option value="" disabled selected>Please select a college first</option>`;
    return;
  }

  if (!auth.currentUser) {
    targetSelect.innerHTML = `<option value="" disabled selected>Sign in first to load list</option>`;
    return;
  }

  targetSelect.innerHTML = `<option value="" disabled selected>Loading ${targetRole}s...</option>`;

  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", targetRole),
      where("collegeId", "==", currentCollegeId)
    );
    const snap = await getDocs(q);

    targetSelect.innerHTML = `<option value="" disabled selected>Select ${targetRole === 'hod' ? 'HOD' : 'Incharge'}</option>`;
    let found = false;

    snap.forEach(d => {
      const u = d.data();
      // Filter department and approval
      if (u.department === dept && u.approved === true) {
        targetSelect.innerHTML += `<option value="${d.id}">${u.name}</option>`;
        found = true;
      }
    });

    if (!found) {
      targetSelect.innerHTML = `<option value="" disabled selected>No approved ${targetRole}s found in ${dept} at this college</option>`;
    }

  } catch (error) {
    console.error(`Error loading ${targetRole}s:`, error);
    targetSelect.innerHTML = `<option value="" disabled selected>Error loading list</option>`;
  }
}

async function loadHodsByCollegeAndDept(collegeId, dept, targetSelect) {
  await loadStaffByRole("hod", dept, targetSelect, collegeId);
}

async function loadInchargesUnderHod(hodId, targetSelect) {
  if (!hodId || !targetSelect) return;

  const currentCollegeId = validatedCollegeId || collegeSelect.value;
  if (!currentCollegeId) {
    targetSelect.innerHTML = `<option value="" disabled selected>Please select a college first</option>`;
    return;
  }

  if (!auth.currentUser) {
    targetSelect.innerHTML = `<option value="" disabled selected>Sign in first to load list</option>`;
    return;
  }

  targetSelect.innerHTML = `<option value="" disabled selected>Loading incharges...</option>`;

  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "incharge"),
      where("hodId", "==", hodId),
      where("collegeId", "==", currentCollegeId)
    );
    const snap = await getDocs(q);

    targetSelect.innerHTML = `<option value="" disabled selected>Select Incharge</option>`;
    let found = false;

    snap.forEach(d => {
      const u = d.data();
      if (u.approved === true) {
        targetSelect.innerHTML += `<option value="${d.id}">${u.name}</option>`;
        found = true;
      }
    });

    if (!found) {
      targetSelect.innerHTML = `<option value="" disabled selected>No approved incharges found under this HOD</option>`;
    }

  } catch (error) {
    console.error("Error loading incharges under HOD:", error);
    targetSelect.innerHTML = `<option value="" disabled selected>Error loading list</option>`;
  }
}

if (staffDept) {
  staffDept.addEventListener("change", () => {
    if (role === "incharge") {
      loadStaffByRole("hod", staffDept.value, staffHodId);
    }
    checkForm();
  });
}


/* ================= FACE CAPTURE LOGIC (MediaPipe) ================= */

let faceLandmarker;

async function loadFaceModels() {
  faceMsg.innerText = "Loading MediaPipe AI...";
  console.log("Initializing MediaPipe Face Landmarker...");

  try {
    // Check for Secure Context (required for MediaPipe WASM)
    if (!window.isSecureContext && location.protocol !== 'file:') {
      console.warn("MediaPipe may fail in insecure contexts. Use HTTPS or localhost.");
    }

    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU"
      },
      outputFaceBlendshapes: true,
      runningMode: "VIDEO",
      numFaces: 1
    });

    console.log("MediaPipe initialized successfully.");
    faceMsg.innerText = "Position your face in the frame";
  } catch (err) {
    console.error("MediaPipe Loading Failed:", err);
    faceMsg.innerText = `Error: ${err.message || "Failed to load AI"}`;
    if (err.message.includes("fetch") || err.message.includes("wasm")) {
      faceMsg.innerHTML = "Error: WASM Load Failed.<br><small>Use VS Code Live Server (127.0.0.1)</small>";
    }
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    video.play();
  } catch (err) {
    console.error("Camera Error:", err);
    faceMsg.innerText = "Camera Access Denied";
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

captureBtn.onclick = async () => {
  if (!video.srcObject || !faceLandmarker) return;

  faceMsg.innerText = "Capturing Face Mesh...";
  captureBtn.disabled = true;

  try {
    const result = await faceLandmarker.detectForVideo(video, performance.now());

    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      faceMsg.innerText = "No face detected. Try again.";
      captureBtn.disabled = false;
      return;
    }

    // Save the 478 landmarks (x, y, z) as a flat array
    const landmarks = result.faceLandmarks[0];
    faceDescriptor = landmarks.flatMap(l => [l.x, l.y, l.z]);

    // UI Feedback
    captureFeedback.classList.remove("hidden");
    faceMsg.innerText = "Face Mesh Registered ✓";

    stopCamera();
    video.classList.add("hidden");
    checkForm();

  } catch (err) {
    console.error("MediaPipe Capture Error:", err);
    faceMsg.innerText = "Error during capture";
    captureBtn.disabled = false;
  }
};


/* ================= FINAL SUBMIT ================= */

submitBtn.onclick = async () => {

  const user = auth.currentUser;

  if (!user) {

    alert("Session expired");

    return;

  }

  await user.reload();

  await user.getIdToken(true);

  if (!user.emailVerified) {

    alert("Verify email first");

    return;

  }


  let data = {

    uid: user.uid,

    email: user.email,

    role: role,

    name: name.value.trim(),

    phone: phone.value,

    // College information (super admin doesn't belong to any college)
    collegeId: role === "superadmin" ? null : (validatedCollegeId || collegeSelect.value),
    collegeName: role === "superadmin" ? "System Admin" : (validatedCollegeName || (collegeSelect.selectedIndex >= 0 ? collegeSelect.options[collegeSelect.selectedIndex].text.split(' (')[0] : "Unknown College")),
    collegeCode: role === "superadmin" ? null : (collegesCache.find(c => c.id === (validatedCollegeId || collegeSelect.value))?.code || null),

    // ADMIN AUTO APPROVED
    approved: (role === "admin" || role === "superadmin") ? true : false,

    profileCompleted: true,

    photoURL: preview.src || "",

    createdAt: serverTimestamp()

  };


  if (role === "student") {

    data.studentId = studentId.value;

    data.department = studentDept.value;

    data.year = year.value;

    data.hodId = studentHodId.value;

    data.inchargeId = inchargeId.value;

    data.faceDescriptor = faceDescriptor;

  }


  if (role === "incharge" || role === "hod") {

    data.staffId = staffId.value;

    data.department = staffDept.value;

    data.hodId = staffHodId.value || null;

  }


  if (role === "admin" || role === "principal" || role === "superadmin") {

    data.staffId = adminStaffId.value;

  }


  try {

    await setDoc(
      doc(db, "users", user.uid),
      data
    );

    // Mark invite as used if token was validated
    if (validatedToken) {
      // Token is the document ID in adminInvites collection
      const inviteDocRef = doc(db, "adminInvites", validatedToken);
      await updateDoc(inviteDocRef, {
          used: true,
          usedAt: serverTimestamp(),
          usedBy: user.uid
      });
    }

    if (role === "admin" || role === "superadmin") {

      alert("Admin registration successful");

      window.location.href = "college-admin-dashboard.html";

    } else {

      alert("Registration complete. Wait for approval.");

      window.location.href = "login.html";

    }

  }
  catch (err) {

    alert(err.message);

    console.error(err);

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
        // Background is set — apply glass effect to container
        document.documentElement.style.setProperty('--body-bg', 'transparent');
        document.documentElement.style.setProperty('--container-bg', 'rgba(255,255,255,0.12)');
        document.documentElement.style.setProperty('--container-border', 'rgba(255,255,255,0.25)');
        document.documentElement.style.setProperty('--container-blur', 'blur(20px)');
        // Ensure text is visible over background
        document.documentElement.style.setProperty('--container-text', '#ffffff');
        document.documentElement.style.setProperty('--container-input-bg', 'rgba(255,255,255,0.15)');
        document.documentElement.style.setProperty('--container-input-border', 'rgba(255,255,255,0.4)');
        document.documentElement.style.setProperty('--container-input-color', '#ffffff');
    } catch (e) { console.warn('Platform background:', e); }
})();
