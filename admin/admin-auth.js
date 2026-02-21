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
  var ADMIN_HEADER_CACHE_KEY = "admin_header_avatar_cache_v1";

  // Temporary: these emails can always access admin (match login allowlist)
  var ALLOWED_ADMIN_EMAILS = ["will_jackson@icloud.com", "stormijxo@gmail.com"];

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

  function computeInitial(displayName, email) {
    var name = (displayName || "").toString().trim();
    if (name) return name.charAt(0).toUpperCase();
    var em = (email || "").toString().trim();
    return em ? em.charAt(0).toUpperCase() : "?";
  }

  function readAvatarCache() {
    try {
      var raw = localStorage.getItem(ADMIN_HEADER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeAvatarCache(user) {
    try {
      localStorage.setItem(ADMIN_HEADER_CACHE_KEY, JSON.stringify({
        displayName: user && user.displayName ? user.displayName : "",
        email: user && user.email ? user.email : "",
        photoURL: user && user.photoURL ? user.photoURL : ""
      }));
    } catch (e) {}
  }

  function renderAdminAvatar(displayName, email, photoURL) {
    var btn = document.getElementById("admin-profile-btn");
    if (!btn) return;
    var initial = computeInitial(displayName, email);
    if (photoURL) {
      var safeUrl = String(photoURL).replace(/"/g, "&quot;");
      btn.innerHTML = "<img src=\"" + safeUrl + "\" alt=\"\" onerror=\"this.parentElement.innerHTML='<span id=\\'admin-profile-avatar\\' class=\\'profile-btn-default\\'>" + initial + "</span>'\" />";
    } else {
      btn.innerHTML = "<span id='admin-profile-avatar' class='profile-btn-default'>" + initial + "</span>";
    }
  }

  window.applyAdminHeaderAvatar = function(user) {
    if (!user) return;
    renderAdminAvatar(user.displayName, user.email, user.photoURL);
    writeAvatarCache(user);
  };

  window.hydrateAdminHeaderAvatar = function() {
    var cache = readAvatarCache();
    if (!cache) return;
    renderAdminAvatar(cache.displayName, cache.email, cache.photoURL);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.hydrateAdminHeaderAvatar);
  } else {
    window.hydrateAdminHeaderAvatar();
  }

  window.ensureAdminAccess = function(callback) {
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        window.location.href = "/";
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
