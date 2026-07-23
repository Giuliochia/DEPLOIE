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
  const lifecycleCleanups = new Set();
  const state = {
    initialized: false,
    available: false,
    pluginRegistered: false,
    refreshFrame: 0,
    refreshPending: false,
    loadGeneration: 0,
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

  const initializeMotionSystem = () => {
    if (state.initialized) return state.available;

    state.initialized = true;
    state.loadGeneration += 1;
    const generation = state.loadGeneration;
    const { gsap, ScrollTrigger } = getDependencies();

    if (!gsap || !ScrollTrigger) {
      state.available = false;
      document.documentElement.dataset.motionSystem = 'unavailable';
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
      waitForRelevantImages(document.getElementById('main') || document)
    ]).then(() => {
      if (state.initialized && generation === state.loadGeneration) {
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
    runLifecycleCleanups();

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
