(() => {
  'use strict';

  // --- Shared visual grammar: particles → connections → structure → verification ---
  const visualGrammar = Object.freeze({
    density: Object.freeze({ desktop: 38, tablet: 30, mobile: 24 }),
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
    network: Object.freeze({
      maxDistance: 118,
      maxConnectionsPerParticle: 2,
      maxConnectionsDesktop: 32,
      maxConnectionsTablet: 22,
      maxConnectionsMobile: 0,
      baseAlpha: 0.28,
      lineWidth: 0.8,
      fadeStart: 0.18,
      fadeEnd: 0.68,
      updateInterval: 150,
    }),
    motion: Object.freeze({ speed: 0.00022, amplitude: 8 }),
    interaction: Object.freeze({ radius: 145, strength: 6 }),
    connections: Object.freeze({ lineWidth: 1, opacity: 0.42 }),
    opacity: Object.freeze({ particle: 0.72, ambient: 0.34, glow: 0.08 }),
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

  function getDistanceSquared(first, second) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return dx * dx + dy * dy;
  }

  function buildTemporaryConnections(
    particles,
    maxDistance,
    maxConnectionsPerParticle,
    maxTotalConnections,
  ) {
    const maxDistanceSquared = maxDistance * maxDistance;
    const connections = [];
    const connectionCount = new Uint8Array(particles.length);

    for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
      if (connectionCount[firstIndex] >= maxConnectionsPerParticle) continue;
      const candidates = [];

      for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex += 1) {
        if (connectionCount[secondIndex] >= maxConnectionsPerParticle) continue;
        const distanceSquared = getDistanceSquared(
          particles[firstIndex],
          particles[secondIndex],
        );
        if (distanceSquared <= maxDistanceSquared) {
          candidates.push({
            a: firstIndex,
            b: secondIndex,
            distanceSquared,
          });
        }
      }

      candidates.sort((first, second) => first.distanceSquared - second.distanceSquared);
      for (const candidate of candidates) {
        if (
          connectionCount[candidate.a] >= maxConnectionsPerParticle
          || connectionCount[candidate.b] >= maxConnectionsPerParticle
          || connections.length >= maxTotalConnections
        ) {
          continue;
        }
        connections.push(candidate);
        connectionCount[candidate.a] += 1;
        connectionCount[candidate.b] += 1;
        if (
          connectionCount[firstIndex] >= maxConnectionsPerParticle
          || connections.length >= maxTotalConnections
        ) {
          break;
        }
      }

      if (connections.length >= maxTotalConnections) break;
    }

    return connections;
  }

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

  // Un ordine casuale (non l'ordine geometrico) in cui i segmenti del
  // contorno raggiungono piena opacità: senza questo, i segmenti si
  // connettono sempre a partire dallo stesso punto, tracciando un arco
  // unico e fedele al profilo reale del marchio anche quando incompleto.
  // Mescolando l'ordine, i tratti mancanti restano distribuiti lungo tutto
  // il profilo invece che concentrati in un solo punto.
  function shuffledOrder(length, random) {
    const order = Array.from({ length }, (_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
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
      this.temporaryConnections = [];
      this.lastNetworkUpdate = 0;
      this.running = false;
      this.visible = false;
      this.frame = 0;
      this.resizeFrame = 0;
      this.width = 0;
      this.height = 0;
      // Stato narrativo corrente: viene scritto dall'esterno (il ponte
      // Hero → Esigenze) in funzione della posizione di scroll. Il tempo
      // non lo fa mai avanzare: al tempo resta solo il respiro ambientale.
      this.narrative = {
        p: 0,
        cohesion: config.formation.cohesionStart,
        structure: config.formation.structureStart,
        gold: 0,
      };
      this.onMotionModeChange = null;

      this.onPointerMove = this.handlePointerMove.bind(this);
      this.onPointerLeave = this.handlePointerLeave.bind(this);
      this.onMotionChange = this.handleMotionChange.bind(this);
      this.onResize = this.scheduleResize.bind(this);

      // Sul documento, non sul contenitore: il contenitore ha
      // pointer-events:none per non intercettare mai testi, CTA e selezione
      // mentre attraversa la pagina. Il raggio d'interazione limita
      // comunque l'effetto alla zona del gruppo.
      document.addEventListener('pointermove', this.onPointerMove, { passive: true });
      document.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
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
      const structuralCount = Math.min(this.config.symbol.length, count - 4, this.config.formation.structuralCap);
      const targets = Array.from({ length: structuralCount }, (_, index) => {
        const targetIndex = Math.round(index * (this.config.symbol.length - 1) / (structuralCount - 1));
        return this.config.symbol[targetIndex];
      });

      this.particles = Array.from({ length: count }, (_, index) => {
        const structural = index < structuralCount;
        return {
          structural,
          target: structural ? targets[index] : [lerp(0.30, 0.70, random()), lerp(0.28, 0.72, random())],
          scatter: this.createScatterPoint(random),
          size: lerp(this.config.size.nodeMin, this.config.size.nodeMax, random()),
          phase: random() * Math.PI * 2,
          shape: index % 4 === 0 ? 'square' : 'circle',
          x: 0,
          y: 0,
        };
      });
      this.structuralCount = structuralCount;
      this.connectionOrder = shuffledOrder(Math.max(0, structuralCount - 1), random);
      this.temporaryConnections = [];
      this.lastNetworkUpdate = 0;
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
      if (this.reducedMotion) this.drawStatic();
      else this.render(performance.now());
    }

    scheduleResize() {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.resize());
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

    positionParticles(now, staticState = false) {
      const cohesion = clamp(this.narrative.cohesion, 0, 1);
      // Il respiro ambientale si riduce man mano che il gruppo si
      // consolida, ma non si azzera mai del tutto: a scroll fermo il
      // sistema resta vivo senza però far avanzare la costruzione.
      const amplitude = staticState
        ? 0
        : this.config.motion.amplitude * lerp(1, this.config.formation.ambientKeep, cohesion);

      this.particles.forEach((particle) => {
        const target = this.getSymbolPoint(particle.target);
        const driftX = Math.sin(now * this.config.motion.speed + particle.phase) * amplitude;
        const driftY = Math.cos(now * this.config.motion.speed * 0.83 + particle.phase) * amplitude * 0.7;
        particle.x = lerp(particle.scatter.x, target.x, cohesion) + driftX;
        particle.y = lerp(particle.scatter.y, target.y, cohesion) + driftY;
        const interaction = this.getInteractionOffset(particle.x, particle.y);
        particle.x += interaction.x;
        particle.y += interaction.y;
      });
    }

    getMaxTemporaryConnections() {
      const network = this.config.network;
      if (window.innerWidth <= this.config.breakpoints.mobile) return network.maxConnectionsMobile;
      if (window.innerWidth <= this.config.breakpoints.tablet) return network.maxConnectionsTablet;
      return network.maxConnectionsDesktop;
    }

    updateTemporaryConnections(now, staticState = false) {
      const network = this.config.network;
      const maxTotalConnections = this.getMaxTemporaryConnections();
      const networkFade = 1 - remap01(
        clamp(this.narrative.p, 0, 1),
        network.fadeStart,
        network.fadeEnd,
      );
      if (staticState || maxTotalConnections === 0 || networkFade <= 0.01) {
        this.temporaryConnections = [];
        return;
      }
      if (this.lastNetworkUpdate && now - this.lastNetworkUpdate < network.updateInterval) {
        return;
      }
      this.temporaryConnections = buildTemporaryConnections(
        this.particles,
        network.maxDistance,
        network.maxConnectionsPerParticle,
        maxTotalConnections,
      );
      this.lastNetworkUpdate = now;
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

    drawTemporaryConnections(constructionProgress, staticState = false) {
      if (staticState || !this.temporaryConnections.length) return;
      const network = this.config.network;
      const networkFade = 1 - remap01(
        constructionProgress,
        network.fadeStart,
        network.fadeEnd,
      );
      this.temporaryConnections.forEach((connection) => {
        const distance = Math.sqrt(connection.distanceSquared);
        const distanceAlpha = 1 - clamp01(distance / network.maxDistance);
        const alpha = network.baseAlpha * distanceAlpha * networkFade;
        if (alpha <= 0.01) return;
        const first = this.particles[connection.a];
        const second = this.particles[connection.b];
        this.drawLine(first, second, alpha, network.lineWidth);
      });
    }

    drawStructureConnections(structureProgress) {
      const nodes = this.particles.slice(0, this.structuralCount);
      const order = this.connectionOrder || [];
      for (let index = 0; index < nodes.length - 1; index += 1) {
        // Un tratto ogni due resta sempre escluso, distribuito lungo tutto
        // il profilo: garantisce che non si formi mai un contorno continuo,
        // a prescindere da quanto la struttura si avvicini al suo tetto.
        if (index % 2 === 1) continue;
        const rank = order[index] !== undefined ? order[index] : index;
        const stagger = clamp(structureProgress * (nodes.length + 4) - rank, 0, 1);
        if (stagger <= 0) continue;
        this.drawLine(
          nodes[index],
          nodes[index + 1],
          this.config.connections.opacity * stagger,
        );
      }
    }

    drawParticles(structureProgress) {
      this.particles.forEach((particle) => {
        const existingAlpha = particle.structural
          ? lerp(0.46, this.config.opacity.particle, structureProgress)
          : this.config.opacity.ambient;
        this.context.globalAlpha = existingAlpha;
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

    drawGoldElement(now) {
      // L'oro accompagna il consolidamento a metà del ponte: appare mentre
      // il gruppo attraversa, si attenua quando l'ordine si assesta e non
      // occupa mai la posizione finale del Varco — orbita sempre a distanza
      // minima da quel punto, con opacità mai piena.
      const level = clamp(this.narrative.gold, 0, 1);
      if (level <= 0.02) return;
      const opacity = level * this.config.formation.goldPeakOpacity;

      const target = this.getSymbolPoint(this.config.gold);
      const symbolSize = Math.min(this.width * 0.82, this.height * 0.82);
      const size = clamp(symbolSize * 0.045, this.config.size.goldMin, this.config.size.goldMax);
      const orbitRadius = symbolSize * this.config.formation.goldOrbit;
      const angle = now * 0.00045;
      const x = target.x + Math.cos(angle) * orbitRadius;
      const y = target.y + Math.sin(angle) * orbitRadius;

      this.context.save();
      this.context.globalAlpha = opacity;
      this.context.fillStyle = this.colors.accent;
      this.context.shadowColor = this.colors.accent;
      this.context.shadowBlur = 8 * this.config.opacity.glow;
      this.context.fillRect(x - size / 2, y - size / 2, size, size);
      this.context.restore();
    }

    render(now, staticState = false) {
      this.context.clearRect(0, 0, this.width, this.height);
      this.positionParticles(now, staticState);
      const constructionProgress = clamp(this.narrative.p, 0, 1);
      const structureProgress = clamp(this.narrative.structure, 0, 1);
      this.updateTemporaryConnections(now, staticState);
      this.drawTemporaryConnections(constructionProgress, staticState);
      this.drawStructureConnections(structureProgress);
      this.drawParticles(structureProgress);
      this.drawGoldElement(now);
      this.context.globalAlpha = 1;
    }

    drawStatic() {
      if (!this.width || !this.height || !this.particles.length) return;
      // Reduced motion mantiene la Hero come materia statica. La struttura
      // incompleta di Esigenze resta affidata al fallback SVG già presente.
      const preset = this.config.formation.reducedPreset;
      this.narrative.p = preset.p;
      this.narrative.cohesion = preset.cohesion;
      this.narrative.structure = preset.structure;
      this.narrative.gold = preset.gold;
      this.render(performance.now(), true);
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
      this.temporaryConnections = [];
      document.removeEventListener('pointermove', this.onPointerMove);
      document.removeEventListener('pointerleave', this.onPointerLeave);
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      this.context.clearRect(0, 0, this.width, this.height);
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
