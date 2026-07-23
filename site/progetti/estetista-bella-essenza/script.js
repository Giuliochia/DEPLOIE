(() => {
  'use strict';

  const showcaseItems = document.querySelectorAll('.flow-showcase-item');
  const showcase = document.querySelector('.flow-showcase');
  const slideButtons = document.querySelectorAll('.flow-showcase-control');
  const lightbox = document.querySelector('.flow-lightbox');
  const lightboxContent = document.querySelector('.flow-lightbox-content');
  const lightboxTitle = document.querySelector('.flow-lightbox-title');
  const closeButton = document.querySelector('.flow-lightbox-close');

  if (!showcase || !lightbox || !lightboxContent || !lightboxTitle || !closeButton) return;

  let activeCard = null;
  let closeTimer = null;
  let loopDistance = 0;
  let loopPosition = 0;
  let lastFrameTime = null;
  let pauseUntil = 0;
  let pointerPaused = false;
  let focusPaused = false;
  let showcaseVisible = false;
  let animationFrameId = 0;
  let resumeTimer = 0;
  let pauseShowcaseFor = (duration) => {
    pauseUntil = Number.isFinite(duration)
      ? window.performance.now() + duration
      : Number.POSITIVE_INFINITY;
  };
  const transitionDuration = 520;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const loopSpeed = 34;
  reducedMotion.addEventListener('change', () => window.location.reload());

  const finishClose = () => {
    if (lightbox.open) lightbox.close();
  };

  const closeLightbox = () => {
    if (!lightbox.open) return;

    lightbox.classList.remove('is-visible');
    window.clearTimeout(closeTimer);

    if (reducedMotion.matches) {
      finishClose();
      return;
    }

    closeTimer = window.setTimeout(finishClose, transitionDuration);
  };

  const createFigure = (sourceImage) => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    const alternativeText = sourceImage.getAttribute('alt') || '';

    figure.className = 'flow-lightbox-figure';
    image.className = 'flow-lightbox-img';
    image.src = sourceImage.currentSrc || sourceImage.src;
    image.alt = alternativeText;

    figure.append(image);
    return figure;
  };

  const moveShowcase = (direction) => {
    const firstItem = showcaseItems[0];
    if (!firstItem) return;

    const gap = Number.parseFloat(window.getComputedStyle(showcase).columnGap) || 0;
    const distance = firstItem.getBoundingClientRect().width + gap;

    pauseShowcaseFor(1400);
    if (!reducedMotion.matches && direction < 0 && showcase.scrollLeft < distance && loopDistance > 0) {
      showcase.scrollLeft += loopDistance;
    }
    showcase.scrollBy({
      left: direction * distance,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
  };

  slideButtons.forEach((button) => {
    button.addEventListener('click', () => moveShowcase(Number(button.dataset.slide)));
  });

  showcase.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveShowcase(event.key === 'ArrowLeft' ? -1 : 1);
  });

  if (!reducedMotion.matches) {
    const clones = Array.from(showcaseItems, (item, index) => {
      const clone = item.cloneNode(true);
      clone.classList.add('is-clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.dataset.sourceIndex = String(index);
      clone.tabIndex = -1;
      showcase.append(clone);
      return clone;
    });

    const updateLoopDistance = () => {
      if (!showcaseItems[0] || !clones[0]) return;
      loopDistance = clones[0].offsetLeft - showcaseItems[0].offsetLeft;
      loopPosition = showcase.scrollLeft;
    };

    const stopShowcaseLoop = () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
      lastFrameTime = null;
    };

    const clearResumeTimer = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = 0;
    };

    const canAnimateShowcase = () => (
      !pointerPaused
      && !focusPaused
      && showcaseVisible
      && !document.hidden
      && window.performance.now() >= pauseUntil
    );

    const startShowcaseLoop = () => {
      clearResumeTimer();
      if (animationFrameId || !canAnimateShowcase()) return;
      animationFrameId = window.requestAnimationFrame(animateShowcase);
    };

    const scheduleShowcaseResume = () => {
      clearResumeTimer();
      if (!Number.isFinite(pauseUntil)) return;
      const delay = Math.max(0, pauseUntil - window.performance.now());
      resumeTimer = window.setTimeout(startShowcaseLoop, delay);
    };

    pauseShowcaseFor = (duration) => {
      pauseUntil = Number.isFinite(duration)
        ? window.performance.now() + duration
        : Number.POSITIVE_INFINITY;
      stopShowcaseLoop();
      scheduleShowcaseResume();
    };

    const animateShowcase = (time) => {
      animationFrameId = 0;
      if (!canAnimateShowcase()) {
        stopShowcaseLoop();
        scheduleShowcaseResume();
        return;
      }

      const elapsed = lastFrameTime === null ? 0 : Math.min(time - lastFrameTime, 50);
      if (loopDistance > 0) {
        loopPosition += (loopSpeed * elapsed) / 1000;
        if (loopPosition >= loopDistance) loopPosition -= loopDistance;
        showcase.scrollLeft = loopPosition;
      }

      lastFrameTime = time;
      animationFrameId = window.requestAnimationFrame(animateShowcase);
    };

    showcase.addEventListener('pointerenter', () => {
      pointerPaused = true;
      stopShowcaseLoop();
    });
    showcase.addEventListener('pointerleave', () => {
      pointerPaused = false;
      startShowcaseLoop();
    });
    showcase.addEventListener('pointerdown', () => pauseShowcaseFor(Number.POSITIVE_INFINITY));
    showcase.addEventListener('pointerup', () => pauseShowcaseFor(1400));
    showcase.addEventListener('pointercancel', () => pauseShowcaseFor(1400));
    showcase.addEventListener('focusin', () => {
      focusPaused = true;
      stopShowcaseLoop();
    });
    showcase.addEventListener('focusout', (event) => {
      if (!showcase.contains(event.relatedTarget)) {
        focusPaused = false;
        startShowcaseLoop();
      }
    });

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      showcaseVisible = entry.isIntersecting;
      if (showcaseVisible) startShowcaseLoop();
      else stopShowcaseLoop();
    }, { threshold: 0.05 });

    visibilityObserver.observe(showcase);
    window.addEventListener('resize', updateLoopDistance);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopShowcaseLoop();
      else startShowcaseLoop();
    });
    window.requestAnimationFrame(() => {
      updateLoopDistance();
      startShowcaseLoop();
    });
  }

  showcase.addEventListener('click', (event) => {
    const item = event.target.closest('.flow-showcase-item');
    if (!item) return;

    const image = item.querySelector('.flow-showcase-img');
    const label = item.querySelector('.flow-showcase-label')?.textContent.trim() || '';

    if (!image) return;

    lightboxTitle.textContent = label;
    lightboxContent.replaceChildren(createFigure(image));
    activeCard = item.classList.contains('is-clone')
      ? showcaseItems[Number(item.dataset.sourceIndex)]
      : item;
    lightbox.showModal();
    closeButton.focus();
    window.requestAnimationFrame(() => lightbox.classList.add('is-visible'));
  });

  closeButton.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  lightbox.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeLightbox();
  });

  lightbox.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      lightbox.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) return;
    if (focusableElements.length === 1) {
      event.preventDefault();
      firstElement.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });

  lightbox.addEventListener('close', () => {
    window.clearTimeout(closeTimer);
    lightbox.classList.remove('is-visible');
    lightboxTitle.textContent = '';
    lightboxContent.replaceChildren();
    activeCard?.focus();
    activeCard = null;
  });
})();
