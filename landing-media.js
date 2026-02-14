/**
 * Landing media — load hero and preview images/videos from Firestore (admin uploads).
 * If site_config/landing has URLs, they replace the default assets. No auth required (public read).
 */
(function() {
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG.apiKey) return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  var db = firebase.firestore();

  db.collection("site_config").doc("landing").get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();

    var slots = ["hero", "preview1", "preview2", "preview3"];
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
      memberCountEl.textContent = "Join " + memberCount + "+ in the circle.";
      memberCountEl.style.display = "block";
    }
  }).catch(function() {});
})();
