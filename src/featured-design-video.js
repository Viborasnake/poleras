import videoUrl from './media/zelda-ocarina-of-time.mp4?url';

export const legacyFeaturedVideoUrl = videoUrl;

export function createFeaturedDesignVideo() {
 const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
 const mounts = new WeakMap();
 const candidates = new Set(), played = new Set();
 let queued = false;
 let active = null;

 function queueAutoplay() {
  if (queued || active || document.hidden || reducedMotion.matches) return;
  queued = true;
  requestAnimationFrame(() => {
   queued = false;
   if (!active && !document.hidden && !reducedMotion.matches && !document.querySelector('dialog[open]')) {
    for (const autoplay of candidates) if (autoplay()) break;
   }
  });
 }

 document.addEventListener('visibilitychange', () => {
  if (document.hidden) active?.stop();
  else queueAutoplay();
 });
 document.addEventListener('close', queueAutoplay, true);
 document.addEventListener('focusin', event => {
  const dialog = event.target.closest('dialog[open]');
  if (dialog && active && active.dialog !== dialog) active.stop();
 });
 reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && active?.automatic) active.stop();
  else queueAutoplay();
 });

 return (scope, enabled = true) => {
  mounts.get(scope)?.();
  if (!enabled) return;
  const listeners = new AbortController();
  const {signal} = listeners;
  const cleanup = [];

  for (const video of scope.querySelectorAll('[data-featured-design-video]')) {
   const host = video.closest('[data-catalog-video-host]');
   const control = host?.querySelector('[data-featured-video-control]');
   const url = video.dataset.featuredDesignVideo;
   if (!control || !url || !video.canPlayType('video/mp4')) continue;
   let attempt = 0, ratio = 0;
   const entry = {dialog:video.closest('dialog'),automatic:false,stop};
   const auto = video.hasAttribute('data-featured-video-autoplay');
   const label = control.dataset.videoLabel || '';
   function controlText(text) {
    control.textContent = text;
    if (label) control.setAttribute('aria-label',`${text} · ${label}`);
   }
   function stop() {
    attempt++;
    if (active === entry) {
     active = null;
     queueAutoplay();
    }
    video.pause();
    if (video.currentTime) video.currentTime = 0;
    video.classList.remove('is-playing');
    delete host.dataset.videoActive;
    controlText('Ver video');
   }
   function unavailable() {
    stop();
    controlText('Reintentar video');
    video.removeAttribute('src');
    video.load();
   }
   async function play(automatic) {
    if (active && active !== entry) active.stop();
    active = entry;
    host.dataset.videoActive = '';
    if (auto) played.add(url);
    entry.automatic = automatic;
    const currentAttempt = ++attempt;
    controlText('Detener video');
    video.muted = true;
    if (!video.hasAttribute('src')) video.src = url;
    try {
     await video.play();
     if (currentAttempt === attempt) video.classList.add('is-playing');
    } catch {
     if (currentAttempt === attempt) unavailable();
    }
   }

   controlText('Ver video');
   control.hidden = false;
   control.addEventListener('click', event => {
    event.stopPropagation();
    if (active === entry) stop();
    else void play(false);
   }, {signal});
   video.addEventListener('ended',stop,{signal});
   video.addEventListener('error',unavailable,{signal});
   entry.dialog?.addEventListener('close',stop,{signal});

   const autoplay = () => {
    if (played.has(url) || ratio < .35) return false;
    void play(true);
    return true;
   };
   if (auto) candidates.add(autoplay);
   const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([position]) => {
      ratio = position.intersectionRatio;
      if (!position.isIntersecting && active === entry) stop();
      if (auto) queueAutoplay();
     },{threshold:[0,.35]})
    : null;
   observer?.observe(host);
   cleanup.push(() => {
    observer?.disconnect();
    if (auto) candidates.delete(autoplay);
    if (active === entry) stop();
    if (video.hasAttribute('src')) {
     video.removeAttribute('src');
     video.load();
    }
    control.hidden = true;
   });
  }

  mounts.set(scope, () => {
   listeners.abort();
   cleanup.forEach(dispose => dispose());
   mounts.delete(scope);
  });
 };
}
