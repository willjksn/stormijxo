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
      var path = (window.location.pathname || "").replace(/^\//, "");
      var isLanding = !path || path === "index.html" || path.endsWith("/index.html");
      if (isLanding) {
        var hash = (window.location.hash || "").toLowerCase();
        var viewLanding = hash.indexOf("view=landing") !== -1;
        if (!viewLanding) {
          window.location.replace("member/feed.html");
          return;
        }
      }
      link.href = "member/profile.html";
      link.textContent = "Profile";
    } else {
      link.href = "login.html";
      link.textContent = "Log in";
    }
  });
})();
