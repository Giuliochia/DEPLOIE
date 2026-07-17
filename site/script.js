import * as THREE from './vendor/three/three.module.min.js';

(() => {
  'use strict';

  // --- Shared visual grammar: particles → volume → structure → verification ---
  const visualGrammar = Object.freeze({
    breakpoints: Object.freeze({ mobile: 620, tablet: 1200 }),
    // Gradi di costruzione narrativa guidati esclusivamente dallo scroll
    // (mai dal tempo): la Hero parte quasi slegata, l'arrivo in Esigenze è
    // più ordinato ma resta lontano dal contorno completo — metà dei
    // tratti non viene comunque mai disegnata e il Varco resta aperto.
    formation: Object.freeze({
      structuralCap: 14,
      structureStart: 0.05,
      structureEnd: 0.62,
      cohesionStart: 0.08,
      cohesionEnd: 0.88,
      ambientKeep: 0.5,
      goldOrbit: 0.05,
      goldPeakOpacity: 0.55,
      reducedPreset: Object.freeze({ p: 0, cohesion: 0.08, structure: 0.05, gold: 0 }),
    }),
    three: Object.freeze({
      particleCountDesktop: 216,
      particleCountTablet: 144,
      particleCountMobile: 84,
      cloudWidth: 420,
      cloudHeight: 300,
      cloudDepth: 520,
      cloudDepthMobile: 300,
      cameraFov: 42,
      cameraZ: 560,
      cameraNear: 1,
      cameraFar: 2000,
      pointSizeDesktop: 3.2,
      pointSizeTablet: 3,
      pointSizeMobile: 3.4,
      formedPointSizeDesktop: 4.4,
      formedPointSizeTablet: 4,
      formedPointSizeMobile: 4.2,
      formationStart: 0.08,
      formationEnd: 0.78,
      delayMin: 0,
      delayMax: 0.38,
      durationMin: 0.34,
      durationMax: 0.68,
      targetDepth: 2,
      targetSize: 378,
      targetSampleInset: 0.03,
      ambientAmount: 5,
      ambientAmountMobile: 3.2,
      settledAmbientKeep: 0.01,
      cameraDriftX: 7,
      cameraDriftY: 4,
      unformedOpacity: 0.62,
      formedOpacity: 0.96,
      pixelRatioMax: 2,
      unformedColor: '--visual-node-muted',
      formedColor: '--visual-node',
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

  // --- Ponte narrativo Hero → Esigenze --------------------------------------
  // Il percorso non è più una curva astratta: è una sequenza di waypoint
  // ricavati da punti reali del layout (confine tra le sezioni, gronda a
  // fianco del testo di Esigenze, colonna di "Essere trovati", fianco
  // dell'hub) e percorsa via MotionPath legato allo scroll. Ogni tier
  // sceglie la ricetta di waypoint adatta all'impianto reale a quella
  // larghezza; la regia alterna costruzione su un lato e testo sull'altro.
  const bridgeConfig = Object.freeze({
    // Sopra 1200 il visual parte a destra del copy: attraversa il centro
    // solo nella fascia vuota tra le due sezioni, scende lungo la gronda a
    // sinistra del titolo e raggiunge l'area di costruzione. Tra 901 e 1200
    // la Hero è impilata (visual già a sinistra), mentre sotto 900 il
    // percorso riduce progressivamente la deviazione laterale.
    tiers: Object.freeze([
      Object.freeze({ minWidth: 1201, recipe: 'gronda', scaleEnd: 0.72, rotateStartDeg: 5 }),
      Object.freeze({ minWidth: 901, recipe: 'colonna', scaleEnd: 0.7, rotateStartDeg: 4 }),
      Object.freeze({ minWidth: 621, recipe: 'fianco-hub', scaleEnd: 0.62, rotateStartDeg: 4 }),
      // Sotto 620 il gruppo arriva più piccolo e senza deviazione laterale
      // dentro lo spazio riservato, prima dei contenuti.
      Object.freeze({ minWidth: 0, recipe: 'fianco-hub', scaleEnd: 0.45, rotateStartDeg: 3 }),
    ]),
    // Morbidezza della curva che MotionPath fa passare per i waypoint.
    curviness: 1.2,
    // Smorzamento dello scrub di ScrollTrigger (secondi di inseguimento).
    scrub: 1,
    // Frazione di viewport a cui il punto d'arrivo è considerato "raggiunto".
    arrivalAnchor: 0.56,
    // Ampiezza della "S" nelle ricette senza gronda (frazione di viewport).
    bandSway: 0.06,
    // Margine minimo dal bordo viewport per il punto d'arrivo.
    edgeMargin: 12,
    // La struttura si consolida più tardi della posizione: durante il ponte
    // il gruppo è visibilmente ancora in costruzione, l'ordine arriva alla
    // fine (esponente applicato al progresso già easato).
    structureBias: 1.35,
    gold: Object.freeze({ fadeInFrom: 0.3, fadeInTo: 0.55, settleFrom: 0.72, settleTo: 0.95, settleDrop: 0.3 }),
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const easeInOut = (value) => value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
  const smoothstep = (edgeA, edgeB, value) => {
    const t = clamp((value - edgeA) / (edgeB - edgeA), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const remap01 = (value, start, end) => {
    if (end === start) return value >= end ? 1 : 0;
    return clamp01((value - start) / (end - start));
  };

  function seededValue(seed) {
    let value = seed >>> 0;
    value += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  const rangeFromSeed = (seed, min, max) => lerp(min, max, seededValue(seed));
  const smoothstep01 = (value) => value * value * (3 - 2 * value);

  class StructureVisual {
    constructor(root, config, motionQuery) {
      this.root = root;
      this.canvas = root.querySelector('canvas');
      this.config = config;
      this.motionQuery = motionQuery;
      this.reducedMotion = motionQuery.matches;
      this.running = false;
      this.visible = false;
      this.frame = 0;
      this.resizeFrame = 0;
      this.width = 0;
      this.height = 0;
      this.particleCount = 0;
      this.positions = null;
      this.colors = null;
      this.startPositions = null;
      this.targetPositions = null;
      this.delays = null;
      this.durations = null;
      this.phases = null;
      this.geometry = null;
      this.points = null;

      // Stato narrativo corrente: continua a essere scritto esclusivamente
      // dal ponte Hero → Esigenze. Il tempo anima solo un respiro minimo.
      this.narrative = {
        p: 0,
        cohesion: config.formation.cohesionStart,
        structure: config.formation.structureStart,
        gold: 0,
      };
      this.onMotionModeChange = null;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(
        config.three.cameraFov,
        1,
        config.three.cameraNear,
        config.three.cameraFar,
      );
      this.camera.position.z = config.three.cameraZ;
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setClearColor(0x000000, 0);

      const styles = getComputedStyle(document.documentElement);
      const unformedColor = styles.getPropertyValue(config.three.unformedColor).trim();
      const formedColor = styles.getPropertyValue(config.three.formedColor).trim();
      this.unformedColor = new THREE.Color(unformedColor || '#77756F');
      this.formedColor = new THREE.Color(formedColor || '#1E1E1B');
      this.material = new THREE.PointsMaterial({
        color: 0xffffff,
        opacity: config.three.unformedOpacity,
        transparent: true,
        size: config.three.pointSizeDesktop,
        sizeAttenuation: true,
        depthWrite: false,
        vertexColors: true,
      });

      this.onMotionChange = this.handleMotionChange.bind(this);
      this.onResize = this.scheduleResize.bind(this);
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

    getParticleCount() {
      const settings = this.config.three;
      if (window.innerWidth <= this.config.breakpoints.mobile) return settings.particleCountMobile;
      if (window.innerWidth <= this.config.breakpoints.tablet) return settings.particleCountTablet;
      return settings.particleCountDesktop;
    }

    getPointSize() {
      const settings = this.config.three;
      if (window.innerWidth <= this.config.breakpoints.mobile) return settings.pointSizeMobile;
      if (window.innerWidth <= this.config.breakpoints.tablet) return settings.pointSizeTablet;
      return settings.pointSizeDesktop;
    }

    getFormedPointSize() {
      const settings = this.config.three;
      if (window.innerWidth <= this.config.breakpoints.mobile) return settings.formedPointSizeMobile;
      if (window.innerWidth <= this.config.breakpoints.tablet) return settings.formedPointSizeTablet;
      return settings.formedPointSizeDesktop;
    }

    getCloudDepth() {
      return window.innerWidth <= this.config.breakpoints.mobile
        ? this.config.three.cloudDepthMobile
        : this.config.three.cloudDepth;
    }

    getAmbientAmount() {
      return window.innerWidth <= this.config.breakpoints.mobile
        ? this.config.three.ambientAmountMobile
        : this.config.three.ambientAmount;
    }

    buildStructuralTargets() {
      const count = Math.min(
        this.config.symbol.length,
        this.config.formation.structuralCap,
      );
      return Array.from({ length: count }, (_, index) => {
        const sourceIndex = Math.round(
          index * (this.config.symbol.length - 1) / (count - 1),
        );
        return this.config.symbol[sourceIndex];
      });
    }

    getTargetPosition(index, structuralTargets) {
      // Si conservano gli stessi tratti esclusi del renderer precedente:
      // solo un segmento ogni due riceve particelle. Il Varco e il profilo
      // rimangono quindi volutamente incompleti anche a fine ponte.
      const activeSegments = [];
      for (let segment = 0; segment < structuralTargets.length - 1; segment += 2) {
        activeSegments.push(segment);
      }
      const segmentIndex = activeSegments[index % activeSegments.length];
      const first = structuralTargets[segmentIndex];
      const second = structuralTargets[segmentIndex + 1];
      const amount = rangeFromSeed(
        91001 + index * 47,
        this.config.three.targetSampleInset,
        1 - this.config.three.targetSampleInset,
      );
      const size = this.config.three.targetSize;

      return {
        x: (lerp(first[0], second[0], amount) - 0.5) * size,
        y: -(lerp(first[1], second[1], amount) - 0.5) * size,
        z: rangeFromSeed(
          92003 + index * 53,
          -this.config.three.targetDepth,
          this.config.three.targetDepth,
        ),
      };
    }

    buildParticleBuffers(count) {
      if (this.points) {
        this.scene.remove(this.points);
        this.geometry.dispose();
      }

      const length = count * 3;
      this.positions = new Float32Array(length);
      this.colors = new Float32Array(length);
      this.startPositions = new Float32Array(length);
      this.targetPositions = new Float32Array(length);
      this.delays = new Float32Array(count);
      this.durations = new Float32Array(count);
      this.phases = new Float32Array(count);

      const settings = this.config.three;
      const structuralTargets = this.buildStructuralTargets();
      const cloudDepth = this.getCloudDepth();

      for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        const densityX = rangeFromSeed(11003 + index * 71, 0.56, 1);
        const densityY = rangeFromSeed(12007 + index * 73, 0.62, 1);
        const asymmetry = rangeFromSeed(13001 + index * 79, -0.12, 0.18);
        const startX = (
          rangeFromSeed(14009 + index * 83, -0.5, 0.5) + asymmetry
        ) * settings.cloudWidth * densityX;
        const startY = rangeFromSeed(
          15013 + index * 89,
          -0.5,
          0.5,
        ) * settings.cloudHeight * densityY;
        const startZ = rangeFromSeed(
          16001 + index * 97,
          -0.5,
          0.5,
        ) * cloudDepth;
        const target = this.getTargetPosition(index, structuralTargets);

        this.startPositions[offset] = startX;
        this.startPositions[offset + 1] = startY;
        this.startPositions[offset + 2] = startZ;
        this.targetPositions[offset] = target.x;
        this.targetPositions[offset + 1] = target.y;
        this.targetPositions[offset + 2] = target.z;
        this.positions[offset] = startX;
        this.positions[offset + 1] = startY;
        this.positions[offset + 2] = startZ;
        this.colors[offset] = this.unformedColor.r;
        this.colors[offset + 1] = this.unformedColor.g;
        this.colors[offset + 2] = this.unformedColor.b;

        const delay = rangeFromSeed(
          17011 + index * 101,
          settings.delayMin,
          settings.delayMax,
        );
        this.delays[index] = delay;
        this.durations[index] = Math.min(
          rangeFromSeed(
            18013 + index * 103,
            settings.durationMin,
            settings.durationMax,
          ),
          1 - delay,
        );
        this.phases[index] = rangeFromSeed(
          19001 + index * 107,
          0,
          Math.PI * 2,
        );
      }

      this.geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.BufferAttribute(this.positions, 3);
      positionAttribute.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('position', positionAttribute);
      const colorAttribute = new THREE.BufferAttribute(this.colors, 3);
      colorAttribute.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('color', colorAttribute);
      this.points = new THREE.Points(this.geometry, this.material);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
      this.particleCount = count;
    }

    resize() {
      const bounds = this.root.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return;

      this.width = bounds.width;
      this.height = bounds.height;
      this.renderer.setPixelRatio(Math.min(
        window.devicePixelRatio || 1,
        this.config.three.pixelRatioMax,
      ));
      this.renderer.setSize(bounds.width, bounds.height, false);
      this.camera.aspect = bounds.width / bounds.height;
      this.camera.updateProjectionMatrix();
      this.material.size = this.getPointSize();

      const count = this.getParticleCount();
      if (count !== this.particleCount) this.buildParticleBuffers(count);

      if (this.reducedMotion) this.drawStatic();
      else this.render(performance.now());
    }

    scheduleResize() {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.resize());
    }

    updatePositions(now, staticState = false) {
      const settings = this.config.three;
      const constructionProgress = clamp(this.narrative.p, 0, 1);
      const formationProgress = remap01(
        constructionProgress,
        settings.formationStart,
        settings.formationEnd,
      );
      const ambientBase = staticState ? 0 : this.getAmbientAmount();

      for (let index = 0; index < this.particleCount; index += 1) {
        const offset = index * 3;
        const localProgress = clamp01(
          (formationProgress - this.delays[index]) / this.durations[index],
        );
        const easedProgress = smoothstep01(localProgress);
        // Ogni fotogramma parte da sorgente e destinazione immutabili:
        // nessun drift si accumula nel tempo.
        const baseX = THREE.MathUtils.lerp(
          this.startPositions[offset],
          this.targetPositions[offset],
          easedProgress,
        );
        const baseY = THREE.MathUtils.lerp(
          this.startPositions[offset + 1],
          this.targetPositions[offset + 1],
          easedProgress,
        );
        const baseZ = THREE.MathUtils.lerp(
          this.startPositions[offset + 2],
          this.targetPositions[offset + 2],
          easedProgress,
        );
        const settleAmount = ambientBase * (
          settings.settledAmbientKeep
          + (1 - settings.settledAmbientKeep) * (1 - easedProgress)
        );
        const phase = this.phases[index];

        this.positions[offset] = baseX
          + Math.sin(now * 0.00024 + phase) * settleAmount;
        this.positions[offset + 1] = baseY
          + Math.cos(now * 0.00019 + phase * 1.13) * settleAmount * 0.72;
        this.positions[offset + 2] = baseZ
          + Math.sin(now * 0.00017 + phase * 0.81) * settleAmount * 0.9;
        this.colors[offset] = THREE.MathUtils.lerp(
          this.unformedColor.r,
          this.formedColor.r,
          easedProgress,
        );
        this.colors[offset + 1] = THREE.MathUtils.lerp(
          this.unformedColor.g,
          this.formedColor.g,
          easedProgress,
        );
        this.colors[offset + 2] = THREE.MathUtils.lerp(
          this.unformedColor.b,
          this.formedColor.b,
          easedProgress,
        );
      }

      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      const presenceProgress = smoothstep01(formationProgress);
      this.material.opacity = lerp(
        settings.unformedOpacity,
        settings.formedOpacity,
        presenceProgress,
      );
      this.material.size = lerp(
        this.getPointSize(),
        this.getFormedPointSize(),
        presenceProgress,
      );
      return formationProgress;
    }

    render(now, staticState = false) {
      if (!this.geometry || !this.particleCount) return;
      const formationProgress = this.updatePositions(now, staticState);
      const cloudFactor = staticState ? 0 : 1 - formationProgress;
      this.camera.position.x = Math.sin(now * 0.00012)
        * this.config.three.cameraDriftX
        * cloudFactor;
      this.camera.position.y = Math.cos(now * 0.0001)
        * this.config.three.cameraDriftY
        * cloudFactor;
      this.camera.position.z = this.config.three.cameraZ;
      this.camera.lookAt(0, 0, 0);
      this.renderer.render(this.scene, this.camera);
    }

    drawStatic() {
      if (!this.width || !this.height || !this.particleCount) return;
      // Reduced motion mantiene la materia immediatamente leggibile e ferma.
      const preset = this.config.formation.reducedPreset;
      this.narrative.p = preset.p;
      this.narrative.cohesion = preset.cohesion;
      this.narrative.structure = preset.structure;
      this.narrative.gold = preset.gold;
      this.render(0, true);
    }

    tick(now) {
      if (!this.running) return;
      this.render(now);
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    start() {
      if (this.running || this.reducedMotion || !this.visible) return;
      this.running = true;
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      cancelAnimationFrame(this.frame);
    }

    handleMotionChange(event) {
      this.reducedMotion = event.matches;
      if (this.onMotionModeChange) this.onMotionModeChange(this.reducedMotion);
      if (this.reducedMotion) {
        this.stop();
        this.drawStatic();
      } else if (this.visible) {
        this.start();
      }
    }

    destroy() {
      this.stop();
      cancelAnimationFrame(this.resizeFrame);
      this.resizeObserver.disconnect();
      this.visibilityObserver.disconnect();
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      if (this.points) this.scene.remove(this.points);
      if (this.geometry) this.geometry.dispose();
      this.material.dispose();
      this.renderer.dispose();
      this.points = null;
      this.geometry = null;
    }
  }

  // --- Ponte narrativo Hero → Esigenze --------------------------------------
  // Controller locale, non un motore globale: ricava i waypoint da punti
  // reali del layout (getBoundingClientRect) e fa percorrere all'intero
  // contenitore un unico percorso curvo via MotionPath, legato allo scroll
  // con ScrollTrigger in scrub. Lo stesso progresso guida il grado di
  // costruzione del visual: tutto è deterministico rispetto allo scroll e
  // tornando indietro ogni stato precedente si ricostruisce esattamente.
  function createHeroBridge(visual, config) {
    if (!window.gsap || !window.ScrollTrigger || !window.MotionPathPlugin) return null;
    const el = visual.root;
    const heroSection = el.closest('.hero');
    const esSystem = document.querySelector('[data-es-system]');
    const head = document.querySelector('.esigenze-head');
    const hub = esSystem ? esSystem.querySelector('[data-es-arrival]') : null;
    const contentNodes = esSystem ? Array.from(esSystem.querySelectorAll('.es-node')) : [];
    if (!heroSection || !esSystem || !head || !hub || !contentNodes.length) return null;

    window.gsap.registerPlugin(window.ScrollTrigger, window.MotionPathPlugin);
    const gsap = window.gsap;
    esSystem.classList.add('es-bridge-active');

    let ctx = null;
    let rebuildFrame = 0;
    let destroyed = false;

    const pickTier = () => config.tiers.find((tier) => window.innerWidth >= tier.minWidth)
      || config.tiers[config.tiers.length - 1];

    // Rect in coordinate di pagina (indipendenti dallo scroll corrente).
    const pageRect = (node) => {
      const rect = node.getBoundingClientRect();
      const scrollTop = window.scrollY;
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        top: rect.top + scrollTop,
        bottom: rect.bottom + scrollTop,
        cx: rect.left + rect.width / 2,
        cy: rect.top + scrollTop + rect.height / 2,
      };
    };

    // I waypoint sono ancorati al layout reale, mai a pixel assoluti:
    // - "gronda": attraversa il centro solo nella fascia vuota tra le due
    //   sezioni e scende nella gronda a sinistra del blocco testuale;
    // - "colonna": Hero impilata, niente gronda utile — passa nella fascia
    //   libera sotto l'intro;
    // - "fianco-hub": su layout stretti riduce la deviazione laterale.
    // Tutte le ricette terminano nell'area trasparente riservata alla
    // costruzione, sul lato opposto rispetto ai contenuti.
    const measureWaypoints = (tier) => {
      const base = pageRect(el);
      const heroR = pageRect(heroSection);
      const headR = pageRect(head);
      const esR = pageRect(esSystem);
      const hubR = pageRect(hub);
      const viewportW = window.innerWidth;
      const halfEnd = (base.width * tier.scaleEnd) / 2;

      const end = {
        x: clamp(hubR.cx, halfEnd + config.edgeMargin, viewportW - halfEnd - config.edgeMargin),
        y: hubR.cy,
      };

      let mids;
      if (tier.recipe === 'gronda') {
        // Centro della gronda tra bordo viewport e blocco testuale.
        const gutterX = Math.max(headR.left / 2, halfEnd * 0.6);
        mids = [
          { x: lerp(base.cx, gutterX, 0.55), y: (heroR.bottom + headR.top) / 2 },
          { x: gutterX, y: headR.cy },
        ];
      } else {
        const sway = window.innerWidth <= 620 ? 0 : viewportW * config.bandSway;
        mids = [
          { x: lerp(base.cx, end.x, 0.4) + sway, y: (heroR.bottom + headR.top) / 2 },
          { x: lerp(base.cx, end.x, 0.8) - sway, y: (headR.bottom + esR.top) / 2 },
        ];
      }

      return {
        // MotionPath parte dalla posizione corrente dell'elemento: i punti
        // sono offset di transform rispetto alla posizione di layout.
        points: mids.concat([end]).map((point) => ({ x: point.x - base.cx, y: point.y - base.cy })),
        endScroll: Math.max(120, end.y - window.innerHeight * config.arrivalAnchor),
      };
    };

    const syncNarrative = (p) => {
      const eased = easeInOut(p);
      const formation = visual.config.formation;
      visual.narrative.p = p;
      visual.narrative.cohesion = lerp(formation.cohesionStart, formation.cohesionEnd, eased);
      visual.narrative.structure = lerp(
        formation.structureStart,
        formation.structureEnd,
        Math.pow(eased, config.structureBias),
      );
      visual.narrative.gold = smoothstep(config.gold.fadeInFrom, config.gold.fadeInTo, p)
        * (1 - config.gold.settleDrop * smoothstep(config.gold.settleFrom, config.gold.settleTo, p));
    };

    // (Ri)costruisce percorso e timeline: al primo avvio e a ogni cambio di
    // layout (resize, load, font). revert() riporta l'elemento alla base di
    // layout prima della nuova misura, così il percorso non insegue sé stesso.
    const build = () => {
      if (destroyed) return;
      if (ctx) ctx.revert();
      ctx = gsap.context(() => {
        const tier = pickTier();
        const measured = measureWaypoints(tier);

        gsap.set(el, { rotation: tier.rotateStartDeg });
        const timeline = gsap.timeline({
          defaults: { ease: 'none', duration: 1 },
          scrollTrigger: {
            start: 0,
            end: () => measured.endScroll,
            scrub: config.scrub,
          },
          // Un solo progresso per posizione e costruzione: lo stato
          // narrativo resta coerente anche quando il loop canvas è in pausa.
          onUpdate: () => syncNarrative(timeline.progress()),
        });
        timeline.to(el, {
          motionPath: { path: measured.points, curviness: config.curviness },
        }, 0);
        timeline.to(el, { rotation: 0 }, 0);
        // La scala scende presto (non linearmente): quando il gruppo
        // affianca il blocco testuale di Esigenze è già vicino alla misura
        // d'arrivo e resta dentro la gronda invece di coprire il titolo.
        timeline.to(el, { scale: tier.scaleEnd, ease: 'power2.out' }, 0);
        contentNodes.forEach((node, index) => {
          const stacked = window.innerWidth <= 760;
          timeline.fromTo(node, {
            opacity: 0.72,
            x: stacked ? 0 : 14,
            y: stacked ? 10 : 0,
          }, {
            opacity: 1,
            x: 0,
            y: 0,
            duration: 0.22,
            ease: 'power1.out',
          }, 0.48 + index * 0.1);
        });
      });
      syncNarrative(0);
      window.ScrollTrigger.refresh();
    };

    const scheduleBuild = () => {
      if (destroyed) return;
      cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(build);
    };

    window.addEventListener('resize', scheduleBuild, { passive: true });
    window.addEventListener('load', scheduleBuild);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleBuild);
    build();

    return {
      destroy() {
        destroyed = true;
        cancelAnimationFrame(rebuildFrame);
        window.removeEventListener('resize', scheduleBuild);
        window.removeEventListener('load', scheduleBuild);
        if (ctx) ctx.revert();
        ctx = null;
        esSystem.classList.remove('es-bridge-active');
      },
    };
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

  // --- Hero: visual condiviso + ponte narrativo verso Esigenze ---
  const heroVisualRoot = document.querySelector('[data-structure-visual]');
  let heroVisual = null;
  let heroBridge = null;
  const mountHeroBridge = () => {
    if (!heroVisual || heroBridge || reducedMotionQuery.matches) return;
    heroBridge = createHeroBridge(heroVisual, bridgeConfig);
  };
  const destroyHeroBridge = () => {
    if (!heroBridge) return;
    heroBridge.destroy();
    heroBridge = null;
  };
  const mountHeroVisual = () => {
    if (!heroVisualRoot || heroVisual) return;
    heroVisual = new StructureVisual(heroVisualRoot, visualGrammar, reducedMotionQuery);
    heroVisual.onMotionModeChange = (reduced) => {
      if (reduced) destroyHeroBridge();
      else mountHeroBridge();
    };
    mountHeroBridge();
  };
  const destroyHeroVisual = () => {
    destroyHeroBridge();
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
