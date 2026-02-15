/**
 * Landing media — load hero and preview images/videos from Firestore (admin uploads).
 * If site_config/landing has URLs, they replace the default assets. No auth required (public read).
 */
(function() {
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.apiKey) return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  var db = firebase.firestore();
  var slots = ["hero", "preview1", "preview2", "preview3"];

  function setSlotsVisible(visible) {
    slots.forEach(function(slot) {
      var wrap = document.querySelector("[data-landing-slot=\"" + slot + "\"]");
      if (!wrap) return;
      wrap.style.visibility = visible ? "" : "hidden";
    });
  }

  // Prevent brief old/default media flash on refresh.
  setSlotsVisible(false);

  db.collection("site_config").doc("landing").get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();

    slots.forEach(function(slot) {
      var item = data[slot];
      if (!item || !item.url) return;
      var wrap = document.querySelector("[data-landing-slot=\"" + slot + "\"]");
      if (!wrap) return;
      if (item.type === "video") {
        var video = document.createElement("video");
        video.src = item.url;
        video.className = slot === "hero" ? "hero-image" : "preview-img";
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.autoplay = true;
        video.setAttribute("playsinline", "");
        wrap.innerHTML = "";
        wrap.appendChild(video);
      } else {
        var img = document.createElement("img");
        img.src = item.url;
        img.className = slot === "hero" ? "hero-image" : "preview-img";
        img.style.objectPosition = "top center";
        img.alt = slot === "hero" ? "Creator" : "Preview";
        wrap.innerHTML = "";
        wrap.appendChild(img);
      }
    });

    var testimonialSection = document.getElementById("testimonial-section");
    if (testimonialSection) {
      var hideTestimonial = data.showTestimonial === false || data.showTestimonial === "false";
      if (hideTestimonial) {
        testimonialSection.style.display = "none";
      } else {
        testimonialSection.style.display = "";
        var textEl = testimonialSection.querySelector("[data-landing-testimonial-text]");
        var attrEl = testimonialSection.querySelector("[data-landing-testimonial-attribution]");
        if (data.testimonialText != null && textEl) textEl.textContent = data.testimonialText;
        if (data.testimonialAttribution != null && attrEl) attrEl.textContent = data.testimonialAttribution;
      }
    }

    var memberCountEl = document.getElementById("member-count-display");
    var showMemberCount = data.showMemberCount === true || data.showMemberCount === "true";
    var memberCount = data.memberCount != null ? Number(data.memberCount) : NaN;
    if (memberCountEl && showMemberCount && !isNaN(memberCount) && memberCount >= 0) {
      memberCountEl.textContent = "Join " + memberCount + " in the circle.";
      memberCountEl.style.display = "block";
    }

    var links = data.socialLinks && typeof data.socialLinks === "object" ? data.socialLinks : {};
    var order = ["instagram", "facebook", "x", "tiktok", "youtube"];
    var iconTpl = { instagram: '<svg viewBox="0 0 24 24" fill="url(#{{id}})" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="{{id}}" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#FED576"/><stop offset="25%" style="stop-color:#F47133"/><stop offset="50%" style="stop-color:#BC3081"/><stop offset="100%" style="stop-color:#4C63D2"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.058 1.645-.07 4.849-.07zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm5.965-10.405a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>', facebook: '<svg viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', x: '<svg viewBox="0 0 24 24" fill="#0F1419" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>', tiktok: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1.05-.08 6.33 6.33 0 00-6.33 6.34 6.33 6.33 0 0010.88 4.41 6.34 6.34 0 00.63-2.56V9.01a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/><path fill="#25F4EE" d="M19.59 2v4.44a4.83 4.83 0 01-1-.1V2z"/><path fill="#25F4EE" d="M15.82 6.44v3.45a2.92 2.92 0 01-2.31-1.74 2.93 2.93 0 01-.88-.13v6.63a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 015.2-1.74v-6.63a2.93 2.93 0 01.88.13 2.89 2.89 0 002.31 1.74z"/><path fill="#FE2C55" d="M12.63 9.4v6.27a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 015.2-1.74V9.4z"/></svg>', youtube: '<svg viewBox="0 0 24 24" fill="#FF0000" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' };

    function renderSocialInto(container, idPrefix) {
      if (!container) return;
      order.forEach(function(key) {
        var item = links[key];
        if (!item || !item.url || (item.show !== true && item.show !== "true")) return;
        var url = item.url.trim();
        if (!url) return;
        var a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.setAttribute("aria-label", key);
        var html = key === "instagram" ? (iconTpl[key] || "").replace(/\{\{id\}\}/g, idPrefix + "-ig") : (iconTpl[key] || "");
        a.innerHTML = html;
        container.appendChild(a);
      });
    }

    renderSocialInto(document.getElementById("hero-social-links"), "hero");
    renderSocialInto(document.getElementById("social-links"), "footer");
  }).catch(function() {})
    .finally(function() {
      setSlotsVisible(true);
    });
})();
