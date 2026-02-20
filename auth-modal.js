/**
 * Auth modal — EchoFlux-style signup/login popup
 * Password requirements turn green when met. Terms checkbox. Confirm password.
 */
(function() {
  var overlay = document.getElementById("auth-modal-overlay");
  if (!overlay) return;

  function openModal(tab) {
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    switchTab(tab || "signup");
  }

  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    document.getElementById("auth-modal-error").classList.remove("visible");
  }

  function switchTab(tab) {
    document.querySelectorAll(".auth-modal-tab").forEach(function(t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".auth-modal-panel").forEach(function(p) {
      p.classList.toggle("active", p.getAttribute("data-panel") === tab);
    });
    var title = document.getElementById("auth-modal-title");
    var sub = document.querySelector(".auth-modal-title .subtitle");
    if (tab === "signup") {
      if (title) title.textContent = "Create your account";
      if (sub) sub.textContent = "Start using Inner Circle.";
    } else {
      if (title) title.textContent = "Welcome back";
      if (sub) sub.textContent = "Log in to Inner Circle.";
    }
    document.getElementById("auth-modal-error").textContent = "";
    document.getElementById("auth-modal-error").classList.remove("visible");
  }

  function showError(msg) {
    var el = document.getElementById("auth-modal-error");
    el.textContent = msg || "";
    el.classList.toggle("visible", !!msg);
  }

  // Password requirements
  var requirements = [
    { id: "len", test: function(p) { return p.length >= 8; }, label: "At least 8 characters" },
    { id: "lower", test: function(p) { return /[a-z]/.test(p); }, label: "One lowercase letter" },
    { id: "upper", test: function(p) { return /[A-Z]/.test(p); }, label: "One uppercase letter" },
    { id: "num", test: function(p) { return /\d/.test(p); }, label: "One number" }
  ];

  function updatePasswordReqs() {
    var pw = (document.getElementById("auth-signup-password") || {}).value || "";
    requirements.forEach(function(r, i) {
      var li = document.getElementById("auth-req-" + r.id);
      if (!li) return;
      if (r.test(pw)) li.classList.add("met");
      else li.classList.remove("met");
    });
  }

  overlay.querySelector(".auth-modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
  });

  document.querySelectorAll(".auth-modal-tab").forEach(function(btn) {
    btn.addEventListener("click", function() {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  document.querySelectorAll("[data-open-auth-signup]").forEach(function(el) {
    el.addEventListener("click", function(e) {
      e.preventDefault();
      openModal("signup");
    });
  });
  document.querySelectorAll("[data-open-auth-login]").forEach(function(el) {
    el.addEventListener("click", function(e) {
      e.preventDefault();
      openModal("login");
    });
  });

  var pwInput = document.getElementById("auth-signup-password");
  var pwReqsBox = document.getElementById("auth-password-reqs");
  if (pwInput && pwReqsBox) {
    function showPwReqs() {
      pwReqsBox.classList.add("visible");
      updatePasswordReqs();
    }
    function hidePwReqs() {
      if (!pwInput.value) pwReqsBox.classList.remove("visible");
    }
    pwInput.addEventListener("input", function() {
      if (pwInput.value) showPwReqs();
      else hidePwReqs();
    });
    pwInput.addEventListener("focus", showPwReqs);
    pwInput.addEventListener("blur", hidePwReqs);
  }

  if (typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    document.getElementById("auth-signup-form").addEventListener("submit", function(e) {
      e.preventDefault();
      showError("Firebase is not configured. Add firebase-config.js with your project config.");
    });
    document.getElementById("auth-login-form").addEventListener("submit", function(e) {
      e.preventDefault();
      showError("Firebase is not configured.");
    });
    return;
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();

  auth.onAuthStateChanged(function(user) {
    if (user) {
      closeModal();
      window.location.href = "member/profile.html";
    }
  });

  function checkUsernameAvailable(username) {
    var u = (username || "").trim().toLowerCase();
    if (!u) return Promise.resolve(false);
    return db.collection("usernames").doc(u).get().then(function(snap) {
      return !snap.exists;
    });
  }

  function createUserProfile(uid, email, displayName, username) {
    var u = (username || "").trim().toLowerCase();
    if (!u) return Promise.reject(new Error("Username is required."));
    var userRef = db.collection("users").doc(uid);
    var usernameRef = db.collection("usernames").doc(u);
    return db.runTransaction(function(transaction) {
      return transaction.get(usernameRef).then(function(snap) {
        if (snap.exists) {
          throw new Error("Username already in use.");
        }
        transaction.set(usernameRef, { uid: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        transaction.set(userRef, {
          email: email || null,
          displayName: displayName || null,
          username: u,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    });
  }

  var usernameInput = document.getElementById("auth-signup-username");
  if (usernameInput) {
    usernameInput.addEventListener("input", function() {
      var err = document.getElementById("auth-modal-error");
      if (err && err.textContent === "Username already in use.") showError("");
    });
    usernameInput.addEventListener("blur", function() {
      var u = usernameInput.value.trim();
      if (!u || typeof db === "undefined") return;
      checkUsernameAvailable(u).then(function(available) {
        if (!available && u) showError("Username already in use.");
      }).catch(function() {});
    });
  }

  document.getElementById("auth-signup-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var name = document.getElementById("auth-signup-name").value.trim();
    var username = document.getElementById("auth-signup-username").value.trim();
    var email = document.getElementById("auth-signup-email").value.trim();
    var password = document.getElementById("auth-signup-password").value;
    var confirm = document.getElementById("auth-signup-confirm").value;
    var agree = document.getElementById("auth-signup-terms").checked;

    showError("");
    if (!agree) {
      showError("You must agree to the Terms and Privacy Policy.");
      return;
    }
    if (password !== confirm) {
      showError("Passwords do not match.");
      return;
    }
    var allMet = requirements.every(function(r) { return r.test(password); });
    if (!allMet) {
      showError("Password does not meet all requirements.");
      return;
    }

    checkUsernameAvailable(username).then(function(available) {
      if (!available) {
        showError("Username already in use.");
        return;
      }
      auth.createUserWithEmailAndPassword(email, password)
        .then(function(cred) {
          return cred.user.updateProfile({ displayName: name }).then(function() { return cred.user; });
        })
        .then(function(user) {
          return createUserProfile(user.uid, user.email, name, username).then(function() { return user; });
        })
        .then(function() {
          window.location.href = "member/profile.html";
        })
        .catch(function(err) {
          showError(err.message || "Sign up failed.");
        });
    }).catch(function() {});
  });

  document.getElementById("auth-login-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var email = document.getElementById("auth-login-email").value.trim();
    var password = document.getElementById("auth-login-password").value;
    showError("");
    auth.signInWithEmailAndPassword(email, password)
      .then(function() {
        window.location.href = "member/profile.html";
      })
      .catch(function(err) {
        showError(err.message || "Log in failed.");
      });
  });

  document.getElementById("auth-signup-google").addEventListener("click", function() {
    var agree = document.getElementById("auth-signup-terms").checked;
    if (!agree) {
      showError("You must agree to the Terms and Privacy Policy.");
      return;
    }
    var provider = new firebase.auth.GoogleAuthProvider();
    showError("");
    auth.signInWithPopup(provider)
      .then(function(result) {
        var user = result.user;
        var displayName = user.displayName || "";
        var base = (user.displayName || "").replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
        var username = base || "user";
        return checkUsernameAvailable(username).then(function(available) {
          if (!available) username = "user_" + user.uid.slice(0, 10);
          return createUserProfile(user.uid, user.email, displayName, username).then(function() { return user; });
        });
      })
      .then(function() {
        window.location.href = "member/profile.html";
      })
      .catch(function(err) {
        showError(err.message || "Sign in with Google failed.");
      });
  });

  document.getElementById("auth-login-google").addEventListener("click", function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    showError("");
    auth.signInWithPopup(provider)
      .then(function(result) {
        var user = result.user;
        var userRef = db.collection("users").doc(user.uid);
        return userRef.get().then(function(doc) {
          if (!doc.exists) {
            var base = (user.displayName || "").replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
            var username = base || "user";
            return checkUsernameAvailable(username).then(function(available) {
              if (!available) username = "user_" + user.uid.slice(0, 10);
              return createUserProfile(user.uid, user.email, user.displayName || null, username);
            });
          }
        });
      })
      .then(function() {
        window.location.href = "member/profile.html";
      })
      .catch(function(err) {
        showError(err.message || "Sign in with Google failed.");
      });
  });

  document.querySelectorAll(".auth-modal-form .btn-show").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var inp = document.getElementById(btn.getAttribute("aria-controls"));
      if (!inp) return;
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
    });
  });
})();
