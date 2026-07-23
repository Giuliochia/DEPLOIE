(() => {
  'use strict';

  /**
   * DEPLOIE motion foundation.
   *
   * GSAP owns future narrative timelines, multi-step sequences, scroll-driven
   * coordination, desktop pinning and controlled scrub. CSS continues to own
   * simple hover/focus states, buttons, the mobile menu and elementary state
   * transitions. Native JavaScript continues to own forms, lightboxes,
   * carousels, application logic and observers unrelated to GSAP timelines.
   *
   * Never animate the same property on the same element through CSS and GSAP
   * at the same time. A section integration must explicitly choose one owner
   * for transform, opacity and filter.
   */

  const motionTokens = Object.freeze({
    duration: Object.freeze({
      micro: 0.18,
      element: 0.45,
      composition: 0.9
    }),
    ease: Object.freeze({
      enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
      reorganize: 'cubic-bezier(0.4, 0, 0.2, 1)'
    })
  });

  const motionQueries = Object.freeze({
    desktop: '(min-width: 821px)',
    mobileTablet: '(max-width: 820px)',
    reducedMotion: '(prefers-reduced-motion: reduce)',
    esigenzeDesktop: '(min-width: 901px)',
    preciseHover: '(hover: hover) and (pointer: fine)'
  });

  const sectionTimelines = new Map();
  const playedSections = new Set();
  const lifecycleCleanups = new Set();
  const state = {
    initialized: false,
    available: false,
    pluginRegistered: false,
    refreshFrame: 0,
    refreshPending: false,
    loadGeneration: 0,
    sectionMotionReady: false,
    matchMedia: null,
    conditions: Object.freeze({
      desktop: false,
      mobileTablet: false,
      reducedMotion: false
    })
  };

  const getDependencies = () => ({
    gsap: window.gsap,
    ScrollTrigger: window.ScrollTrigger
  });

  const isReducedMotion = () => window.matchMedia(motionQueries.reducedMotion).matches;

  const addLifecycleListener = (target, type, listener, options) => {
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    lifecycleCleanups.add(cleanup);
    return cleanup;
  };

  const runLifecycleCleanups = () => {
    lifecycleCleanups.forEach((cleanup) => cleanup());
    lifecycleCleanups.clear();
  };

  const cancelScheduledRefresh = () => {
    if (state.refreshFrame) window.cancelAnimationFrame(state.refreshFrame);
    state.refreshFrame = 0;
    state.refreshPending = false;
  };

  const refreshScrollTrigger = () => {
    if (!state.initialized || !state.available || state.refreshPending) return false;

    state.refreshPending = true;
    state.refreshFrame = window.requestAnimationFrame(() => {
      state.refreshFrame = 0;
      state.refreshPending = false;
      if (!state.initialized || !state.available) return;
      getDependencies().ScrollTrigger.refresh();
    });

    return true;
  };

  const waitForFonts = () => {
    if (!document.fonts?.ready) return Promise.resolve();
    return document.fonts.ready.catch(() => undefined);
  };

  const waitForRelevantImages = (root = document) => {
    const images = Array.from(root.querySelectorAll('img'));

    return Promise.all(images.map((image) => {
      if (image.complete) {
        if (typeof image.decode === 'function') return image.decode().catch(() => undefined);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  };

  const destroySectionTimeline = (sectionId) => {
    const entry = sectionTimelines.get(sectionId);
    if (!entry) return false;

    entry.cleanup?.();
    entry.timeline?.scrollTrigger?.kill();
    entry.timeline?.kill?.();
    sectionTimelines.delete(sectionId);
    return true;
  };

  const destroyAllSectionTimelines = () => {
    Array.from(sectionTimelines.keys()).forEach(destroySectionTimeline);
  };

  const registerSectionTimeline = (sectionId, timeline, cleanup) => {
    if (!sectionId || !timeline) return null;

    destroySectionTimeline(sectionId);
    sectionTimelines.set(sectionId, {
      timeline,
      cleanup: typeof cleanup === 'function' ? cleanup : null
    });
    return timeline;
  };

  const setupMatchMedia = () => {
    const { gsap } = getDependencies();
    state.matchMedia = gsap.matchMedia();

    state.matchMedia.add({
      desktop: motionQueries.desktop,
      mobileTablet: motionQueries.mobileTablet,
      reducedMotion: motionQueries.reducedMotion
    }, (context) => {
      state.conditions = Object.freeze({ ...context.conditions });

      if (context.conditions.reducedMotion) {
        destroyAllSectionTimelines();
      }

      return () => {
        destroyAllSectionTimelines();
      };
    });
  };

  const setHeroFinalState = () => {
    const { gsap } = getDependencies();
    const hero = document.getElementById('top');
    if (!hero) return;

    gsap.set(hero.querySelector('h1'), {
      opacity: 1,
      y: 0,
      clipPath: 'inset(0% 0% 0% 0%)',
      clearProps: 'willChange'
    });
    gsap.set(hero.querySelectorAll('.hero-title-reveal'), {
      opacity: 1,
      filter: 'blur(0px)',
      maskPosition: '0% 0%',
      webkitMaskPosition: '0% 0%',
      clearProps: 'willChange'
    });
    gsap.set([hero.querySelector('.hero-text'), hero.querySelector('.hero-ctas')], {
      opacity: 1,
      y: 0,
      clearProps: 'willChange'
    });
    gsap.set(hero.querySelector('.hero-method-diagram'), { opacity: 1 });
    gsap.set(hero.querySelector('.hero-diagram-background'), {
      opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, clearProps: 'willChange'
    });
    const compactFinal = window.matchMedia('(max-width: 900px)').matches;
    const orderedRatio = compactFinal ? 0.28 : 1;
    const orderedStates = [
      { x: -45, y: -25 },
      { x: 55, y: -40 },
      { x: -55, y: 42 }
    ];
    const orderedMethodStates = [
      { x: -25, y: -78 },
      { x: 60, y: 0 },
      { x: -85, y: 70 },
      { x: -55, y: 80 }
    ];
    const finalEmptyStates = compactFinal
      ? [[-14, 8, -0.4], [16, -8, 0.45], [18, 9, -0.35], [-12, 12, 0.3], [14, 8, -0.4], [17, 10, 0.35], [-10, 13, -0.3], [12, 12, 0.4]]
      : [[-250, 42, -2.8], [330, 16, 3.1], [300, 198, -2.5], [-8, 108, 2.3], [-22, 136, -2.7], [314, -4, 3.2], [-126, 94, -2.2], [214, 66, 2.6]];
    Array.from(hero.querySelectorAll('.hero-card-back')).forEach((card, index) => {
      const [x, y, rotation] = finalEmptyStates[index];
      gsap.set(card, {
        x,
        y,
        rotation,
        fillOpacity: 0.12,
        strokeOpacity: 0.5,
        filter: 'none'
      });
    });
    gsap.set(hero.querySelector('.hero-diagram-output'), { opacity: 1 });
    const finalInputNodes = Array.from(hero.querySelectorAll('.hero-input-node'));
    const unusedOffsets = compactFinal
      ? [[27.84, -14.72, -0.62], [-28.16, 13.12, -0.7], [-18.88, 8.64, 0.57]]
      : [[174, -92, -2.8], [-176, 82, -3.2], [-118, 54, 2.6]];
    finalInputNodes.forEach((node, index) => {
      const card = node.querySelector('.hero-card');
      const content = Array.from(node.children).filter((child) => child !== card);
      const ordered = orderedStates[index];
      const [x, y, rotation] = index < 3
        ? [ordered.x * orderedRatio, ordered.y * orderedRatio, 0]
        : unusedOffsets[index - 3];
      gsap.set(node, {
        opacity: index < 3 ? 0.78 : 0.12,
        x, y, rotation, scale: index < 3 ? 0.995 : 0.97,
        clearProps: 'willChange'
      });
      gsap.set(card, {
        fillOpacity: index < 3 ? 1 : 0.12,
        strokeOpacity: index < 3 ? 1 : 0.22
      });
      gsap.set(content, { opacity: index < 3 ? 0.72 : 0 });
    });
    [
      hero.querySelector('.hero-node-appointments'),
      hero.querySelector('.hero-node-automation'),
      hero.querySelector('.hero-node-booking')
    ].forEach((node, index) => {
      const ordered = orderedMethodStates[index === 0 ? 0 : index + 1];
      gsap.set(node, {
        opacity: 0.72,
        x: ordered.x * orderedRatio,
        y: ordered.y * orderedRatio,
        rotation: 0,
        scale: 0.995,
        clearProps: 'willChange'
      });
    });
    gsap.set(hero.querySelector('.hero-node-redundant'), {
      opacity: 0.12,
      x: compactFinal ? 55.68 : 348,
      y: compactFinal ? -6.72 : -42,
      rotation: compactFinal ? -0.66 : -3,
      scale: 0.97,
      clearProps: 'willChange'
    });
    gsap.set(hero.querySelector('.hero-node-clients'), {
      opacity: 1,
      x: orderedMethodStates[1].x * orderedRatio,
      y: orderedMethodStates[1].y * orderedRatio,
      rotation: 0,
      scale: 1,
      clearProps: 'willChange'
    });
    gsap.set(hero.querySelector('.hero-output-node'), {
      opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', clearProps: 'willChange'
    });
    gsap.set(hero.querySelector('.hero-convergence-point'), { opacity: 1, scale: 1 });
    gsap.set(hero.querySelectorAll('.hero-diagram-connections-in .hero-diagram-path:nth-child(-n+3)'), {
      opacity: 1,
      strokeDasharray: 1,
      strokeDashoffset: 0
    });
    gsap.set(hero.querySelectorAll('.hero-diagram-connections-in .hero-diagram-path:nth-child(n+4)'), {
      opacity: 0, strokeDasharray: 1, strokeDashoffset: 1
    });
    gsap.set(hero.querySelector('.hero-output-path-primary'), {
      opacity: 1, strokeDasharray: 1, strokeDashoffset: 0
    });
    const finalOutputStructural = Array.from(hero.querySelectorAll('.hero-output-path-structural'));
    gsap.set(finalOutputStructural.slice(0, 3), {
      opacity: 0.34, strokeDasharray: 1, strokeDashoffset: 0
    });
    gsap.set(finalOutputStructural.slice(3), {
      opacity: 0, strokeDasharray: 1, strokeDashoffset: 1
    });
    gsap.set([
      hero.querySelector('.hero-card-pin-output'),
      hero.querySelector('.hero-output-label'),
      hero.querySelector('.hero-output-check-ring')
    ], { opacity: 1 });
    gsap.set(hero.querySelector('.hero-output-check'), {
      strokeDasharray: 1,
      strokeDashoffset: 0
    });
    gsap.set('.hero-esigenze-bridge', { scaleY: 1, transformOrigin: 'top center' });
    gsap.set('.hero-esigenze-bridge span', { scale: 1 });
  };

  const createHeroTimeline = ({ compact = false, reducedMotion = false } = {}) => {
    const { gsap } = getDependencies();
    const hero = document.getElementById('top');
    if (!hero) return null;

    const title = hero.querySelector('h1');
    const titleBlocks = Array.from(hero.querySelectorAll('.hero-title-reveal'));
    const text = hero.querySelector('.hero-text');
    const ctas = hero.querySelector('.hero-ctas');
    const diagram = hero.querySelector('.hero-method-diagram');
    const background = hero.querySelector('.hero-diagram-background');
    const backgroundCards = Array.from(hero.querySelectorAll('.hero-card-back'));
    const inputNodes = Array.from(hero.querySelectorAll('.hero-input-node'));
    const methodNodes = Array.from(hero.querySelectorAll('.hero-method-node'));
    const connectionsIn = Array.from(hero.querySelectorAll('.hero-diagram-connections-in .hero-diagram-path'));
    const connectionsOut = Array.from(hero.querySelectorAll('.hero-diagram-connections-out .hero-diagram-path'));
    const centralNode = hero.querySelector('.hero-node-clients');
    const outputGroup = hero.querySelector('.hero-diagram-output');
    const outputNode = hero.querySelector('.hero-output-node');
    const outputPrimary = hero.querySelector('.hero-output-path-primary');
    const outputStructural = Array.from(hero.querySelectorAll('.hero-output-path-structural'));
    const outputStructuralUseful = outputStructural.slice(0, 3);
    const convergencePoint = hero.querySelector('.hero-convergence-point');
    const outputCheck = hero.querySelector('.hero-output-check');
    const outputCard = hero.querySelector('.hero-card-output');
    const outputContent = [
      hero.querySelector('.hero-card-pin-output'),
      hero.querySelector('.hero-output-label'),
      hero.querySelector('.hero-output-check-ring')
    ];
    const selectedProblemCard = hero.querySelector('.hero-node-problem .hero-card');
    const inputCardShapes = inputNodes.map((node) => node.querySelector('.hero-card'));
    const inputContents = inputNodes.map((node, index) => (
      Array.from(node.children).filter((child) => child !== inputCardShapes[index])
    ));
    const bridge = document.querySelector('.hero-esigenze-bridge');
    const bridgeMark = bridge?.querySelector('span');

    if (reducedMotion || playedSections.has('hero')) {
      setHeroFinalState();
      document.documentElement.classList.remove('hero-motion-pending');
      playedSections.add('hero');
      return null;
    }

    const revealMask = 'linear-gradient(90deg, #000 0%, #000 45%, rgba(0,0,0,.82) 48%, rgba(0,0,0,.38) 52%, transparent 55%, transparent 100%)';
    gsap.set(title, { opacity: 1, y: 0, clipPath: 'none' });
    gsap.set(titleBlocks, {
      opacity: 1,
      filter: 'blur(2px)',
      maskImage: revealMask,
      maskSize: '250% 100%',
      maskPosition: '100% 0%',
      maskRepeat: 'no-repeat',
      webkitMaskImage: revealMask,
      webkitMaskSize: '250% 100%',
      webkitMaskPosition: '100% 0%',
      webkitMaskRepeat: 'no-repeat',
      willChange: 'mask-position,-webkit-mask-position,filter'
    });
    gsap.set([text, ctas], { opacity: 0, y: compact ? 12 : 18, willChange: 'transform,opacity' });
    gsap.set(diagram, { opacity: 1 });
    gsap.set(background, { opacity: 1, scale: 1, transformOrigin: 'center', willChange: 'opacity' });
    gsap.set(backgroundCards, { fillOpacity: 0.055, strokeOpacity: 0.38 });
    const scatteredStates = Object.freeze({
      'hero-node-problem': { x: -225, y: -36, rotation: -3.4 },
      'hero-node-requests': { x: 292, y: -82, rotation: 3.6 },
      'hero-node-quotes': { x: -142, y: 44, rotation: 2.7 },
      'hero-node-useless': { x: 174, y: -92, rotation: -2.8 },
      'hero-node-showcase': { x: -176, y: 82, rotation: -3.2 },
      'hero-node-discarded': { x: -118, y: 54, rotation: 2.6 },
      'hero-node-appointments': { x: -56, y: -10, rotation: -2.2 },
      'hero-node-clients': { x: 0, y: 0, rotation: 0 },
      'hero-node-automation': { x: 438, y: -232, rotation: -3.3 },
      'hero-node-booking': { x: 190, y: 28, rotation: 2.4 },
      'hero-node-redundant': { x: 348, y: -42, rotation: -3 }
    });
    const compactScatterRatio = compact ? 0.16 : 1;
    const compactRotationRatio = compact ? 0.22 : 1;
    const orderedRatio = compact ? 0.28 : 1;
    const orderedStates = [
      { x: -45, y: -25 },
      { x: 55, y: -40 },
      { x: -55, y: 42 }
    ];
    const orderedMethodStates = [
      { x: -25, y: -78 },
      { x: 60, y: 0 },
      { x: -85, y: 70 },
      { x: -55, y: 80 }
    ];
    const stateForNode = (node) => {
      const className = Array.from(node.classList).find((name) => scatteredStates[name]);
      const state = scatteredStates[className];
      return {
        x: state.x * compactScatterRatio,
        y: state.y * compactScatterRatio,
        rotation: state.rotation * compactRotationRatio
      };
    };

    inputNodes.forEach((node, index) => {
      const { x, y, rotation } = stateForNode(node);
      gsap.set(node, {
        opacity: index < 3 ? 0.34 : 0.18,
        x,
        y,
        rotation,
        scale: index < 3 ? 0.985 : 0.97,
        willChange: 'transform,opacity'
      });
      gsap.set(inputCardShapes[index], {
        fillOpacity: index < 3 ? 0.52 : 0.12,
        strokeOpacity: index < 3 ? 0.48 : 0.22
      });
      gsap.set(inputContents[index], { opacity: index < 3 ? 0.1 : 0 });
    });
    methodNodes.forEach((node) => {
      const { x, y, rotation } = stateForNode(node);
      gsap.set(node, {
        opacity: node === centralNode ? 0.08 : 0.055,
        x,
        y,
        rotation,
        scale: node === centralNode ? 0.985 : 0.975,
        willChange: 'transform,opacity'
      });
    });
    const scatteredEmptyStates = compact
      ? [[-14, 8, -0.4], [16, -8, 0.45], [18, 9, -0.35], [-12, 12, 0.3], [14, 8, -0.4], [17, 10, 0.35], [-10, 13, -0.3], [12, 12, 0.4]]
      : [[-250, 42, -2.8], [330, 16, 3.1], [300, 198, -2.5], [-8, 108, 2.3], [-22, 136, -2.7], [314, -4, 3.2], [-126, 94, -2.2], [214, 66, 2.6]];
    backgroundCards.forEach((card, index) => {
      const [x, y, rotation] = scatteredEmptyStates[index];
      gsap.set(card, {
        x,
        y,
        rotation,
        fillOpacity: 0.065,
        strokeOpacity: 0.46,
        filter: 'none',
        transformOrigin: 'center'
      });
    });
    gsap.set([...connectionsIn, ...connectionsOut], {
      opacity: 0,
      strokeDasharray: 1,
      strokeDashoffset: 1,
      willChange: 'stroke-dashoffset'
    });
    gsap.set(outputGroup, { opacity: 1 });
    gsap.set([outputNode, convergencePoint], {
      opacity: 0,
      scale: compact ? 0.985 : 0.98,
      transformOrigin: 'center',
      willChange: 'transform,opacity'
    });
    gsap.set(outputNode, { clipPath: 'inset(0% 100% 0% 0%)' });
    gsap.set(outputCard, { opacity: 1 });
    gsap.set(outputContent, { opacity: 0 });
    gsap.set(outputCheck, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(bridge, { scaleY: 0, transformOrigin: 'top center' });
    gsap.set(bridgeMark, { scale: 0 });
    document.documentElement.classList.remove('hero-motion-pending');

    const timeline = gsap.timeline({
      defaults: { ease: motionTokens.ease.enter },
      onComplete: () => {
        playedSections.add('hero');
        setHeroFinalState();
      }
    });

    const titleDurations = [0.5, 0.58, 0.52];
    const titleStarts = [0, 0.64, 1.36];
    titleBlocks.forEach((block, index) => {
      const start = titleStarts[index];
      const duration = titleDurations[index];
      timeline
        .to(block, {
          maskPosition: '0% 0%',
          webkitMaskPosition: '0% 0%',
          duration,
          ease: 'power2.inOut'
        }, start)
        .to(block, {
          filter: 'blur(0px)',
          duration: 0.1,
          ease: 'power1.out'
        }, start + duration - 0.1);
    });

    const quietHold = { progress: 0 };
    const secondaryMethodNodes = methodNodes.filter((node) => node !== centralNode && node !== methodNodes[4]);

    timeline
      // Il campo informativo esiste già: disperso, tenue e senza relazioni.
      .to(text, { opacity: 1, y: 0, duration: 0.48 }, 0.18)
      .to(backgroundCards, { fillOpacity: 0.085, strokeOpacity: 0.44, duration: 0.54 }, 0.28)
      .to(ctas, { opacity: 1, y: 0, duration: 0.46 }, 0.96)

      // Analisi: un solo documento alla volta diventa leggibile.
      .to(selectedProblemCard, { stroke: '#8f8778', strokeWidth: 1.5, strokeOpacity: 1, duration: 0.16 }, 0.62)
      .to(inputContents[0], { opacity: 1, duration: 0.2 }, 0.78)
      .to(inputCardShapes[0], { fillOpacity: 1, duration: 0.18 }, 0.94)
      .to(inputNodes[0], { opacity: 1, scale: 1.012, duration: 0.2, ease: 'power2.out' }, 0.94)
      .to(centralNode, { opacity: 0.22, scale: 0.99, duration: 0.24 }, 1.08)

      .to(inputNodes[0], { opacity: 0.64, scale: 0.995, duration: 0.22 }, 1.2)
      .to(inputContents[0], { opacity: 0.7, duration: 0.2 }, 1.2)
      .to(inputCardShapes[1], { strokeOpacity: 1, duration: 0.16 }, 1.22)
      .to(inputContents[1], { opacity: 1, duration: 0.2 }, 1.38)
      .to(inputCardShapes[1], { fillOpacity: 1, duration: 0.18 }, 1.54)
      .to(inputNodes[1], { opacity: 1, scale: 1.012, duration: 0.2, ease: 'power2.out' }, 1.54)
      .to(centralNode, { opacity: 0.42, scale: 0.994, duration: 0.24 }, 1.68)

      .to(inputNodes[1], { opacity: 0.64, scale: 0.995, duration: 0.22 }, 1.8)
      .to(inputContents[1], { opacity: 0.7, duration: 0.2 }, 1.8)
      .to(inputCardShapes[2], { strokeOpacity: 1, duration: 0.16 }, 1.82)
      .to(inputContents[2], { opacity: 1, duration: 0.2 }, 1.98)
      .to(inputCardShapes[2], { fillOpacity: 1, duration: 0.18 }, 2.14)
      .to(inputNodes[2], { opacity: 1, scale: 1.012, duration: 0.2, ease: 'power2.out' }, 2.14)
      .to(centralNode, { opacity: 0.62, scale: 0.997, duration: 0.26 }, 2.3)
      .to(inputNodes[2], { opacity: 0.68, scale: 0.995, duration: 0.22 }, 2.48)
      .to(inputContents[2], { opacity: 0.72, duration: 0.2 }, 2.48)

      // Convergenza: le informazioni utili si avvicinano, senza allinearsi ancora.
      .to(inputNodes[0], { x: compact ? -4 : -28, y: compact ? -2 : -8, rotation: compact ? -0.15 : -0.45, duration: 0.58, ease: 'power3.inOut' }, 2.68)
      .to(inputNodes[1], { x: compact ? 4 : 26, y: compact ? -3 : -14, rotation: compact ? 0.15 : 0.4, duration: 0.58, ease: 'power3.inOut' }, 2.68)
      .to(inputNodes[2], { x: compact ? -4 : -12, y: compact ? 3 : 15, rotation: compact ? -0.12 : -0.3, duration: 0.58, ease: 'power3.inOut' }, 2.68)
      .to(methodNodes[0], { opacity: 0.42, scale: 0.99, duration: 0.34 }, 2.82)
      .to(methodNodes[2], { opacity: 0.46, scale: 0.99, duration: 0.34 }, 3.02)
      .to(methodNodes[3], { opacity: 0.38, scale: 0.985, duration: 0.32 }, 3.16)

      // Allineamento: il sistema trova la propria struttura definitiva.
      .to(inputNodes[0], {
        x: orderedStates[0].x * orderedRatio,
        y: orderedStates[0].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(inputNodes[1], {
        x: orderedStates[1].x * orderedRatio,
        y: orderedStates[1].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(inputNodes[2], {
        x: orderedStates[2].x * orderedRatio,
        y: orderedStates[2].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(methodNodes[0], {
        x: orderedMethodStates[0].x * orderedRatio,
        y: orderedMethodStates[0].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(centralNode, {
        x: orderedMethodStates[1].x * orderedRatio,
        y: orderedMethodStates[1].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(methodNodes[2], {
        x: orderedMethodStates[2].x * orderedRatio,
        y: orderedMethodStates[2].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(methodNodes[3], {
        x: orderedMethodStates[3].x * orderedRatio,
        y: orderedMethodStates[3].y * orderedRatio,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'power3.inOut'
      }, 3.3)
      .to(inputNodes[3], {
        scale: 0.97, opacity: 0.12, duration: 0.42, ease: 'power2.out'
      }, 3.5)
      .to(inputNodes[4], {
        scale: 0.97, opacity: 0.12, duration: 0.42, ease: 'power2.out'
      }, 3.5)
      .to(inputNodes[5], {
        scale: 0.97, opacity: 0.12, duration: 0.42, ease: 'power2.out'
      }, 3.5)
      .to(methodNodes[4], {
        scale: 0.97, opacity: 0.12, duration: 0.42, ease: 'power2.out'
      }, 3.5)
      .to(backgroundCards, {
        fillOpacity: 0.12,
        strokeOpacity: 0.5,
        duration: 0.42,
        ease: 'power2.out'
      }, 3.42)
      .to(centralNode, { opacity: 1, scale: 1, duration: 0.32 }, 3.62)
      .to([inputNodes[0], inputNodes[1], inputNodes[2]], { opacity: 0.78, scale: 0.995, duration: 0.3 }, 3.78)
      .to(secondaryMethodNodes, { opacity: 0.72, scale: 0.995, duration: 0.3 }, 3.78)

      // Solo dopo la stabilizzazione le relazioni confermano l'ordine.
      .to(connectionsIn[0], { opacity: 1, strokeWidth: 1.8, strokeDashoffset: 0, duration: 0.22, ease: 'power2.inOut' }, 4.05)
      .to(connectionsIn[0], { strokeWidth: 1.2, duration: 0.16, ease: 'power2.out' }, 4.27)
      .to(connectionsIn[1], { opacity: 1, strokeWidth: 1.8, strokeDashoffset: 0, duration: 0.22, ease: 'power2.inOut' }, 4.3)
      .to(connectionsIn[1], { strokeWidth: 1.2, duration: 0.16, ease: 'power2.out' }, 4.52)
      .to(connectionsIn[2], { opacity: 1, strokeWidth: 1.8, strokeDashoffset: 0, duration: 0.22, ease: 'power2.inOut' }, 4.55)
      .to(connectionsIn[2], { strokeWidth: 1.2, duration: 0.16, ease: 'power2.out' }, 4.77)

      // Il risultato viene prodotto: uscita, contenitore, contenuto, check.
      .to(outputPrimary, { opacity: 1, strokeWidth: 2.2, strokeDashoffset: 0, duration: 0.22, ease: 'power2.inOut' }, 4.92)
      .to(outputPrimary, { strokeWidth: 1.7, duration: 0.16, ease: 'power2.out' }, 5.14)
      .to(outputStructuralUseful, { opacity: 0.34, strokeWidth: 2.1, strokeDashoffset: 0, duration: 0.18, ease: 'power2.out' }, 5.02)
      .to(outputStructuralUseful, { strokeWidth: 1.7, duration: 0.16, ease: 'power2.out' }, 5.2)
      .to(convergencePoint, { opacity: 1, scale: 1, duration: 0.14 }, 5.02)
      .to(outputNode, {
        opacity: 1,
        scale: 1,
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.2,
        ease: 'power2.out'
      }, 5.03)
      .to(outputContent, { opacity: 1, duration: 0.12, ease: 'power2.out' }, 5.11)
      .to(outputCheck, { strokeDashoffset: 0, duration: 0.16, ease: 'power2.out' }, 5.08)
      .to(outputNode, {
        scale: compact ? 1.006 : 1.012,
        duration: 0.08,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
      }, 5.24)
      .set(outputNode, {
        transformOrigin: '18px 18px'
      }, 5.4)
      .to(outputNode, {
        rotation: 5,
        duration: 0.28,
        ease: 'power2.out'
      }, 5.4)
      .to(outputNode, {
        rotation: -3,
        duration: 0.48,
        ease: 'power2.inOut'
      }, 5.68)
      .to(outputNode, {
        rotation: 2,
        duration: 0.5,
        ease: 'power2.inOut'
      }, 6.16)
      .to(outputNode, {
        rotation: -1,
        duration: 0.52,
        ease: 'power2.inOut'
      }, 6.66)
      .to(outputNode, {
        rotation: 0,
        duration: 0.58,
        ease: 'power2.out'
      }, 7.18)
      .to(bridge, { scaleY: 1, duration: 0.22 }, 4.98)
      .to(bridgeMark, { scale: 1, duration: 0.1 }, 5.1)

      // Pausa di lettura, senza nuove azioni visive.
      .to(quietHold, { progress: 1, duration: 0.7, ease: 'none' }, 7.76);

    return timeline;
  };

  const setEsigenzeFinalState = () => {
    const { gsap } = getDependencies();
    const section = document.getElementById('cosa-semplificare');
    if (!section) return;

    gsap.set([
      section.querySelector('.esigenze-head'),
      section.querySelector('.es-hub'),
      ...section.querySelectorAll('.es-node'),
      ...section.querySelectorAll('.es-particle')
    ], { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'willChange' });
    gsap.set(section.querySelectorAll('.es-path'), { strokeDashoffset: 0 });
  };

  const createEsigenzeTimeline = ({ compact = false, reducedMotion = false } = {}) => {
    const { gsap } = getDependencies();
    const section = document.getElementById('cosa-semplificare');
    if (!section) return null;

    const head = section.querySelector('.esigenze-head');
    const hub = section.querySelector('.es-hub');
    const entry = section.querySelector('.es-node-entry');
    const control = section.querySelector('.es-node-control');
    const clients = section.querySelector('.es-node-clients');
    const paths = Array.from(section.querySelectorAll('.es-path'));
    const particles = section.querySelectorAll('.es-particle');
    const system = section.querySelector('[data-es-system]');

    if (reducedMotion || playedSections.has('esigenze')) {
      setEsigenzeFinalState();
      playedSections.add('esigenze');
      system?.dispatchEvent(new CustomEvent('deploie:motion-complete'));
      return null;
    }

    const distance = compact ? 14 : 28;
    gsap.set(head, { opacity: 0, y: compact ? 12 : 20, clipPath: 'inset(0% 0% 24% 0%)' });
    gsap.set(hub, { opacity: 0, scale: 0.965, willChange: 'transform,opacity' });
    gsap.set(entry, { opacity: 0, x: -distance, y: compact ? 8 : 0, willChange: 'transform,opacity' });
    gsap.set(control, { opacity: 0, x: compact ? 0 : distance, y: -distance * 0.45, willChange: 'transform,opacity' });
    gsap.set(clients, { opacity: 0, x: compact ? 0 : distance * 0.75, y: distance * 0.5, willChange: 'transform,opacity' });
    gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(particles, { opacity: 0 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: compact ? 'top 82%' : 'top 74%',
        once: true
      },
      defaults: { ease: motionTokens.ease.enter },
      onComplete: () => {
        playedSections.add('esigenze');
        setEsigenzeFinalState();
        system?.dispatchEvent(new CustomEvent('deploie:motion-complete'));
      }
    });

    timeline
      .to(head, {
        opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)',
        duration: compact ? 0.52 : 0.68
      }, 0)
      .to(entry, { opacity: 1, x: 0, y: 0, duration: compact ? 0.48 : 0.62 }, compact ? 0.2 : 0.28)
      .to(control, { opacity: 1, x: 0, y: 0, duration: compact ? 0.48 : 0.62 }, compact ? 0.36 : 0.48)
      .to(clients, { opacity: 1, x: 0, y: 0, duration: compact ? 0.5 : 0.66 }, compact ? 0.5 : 0.64);

    if (!compact) {
      timeline
        .to(paths.slice(0, 3), { strokeDashoffset: 0, duration: 0.72, stagger: 0.08 }, 0.46)
        .to(paths.slice(3, 6), { strokeDashoffset: 0, duration: 0.76, stagger: 0.07 }, 0.72)
        .to(paths.slice(6), { strokeDashoffset: 0, duration: 0.78, stagger: 0.08 }, 0.96)
        .to(particles, { opacity: 1, duration: 0.42, stagger: 0.035 }, 1.08);
    }

    timeline
      .to(hub, { opacity: 1, scale: 1, duration: compact ? 0.52 : 0.66 }, compact ? 0.62 : 1.04)
      .to(hub, {
        scale: compact ? 1.012 : 1.022,
        duration: 0.17,
        yoyo: true,
        repeat: 1,
        ease: motionTokens.ease.reorganize
      }, compact ? 0.94 : 1.48);

    return timeline;
  };

  const setupHeroEsigenzeMotion = () => {
    if (state.sectionMotionReady || !state.matchMedia) return;
    state.sectionMotionReady = true;

    state.matchMedia.add({
      desktop: motionQueries.desktop,
      compact: motionQueries.mobileTablet,
      heroCompact: '(max-width: 900px)',
      reducedMotion: motionQueries.reducedMotion
    }, (context) => {
      const heroOptions = {
        compact: context.conditions.heroCompact,
        reducedMotion: context.conditions.reducedMotion
      };
      const esigenzeOptions = {
        compact: context.conditions.compact,
        reducedMotion: context.conditions.reducedMotion
      };
      const heroTimeline = createHeroTimeline(heroOptions);
      const esigenzeTimeline = createEsigenzeTimeline(esigenzeOptions);

      if (heroTimeline) {
        playedSections.add('hero');
        registerSectionTimeline('hero', heroTimeline, setHeroFinalState);
      }
      if (esigenzeTimeline) {
        registerSectionTimeline('esigenze', esigenzeTimeline, () => {
          setEsigenzeFinalState();
          document.querySelector('[data-es-system]')?.dispatchEvent(new CustomEvent('deploie:motion-complete'));
        });
      }

      return () => {
        destroySectionTimeline('hero');
        destroySectionTimeline('esigenze');
      };
    });
  };

  const initializeMotionSystem = () => {
    if (state.initialized) return state.available;

    state.initialized = true;
    state.loadGeneration += 1;
    const generation = state.loadGeneration;
    const { gsap, ScrollTrigger } = getDependencies();

    if (!gsap || !ScrollTrigger) {
      state.available = false;
      document.documentElement.dataset.motionSystem = 'unavailable';
      document.documentElement.classList.remove('hero-motion-pending');
      return false;
    }

    state.available = true;
    if (!state.pluginRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      state.pluginRegistered = true;
    }

    document.documentElement.dataset.motionSystem = 'ready';
    setupMatchMedia();

    addLifecycleListener(window, 'pagehide', destroyMotionSystem, { once: true });
    refreshScrollTrigger();

    Promise.all([
      waitForFonts(),
      waitForRelevantImages(document.getElementById('top') || document)
    ]).then(() => {
      if (state.initialized && generation === state.loadGeneration) {
        setupHeroEsigenzeMotion();
        refreshScrollTrigger();
      }
    });

    return true;
  };

  const destroyMotionSystem = () => {
    if (!state.initialized) return;

    state.loadGeneration += 1;
    cancelScheduledRefresh();
    destroyAllSectionTimelines();
    state.matchMedia?.revert();
    state.matchMedia = null;
    state.sectionMotionReady = false;
    runLifecycleCleanups();
    document.documentElement.classList.remove('hero-motion-pending');

    state.initialized = false;
    state.available = false;
    state.conditions = Object.freeze({
      desktop: false,
      mobileTablet: false,
      reducedMotion: isReducedMotion()
    });
    document.documentElement.dataset.motionSystem = 'destroyed';
  };

  const reinitializeMotionSystem = () => {
    destroyMotionSystem();
    return initializeMotionSystem();
  };

  /**
   * Future section integration example (documentation only; never executed):
   *
   * const timeline = gsap.timeline({
   *   scrollTrigger: { trigger: section, start: 'top 75%' }
   * });
   * timeline.from(section.querySelector('h2'), {
   *   y: 24,
   *   duration: motionTokens.duration.element,
   *   ease: motionTokens.ease.enter
   * });
   * DeploieMotion.registerSectionTimeline('section-id', timeline);
   *
   * Cleanup:
   * DeploieMotion.destroySectionTimeline('section-id');
   */

  const controller = Object.freeze({
    version: '1.0.0',
    gsapVersion: '3.15.0',
    tokens: motionTokens,
    queries: motionQueries,
    initialize: initializeMotionSystem,
    destroy: destroyMotionSystem,
    reinitialize: reinitializeMotionSystem,
    registerSectionTimeline,
    destroySectionTimeline,
    destroyAllSectionTimelines,
    refresh: refreshScrollTrigger,
    waitForFonts,
    waitForRelevantImages,
    isReducedMotion,
    getState: () => Object.freeze({
      initialized: state.initialized,
      available: state.available,
      pluginRegistered: state.pluginRegistered,
      timelineCount: sectionTimelines.size,
      conditions: state.conditions
    })
  });

  window.DeploieMotion = controller;
  controller.initialize();
})();
