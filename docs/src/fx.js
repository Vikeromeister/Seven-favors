export const motion = {
  factor: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : 1
};

function isHiddenDoc() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function wait(ms) {
  if (isHiddenDoc()) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms * motion.factor));
}

export function rectOf(el) {
  if (!el) return new DOMRect(0, 0, 80, 160);
  return el.getBoundingClientRect();
}

export function flyCard({ from, to, frontSrc = null, backSrc, startFaceUp, endFaceUp,
                          duration = 550, delay = 0, keep = false }) {
  const layer = document.getElementById('fx-layer');
  const card = document.createElement('div');
  card.className = 'fx-card';
  const fw = from.width || 80;
  const fh = from.height || 160;
  const tw = to.width || fw;
  const th = to.height || fh;
  Object.assign(card.style, {
    left: `${from.left}px`, top: `${from.top}px`,
    width: `${fw}px`, height: `${fh}px`
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

  const r0 = startFaceUp ? 0 : 180;
  const r1 = endFaceUp ? 0 : 180;

  if (isHiddenDoc()) {
    if (keep) {
      Object.assign(card.style, {
        left: `${to.left}px`, top: `${to.top}px`,
        width: `${tw}px`, height: `${th}px`
      });
      inner.style.transform = `rotateY(${r1}deg)`;
    } else {
      card.remove();
    }
    return Promise.resolve(card);
  }

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = tw / fw;
  const sy = th / fh;
  const dur = Math.max(1, duration * motion.factor);
  const del = delay * motion.factor;
  const opts = {
    duration: dur,
    delay: del,
    easing: 'cubic-bezier(.2,.7,.2,1)',
    fill: 'forwards'
  };
  const move = card.animate([
    { transform: 'translate(0px, 0px) scale(1, 1)' },
    { transform: `translate(${dx / 2}px, ${dy / 2 - 30}px) scale(${((1 + sx) / 2) * 1.08}, ${((1 + sy) / 2) * 1.08})`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }
  ], opts);
  const flip = inner.animate([
    { transform: `rotateY(${r0}deg)` },
    { transform: `rotateY(${r1}deg)` }
  ], opts);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      if (!keep) card.remove();
      resolve(card);
    };
    const safetyTimer = setTimeout(() => {
      try { move.finish(); } catch (_) {}
      try { flip.finish(); } catch (_) {}
      finish();
    }, dur + del + 350);
    Promise.all([move.finished, flip.finished]).then(finish, finish);
  });
}

export function clearFx() {
  document.getElementById('fx-layer')?.replaceChildren();
}
