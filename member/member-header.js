/**
 * Member header: profile avatar (link to profile) and menu dropdown.
 * Call initMemberHeader(user) after auth.
 * Admin button is shown only for allowed admin emails.
 */
var ADMIN_EMAILS = ["will_jackson@icloud.com", "stormijxo@gmail.com"];

function initMemberHeader(user) {
  var imgEl = document.getElementById("header-avatar-img");
  var initEl = document.getElementById("header-avatar-initials");
  var wrapEl = document.getElementById("profile-avatar-wrap");
  var dropEl = document.getElementById("profile-dropdown");
  var adminLink = document.getElementById("header-admin-link");

  if (!wrapEl || !dropEl) return;

  var email = (user && (user.email || user.emailAddress)) ? (user.email || user.emailAddress).trim().toLowerCase() : "";
  if (adminLink && ADMIN_EMAILS.indexOf(email) !== -1) {
    adminLink.style.display = "";
  }

  if (user.photoURL && imgEl) {
    imgEl.src = user.photoURL;
    imgEl.alt = (user.displayName || "User") + " photo";
    imgEl.style.display = "block";
    if (initEl) initEl.style.display = "none";
  } else if (initEl) {
    var initials = "?";
    if (user.displayName) {
      var parts = user.displayName.trim().split(/\s+/);
      initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0][0] || "?").toUpperCase();
    } else if (user.email) {
      initials = user.email[0].toUpperCase();
    }
    initEl.textContent = initials.slice(0, 2);
    initEl.style.display = "flex";
    if (imgEl) imgEl.style.display = "none";
  }

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
