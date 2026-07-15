(() => {
  'use strict';

  // --- Mobile menu ---
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');

  function closeMenu() {
    mobileNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Apri il menu');
  }
  function openMenu() {
    mobileNav.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Chiudi il menu');
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains('open');
    isOpen ? closeMenu() : openMenu();
  });
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // --- Scroll reveal (skips entirely if reduced motion is preferred) ---
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  // --- Esigenze system: one controlled activation when it enters the viewport ---
  const esigenzeSystem = document.querySelector('[data-es-system]');
  if (esigenzeSystem && !prefersReducedMotion && 'IntersectionObserver' in window) {
    esigenzeSystem.classList.add('es-motion-ready');
    const esigenzeConnections = esigenzeSystem.querySelector('.es-connections');
    const flowAnimations = esigenzeConnections.querySelectorAll('animateMotion');
    const desktopFlow = window.matchMedia('(min-width: 901px)');
    let systemIsVisible = false;
    let flowHasStarted = false;

    const startFlow = () => {
      if (!desktopFlow.matches) return;
      if (typeof esigenzeConnections.unpauseAnimations === 'function') esigenzeConnections.unpauseAnimations();
      if (!flowHasStarted) {
        flowAnimations.forEach((animation) => {
          if (typeof animation.beginElement === 'function') animation.beginElement();
        });
        flowHasStarted = true;
      }
    };

    const pauseFlow = () => {
      if (typeof esigenzeConnections.pauseAnimations === 'function') esigenzeConnections.pauseAnimations();
    };

    const esigenzeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-active');
          entry.target.classList.add('is-running');
          systemIsVisible = true;
          startFlow();
        } else {
          entry.target.classList.remove('is-running');
          systemIsVisible = false;
          pauseFlow();
        }
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -40px 0px' });
    esigenzeObserver.observe(esigenzeSystem);
    desktopFlow.addEventListener('change', () => {
      if (systemIsVisible && desktopFlow.matches) startFlow();
      else pauseFlow();
    });
  }

  // --- Back to top button ---
  const toTop = document.getElementById('toTop');
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('visible', window.scrollY > 600);
  }, { passive: true });
  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });

  // --- Contact form test behavior (no data is sent without a backend) ---
  const ctaForm = document.getElementById('ctaForm');
  const formConfirmation = document.getElementById('formConfirmation');
  ctaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!ctaForm.checkValidity()) {
      ctaForm.reportValidity();
      return;
    }
    ctaForm.hidden = true;
    formConfirmation.hidden = false;
    formConfirmation.focus();
    ctaForm.reset();
  });

  document.getElementById('currentYear').textContent = new Date().getFullYear();
})();
