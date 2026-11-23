import videoUrl from './media/zelda-ocarina-of-time.mp4?url';

export function createFeaturedDesignVideo() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let played = false;
  let disconnect = () => {};

  return (grid) => {
    disconnect();
    disconnect = () => {};
    const video = grid.querySelector('[data-featured-design-video]');
    const control = grid.querySelector('[data-featured-video-control]');
    if (!video || !control || !video.canPlayType('video/mp4')) return;

    const card = video.closest('.catalog-card');
    const listeners = new AbortController();
    const {signal} = listeners;
    let attempt = 0;
    let active = false;
    let automatic = false;
    let ratio = 0;

    function stop() {
      attempt++;
      active = false;
      video.pause();
      if (video.currentTime) video.currentTime = 0;
      video.classList.remove('is-playing');
      control.textContent = 'Ver video';
    }

    async function play(autoplay) {
      const currentAttempt = ++attempt;
      played = active = true;
      automatic = autoplay;
      control.textContent = 'Detener video';
      video.muted = true;
      if (!video.hasAttribute('src')) video.src = videoUrl;
      try {
        await video.play();
        if (currentAttempt === attempt) video.classList.add('is-playing');
      } catch {
        if (currentAttempt === attempt) stop();
      }
    }

    function tryAutoplay() {
      if (!played && ratio >= 0.35 && !document.hidden && !reducedMotion.matches &&
          !document.querySelector('dialog[open]')) {
        play(true);
      }
    }

    control.hidden = false;
    control.addEventListener('click', (event) => {
      event.stopPropagation();
      if (active) stop();
      else play(false);
    }, {signal});
    video.addEventListener('ended', stop, {signal});
    video.addEventListener('error', stop, {signal});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else tryAutoplay();
    }, {signal});
    document.addEventListener('focusin', (event) => {
      if (active && event.target.closest('dialog[open]')) stop();
    }, {signal});
    reducedMotion.addEventListener('change', () => {
      if (automatic && reducedMotion.matches) stop();
      else tryAutoplay();
    }, {signal});

    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
        ratio = entry.intersectionRatio;
        if (!entry.isIntersecting && active) stop();
        else tryAutoplay();
      }, {threshold: [0, 0.35]})
      : null;
    observer?.observe(card);
    disconnect = () => {
      observer?.disconnect();
      listeners.abort();
      stop();
    };
  };
}
