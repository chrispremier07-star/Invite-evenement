/* Effets allégés : zoom des photos, lumière qui suit le doigt, révélation des textes, compte à rebours qui se retourne,
   boutons magnétiques, retour haptique, photos flottantes de la frise.
   À ajouter en DERNIER avant </body> :  <script src="sublime2.js"></script>   (retirer la ligne = retour à l'état précédent)
   Chaque bloc est indépendant : supprimez-en un pour le désactiver. */
(function(){
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doux = 'cubic-bezier(.22,.61,.36,1)';
  const $ = s => document.querySelector(s);
  const ST = window.setTimeout.bind(window);
  const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch(e){} };
  const lancerQuandRevele = fn => {
    if (document.body.classList.contains('revele')) return fn();
    const mo = new MutationObserver(() => { if (document.body.classList.contains('revele')){ mo.disconnect(); fn(); } });
    mo.observe(document.body, {attributes:true, attributeFilter:['class']});
  };
  const css = t => { const s = document.createElement('style'); s.textContent = t; document.head.appendChild(s); };

  /* ============ 5. Photos : léger zoom arrière à l'apparition ============ */
  try {
    if (!calme) css('#grille .g-cadre img{scale:1.2;transition:scale 2.6s ' + doux + '}#grille .apparait.visible .g-cadre img{scale:1}');
  } catch(err){}

  /* ============ 6. Lumière dorée qui suit le doigt (sections sombres, déplacement par transformation) ============ */
  try {
    if (!calme){
      const secs = ['#lieu', '#rsvp', 'footer.pied'].map($).filter(Boolean).map(s => {
        if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
        s.style.overflow = 'hidden';
        const g = document.createElement('div');
        g.setAttribute('aria-hidden', 'true');
        g.style.cssText = 'position:absolute;left:0;top:0;width:420px;height:420px;margin:-210px 0 0 -210px;pointer-events:none;z-index:0;opacity:0;transition:opacity 1.2s ease;background:radial-gradient(circle,rgba(224,191,126,.24),rgba(224,191,126,0) 68%);will-change:transform,opacity;transform:translate3d(0,0,0)';
        s.insertBefore(g, s.firstChild);
        return {s, g, cx: 0, cy: 0, tx: 0, ty: 0, on: false};
      });
      let lx = 0, ly = -9999, raf = 0, stopT;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const rects = secs.map(o => o.s.getBoundingClientRect());
        secs.forEach((o, i) => {
          const r = rects[i], dedans = ly >= r.top && ly <= r.bottom;
          if (dedans){ o.tx = lx - r.left; o.ty = ly - r.top; if (!o.on){ o.cx = o.tx; o.cy = o.ty; o.on = true; o.g.style.opacity = 1; } }
          else if (o.on){ o.on = false; o.g.style.opacity = 0; }
          if (o.on){ o.cx += (o.tx - o.cx) * .14; o.cy += (o.ty - o.cy) * .14; o.g.style.transform = 'translate3d(' + o.cx.toFixed(1) + 'px,' + o.cy.toFixed(1) + 'px,0)'; }
        });
      };
      const bouge = (x, y) => { lx = x; ly = y; clearTimeout(stopT); if (!raf) raf = requestAnimationFrame(tick); };
      const fin = () => { ly = -9999; clearTimeout(stopT); stopT = ST(() => { cancelAnimationFrame(raf); raf = 0; secs.forEach(o => { o.on = false; o.g.style.opacity = 0; }); }, 1600); };
      addEventListener('pointermove', e => bouge(e.clientX, e.clientY), {passive:true});
      addEventListener('touchstart', e => bouge(e.touches[0].clientX, e.touches[0].clientY), {passive:true});
      addEventListener('touchmove', e => bouge(e.touches[0].clientX, e.touches[0].clientY), {passive:true});
      addEventListener('touchend', fin, {passive:true}); addEventListener('touchcancel', fin, {passive:true});
      document.addEventListener('pointerleave', fin);
    }
  } catch(err){}

  /* ============ 7. Textes : révélation plus lente et plus souple (mots des titres, blocs) ============ */
  try {
    if (!calme) css('.m{transform:translate3d(0,.55em,0);transition:opacity 1.5s cubic-bezier(.16,1,.3,1),transform 1.8s cubic-bezier(.16,1,.3,1)}' +
      '.apparait{transform:translate3d(0,22px,0);transition:opacity 1.7s cubic-bezier(.16,1,.3,1),transform 1.8s cubic-bezier(.16,1,.3,1)}' +
      '.apparait.visible{transform:none}');
  } catch(err){}

  /* ============ 10. Compte à rebours qui se retourne (volet de gare) ============ */
  try {
    if (!calme){
      document.querySelectorAll('#compteur strong').forEach(n => {
        n.style.transformOrigin = '50% 100%';
        new MutationObserver(() => {
          n.animate([{transform: 'perspective(260px) rotateX(-85deg)', opacity: 0}, {transform: 'perspective(260px) rotateX(0deg)', opacity: 1}], {duration: 720, easing: 'cubic-bezier(.3,1.25,.5,1)'});
        }).observe(n, {childList:true, characterData:true, subtree:true});
      });
    }
  } catch(err){}

  /* ============ 11. Boutons magnétiques (ordinateur, lectures groupées) + appui doux (téléphone) ============ */
  try {
    css('.btn{transition:background .6s ' + doux + ',color .6s ' + doux + ',border-color .6s ' + doux + ',transform .6s ' + doux + ',translate .5s ' + doux + ',scale .3s ' + doux + '}');
    if (!calme){
      let att = false, px = 0, py = 0;
      const maj = () => { att = false;
        const els = [...document.querySelectorAll('.btn')], vh = innerHeight;
        const rects = els.map(b => b.getBoundingClientRect());
        els.forEach((b, i) => {
          const r = rects[i];
          if (r.bottom < -80 || r.top > vh + 80) return;
          const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
          const proche = Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 70;
          const v = proche ? Math.max(-9, Math.min(9, dx * .2)).toFixed(1) + 'px ' + Math.max(-7, Math.min(7, dy * .28)).toFixed(1) + 'px' : '0px 0px';
          if (b.__t !== v){ b.__t = v; b.style.translate = v; }
        });
      };
      addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; px = e.clientX; py = e.clientY; if (!att){ att = true; requestAnimationFrame(maj); } }, {passive:true});
      addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('.btn'); if (b) b.style.scale = '.96'; }, {passive:true});
      const rel = () => document.querySelectorAll('.btn').forEach(b => b.style.scale = '');
      addEventListener('pointerup', rel, {passive:true}); addEventListener('pointercancel', rel, {passive:true});
    }
  } catch(err){}

  /* ============ 12. Retour haptique (Android) ============ */
  try {
    document.addEventListener('click', e => {
      if (e.target.closest('#ouvrir')){ vib(18); ST(() => vib(12), 300); ST(() => vib([10, 60, 10]), 3400); }
      else if (e.target.closest('.btn,.ct-btn,#son')) vib(10);
    }, true);
    lancerQuandRevele(() => vib([30, 60, 30]));
  } catch(err){}

  /* ============ 13. Photos flottantes autour de la frise (parallaxe à plusieurs profondeurs) ============ */
  try {
    const sec = $('#histoire');
    if (sec){
      let src = [];
      try { src = (INVITATION.galerie.photos || []).slice(1, 5); } catch(e){}
      if (!src.length) src = [...document.querySelectorAll('#grille img')].slice(1, 5).map(i => i.getAttribute('src'));
      const defs = [{top: 16, cote: 'g', t: 64, rot: -6, v: 70}, {top: 40, cote: 'd', t: 72, rot: 5, v: -50}, {top: 63, cote: 'g', t: 58, rot: 4, v: 90}, {top: 85, cote: 'd', t: 66, rot: -5, v: -80}];
      css('.photo-flotte{position:absolute;z-index:0;pointer-events:none;padding:4px;background:#FBF8F1;box-shadow:0 12px 26px -14px rgba(59,34,24,.55);opacity:0;transition:opacity 1.6s ease;will-change:transform}' +
          '.photo-flotte img{display:block;width:100%;height:100%;object-fit:cover;filter:sepia(.18)}' +
          '.photo-flotte.vu{opacity:.26}' +
          '@media (min-width:900px){.photo-flotte.vu{opacity:.95}}');
      sec.classList.add('has-filigrane');
      const photos = src.map((s, i) => {
        const d = defs[i % defs.length], el = document.createElement('div');
        el.className = 'photo-flotte'; el.setAttribute('aria-hidden', 'true');
        el.style.cssText += 'top:' + d.top + '%;width:' + d.t + 'px;height:' + Math.round(d.t * 1.22) + 'px;' + (d.cote === 'g' ? 'left:-8px' : 'right:-8px');
        el.dataset.wide = d.cote; el.innerHTML = '<img src="' + s + '" alt="" loading="lazy" decoding="async">';
        sec.appendChild(el);
        return {el, d};
      });
      const place = () => photos.forEach(({el, d}) => {
        if (innerWidth >= 900){ const m = 'calc(50% - 310px - ' + (d.t + 28) + 'px)'; if (d.cote === 'g'){ el.style.left = m; el.style.right = 'auto'; } else { el.style.right = m; el.style.left = 'auto'; } }
        else { if (d.cote === 'g'){ el.style.left = '-8px'; el.style.right = 'auto'; } else { el.style.right = '-8px'; el.style.left = 'auto'; } }
      });
      place(); addEventListener('resize', place);
      if (!calme){
        let att = false;
        const maj = () => { att = false; const vh = innerHeight, r = sec.getBoundingClientRect();
          if (r.bottom < -50 || r.top > vh + 50) return;
          const k = (r.top + r.height / 2 - vh / 2) / vh;
          photos.forEach(({el, d}) => { el.style.transform = 'translate3d(0,' + (k * d.v).toFixed(1) + 'px,0) rotate(' + (d.rot + k * 3).toFixed(2) + 'deg)'; el.classList.add('vu'); });
        };
        const plan = () => { if (!att){ att = true; requestAnimationFrame(maj); } };
        addEventListener('scroll', plan, {passive:true}); addEventListener('resize', plan); plan();
      } else photos.forEach(({el, d}) => { el.style.transform = 'rotate(' + d.rot + 'deg)'; el.classList.add('vu'); });
    }
  } catch(err){}
})();
