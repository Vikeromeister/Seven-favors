export const motion = {
  factor: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : 1
};

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms * motion.factor));
}

export function rectOf(el) {
  return el.getBoundingClientRect();
}

/**
 * Fly a card clone (in #fx-layer, position:fixed, viewport coords) from one rect to another,
 * optionally flipping it. Front = face image, back = card back.
 * @returns {Promise<HTMLElement>} resolves after landing; the clone is removed unless keep=true.
 */
export function flyCard({ from, to, frontSrc = null, backSrc, startFaceUp, endFaceUp,
                          duration = 550, delay = 0, keep = false }) {
  const layer = document.getElementById('fx-layer');
  const card = document.createElement('div');
  card.className = 'fx-card';
  Object.assign(card.style, {
    left: `${from.left}px`, top: `${from.top}px`,
    width: `${from.width}px`, height: `${from.height}px`
  });
  const inner = document.createElement('div');
  inner.className = 'fx-inner';
  const front = document.createElement('div');
  front.className = 'fx-face fx-front';
  if (frontSrc) front.style.backgroundImage = `url('${frontSrc}')`;
  const back = document.createElement('div');
  back.className = 'fx-face fx-back';
  back.style.backgroundImage = `url('${backSrc}')`;
  inner.append(front, back);
  card.append(inner);
  layer.append(card);

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const opts = {
    duration: Math.max(1, duration * motion.factor),
    delay: delay * motion.factor,
    easing: 'cubic-bezier(.2,.7,.2,1)',
    fill: 'forwards'
  };
  const r0 = startFaceUp ? 0 : 180;
  const r1 = endFaceUp ? 0 : 180;
  const move = card.animate([
    { transform: 'translate(0px, 0px) scale(1, 1)' },
    { transform: `translate(${dx / 2}px, ${dy / 2 - 30}px) scale(${((1 + sx) / 2) * 1.08}, ${((1 + sy) / 2) * 1.08})`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }
  ], opts);
  const flip = inner.animate([
    { transform: `rotateY(${r0}deg)` },
    { transform: `rotateY(${r1}deg)` }
  ], opts);
  return Promise.all([move.finished, flip.finished]).then(() => {
    if (!keep) card.remove();
    return card;
  });
}

export function clearFx() {
  document.getElementById('fx-layer')?.replaceChildren();
}
