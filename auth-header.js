/**
 * Updates the header auth link based on Firebase Auth state.
 * Requires: Firebase (app + auth) and FIREBASE_CONFIG loaded before this script.
 */
(function() {
  var link = document.getElementById("header-auth-link");
  if (!link) return;
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined" ||
      !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  var auth = firebase.auth();
  auth.onAuthStateChanged(function(user) {
    if (user) {
      link.href = "admin/dashboard.html";
      link.textContent = "Dashboard";
    } else {
      link.href = "admin/login.html";
      link.textContent = "Log in";
    }
  });
})();
