// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
  anchor.addEventListener("click", function (e) {
    var target = document.querySelector(this.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// Scroll reveal: add .visible when section is in view
function initReveal() {
  var reveals = document.querySelectorAll(".reveal");
  function checkReveal() {
    reveals.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      var windowHeight = window.innerHeight;
      if (top < windowHeight - 80) {
        el.classList.add("visible");
      }
    });
  }
  window.addEventListener("scroll", checkReveal);
  window.addEventListener("resize", checkReveal);
  checkReveal(); // run once on load
}

initReveal();

// FAQ accordion: one open at a time
var faqList = document.querySelector(".faq-accordion");
if (faqList) {
  faqList.querySelectorAll(".faq-question").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var isOpen = btn.getAttribute("aria-expanded") === "true";
      faqList.querySelectorAll(".faq-question").forEach(function (b) {
        b.setAttribute("aria-expanded", "false");
      });
      btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    });
  });
}
