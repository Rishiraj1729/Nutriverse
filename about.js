gsap.registerPlugin(ScrollTrigger);

/* HERO REVEAL */
gsap.from(".hero-inner h1", {
  y: 80,
  opacity: 0,
  duration: 1,
  ease: "power3.out"
});

gsap.from(".hero-inner p", {
  y: 40,
  opacity: 0,
  delay: 0.2,
  duration: 1,
  ease: "power3.out"
});

/* STORY SECTION */
gsap.from(".story-left h2", {
  scrollTrigger: {
    trigger: ".about-story",
    start: "top 75%"
  },
  x: -80,
  opacity: 0,
  duration: 1,
  ease: "power3.out"
});

gsap.from(".story-right p", {
  scrollTrigger: {
    trigger: ".about-story",
    start: "top 75%"
  },
  y: 60,
  opacity: 0,
  stagger: 0.2,
  duration: 1,
  ease: "power3.out"
});

/* DIFFERENCE CARDS */
gsap.from(".difference-card", {
  scrollTrigger: {
    trigger: ".difference-grid",
    start: "top 80%"
  },
  y: 80,
  opacity: 0,
  stagger: 0.15,
  duration: 1,
  ease: "power3.out"
});

/* INGREDIENT IMAGE */
gsap.from(".ingredients-right img", {
  scrollTrigger: {
    trigger: ".about-ingredients",
    start: "top 75%"
  },
  y: 100,
  rotate: -10,
  opacity: 0,
  duration: 1.2,
  ease: "power4.out"
});

/* VISION */
gsap.from(".about-vision h2", {
  scrollTrigger: {
    trigger: ".about-vision",
    start: "top 80%"
  },
  y: 80,
  opacity: 0,
  duration: 1,
  ease: "power3.out"
});

gsap.from(".about-vision p", {
  scrollTrigger: {
    trigger: ".about-vision",
    start: "top 80%"
  },
  y: 40,
  opacity: 0,
  delay: 0.2,
  duration: 1,
  ease: "power3.out"
});