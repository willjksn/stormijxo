/**
 * Admin access: only users in admin_users with role "admin" can access admin pages.
 * Bootstrap: if zero admin_users docs have role "admin", allow first authenticated user.
 */
(function() {
  if (typeof window.ensureAdminAccess === "function") return;
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.apiKey) {
    window.ensureAdminAccess = function(cb) { if (cb) cb(null, null); };
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();

  // Temporary: these emails can always access admin (match login allowlist)
  var ALLOWED_ADMIN_EMAILS = ["will_jackson@icloud.com", "stormij.xo@gmail.com"];

  function checkIsAdmin(userEmail) {
    var emailNorm = (userEmail || "").trim().toLowerCase();
    if (ALLOWED_ADMIN_EMAILS.indexOf(emailNorm) !== -1) return Promise.resolve(true);
    return db.collection("admin_users")
      .where("email", "==", userEmail)
      .where("role", "==", "admin")
      .limit(1)
      .get()
      .then(function(snap) { return !snap.empty; });
  }

  function countAdmins() {
    return db.collection("admin_users")
      .where("role", "==", "admin")
      .limit(1)
      .get()
      .then(function(snap) { return snap.size; });
  }

  window.ensureAdminAccess = function(callback) {
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      var emailNorm = (user.email || "").trim().toLowerCase();
      if (ALLOWED_ADMIN_EMAILS.indexOf(emailNorm) !== -1) {
        if (callback) callback(user, { bootstrap: true });
        return;
      }
      countAdmins().then(function(adminCount) {
        if (adminCount === 0) {
          if (callback) callback(user, { bootstrap: true });
          return;
        }
        checkIsAdmin(user.email).then(function(isAdmin) {
          if (isAdmin && callback) callback(user, { bootstrap: false });
          else {
            auth.signOut();
            window.location.href = "login.html?reason=noaccess";
          }
        }).catch(function() {
          window.location.href = "login.html?reason=error";
        });
      }).catch(function() {
        window.location.href = "login.html?reason=error";
      });
    });
  };
})();
