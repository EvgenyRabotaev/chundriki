// Параллакс и искры в hero. Без зависимостей, только transform + requestAnimationFrame.
(function () {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const layers = [...hero.querySelectorAll('.layer')].map((el) => ({
    el, speed: parseFloat(el.dataset.speed || 0), mouse: parseFloat(el.dataset.mouse || 0),
  }));
  const content = hero.querySelector('.hero-content');
  const cue = hero.querySelector('.scroll-cue');

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { threshold: 0 }).observe(hero);

  // ---------- Параллакс ----------
  let mx = 0, my = 0, cx = 0, cy = 0, lastScroll = -1, raf = 0;
  if (!reduce && fine) {
    window.addEventListener('mousemove', (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      kick();
    }, { passive: true });
  }
  if (!reduce) window.addEventListener('scroll', kick, { passive: true });

  function kick() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    if (!visible) return;
    const sy = Math.min(window.scrollY, window.innerHeight * 1.5);
    cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
    for (const l of layers) {
      const x = -cx * l.mouse, y = sy * l.speed - cy * l.mouse * 0.6;
      l.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }
    if (content) {
      content.style.transform = `translate3d(0, ${(sy * 0.35).toFixed(1)}px, 0)`;
      content.style.opacity = Math.max(0, 1 - sy / (window.innerHeight * 0.7)).toFixed(3);
    }
    if (cue) cue.style.opacity = Math.max(0, 1 - sy / 120).toFixed(2);
    const moving = Math.abs(mx - cx) > 0.001 || Math.abs(my - cy) > 0.001 || sy !== lastScroll;
    lastScroll = sy;
    if (moving) kick();
  }
  kick();

  // ---------- Искры ----------
  const canvas = hero.querySelector('.embers');
  if (!canvas || reduce) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0, parts = [];
  const mobile = window.innerWidth < 760;
  const COUNT = mobile ? 26 : 64;

  // Предрендер светящейся точки
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sg = sprite.getContext('2d');
  const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.15, 'rgba(255,180,90,.95)');
  grad.addColorStop(0.4, 'rgba(255,110,30,.35)');
  grad.addColorStop(1, 'rgba(255,80,0,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 64, 64);

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(p, initial) {
    // Чаще со стороны костра (справа внизу), иногда по всей ширине
    const nearFire = Math.random() < 0.65;
    p.x = nearFire ? W * (mobile ? 0.55 + Math.random() * 0.4 : 0.55 + Math.random() * 0.35) : Math.random() * W;
    p.y = initial ? H * (0.3 + Math.random() * 0.7) : H + 10;
    p.vy = 0.25 + Math.random() * 0.75;
    p.vx = (Math.random() - 0.3) * 0.25;
    p.size = 3 + Math.random() * (mobile ? 6 : 9);
    p.life = 0; p.max = 260 + Math.random() * 380;
    p.phase = Math.random() * Math.PI * 2; p.wob = 0.3 + Math.random() * 0.9;
    return p;
  }
  resize();
  for (let i = 0; i < COUNT; i++) parts.push(spawn({}, true));
  window.addEventListener('resize', resize, { passive: true });

  let last = performance.now(), running = false;
  function loop(now) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(3, (now - last) / 16.67); last = now;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.life += dt;
      p.phase += 0.02 * dt;
      p.x += (p.vx + Math.sin(p.phase) * p.wob * 0.35) * dt;
      p.y -= p.vy * dt;
      const t = p.life / p.max;
      if (t >= 1 || p.y < -20) { spawn(p, false); continue; }
      const a = Math.sin(Math.PI * t) * (0.55 + 0.45 * Math.sin(p.phase * 6));
      ctx.globalAlpha = Math.max(0, a);
      const s = p.size * (1 - t * 0.5);
      ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  function start() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  document.addEventListener('visibilitychange', start);
  new IntersectionObserver(([e]) => { if (e.isIntersecting) start(); }).observe(hero);
  start();
})();
