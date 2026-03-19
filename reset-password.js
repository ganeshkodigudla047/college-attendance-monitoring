import { auth } from "./firebase.js";
import {
  confirmPasswordReset,
  verifyPasswordResetCode
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/* ================= DOM ================= */
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const resetBtn = document.getElementById("resetBtn");
const status = document.getElementById("status");

/* ================= URL PARAMETERS ================= */
const urlParams = new URLSearchParams(window.location.search);
const oobCode = urlParams.get('oobCode'); // Firebase reset code
const mode = urlParams.get('mode'); // Should be 'resetPassword'

// Check if we have the required parameters
if (!oobCode || mode !== 'resetPassword') {
  status.innerText = "Invalid or expired reset link. Please request a new password reset.";
  status.style.color = "#ef4444";
  resetBtn.disabled = true;
} else {
  // Verify the reset code is valid
  verifyPasswordResetCode(auth, oobCode)
    .then((email) => {
      status.innerText = `Resetting password for: ${email}`;
      status.style.color = "#10b981";
    })
    .catch((error) => {
      status.innerText = "Invalid or expired reset link. Please request a new password reset.";
      status.style.color = "#ef4444";
      resetBtn.disabled = true;
    });
}

/* ================= PASSWORD RESET ================= */
// Add support for pressing Enter to reset
function handleEnter(e) {
  if (e.key === "Enter") {
    resetBtn.click();
  }
}
newPasswordInput.addEventListener("keydown", handleEnter);
confirmPasswordInput.addEventListener("keydown", handleEnter);

resetBtn.onclick = async () => {
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validation
  if (!newPassword) {
    status.innerText = "Please enter a new password";
    status.style.color = "#ef4444";
    return;
  }

  if (newPassword.length < 6) {
    status.innerText = "Password must be at least 6 characters long";
    status.style.color = "#ef4444";
    return;
  }

  if (newPassword !== confirmPassword) {
    status.innerText = "Passwords do not match";
    status.style.color = "#ef4444";
    return;
  }

  try {
    resetBtn.disabled = true;
    resetBtn.innerText = "Resetting...";
    status.innerText = "";

    // Reset the password
    await confirmPasswordReset(auth, oobCode, newPassword);

    status.innerText = "✅ Password reset successfully! You can now login with your new password.";
    status.style.color = "#10b981";

    // Clear inputs
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";

    // Redirect to login after 3 seconds
    setTimeout(() => {
      window.location.href = "login.html";
    }, 3000);

  } catch (error) {
    let errorMessage = "Failed to reset password. Please try again.";
    
    switch (error.code) {
      case "auth/expired-action-code":
        errorMessage = "Reset link has expired. Please request a new password reset.";
        break;
      case "auth/invalid-action-code":
        errorMessage = "Invalid reset link. Please request a new password reset.";
        break;
      case "auth/weak-password":
        errorMessage = "Password is too weak. Please choose a stronger password.";
        break;
    }

    status.innerText = errorMessage;
    status.style.color = "#ef4444";
    resetBtn.disabled = false;
    resetBtn.innerText = "Reset Password";
  }
};