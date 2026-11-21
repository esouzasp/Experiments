// Animações do cabeçalho: título que "se decifra" e fluxo de hexadecimal
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GLYPHS = 'ABCDEF0123456789#$%&*<>/\\|=+';
  const hex = () => '0123456789abcdef'[Math.random() * 16 | 0];

  document.querySelectorAll('[data-scramble]').forEach(el => {
    const final = el.dataset.scramble;
    el.textContent = final;
    if (reduce) return;
    const run = () => {
      let frame = 0;
      const t = setInterval(() => {
        el.textContent = [...final].map((c, i) =>
          c === '_' || c === ' ' || i < frame / 2 ? c : GLYPHS[Math.random() * GLYPHS.length | 0]).join('');
        if (++frame > final.length * 2) { clearInterval(t); el.textContent = final; }
      }, 40);
    };
    run();
    setInterval(() => { if (!document.hidden) run(); }, 15000);
  });

  document.querySelectorAll('.hx-stream').forEach(el => {
    const tok = () => Math.random() < 0.08 ? '··' : hex() + hex();
    const buf = Array.from({ length: 90 }, tok);
    el.textContent = buf.join(' ');
    if (reduce) return;
    setInterval(() => {
      if (document.hidden) return;
      buf.pop(); buf.unshift(tok());
      el.textContent = buf.join(' ');
    }, 110);
  });
})();
