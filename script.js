(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const header = $(".site-header");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = $(".menu-toggle");
  const mobileNav = $(".nav-mobile");
  if (toggle && mobileNav) {
    const toggleMenu = () => {
      const open = !mobileNav.classList.contains("active");
      mobileNav.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", toggleMenu);
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileNav.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  const track = $("#hits-track");
  $$("[data-carousel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!track) return;
      const dir = Number(btn.getAttribute("data-carousel"));
      track.scrollBy({ left: dir * 300, behavior: prefersReduced ? "auto" : "smooth" });
    });
  });

  $$(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      $$("[data-cat]").forEach((card) => {
        card.style.display = filter === "all" || card.dataset.cat === filter ? "" : "none";
      });
    });
  });

  const hash = location.hash.replace("#", "");
  if (hash) {
    const match = $(`.filter-btn[data-filter="${hash}"]`);
    if (match) match.click();
  }

  document.addEventListener("nv-catalog", () => {
    const active = document.querySelector(".filter-btn.active");
    if (active) active.click();
  });

  const videoEl = $(".hero-video-element");
  const poster = $(".hero-video-poster");
  const syncHeroMedia = () => {
    if (!videoEl) return;
    const isMobile = window.innerWidth < 700;
    if (isMobile || prefersReduced) {
      try { videoEl.pause(); } catch (e) { /* ignore */ }
      videoEl.style.display = "none";
      if (poster) poster.style.zIndex = "2";
    } else {
      videoEl.style.display = "";
      if (poster) poster.style.zIndex = "0";
      try { videoEl.play(); } catch (e) { /* ignore autoplay */ }
    }
  };
  syncHeroMedia();
  window.addEventListener("resize", syncHeroMedia, { passive: true });
})();
