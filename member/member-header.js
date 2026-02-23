/**
 * Member header: profile avatar (link to profile) and menu dropdown.
 * Call initMemberHeader(user) after auth.
 * Admin button is shown only for allowed admin emails.
 */
var ADMIN_EMAILS = ["will_jackson@icloud.com", "stormij.xo@gmail.com"];
var MEMBER_HEADER_CACHE_KEY = "member_header_cache_v1";

function setAdminLinkVisible(adminLink, isVisible) {
  if (!adminLink) return;
  adminLink.style.visibility = isVisible ? "visible" : "hidden";
  adminLink.style.pointerEvents = isVisible ? "auto" : "none";
}

function computeUserInitials(user) {
  var initials = "";
  if (user && user.displayName && user.displayName.trim()) {
    var parts = user.displayName.trim().split(/\s+/);
    initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0][0] || "").toUpperCase();
  } else if (user && user.email && user.email.trim()) {
    initials = user.email.trim()[0].toUpperCase();
  }
  return initials && /[A-Z0-9]/i.test(initials) ? initials.slice(0, 2) : "";
}

function readHeaderCache() {
  try {
    var raw = localStorage.getItem(MEMBER_HEADER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeHeaderCache(cache) {
  try {
    var prev = readHeaderCache() || {};
    localStorage.setItem(MEMBER_HEADER_CACHE_KEY, JSON.stringify({
      email: cache && cache.email ? cache.email : (prev.email || ""),
      displayName: cache && cache.displayName ? cache.displayName : (prev.displayName || ""),
      // Preserve last known photo so transient profile reads don't reintroduce initials flash
      photoURL: cache && cache.photoURL ? cache.photoURL : (prev.photoURL || ""),
      initials: cache && cache.initials ? cache.initials : (prev.initials || "")
    }));
  } catch (e) {}
}

function showHeaderInitials(imgEl, initEl, initials) {
  if (initEl) {
    initEl.textContent = initials || "?";
    initEl.style.display = "flex";
  }
  if (imgEl) imgEl.style.display = "none";
}

function showHeaderAvatar(imgEl, initEl, photoURL, displayName, initials) {
  if (!imgEl || !photoURL) {
    showHeaderInitials(imgEl, initEl, initials);
    return;
  }
  imgEl.onerror = function() {
    showHeaderInitials(imgEl, initEl, initials);
  };
  imgEl.src = photoURL;
  imgEl.alt = (displayName || "User") + " photo";
  imgEl.style.display = "block";
  if (initEl) initEl.style.display = "none";
}

function applyCachedMemberHeader() {
  var imgEl = document.getElementById("header-avatar-img");
  var initEl = document.getElementById("header-avatar-initials");
  var adminLink = document.getElementById("header-admin-link");
  var cache = readHeaderCache();
  if (!cache) return;

  setAdminLinkVisible(adminLink, ADMIN_EMAILS.indexOf((cache.email || "").toLowerCase()) !== -1);

  if (cache.photoURL) {
    showHeaderAvatar(imgEl, initEl, cache.photoURL, cache.displayName, cache.initials);
  } else if (cache.initials && initEl) {
    showHeaderInitials(imgEl, initEl, cache.initials);
  }
}

function initMemberHeader(user) {
  var imgEl = document.getElementById("header-avatar-img");
  var initEl = document.getElementById("header-avatar-initials");
  var wrapEl = document.getElementById("profile-avatar-wrap");
  var dropEl = document.getElementById("profile-dropdown");
  var adminLink = document.getElementById("header-admin-link");

  if (!wrapEl || !dropEl) return;

  var email = (user && (user.email || user.emailAddress)) ? (user.email || user.emailAddress).trim().toLowerCase() : "";
  setAdminLinkVisible(adminLink, ADMIN_EMAILS.indexOf(email) !== -1);

  var cached = readHeaderCache() || {};
  var cachedPhoto = cached.photoURL || "";
  var effectivePhoto = (user && user.photoURL) ? user.photoURL : cachedPhoto;
  var effectiveDisplayName = (user && user.displayName) ? user.displayName : (cached.displayName || "");
  var effectiveInitials = computeUserInitials(user) || (cached.initials || "");

  if (effectivePhoto) {
    showHeaderAvatar(imgEl, initEl, effectivePhoto, effectiveDisplayName, effectiveInitials);
  } else if (initEl && user) {
    var initials = computeUserInitials(user);
    if (initials && /[A-Z0-9]/i.test(initials)) {
      showHeaderInitials(imgEl, initEl, initials.slice(0, 2));
    }
  }

  if (!wrapEl.dataset.listener) {
    wrapEl.dataset.listener = "1";
    wrapEl.addEventListener("click", function(e) {
      e.stopPropagation();
      var open = dropEl.classList.toggle("open");
      wrapEl.setAttribute("aria-expanded", open);
    });
    document.addEventListener("click", function() {
      dropEl.classList.remove("open");
      wrapEl.setAttribute("aria-expanded", "false");
    });
  }

  writeHeaderCache({
    email: email,
    displayName: effectiveDisplayName,
    photoURL: effectivePhoto,
    initials: effectiveInitials
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyCachedMemberHeader);
} else {
  applyCachedMemberHeader();
}
