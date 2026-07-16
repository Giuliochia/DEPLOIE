(() => {
  'use strict';

  // --- Shared visual grammar: particles → connections → structure → verification ---
  const visualGrammar = Object.freeze({
    density: Object.freeze({ desktop: 38, tablet: 30, mobile: 24 }),
    breakpoints: Object.freeze({ mobile: 620, tablet: 1200 }),
    cycle: Object.freeze({
      dispersion: 2200,
      attraction: 2600,
      connection: 1800,
      emergence: 1500,
      stability: 1900,
      dissolution: 1700,
    }),
    motion: Object.freeze({ speed: 0.00022, amplitude: 8, breathe: 0.003 }),
    interaction: Object.freeze({ radius: 145, strength: 6 }),
    connections: Object.freeze({ maxDistance: 112, lineWidth: 1, opacity: 0.42, ambientOpacity: 0.14 }),
    opacity: Object.freeze({ particle: 0.72, ambient: 0.34, dissolve: 0.16, glow: 0.08 }),
    size: Object.freeze({ nodeMin: 1.5, nodeMax: 3.2, goldMin: 9, goldMax: 14 }),
    colors: Object.freeze({
      node: '--visual-node',
      muted: '--visual-node-muted',
      connection: '--visual-connection',
      accent: '--visual-accent',
    }),
    // Ordered points follow the centre line of the original DEPLOIE symbol,
    // preserving its rounded proportions and the opening at the bottom.
    symbol: Object.freeze([
      [0.42, 0.86], [0.36, 0.86], [0.30, 0.84], [0.24, 0.81], [0.19, 0.75],
      [0.17, 0.67], [0.17, 0.57], [0.17, 0.47], [0.17, 0.37], [0.18, 0.29],
      [0.22, 0.23], [0.28, 0.19], [0.36, 0.17], [0.45, 0.17], [0.55, 0.17],
      [0.64, 0.17], [0.72, 0.19], [0.78, 0.23], [0.82, 0.29], [0.83, 0.37],
      [0.83, 0.47], [0.83, 0.57], [0.83, 0.67], [0.81, 0.75], [0.76, 0.81],
      [0.70, 0.84], [0.64, 0.86], [0.58, 0.86],
    ]),
    gold: Object.freeze([0.50, 0.84]),
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const easeInOut = (value) => value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  class StructureVisual {
    constructor(root, config, motionQuery) {
      this.root = root;
      this.canvas = root.querySelector('canvas');
      this.context = this.canvas.getContext('2d', { alpha: true });
      this.config = config;
      this.motionQuery = motionQuery;
      this.reducedMotion = motionQuery.matches;
      this.pointer = { active: false, x: 0, y: 0 };
      this.particles = [];
      this.running = false;
      this.visible = false;
      this.frame = 0;
      this.resizeFrame = 0;
      this.startTime = 0;
      this.pausedAt = 0;
      this.cycleIndex = 0;
      this.width = 0;
      this.height = 0;

      this.onPointerMove = this.handlePointerMove.bind(this);
      this.onPointerLeave = this.handlePointerLeave.bind(this);
      this.onMotionChange = this.handleMotionChange.bind(this);
      this.onResize = this.scheduleResize.bind(this);

      this.root.addEventListener('pointermove', this.onPointerMove, { passive: true });
      this.root.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      this.motionQuery.addEventListener('change', this.onMotionChange);

      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.root);
      this.visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          this.visible = entry.isIntersecting;
          if (this.visible && !this.reducedMotion) this.start();
          else this.stop();
        });
      }, { threshold: 0.05 });
      this.visibilityObserver.observe(this.root);
      this.resize();
    }

    resolveColors() {
      const styles = getComputedStyle(document.documentElement);
      this.colors = Object.fromEntries(Object.entries(this.config.colors).map(([key, token]) => [
        key,
        styles.getPropertyValue(token).trim(),
      ]));
    }

    getDensity() {
      if (window.innerWidth <= this.config.breakpoints.mobile) return this.config.density.mobile;
      if (window.innerWidth <= this.config.breakpoints.tablet) return this.config.density.tablet;
      return this.config.density.desktop;
    }

    getSymbolPoint(point) {
      const size = Math.min(this.width * 0.82, this.height * 0.82);
      return {
        x: this.width * 0.5 + (point[0] - 0.5) * size,
        y: this.height * 0.5 + (point[1] - 0.5) * size,
      };
    }

    createScatterPoint(random) {
      return {
        x: this.width * lerp(0.07, 0.93, random()),
        y: this.height * lerp(0.08, 0.92, random()),
      };
    }

    buildParticles() {
      const random = seededRandom(43721 + Math.round(this.width) * 17 + Math.round(this.height));
      const count = this.getDensity();
      const structuralCount = Math.min(this.config.symbol.length, count - 4);
      const targets = Array.from({ length: structuralCount }, (_, index) => {
        const targetIndex = Math.round(index * (this.config.symbol.length - 1) / (structuralCount - 1));
        return this.config.symbol[targetIndex];
      });

      this.particles = Array.from({ length: count }, (_, index) => {
        const structural = index < structuralCount;
        return {
          structural,
          target: structural ? targets[index] : [lerp(0.30, 0.70, random()), lerp(0.28, 0.72, random())],
          scatterA: this.createScatterPoint(random),
          scatterB: this.createScatterPoint(random),
          size: lerp(this.config.size.nodeMin, this.config.size.nodeMax, random()),
          phase: random() * Math.PI * 2,
          shape: index % 4 === 0 ? 'square' : 'circle',
          x: 0,
          y: 0,
        };
      });
      this.structuralCount = structuralCount;
      this.cycleIndex = 0;
    }

    advanceCycle() {
      const random = seededRandom(43721 + this.cycleIndex * 7919 + Math.round(this.width));
      this.particles.forEach((particle) => {
        particle.scatterA = particle.scatterB;
        particle.scatterB = this.createScatterPoint(random);
      });
    }

    resize() {
      const bounds = this.root.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = bounds.width;
      this.height = bounds.height;
      this.canvas.width = Math.round(bounds.width * ratio);
      this.canvas.height = Math.round(bounds.height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.resolveColors();
      this.buildParticles();
      this.startTime = performance.now();
      this.pausedAt = 0;
      if (this.reducedMotion) this.drawStatic();
      else if (!this.running) this.render({ name: 'dispersion', progress: 0 }, performance.now());
    }

    scheduleResize() {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.resize());
    }

    getPhase(elapsed) {
      const entries = Object.entries(this.config.cycle);
      let cursor = 0;
      for (const [name, duration] of entries) {
        if (elapsed <= cursor + duration) return { name, progress: clamp((elapsed - cursor) / duration, 0, 1) };
        cursor += duration;
      }
      return { name: 'dissolution', progress: 1 };
    }

    getInteractionOffset(x, y) {
      if (!this.pointer.active || this.reducedMotion) return { x: 0, y: 0 };
      const dx = x - this.pointer.x;
      const dy = y - this.pointer.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance >= this.config.interaction.radius) return { x: 0, y: 0 };
      const amount = (1 - distance / this.config.interaction.radius) * this.config.interaction.strength;
      return { x: dx / distance * amount, y: dy / distance * amount };
    }

    positionParticles(phase, now, staticState = false) {
      const progress = easeInOut(phase.progress);
      const stablePhase = ['connection', 'emergence', 'stability'].includes(phase.name);
      const breathe = !staticState && phase.name === 'stability'
        ? 1 + Math.sin(now * 0.0018) * this.config.motion.breathe
        : 1;

      this.particles.forEach((particle) => {
        const target = this.getSymbolPoint(particle.target);
        target.x = this.width * 0.5 + (target.x - this.width * 0.5) * breathe;
        target.y = this.height * 0.5 + (target.y - this.height * 0.5) * breathe;
        const openX = lerp(particle.scatterA.x, particle.scatterB.x, 0.16);
        const openY = lerp(particle.scatterA.y, particle.scatterB.y, 0.16);
        const drift = staticState ? 0 : this.config.motion.amplitude;
        const driftX = Math.sin(now * this.config.motion.speed + particle.phase) * drift;
        const driftY = Math.cos(now * this.config.motion.speed * 0.83 + particle.phase) * drift * 0.7;

        if (phase.name === 'dispersion') {
          particle.x = lerp(particle.scatterA.x, openX, progress) + driftX;
          particle.y = lerp(particle.scatterA.y, openY, progress) + driftY;
        } else if (phase.name === 'attraction') {
          particle.x = lerp(openX, target.x, progress) + driftX * (1 - progress);
          particle.y = lerp(openY, target.y, progress) + driftY * (1 - progress);
        } else if (stablePhase) {
          particle.x = target.x;
          particle.y = target.y;
        } else {
          particle.x = lerp(target.x, particle.scatterB.x, progress) + driftX * progress;
          particle.y = lerp(target.y, particle.scatterB.y, progress) + driftY * progress;
        }

        const interaction = this.getInteractionOffset(particle.x, particle.y);
        particle.x += interaction.x;
        particle.y += interaction.y;
      });
    }

    getStructureProgress(phase) {
      if (phase.name === 'connection') return easeInOut(phase.progress);
      if (phase.name === 'emergence' || phase.name === 'stability') return 1;
      if (phase.name === 'dissolution') return 1 - easeInOut(phase.progress);
      return 0;
    }

    drawLine(first, second, opacity, width = this.config.connections.lineWidth) {
      this.context.beginPath();
      this.context.moveTo(first.x, first.y);
      this.context.lineTo(second.x, second.y);
      this.context.strokeStyle = this.colors.connection;
      this.context.lineWidth = width;
      this.context.globalAlpha = opacity;
      this.context.stroke();
    }

    drawAmbientConnections(structureProgress) {
      const ambient = this.particles.slice(this.structuralCount);
      for (let index = 0; index < ambient.length - 1; index += 2) {
        const first = ambient[index];
        const second = ambient[index + 1];
        if (!second || Math.hypot(first.x - second.x, first.y - second.y) > this.config.connections.maxDistance) continue;
        this.drawLine(first, second, this.config.connections.ambientOpacity * (1 - structureProgress));
      }
    }

    drawStructureConnections(structureProgress) {
      const nodes = this.particles.slice(0, this.structuralCount);
      for (let index = 0; index < nodes.length - 1; index += 1) {
        const stagger = clamp(structureProgress * (nodes.length + 4) - index, 0, 1);
        if (stagger <= 0) continue;
        this.drawLine(nodes[index], nodes[index + 1], this.config.connections.opacity * stagger);
      }
    }

    drawParticles(structureProgress, phase) {
      this.particles.forEach((particle) => {
        const structuralOpacity = lerp(0.46, this.config.opacity.particle, structureProgress);
        const dissolve = phase.name === 'dissolution' ? lerp(1, this.config.opacity.dissolve, phase.progress) : 1;
        this.context.globalAlpha = (particle.structural ? structuralOpacity : this.config.opacity.ambient) * dissolve;
        this.context.fillStyle = particle.structural ? this.colors.node : this.colors.muted;
        this.context.beginPath();
        if (particle.shape === 'square') {
          this.context.rect(particle.x - particle.size, particle.y - particle.size, particle.size * 2, particle.size * 2);
        } else {
          this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        }
        this.context.fill();
      });
    }

    drawGoldElement(phase) {
      let opacity = 0;
      if (phase.name === 'emergence') opacity = easeInOut(clamp((phase.progress - 0.38) / 0.62, 0, 1));
      if (phase.name === 'stability') opacity = 1;
      if (phase.name === 'dissolution') opacity = 1 - easeInOut(phase.progress);
      if (opacity <= 0) return;

      const point = this.getSymbolPoint(this.config.gold);
      const symbolSize = Math.min(this.width * 0.82, this.height * 0.82);
      const size = clamp(symbolSize * 0.045, this.config.size.goldMin, this.config.size.goldMax);
      this.context.save();
      this.context.globalAlpha = opacity;
      this.context.fillStyle = this.colors.accent;
      this.context.shadowColor = this.colors.accent;
      this.context.shadowBlur = 8 * this.config.opacity.glow;
      this.context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
      this.context.restore();
    }

    render(phase, now, staticState = false) {
      this.context.clearRect(0, 0, this.width, this.height);
      this.positionParticles(phase, now, staticState);
      const structureProgress = staticState ? 1 : this.getStructureProgress(phase);
      this.drawAmbientConnections(structureProgress);
      this.drawStructureConnections(structureProgress);
      this.drawParticles(structureProgress, phase);
      this.drawGoldElement(staticState ? { name: 'stability', progress: 1 } : phase);
      this.context.globalAlpha = 1;
    }

    drawStatic() {
      if (!this.width || !this.height || !this.particles.length) return;
      this.render({ name: 'stability', progress: 1 }, performance.now(), true);
    }

    tick(now) {
      if (!this.running) return;
      const totalDuration = Object.values(this.config.cycle).reduce((sum, duration) => sum + duration, 0);
      const elapsed = Math.max(0, now - this.startTime);
      const nextCycleIndex = Math.floor(elapsed / totalDuration);
      while (this.cycleIndex < nextCycleIndex) {
        this.cycleIndex += 1;
        this.advanceCycle();
      }
      const phase = this.getPhase(elapsed % totalDuration);
      this.render(phase, now);
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    start() {
      if (this.running || this.reducedMotion || !this.visible) return;
      const now = performance.now();
      if (!this.startTime) this.startTime = now;
      if (this.pausedAt) this.startTime += now - this.pausedAt;
      this.pausedAt = 0;
      this.running = true;
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      this.pausedAt = performance.now();
      cancelAnimationFrame(this.frame);
    }

    handlePointerMove(event) {
      const supportsPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!supportsPointer || window.innerWidth <= this.config.breakpoints.tablet || this.reducedMotion) return;
      const bounds = this.root.getBoundingClientRect();
      this.pointer.active = true;
      this.pointer.x = event.clientX - bounds.left;
      this.pointer.y = event.clientY - bounds.top;
    }

    handlePointerLeave() {
      this.pointer.active = false;
    }

    handleMotionChange(event) {
      this.reducedMotion = event.matches;
      this.pointer.active = false;
      if (this.reducedMotion) {
        this.stop();
        this.drawStatic();
      } else if (this.visible) {
        this.startTime = performance.now();
        this.pausedAt = 0;
        this.cycleIndex = 0;
        this.start();
      }
    }

    destroy() {
      this.stop();
      cancelAnimationFrame(this.resizeFrame);
      this.resizeObserver.disconnect();
      this.visibilityObserver.disconnect();
      this.root.removeEventListener('pointermove', this.onPointerMove);
      this.root.removeEventListener('pointerleave', this.onPointerLeave);
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      this.context.clearRect(0, 0, this.width, this.height);
    }
  }

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

  // --- Hero: first reusable instance of the shared visual grammar ---
  const heroVisualRoot = document.querySelector('[data-structure-visual]');
  let heroVisual = null;
  const mountHeroVisual = () => {
    if (!heroVisualRoot || heroVisual) return;
    heroVisual = new StructureVisual(heroVisualRoot, visualGrammar, reducedMotionQuery);
  };
  const destroyHeroVisual = () => {
    if (!heroVisual) return;
    heroVisual.destroy();
    heroVisual = null;
  };
  mountHeroVisual();
  window.addEventListener('pagehide', destroyHeroVisual);
  window.addEventListener('pageshow', mountHeroVisual);

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

  // --- Manifesto: one narrative sequence on first entry ---
  const manifesto = document.querySelector('[data-manifesto]');
  if (manifesto && !prefersReducedMotion && 'IntersectionObserver' in window) {
    manifesto.classList.add('manifesto-motion-ready');
    const manifestoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-active');
          manifestoObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.28, rootMargin: '0px 0px -50px 0px' });
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
