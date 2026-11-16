/* Décor : icônes de titres + fleurs flottantes. Ajouter avant </body> :  <script src="decor.js"></script> */
/* ---------- CONTACTS : à modifier ici ---------- */
const CONTACTS = {
  surtitre: "Une question ?",
  titre: "Nous contacter",
  texte: "N’hésitez pas à nous joindre ou à joindre nos témoins pour toute question.",
  // tel au format international sans espaces ni « + » pour WhatsApp (ex. 33612345678). Laissez "" pour masquer un bouton.
  personnes: [
    { nom: "Les mariés", role: "Commité d'organisation", tel: "+2250504753945", whatsapp: "+2250504753945" },
  ]
};

(function(){
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Icônes au-dessus des titres ---------- */
  const ICONES = {
    histoire:  '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    galerie:   '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2h5L16 7"/>',
    programme: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    lieu:      '<path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    tenue:     '<path d="M12 8a2 2 0 112 2c0 1-2 1.3-2 3"/><path d="M12 13L3 18.5h18z"/>',
    rsvp:      '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3.5 7l8.5 6.5L20.5 7"/>'
  };
  Object.keys(ICONES).forEach(id => {
    const tete = document.querySelector('#' + id + ' .entete');
    if (!tete || tete.querySelector('.deco-icone')) return;
    const c = id === 'rsvp' ? '#E6BF9B' : '#9A4524';
    const d = document.createElement('div');
    d.className = 'deco-icone apparait';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'display:flex;justify-content:center;margin-bottom:18px;color:' + c;
    d.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' + ICONES[id] + '</svg>';
    tete.insertBefore(d, tete.firstChild);
  });

  /* ---------- Espace contacts ---------- */
  (function(){
    const pied = document.querySelector('footer.pied') || document.querySelector('footer');
    if (!pied || document.getElementById('contacts')) return;
    const e = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const ic = {
      tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
      wa: '<path d="M4 20l1.3-4.2A8 8 0 118 19z"/>',
      mail: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3.5 7l8.5 6.5L20.5 7"/>'
    };
    const bt = (href, lib, i, ext) => '<a class="ct-btn" href="' + e(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic[i] + '</svg>' + lib + '</a>';
    const cartes = CONTACTS.personnes.map(p =>
      '<div class="apparait ct-carte"><p class="ct-role">' + e(p.role) + '</p><p class="ct-nom">' + e(p.nom) + '</p><div class="ct-btns">' +
      (p.tel ? bt('tel:' + p.tel, 'Appeler', 'tel') : '') +
      (p.whatsapp ? bt('https://wa.me/' + p.whatsapp, 'WhatsApp', 'wa', true) : '') +
      (p.email ? bt('mailto:' + p.email, 'E-mail', 'mail') : '') + '</div></div>').join('');
    const st = document.createElement('style');
    st.textContent = '#contacts{background:var(--creme-2,#EADDCB);color:var(--brun,#3B2218)}#contacts .bloc{padding-top:88px;padding-bottom:88px}' +
      '.ct-texte{max-width:34ch;margin:0 auto 44px;text-align:center;color:var(--brun-2,#5A3A2C);text-wrap:pretty}' +
      '.ct-liste{display:grid;gap:20px}.ct-carte{background:#FBF6EF;border-radius:2px;padding:28px 22px;text-align:center;box-shadow:0 1px 0 rgba(59,34,24,.08)}' +
      '.ct-role{font:500 10px/1 var(--capitale,serif);letter-spacing:.28em;text-transform:uppercase;color:var(--terra-encre,#9A4524);margin-bottom:12px}' +
      '.ct-nom{font:italic 400 30px/1.1 var(--titre,serif);margin-bottom:22px}' +
      '.ct-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}' +
      '.ct-btn{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 20px;border:1px solid var(--terra-encre,#9A4524);border-radius:999px;color:var(--terra-encre,#9A4524);font:500 11px/1 var(--capitale,serif);letter-spacing:.18em;text-transform:uppercase;transition:background .6s ease,color .6s ease}' +
      '.ct-btn:hover{background:var(--terra-encre,#9A4524);color:var(--creme,#F4ECE0)}' +
      '@media(min-width:700px){.ct-liste{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(st);
    const s = document.createElement('section');
    s.id = 'contacts';
    s.innerHTML = '<div class="bloc"><header class="entete"><span class="surtitre apparait">' + e(CONTACTS.surtitre) + '</span><h2 class="titre mots">' + e(CONTACTS.titre) + '</h2><div class="ornement apparait"><i></i><b></b><i></i></div></header><p class="ct-texte apparait">' + e(CONTACTS.texte) + '</p><div class="ct-liste">' + cartes + '</div></div>';
    pied.parentNode.insertBefore(s, pied);
    s.querySelectorAll('.mots').forEach(el => { el.innerHTML = el.textContent.trim().split(/\s+/).map((w,i) => '<span class="m" style="transition-delay:' + (i*.12) + 's">' + e(w) + '</span>').join(' '); });
  })();

  /* ---------- Fleurs flottantes ---------- */
  if (calme) return;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:30;pointer-events:none;opacity:0;transition:opacity 3s ease 1.5s';
  document.body.appendChild(cv);
  const x = cv.getContext('2d');
  const pal = [['#C97B5A','#D9B97A'], ['#E3A98F','#D9B97A'], ['#B85A35','#F0D9A8'], ['#E8B9A5','#C99A55']];
  const R = (a,b) => a + Math.random()*(b-a);
  let W, H, dpr, fleurs = [], dern = performance.now(), t0 = dern, sv = 0, lastY = scrollY;

  function taille(){ dpr = Math.min(devicePixelRatio||1, 2); W = innerWidth; H = innerHeight; cv.width = W*dpr; cv.height = H*dpr; x.setTransform(dpr,0,0,dpr,0,0); }
  function neuve(init){
    const z = R(.5,1), p = pal[Math.floor(R(0,pal.length))];
    return { x:R(0,1), y: init ? R(0,1) : -.08, z, s:R(9,17)*z, vy:R(.012,.026)*z, ph:R(0,6.28), sw:R(.12,.3), amp:R(.02,.05),
      r:R(0,6.28), vr:R(-.35,.35), tilt:R(0,6.28), vt:R(.3,.8), c:p[0], c2:p[1], petales: Math.random() < .6 ? 5 : 6, max:R(.25,.45) };
  }
  function init(){ taille(); const n = W < 600 ? 6 : 10; fleurs = []; for (let i=0;i<n;i++) fleurs.push(neuve(true)); }
  function fleur(f, t){
    const sq = .55 + .45*Math.abs(Math.cos(t*f.vt + f.tilt));
    x.save(); x.translate(f.px, f.py); x.rotate(f.r + t*f.vr); x.scale(1, sq);
    x.fillStyle = f.c;
    for (let i=0;i<f.petales;i++){
      x.save(); x.rotate(i*6.283/f.petales);
      x.beginPath(); x.ellipse(0, -f.s*.5, f.s*.28, f.s*.5, 0, 0, 6.283); x.fill();
      x.restore();
    }
    x.fillStyle = f.c2; x.beginPath(); x.arc(0,0,f.s*.18,0,6.283); x.fill();
    x.restore();
  }
  function dessiner(t, dt){
    x.clearRect(0,0,W,H);
    const hero = document.getElementById('accueil'), hb = hero ? hero.getBoundingClientRect() : null;
    const sy = scrollY; if (dt > 0){ sv += ((sy - lastY)/dt - sv) * Math.min(1, dt*5); } lastY = sy;
    const vent = Math.max(-1, Math.min(1, sv/1800));
    for (const f of fleurs){
      f.y += f.vy*dt - (sv/H)*f.z*.5*dt;
      f.r += vent*f.z*dt*2.2;
      if (f.y > 1.08) Object.assign(f, neuve(false));
      else if (f.y < -.12) Object.assign(f, neuve(false), {y: 1.06});
      f.px = (f.x + Math.sin(t*f.sw + f.ph)*f.amp)*W + vent*f.z*Math.sin(f.ph*2 + t)*34; f.py = f.y*H;
      let a = f.max * Math.min(1, f.y/.1 + .0, (1.08 - f.y)/.12);
      if (hb && f.py > hb.top && f.py < hb.top + hb.height*.58 && f.px > W*.2 && f.px < W*.8) a *= .15;
      if (a <= .01) continue;
      x.globalAlpha = Math.max(0, a); fleur(f, t);
    }
    x.globalAlpha = 1;
  }
  function boucle(now){
    requestAnimationFrame(boucle);
    if (document.hidden){ dern = now; return; }
    const dt = Math.min(.05, (now - dern)/1000); dern = now;
    dessiner((now - t0)/1000, dt);
  }
  function demarrer(){ init(); cv.style.opacity = 1; requestAnimationFrame(boucle); let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(init, 250); }); }
  if (document.body.classList.contains('revele')) demarrer();
  else { const mo = new MutationObserver(() => { if (document.body.classList.contains('revele')){ mo.disconnect(); demarrer(); } }); mo.observe(document.body, {attributes:true, attributeFilter:['class']}); }
})();
