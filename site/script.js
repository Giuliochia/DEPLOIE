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
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = reducedMotionQuery.matches;

  // --- Ambient logo field: pooled, independent lifecycles while visible ---
  const ambientBackground = document.querySelector('[data-ambient-background]');
  if (ambientBackground && !prefersReducedMotion && 'IntersectionObserver' in window) {
    const ambientSvg = ambientBackground.querySelector('.ambient-background-svg');
    const ambientLogos = Array.from(ambientSvg.querySelectorAll('.ambient-logo')).map((group) => ({
      group,
      path: group.querySelector('path'),
      accent: group.querySelector('rect'),
      pathLength: group.querySelector('path').getTotalLength(),
      timers: []
    }));
    const esigenzeSection = document.getElementById('cosa-semplificare');
    let ambientIsVisible = false;

    const randomBetween = (min, max) => min + Math.random() * (max - min);

    const clearAmbientInstance = (instance) => {
      instance.timers.forEach((timer) => window.clearTimeout(timer));
      instance.timers = [];
      instance.group.style.transition = 'none';
      instance.group.style.opacity = '0';
      instance.path.style.transition = 'none';
      instance.accent.style.transition = 'none';
      instance.accent.style.opacity = '0';
    };

    const scheduleAmbient = (instance, callback, delay) => {
      const timer = window.setTimeout(() => {
        instance.timers = instance.timers.filter((activeTimer) => activeTimer !== timer);
        if (ambientIsVisible) callback();
      }, delay);
      instance.timers.push(timer);
    };

    const syncAmbientSize = () => {
      if (!esigenzeSection) return;
      const mainRect = document.getElementById('main').getBoundingClientRect();
      const esigenzeRect = esigenzeSection.getBoundingClientRect();
      ambientBackground.style.height = `${Math.ceil(esigenzeRect.bottom - mainRect.top)}px`;
    };

    const runAmbientInstance = (instance) => {
      if (!ambientIsVisible) return;
      clearAmbientInstance(instance);

      const bounds = ambientBackground.getBoundingClientRect();
      const visibleTop = Math.max(0, -bounds.top);
      const visibleBottom = Math.min(bounds.height, window.innerHeight - bounds.top);
      const scale = randomBetween(.25, .6);
      const size = 100 * scale;
      const x = randomBetween(0, Math.max(0, bounds.width - size));
      const y = randomBetween(visibleTop, Math.max(visibleTop, visibleBottom - size));
      const rotation = randomBetween(-10, 10);
      const driftX = randomBetween(-40, 40);
      const driftY = randomBetween(-40, 40);
      const drawDuration = randomBetween(1300, 1900);
      const holdDuration = randomBetween(2200, 3200);
      const pauseDuration = randomBetween(400, 1200);
      const variant = Math.floor(Math.random() * 3);
      const outlineDelay = variant === 2 ? 240 : 0;
      const totalDrawDuration = drawDuration + outlineDelay;
      const startOffset = variant === 1 ? -instance.pathLength : instance.pathLength;
      const endOffset = variant === 1 ? instance.pathLength : -instance.pathLength;
      const startTransform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
      const endTransform = `translate(${x + driftX}px, ${y + driftY}px) rotate(${rotation}deg) scale(${scale})`;

      instance.group.style.transition = 'none';
      instance.group.style.transform = startTransform;
      instance.group.style.opacity = '.72';
      instance.path.style.strokeDasharray = `${instance.pathLength}`;
      instance.path.style.strokeDashoffset = `${startOffset}`;
      instance.path.style.transition = 'none';
      instance.accent.style.transition = 'none';
      instance.accent.style.opacity = variant === 2 ? '1' : '0';
      void instance.group.getBoundingClientRect();

      instance.group.style.transition = `transform ${totalDrawDuration + holdDuration}ms linear`;
      instance.group.style.transform = endTransform;

      scheduleAmbient(instance, () => {
        instance.path.style.transition = `stroke-dashoffset ${drawDuration}ms cubic-bezier(.65,0,.35,1)`;
        instance.path.style.strokeDashoffset = '0';
        if (variant !== 2) {
          instance.accent.style.transition = 'opacity 350ms ease';
          scheduleAmbient(instance, () => {
            instance.accent.style.opacity = '1';
          }, Math.max(0, drawDuration - 350));
        }
      }, outlineDelay);

      scheduleAmbient(instance, () => {
        instance.group.style.transition = 'opacity 700ms ease';
        instance.group.style.opacity = '0';
        instance.path.style.transition = 'stroke-dashoffset 700ms cubic-bezier(.65,0,.35,1)';
        instance.path.style.strokeDashoffset = `${endOffset}`;
        instance.accent.style.transition = 'opacity 420ms ease';
        instance.accent.style.opacity = '0';
      }, totalDrawDuration + holdDuration);

      scheduleAmbient(instance, () => {
        runAmbientInstance(instance);
      }, totalDrawDuration + holdDuration + 700 + pauseDuration);
    };

    const stopAmbientField = () => {
      ambientLogos.forEach(clearAmbientInstance);
    };

    const startAmbientField = () => {
      ambientLogos.forEach((instance, index) => {
        scheduleAmbient(instance, () => runAmbientInstance(instance), index * 260 + randomBetween(0, 500));
      });
    };

    syncAmbientSize();
    window.addEventListener('resize', syncAmbientSize, { passive: true });

    const ambientObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !ambientIsVisible) {
          ambientIsVisible = true;
          startAmbientField();
        } else if (!entry.isIntersecting && ambientIsVisible) {
          ambientIsVisible = false;
          stopAmbientField();
        }
      });
    }, { threshold: 0 });
    ambientObserver.observe(ambientBackground);
  }

  // --- Hero mockup: staged build, repeated only while visible ---
  const hero = document.getElementById('top');
  if (hero && prefersReducedMotion) {
    hero.classList.add('hero-motion-ready', 'hero-phase-settled');
  } else if (hero && 'IntersectionObserver' in window) {
    const heroPhaseClasses = [
      'hero-phase-skeleton',
      'hero-phase-content',
      'hero-phase-settled',
      'hero-phase-fade'
    ];
    let heroIsVisible = false;
    let heroRestartFrame = 0;
    let heroTimers = [];

    const clearHeroSchedule = () => {
      heroTimers.forEach((timer) => window.clearTimeout(timer));
      heroTimers = [];
      cancelAnimationFrame(heroRestartFrame);
      heroRestartFrame = 0;
    };

    const setHeroPhase = (phase) => {
      hero.classList.remove(...heroPhaseClasses);
      if (phase) hero.classList.add(phase);
    };

    const runHeroCycle = () => {
      if (!heroIsVisible) return;
      clearHeroSchedule();
      hero.classList.remove('hero-cycle-running');
      setHeroPhase(null);
      void hero.offsetWidth;

      heroRestartFrame = requestAnimationFrame(() => {
        if (!heroIsVisible) return;
        hero.classList.add('hero-cycle-running');
        heroTimers.push(window.setTimeout(() => setHeroPhase('hero-phase-skeleton'), 400));
        heroTimers.push(window.setTimeout(() => setHeroPhase('hero-phase-content'), 800));
        heroTimers.push(window.setTimeout(() => setHeroPhase('hero-phase-settled'), 1600));
        heroTimers.push(window.setTimeout(() => setHeroPhase('hero-phase-fade'), 52000));
        heroTimers.push(window.setTimeout(runHeroCycle, 52300));
      });
    };

    const stopHeroCycle = () => {
      clearHeroSchedule();
      hero.classList.remove('hero-cycle-running');
      setHeroPhase(null);
    };

    hero.classList.add('hero-motion-ready');
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !heroIsVisible) {
          heroIsVisible = true;
          runHeroCycle();
        } else if (!entry.isIntersecting && heroIsVisible) {
          heroIsVisible = false;
          stopHeroCycle();
        }
      });
    }, { threshold: 0.15 });
    heroObserver.observe(hero);
  }

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
    const manifestoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        manifestoIsVisible = entry.isIntersecting;
        if (entry.intersectionRatio >= 0.28 && !manifestoHasActivated) {
          manifestoHasActivated = true;
          entry.target.classList.add('is-active');
        }
        if (manifestoIsVisible) startManifestoLoop();
        else stopManifestoLoop();
      });
    }, { threshold: [0, 0.28], rootMargin: '0px 0px -50px 0px' });
    manifestoObserver.observe(manifesto);
  }

  // --- Process system: one narrative entrance, then a light flow while visible ---
  const processSystem = document.querySelector('[data-process-system]');
  if (processSystem && !prefersReducedMotion && 'IntersectionObserver' in window) {
    processSystem.classList.add('process-motion-ready');
    const processFlow = processSystem.querySelector('.process-flow');
    const processAnimations = processFlow.querySelectorAll('animateMotion');
    const processDesktopFlow = window.matchMedia('(min-width: 821px)');
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

    const processObserver = new IntersectionObserver((entries) => {
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
    }, { threshold: 0.18, rootMargin: '0px 0px -50px 0px' });
    processObserver.observe(processSystem);
    processDesktopFlow.addEventListener('change', () => {
      if (processIsVisible && processDesktopFlow.matches) startProcessFlow();
      else pauseProcessFlow();
    });
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

  // --- Esigenze cards: pointer tilt, independent from the SVG flow ---
  const preciseHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (esigenzeSystem && !prefersReducedMotion && preciseHover.matches) {
    const tiltCards = esigenzeSystem.querySelectorAll('.es-node');
    const maxTilt = 9;

    tiltCards.forEach((card) => {
      let resetTimer = 0;

      card.addEventListener('mouseenter', () => {
        window.clearTimeout(resetTimer);
        card.classList.add('is-tilting');
        card.style.transition = 'transform .12s cubic-bezier(.16,1,.3,1)';
      });

      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        const pointerX = (event.clientX - rect.left) / rect.width;
        const pointerY = (event.clientY - rect.top) / rect.height;
        const rotateX = (0.5 - pointerY) * maxTilt * 2;
        const rotateY = (pointerX - 0.5) * maxTilt * 2;

        card.style.transform = `perspective(700px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform .3s cubic-bezier(.16,1,.3,1)';
        card.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)';

        resetTimer = window.setTimeout(() => {
          card.classList.remove('is-tilting');
          card.style.removeProperty('transition');
          card.style.removeProperty('transform');
        }, 300);
      });
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
