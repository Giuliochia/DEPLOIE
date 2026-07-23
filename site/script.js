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

  // --- Shared runtime preferences and breakpoints ---
  const sharedMotionQueries = window.DeploieMotion?.queries || {
    reducedMotion: '(prefers-reduced-motion: reduce)',
    desktop: '(min-width: 821px)',
    esigenzeDesktop: '(min-width: 901px)',
    preciseHover: '(hover: hover) and (pointer: fine)'
  };
  const reducedMotionQuery = window.matchMedia(sharedMotionQueries.reducedMotion);
  let prefersReducedMotion = reducedMotionQuery.matches;
  const motionBreakpoints = {
    processDesktop: window.matchMedia(sharedMotionQueries.desktop),
    esigenzeDesktop: window.matchMedia(sharedMotionQueries.esigenzeDesktop),
    preciseHover: window.matchMedia(sharedMotionQueries.preciseHover)
  };
  const activeObservers = new Set();

  const trackObserver = (observer) => {
    activeObservers.add(observer);
    return observer;
  };

  const disconnectObservers = () => {
    activeObservers.forEach((observer) => observer.disconnect());
    activeObservers.clear();
  };

  const revealEls = document.querySelectorAll('.reveal');
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const io = trackObserver(new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }));
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  // --- Manifesto: one narrative sequence, repeated only while visible ---
  const manifesto = document.querySelector('[data-manifesto]');
  if (manifesto && !prefersReducedMotion && 'IntersectionObserver' in window) {
    const manifestoCycleDuration = 20000;
    const manifestoResetDuration = 500;
    let manifestoIsVisible = false;
    let manifestoHasActivated = false;
    let manifestoLoopRunning = false;
    let manifestoResetTimer = 0;
    let manifestoRestartTimer = 0;
    let manifestoRestartFrame = 0;

    const clearManifestoLoop = () => {
      window.clearTimeout(manifestoResetTimer);
      window.clearTimeout(manifestoRestartTimer);
      cancelAnimationFrame(manifestoRestartFrame);
      manifestoResetTimer = 0;
      manifestoRestartTimer = 0;
      manifestoRestartFrame = 0;
    };

    const scheduleManifestoCycle = () => {
      manifestoResetTimer = window.setTimeout(() => {
        if (!manifestoIsVisible) return;
        manifesto.classList.add('is-resetting');

        manifestoRestartTimer = window.setTimeout(() => {
          if (!manifestoIsVisible) return;
          manifesto.classList.remove('is-active');
          void manifesto.offsetWidth;
          manifestoRestartFrame = requestAnimationFrame(() => {
            if (!manifestoIsVisible) return;
            manifesto.classList.add('is-active');
            manifesto.classList.remove('is-resetting');
            scheduleManifestoCycle();
          });
        }, manifestoResetDuration);
      }, manifestoCycleDuration - manifestoResetDuration);
    };

    const startManifestoLoop = () => {
      if (manifestoLoopRunning || !manifestoIsVisible || !manifestoHasActivated) return;
      manifestoLoopRunning = true;
      scheduleManifestoCycle();
    };

    const stopManifestoLoop = () => {
      manifestoLoopRunning = false;
      clearManifestoLoop();
      manifesto.classList.remove('is-resetting');
      if (manifestoHasActivated) manifesto.classList.add('is-active');
    };

    manifesto.classList.add('manifesto-motion-ready');
    const manifestoObserver = trackObserver(new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        manifestoIsVisible = entry.isIntersecting;
        if (entry.intersectionRatio >= 0.28 && !manifestoHasActivated) {
          manifestoHasActivated = true;
          entry.target.classList.add('is-active');
        }
        if (manifestoIsVisible) startManifestoLoop();
        else stopManifestoLoop();
      });
    }, { threshold: [0, 0.28], rootMargin: '0px 0px -50px 0px' }));
    manifestoObserver.observe(manifesto);
  }

  // --- Process system: one narrative entrance, then a light flow while visible ---
  const processSystem = document.querySelector('[data-process-system]');
  if (processSystem && !prefersReducedMotion && 'IntersectionObserver' in window) {
    processSystem.classList.add('process-motion-ready');
    const processFlow = processSystem.querySelector('.process-flow');
    const processAnimations = processFlow.querySelectorAll('animateMotion');
    const processDesktopFlow = motionBreakpoints.processDesktop;
    let processIsVisible = false;
    let processFlowHasStarted = false;

    const startProcessFlow = () => {
      if (!processDesktopFlow.matches) return;
      if (typeof processFlow.unpauseAnimations === 'function') processFlow.unpauseAnimations();
      if (!processFlowHasStarted) {
        processAnimations.forEach((animation) => {
          if (typeof animation.beginElement === 'function') animation.beginElement();
        });
        processFlowHasStarted = true;
      }
    };

    const pauseProcessFlow = () => {
      if (typeof processFlow.pauseAnimations === 'function') processFlow.pauseAnimations();
    };

    const processObserver = trackObserver(new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-active');
          entry.target.classList.add('is-running');
          processIsVisible = true;
          startProcessFlow();
        } else {
          entry.target.classList.remove('is-running');
          processIsVisible = false;
          pauseProcessFlow();
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -50px 0px' }));
    processObserver.observe(processSystem);
    processDesktopFlow.addEventListener('change', () => {
      if (processIsVisible && processDesktopFlow.matches) startProcessFlow();
      else pauseProcessFlow();
    });
  }

  // --- Esigenze cards: restrained inner tilt after the GSAP entrance ---
  const esigenzeSystem = document.querySelector('[data-es-system]');
  const preciseHover = motionBreakpoints.preciseHover;
  if (esigenzeSystem && !prefersReducedMotion && preciseHover.matches) {
    const tiltCards = esigenzeSystem.querySelectorAll('.es-node');
    let tiltInitialized = false;

    const initializeTilt = () => {
      if (tiltInitialized) return;
      tiltInitialized = true;

      tiltCards.forEach((card) => {
        const tiltLayer = card.querySelector('.es-node-tilt');
        if (!tiltLayer) return;

        card.addEventListener('mousemove', (event) => {
          const rect = card.getBoundingClientRect();
          const pointerX = (event.clientX - rect.left) / rect.width;
          const pointerY = (event.clientY - rect.top) / rect.height;
          const rotateX = (0.5 - pointerY) * 5;
          const rotateY = (pointerX - 0.5) * 5;
          tiltLayer.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.006)`;
        });

        card.addEventListener('mouseleave', () => {
          tiltLayer.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
        });
      });
    };

    esigenzeSystem.addEventListener('deploie:motion-complete', initializeTilt, { once: true });
    if (!window.DeploieMotion?.getState().available) initializeTilt();
  }

  // --- Back to top button ---
  const toTop = document.getElementById('toTop');
  let toTopFrame = 0;
  const updateToTop = () => {
    toTopFrame = 0;
    toTop.classList.toggle('visible', window.scrollY > 600);
  };
  window.addEventListener('scroll', () => {
    if (!toTopFrame) toTopFrame = window.requestAnimationFrame(updateToTop);
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

  reducedMotionQuery.addEventListener('change', (event) => {
    if (prefersReducedMotion === event.matches) return;
    prefersReducedMotion = event.matches;
    disconnectObservers();
    window.location.reload();
  });
  window.addEventListener('pagehide', disconnectObservers, { once: true });

  document.getElementById('currentYear').textContent = new Date().getFullYear();
})();
