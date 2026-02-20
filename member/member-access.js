/**
 * Member access control: require auth + active member.
 * Call ensureMemberAccess(callback) after Firebase init. callback(user, memberDoc).
 * Redirects to login if not authenticated; shows renewal prompt if not active member.
 */
function ensureMemberAccess(callback) {
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.apiKey) {
    if (callback) callback(null, null);
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  var auth = firebase.auth();
  var db = firebase.firestore();

  auth.onAuthStateChanged(function(user) {
    if (!user) {
      var path = (window.location.pathname || "").replace(/^\//, "") || "member/feed.html";
      window.location.href = "../login.html?redirect=" + encodeURIComponent(path);
      return;
    }
    if (callback) callback(user, null);
  });
}

function showRenewal(user) {
  var wrap = document.getElementById("member-renewal-wrap");
  if (wrap) {
    wrap.style.display = "block";
    wrap.querySelector(".member-renewal-msg").textContent =
      "Your subscription has expired or is not active. Renew to access the member area.";
    var btn = wrap.querySelector(".member-renewal-btn");
    if (btn) btn.href = "/#subscribe";
    var main = document.querySelector("main.member-main");
    if (main) main.style.display = "none";
  } else {
    document.body.innerHTML =
      "<main style='max-width:480px;margin:4rem auto;padding:2rem;text-align:center'>" +
      "<h1>Subscription required</h1>" +
      "<p>Your subscription has expired or is not active. <a href='/index.html#subscribe'>Renew here</a> to access the member area.</p>" +
      "<p><a href='../index.html' class='btn btn-primary'>Back to home</a></p>" +
      "<p style='margin-top:1.5rem'><a href='profile.html'>Go to profile</a></p></main>";
  }
}
