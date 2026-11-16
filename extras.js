/* Extras : compte à rebours vivant, galerie plein écran, bouton « Ajouter à l'agenda », monogramme en filigrane.
   À ajouter avant </body> :  <script src="extras.js"></script>   (retirer la ligne = retour à l'état précédent)
   Chaque bloc est indépendant : supprimez-en un pour le désactiver. */
(function(){
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = (typeof INVITATION !== 'undefined') ? INVITATION : null;
  const doux = 'cubic-bezier(.22,.61,.36,1)';
  const e = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ============ 1. Compte à rebours vivant ============ */
  try {
    const nums = document.querySelectorAll('#compteur strong');
    if (!calme) nums.forEach((n, i) => {
      n.style.display = 'block';
      new MutationObserver(() => {
        n.animate([{transform:'translateY(38%)', opacity:0}, {transform:'none', opacity:1}], {duration:650, easing:doux});
        if (i === 3) n.animate([{textShadow:'0 0 16px rgba(224,191,126,.75)'}, {textShadow:'0 0 0 rgba(224,191,126,0)'}], {duration:900, easing:'ease-out'});
      }).observe(n, {childList:true, characterData:true, subtree:true});
    });
  } catch(err){}

  /* ============ 2. Galerie plein écran ============ */
  try {
    const imgs = [...document.querySelectorAll('#grille .g-cadre img')];
    if (imgs.length){
      const st = document.createElement('style');
      st.textContent =
        '#grille .g-cadre{cursor:zoom-in;-webkit-tap-highlight-color:transparent}#grille .g-cadre:active{filter:none}' +
        '#lb{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(26,3,6,.95);opacity:0;visibility:hidden;transition:opacity .6s ' + doux + ',visibility 0s linear .6s;touch-action:none;-webkit-user-select:none;user-select:none}' +
        '#lb.ouvert{opacity:1;visibility:visible;transition:opacity .6s ' + doux + '}' +
        '#lb .lb-enc{position:relative;filter:drop-shadow(0 0 22px rgba(236,196,110,.28))}#lb .g-pass{padding:0}#lb img{display:block;max-width:calc(92vw - 24px);max-height:calc(80vh - 24px);object-fit:contain;border-radius:1px;position:relative;z-index:1;box-shadow:0 0 0 1px rgba(176,134,52,.85),0 0 0 3px #F8F0E0,0 0 0 4px rgba(176,134,52,.55);-webkit-user-drag:none}' +
        '#lb button{position:absolute;display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:rgba(246,241,231,.1);color:#F6F1E7;transition:background .5s ease}' +
        '#lb button:hover{background:rgba(246,241,231,.22)}' +
        '#lb .lb-x{top:calc(14px + env(safe-area-inset-top));right:14px}' +
        '#lb .lb-p{left:10px;top:50%;margin-top:-24px}#lb .lb-n{right:10px;top:50%;margin-top:-24px}' +
        '#lb .lb-c{position:absolute;left:0;right:0;bottom:calc(22px + env(safe-area-inset-bottom));text-align:center;font:500 11px/1 var(--capitale,serif);letter-spacing:.3em;color:#E0BF7E}' +
        '@media (max-width:600px){#lb .lb-p,#lb .lb-n{display:none}}';
      document.head.appendChild(st);
      const lb = document.createElement('div');
      lb.id = 'lb'; lb.setAttribute('role','dialog'); lb.setAttribute('aria-label','Galerie');
      const ic = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
      lb.innerHTML = '<div class="lb-enc"><div class="g-or"><div class="g-pass"><img alt=""></div></div></div><button class="lb-x" aria-label="Fermer">' + ic('<path d="M6 6l12 12M18 6L6 18"/>') + '</button><button class="lb-p" aria-label="Précédente">' + ic('<path d="M15 5l-7 7 7 7"/>') + '</button><button class="lb-n" aria-label="Suivante">' + ic('<path d="M9 5l7 7-7 7"/>') + '</button><div class="lb-c"></div>';
      document.body.appendChild(lb);
      const fr = lb.querySelector('.lb-enc'), im = lb.querySelector('img');
      const c0 = document.querySelector('#grille .g-enc'); if (c0) c0.querySelectorAll('.g-o1,.g-o2').forEach(c => fr.appendChild(c.cloneNode(true)));
      const _u = 0, cpt = lb.querySelector('.lb-c');
      let cur = 0, ouvert = false;
      const aff = (i, dir) => {
        cur = (i + imgs.length) % imgs.length;
        im.src = imgs[cur].currentSrc || imgs[cur].src;
        cpt.textContent = (cur + 1) + ' / ' + imgs.length;
        if (!calme && dir) fr.animate([{opacity:0, transform:'translateX(' + (dir * 44) + 'px)'}, {opacity:1, transform:'none'}], {duration:520, easing:doux});
      };
      const ouvrir = i => { aff(i, 0); ouvert = true; lb.classList.add('ouvert'); document.body.style.overflow = 'hidden'; };
      const fermer = () => { ouvert = false; lb.classList.remove('ouvert'); document.body.style.overflow = ''; };
      imgs.forEach((m, i) => m.closest('.g-cadre').addEventListener('click', () => ouvrir(i)));
      lb.querySelector('.lb-x').addEventListener('click', fermer);
      lb.querySelector('.lb-p').addEventListener('click', () => aff(cur - 1, -1));
      lb.querySelector('.lb-n').addEventListener('click', () => aff(cur + 1, 1));
      lb.addEventListener('click', ev => { if (ev.target === lb) fermer(); });
      addEventListener('keydown', ev => { if (!ouvert) return; if (ev.key === 'Escape') fermer(); if (ev.key === 'ArrowLeft') aff(cur - 1, -1); if (ev.key === 'ArrowRight') aff(cur + 1, 1); });
      let x0 = null, dx = 0;
      im.addEventListener('pointerdown', ev => { x0 = ev.clientX; dx = 0; im.setPointerCapture(ev.pointerId); });
      im.addEventListener('pointermove', ev => { if (x0 === null) return; dx = ev.clientX - x0; im.style.transform = 'translateX(' + dx * .6 + 'px)'; });
      const fin = () => {
        if (x0 === null) return;
        const d = dx; x0 = null; im.style.transform = '';
        if (d < -60) aff(cur + 1, 1); else if (d > 60) aff(cur - 1, -1);
        else if (!calme && d) im.animate([{transform:'translateX(' + d * .6 + 'px)'}, {transform:'none'}], {duration:400, easing:doux});
      };
      im.addEventListener('pointerup', fin); im.addEventListener('pointercancel', fin);
    }
  } catch(err){}

  /* ============ 3. Ajouter à l'agenda ============ */
  try {
    const bouton = document.getElementById('itineraire');
    if (C && bouton){
      const DUREE_H = 8;     // durée de l'événement dans l'agenda (heures)
      const d0 = new Date(C.dateMariage), d1 = new Date(d0.getTime() + DUREE_H * 36e5);
      const loc = C.lieu.nom + ', ' + C.lieu.adresse + ', ' + C.lieu.ville;
      const titre = 'Mariage de ' + C.prenom1 + ' & ' + C.prenom2;
      const p = n => String(n).padStart(2, '0');
      const loc8 = d => d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + 'T' + p(d.getHours()) + p(d.getMinutes()) + '00';
      const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Invitation mariage//FR','CALSCALE:GREGORIAN','BEGIN:VEVENT',
        'UID:mariage-' + loc8(d0) + '@invitation','DTSTAMP:' + loc8(new Date()),'DTSTART:' + loc8(d0),'DTEND:' + loc8(d1),
        'SUMMARY:' + titre,'LOCATION:' + loc.replace(/,/g, '\\,'),'DESCRIPTION:Nous avons hâte de partager ce jour avec vous.',
        'BEGIN:VALARM','TRIGGER:-P7D','ACTION:DISPLAY','DESCRIPTION:Mariage dans une semaine','END:VALARM',
        'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Mariage demain','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
      const google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(titre) + '&dates=' + loc8(d0) + '/' + loc8(d1) + '&location=' + encodeURIComponent(loc);
      const bloc = document.createElement('div');
      bloc.className = 'apparait';
      bloc.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:14px';
      bloc.innerHTML = '<a class="btn btn-fonce" id="agendaIcs" href="' + e(google) + '" target="_blank" rel="noopener" style="padding:0 24px">Ajouter à l’agenda</a>';
      bouton.parentNode.insertBefore(bloc, bouton.nextSibling);
      const sa = document.createElement('style');
      sa.textContent =
        '#agendaIcs{position:relative;overflow:hidden;isolation:isolate;box-shadow:0 0 0 0 rgba(139,15,28,.35),0 10px 24px -10px rgba(63,10,16,.55)}' +
        '#agendaIcs::after{content:"";position:absolute;top:-30%;bottom:-30%;left:-60%;width:36%;z-index:-1;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(244,236,224,.6) 50%,rgba(255,255,255,0) 100%);transform:skewX(-20deg)}' +
        '@media (prefers-reduced-motion:no-preference){#agendaIcs{animation:agPulse 2.8s ease-in-out infinite}#agendaIcs::after{animation:agBeam 4.2s cubic-bezier(.45,.05,.3,1) infinite}}' +
        '@keyframes agPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(139,15,28,.35),0 10px 24px -10px rgba(63,10,16,.55)}50%{transform:scale(1.04);box-shadow:0 0 0 14px rgba(139,15,28,0),0 14px 30px -8px rgba(63,10,16,.65)}}' +
        '@keyframes agBeam{0%{left:-60%}55%,100%{left:130%}}' +
        '#agendaIcs:hover{animation-play-state:paused}';
      document.head.appendChild(sa);
    }
  } catch(err){}

  /* ============ 4. Monogramme en filigrane ============ */
  try {
    if (C){
      const ini = C.prenom1.charAt(0) + ' & ' + C.prenom2.charAt(0);
      const cibles = ['histoire','programme','tenue'].map(id => document.getElementById(id)).filter(Boolean);
      const st = document.createElement('style');
      st.textContent = '.filigrane{position:absolute;left:50%;top:50%;z-index:0;pointer-events:none;white-space:nowrap;font:400 min(78vw,440px)/1 var(--script,"Pinyon Script",cursive);color:rgba(139,15,28,.055);transform:translate3d(-50%,-50%,0);opacity:0;transition:opacity 2.4s ' + doux + '}' +
        '.filigrane.vu{opacity:1}' +
        '.has-filigrane{overflow:hidden}.has-filigrane .bloc{position:relative;z-index:1}';
      document.head.appendChild(st);
      const marques = cibles.map(s => {
        s.classList.add('has-filigrane');
        const m = document.createElement('div');
        m.className = 'filigrane'; m.setAttribute('aria-hidden','true'); m.textContent = ini;
        s.insertBefore(m, s.firstChild);
        return {s, m};
      });
      if (!calme){
        let att = false;
        const maj = () => { att = false; const vh = innerHeight;
          marques.forEach(({s, m}) => { const r = s.getBoundingClientRect();
            if (r.bottom < -50 || r.top > vh + 50) return;
            const k = (r.top + r.height / 2 - vh / 2) / vh;
            m.style.transform = 'translate3d(-50%,calc(-50% + ' + (k * -90).toFixed(1) + 'px),0) rotate(' + (k * -3).toFixed(2) + 'deg)';
            m.classList.add('vu'); }); };
        const plan = () => { if (!att){ att = true; requestAnimationFrame(maj); } };
        addEventListener('scroll', plan, {passive:true}); addEventListener('resize', plan); plan();
      } else marques.forEach(({m}) => m.classList.add('vu'));
    }
  } catch(err){}
})();
