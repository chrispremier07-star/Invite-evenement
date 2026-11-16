/* Sublimation : photo d'accueil vivante, prénoms écrits à la plume, scènes animées de la frise, séparateurs dorés.
   À ajouter avant </body> :  <script src="sublime.js"></script>   (retirer la ligne = retour à l'état précédent)
   Chaque bloc est indépendant : supprimez-en un pour le désactiver. */
(function(){
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const OR = '#C49A4A', RUBIS = '#8B0F1C';
  const doux = 'cubic-bezier(.22,.61,.36,1)';
  const ST = window.setTimeout.bind(window);
  const lancerQuandRevele = fn => {
    if (document.body.classList.contains('revele')) return fn();
    const mo = new MutationObserver(() => { if (document.body.classList.contains('revele')){ mo.disconnect(); fn(); } });
    mo.observe(document.body, {attributes:true, attributeFilter:['class']});
  };

  /* ============ 1. Photo d'accueil vivante : lent zoom + gyroscope ============ */
  try {
    const img = document.getElementById('heroImg'), hero = document.getElementById('accueil');
    if (img && hero && !calme){
      const st = document.createElement('style');
      st.textContent = '@keyframes kenBurns{from{scale:1.08}to{scale:1.19}}#heroImg{animation:kenBurns 26s ease-in-out infinite alternate;will-change:scale,translate}';
      document.head.appendChild(st);
      let cx = 0, cy = 0, tx = 0, ty = 0, vu = true, actif = false;
      const lim = (v, m) => Math.max(-m, Math.min(m, v));
      const boucle = () => {
        requestAnimationFrame(boucle);
        if (!vu || document.hidden) return;
        cx += (tx - cx) * .06; cy += (ty - cy) * .06;
        img.style.translate = cx.toFixed(2) + 'px ' + cy.toFixed(2) + 'px';
      };
      const ecouter = () => {
        if (actif) return; actif = true;
        addEventListener('deviceorientation', ev => {
          if (ev.gamma == null) return;
          tx = lim(ev.gamma / 25, 1) * -12; ty = lim((ev.beta - 50) / 25, 1) * -9;
        }, {passive:true});
      };
      addEventListener('pointermove', ev => {
        if (ev.pointerType !== 'mouse') return;
        tx = (ev.clientX / innerWidth - .5) * -20; ty = (ev.clientY / innerHeight - .5) * -14;
      }, {passive:true});
      document.addEventListener('click', ev => {
        if (!ev.target.closest('#ouvrir')) return;
        const D = window.DeviceOrientationEvent;
        if (D && typeof D.requestPermission === 'function') D.requestPermission().then(r => { if (r === 'granted') ecouter(); }).catch(()=>{});
        else ecouter();
      }, true);
      if ('IntersectionObserver' in window) new IntersectionObserver(e => vu = e[0].isIntersecting).observe(hero);
      requestAnimationFrame(boucle);
    }
  } catch(err){}

  /* ============ 2. Prénoms : apparition lettre par lettre (opacité + transformation uniquement, fluide) ============ */
  try {
    const h = document.getElementById('heroNoms');
    if (h && !calme){
      const st = document.createElement('style');
      st.textContent = '.lettre{display:inline-block;opacity:0;transform:translate3d(0,.42em,0) scale(.94);color:#E0BF7E;will-change:opacity,transform;transition:opacity 1.4s cubic-bezier(.16,1,.3,1),transform 1.6s cubic-bezier(.16,1,.3,1),color 2.6s ease}' +
        '#heroNoms.ecrit .lettre{opacity:1;transform:none;color:inherit}';
      document.head.appendChild(st);
      let n = 0;
      h.querySelectorAll('.m').forEach(sp => {
        sp.style.transition = 'none'; sp.style.opacity = 1; sp.style.transform = 'none';
        const t = sp.textContent;
        sp.setAttribute('aria-label', t);
        sp.innerHTML = [...t].map(ch => '<span class="lettre" aria-hidden="true" style="transition-delay:' + (0.45 + (n++) * 0.1).toFixed(2) + 's">' + (ch === ' ' ? '&nbsp;' : ch) + '</span>').join('');
      });
      lancerQuandRevele(() => requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('ecrit'))));
    }
  } catch(err){}

  /* ============ 3. Scènes animées de la frise « Notre histoire » ============ */
  try {
    const etapes = [...document.querySelectorAll('#frise .etape')];
    if (etapes.length){
      const st = document.createElement('style');
      st.textContent = '#frise .etape{padding-right:64px}.etape-scene{position:absolute;right:0;top:-6px;width:54px;height:54px;pointer-events:none}.etape-scene svg{width:100%;height:100%;overflow:visible}';
      document.head.appendChild(st);
      const sparkle = (x, y, r) => '<path class="spk" d="M' + x + ' ' + (y - r) + 'L' + (x + r * .28) + ' ' + (y - r * .28) + 'L' + (x + r) + ' ' + y + 'L' + (x + r * .28) + ' ' + (y + r * .28) + 'L' + x + ' ' + (y + r) + 'L' + (x - r * .28) + ' ' + (y + r * .28) + 'L' + (x - r) + ' ' + y + 'L' + (x - r * .28) + ' ' + (y - r * .28) + 'Z" fill="' + OR + '" style="transform-box:fill-box;transform-origin:center"/>';
      const S = (c) => '<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + c + '</svg>';
      const scenes = [
        /* rencontre : un cœur qui se dessine et bat */
        S('<g class="pulse" style="transform-box:fill-box;transform-origin:center"><path class="dessin" d="M24 41C8 29 6 17 14 12.5 19 10 23 12.5 24 17 25 12.5 29 10 34 12.5 42 17 40 29 24 41Z" stroke="' + RUBIS + '" stroke-width="1.6" fill="' + RUBIS + '" fill-opacity="0"/></g>' + sparkle(40, 8, 4) + sparkle(8, 10, 3)),
        /* premier rendez-vous : deux tasses qui trinquent, vapeur */
        S('<g class="tasse g"><g style="transform-box:view-box"><path class="dessin" d="M6 22h15v9a7.5 7.5 0 01-15 0zM21 24h2.2a3 3 0 010 6H21" stroke="' + RUBIS + '" stroke-width="1.6"/></g></g>' +
          '<g class="tasse d" transform="translate(48 0) scale(-1 1)"><path class="dessin" d="M6 22h15v9a7.5 7.5 0 01-15 0zM21 24h2.2a3 3 0 010 6H21" stroke="' + RUBIS + '" stroke-width="1.6"/></g>' +
          '<path class="vap" d="M20 17c-2-2 2-4 0-6M28 17c-2-2 2-4 0-6" stroke="' + OR + '" stroke-width="1.3"/>' + sparkle(24, 24, 4)),
        /* demande : une bague qui scintille */
        S('<ellipse class="dessin" cx="24" cy="32" rx="11" ry="10" stroke="' + RUBIS + '" stroke-width="1.7"/>' +
          '<path class="dessin" d="M24 8l6.5 6.5L24 23l-6.5-8.5z M17.5 14.5h13" stroke="' + OR + '" stroke-width="1.5" fill="' + OR + '" fill-opacity=".15"/>' + sparkle(37, 9, 5) + sparkle(9, 18, 3.5) + sparkle(40, 24, 2.6))
      ];
      etapes.forEach((et, i) => {
        const box = document.createElement('div');
        box.className = 'etape-scene'; box.innerHTML = scenes[i % scenes.length];
        et.insertBefore(box, et.firstChild);
        const dessins = [...box.querySelectorAll('.dessin')];
        dessins.forEach(p => { const L = p.getTotalLength ? p.getTotalLength() : 100; p.style.strokeDasharray = L; p.style.strokeDashoffset = calme ? 0 : L; p.__L = L; if (calme) p.style.fillOpacity = ''; });
        if (calme) { box.querySelectorAll('.dessin[fill]').forEach(p => p.setAttribute('fill-opacity', .2)); return; }
        let joue = false;
        const jouer = () => {
          if (joue) return; joue = true;
          dessins.forEach((p, k) => {
            p.animate([{strokeDashoffset: p.__L}, {strokeDashoffset: 0}], {duration: 1700, delay: 250 + k * 250, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards'});
            if (p.hasAttribute('fill-opacity')) p.animate([{fillOpacity: 0}, {fillOpacity: .22}], {duration: 900, delay: 1500, fill: 'forwards'});
          });
          const sc = (el, a, b, dur, d) => el && el.animate(a, {duration: dur, delay: d, iterations: Infinity, easing: 'ease-in-out', ...(b||{})});
          box.querySelectorAll('.pulse').forEach(el => sc(el, [{transform:'scale(1)'},{transform:'scale(1.12)',offset:.14},{transform:'scale(1)',offset:.28},{transform:'scale(1.08)',offset:.4},{transform:'scale(1)',offset:.55},{transform:'scale(1)'}], null, 2600, 1900));
          box.querySelectorAll('.spk').forEach((el, k) => sc(el, [{transform:'scale(0) rotate(0deg)',opacity:0},{transform:'scale(1) rotate(45deg)',opacity:1,offset:.4},{transform:'scale(0) rotate(90deg)',opacity:0}], null, 2600, 1200 + k * 700));
          const g = box.querySelector('.tasse.g > g'), d = box.querySelector('.tasse.d');
          if (g){ g.style.transformOrigin = '13px 38px'; sc(g, [{transform:'rotate(0deg)'},{transform:'rotate(0deg)',offset:.35},{transform:'rotate(11deg)',offset:.5},{transform:'rotate(2deg)',offset:.6},{transform:'rotate(0deg)',offset:.8},{transform:'rotate(0deg)'}], null, 3200, 1800); }
          if (d){ const inner = d; inner.style.transformBox = 'view-box'; }
          const vap = box.querySelector('.vap');
          if (vap){ vap.style.opacity = 0; sc(vap, [{opacity:0,transform:'translateY(4px)'},{opacity:.9,offset:.4},{opacity:0,transform:'translateY(-6px)'}], null, 2600, 2000); }
          const boucles = () => box.getAnimations({subtree:true}).filter(an => an.effect && an.effect.getTiming().iterations === Infinity);
          new IntersectionObserver(e => boucles().forEach(an => e[0].isIntersecting ? an.play() : an.pause())).observe(box);
        };
        new IntersectionObserver((e, o) => { if (e[0].isIntersecting){ jouer(); o.disconnect(); } }, {threshold:.5}).observe(et);
      });
    }
  } catch(err){}

  /* ============ 4. Séparateurs dorés entre les sections ============ */
  try {
    const st = document.createElement('style');
    st.textContent =
      '.sep{height:0;position:relative;z-index:3;pointer-events:none}' +
      '.sep-in{position:absolute;left:50%;top:0;transform:translate(-50%,-50%);display:flex;align-items:center;gap:12px}' +
      '.sep-l,.sep-r{display:block;height:1px;width:min(24vw,104px);transition:transform 1.8s ' + doux + '}' +
      '.sep-l{background:linear-gradient(90deg,rgba(196,154,74,0),' + OR + ');transform:scaleX(0);transform-origin:100% 50%}' +
      '.sep-r{background:linear-gradient(270deg,rgba(196,154,74,0),' + OR + ');transform:scaleX(0);transform-origin:0 50%}' +
      '.sep-d{position:relative;width:16px;height:16px;border:1px solid ' + OR + ';background:rgba(196,154,74,.2);transform:rotate(0deg) scale(0);transition:transform 1.5s ' + doux + ' .55s}' +
      '.sep-d::after{content:"";position:absolute;inset:4px;background:' + OR + '}' +
      '.sep-p{display:block;width:4px;height:4px;border-radius:50%;background:' + OR + ';opacity:0;transform:scale(0);transition:opacity 1s ease 1.3s,transform 1s ' + doux + ' 1.3s}' +
      '.sep.visible .sep-l,.sep.visible .sep-r{transform:scaleX(1)}' +
      '.sep.visible .sep-d{transform:rotate(225deg) scale(1)}' +
      '.sep.visible .sep-p{opacity:.9;transform:scale(1)}' +
      '@media (prefers-reduced-motion:reduce){.sep *{transition:none!important}}';
    document.head.appendChild(st);
    const cibles = ['#histoire','#galerie','#programme','#lieu','#tenue','#rsvp','#contacts','footer.pied'].map(s => document.querySelector(s)).filter(Boolean);
    const io = 'IntersectionObserver' in window && !calme ? new IntersectionObserver((en, o) => en.forEach(e => { if (e.isIntersecting){ e.target.closest('.sep').classList.add('visible'); o.unobserve(e.target); } }), {threshold:.6}) : null;
    cibles.forEach(c => {
      const sep = document.createElement('div');
      sep.className = 'sep'; sep.setAttribute('aria-hidden', 'true');
      sep.innerHTML = '<div class="sep-in"><i class="sep-l"></i><i class="sep-p"></i><i class="sep-d"></i><i class="sep-p"></i><i class="sep-r"></i></div>';
      c.parentNode.insertBefore(sep, c);
      if (io) io.observe(sep.querySelector('.sep-in')); else sep.classList.add('visible');
    });
  } catch(err){}
})();
