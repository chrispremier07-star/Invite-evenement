/* Ouverture cinématique premium : cachet lumineux qui se détache et tombe, lettre qui s'ouvre, chute de l'enveloppe.
   À ajouter avant </body> :  <script src="ouverture.js"></script>   (retirer la ligne = ouverture d'origine) */
(function(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const intro = document.getElementById('intro'), btn = document.getElementById('ouvrir');
  if (!intro || !btn) return;

  const SUPPLEMENT = 900;    // ms avant l'apparition du site
  const ST = window.setTimeout.bind(window);
  const lisse = 'cubic-bezier(.65,0,.35,1)', doux = 'cubic-bezier(.22,.61,.36,1)';

  const st = document.createElement('style');
  st.textContent =
    '.cachet{overflow:hidden}' +
    '.cachet::after{content:"";position:absolute;top:-30%;bottom:-30%;left:-80%;width:46%;pointer-events:none;background:linear-gradient(100deg,rgba(255,250,235,0) 0%,rgba(255,250,235,.85) 50%,rgba(255,250,235,0) 100%);transform:skewX(-20deg);animation:cachetFaisceau 4.4s cubic-bezier(.45,.05,.3,1) 1s infinite}' +
    '@keyframes cachetFaisceau{0%{left:-80%}45%,100%{left:140%}}' +
    '.cachet{animation:cachetRespire 3.6s ease-in-out infinite}' +
    '@keyframes cachetRespire{0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}}' +
    '.intro-btn{position:relative;overflow:hidden;isolation:isolate;min-height:56px;padding:0 36px;animation:btnPulse 2.8s ease-in-out infinite}' +
    '.intro-btn::after{content:"";position:absolute;top:-30%;bottom:-30%;left:-60%;width:36%;z-index:-1;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(244,236,224,.55) 50%,rgba(255,255,255,0) 100%);transform:skewX(-20deg);animation:btnFaisceau 4s cubic-bezier(.45,.05,.3,1) .6s infinite}' +
    '@keyframes btnPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(139,15,28,.35),0 10px 26px -10px rgba(63,10,16,.55)}50%{transform:scale(1.04);box-shadow:0 0 0 14px rgba(139,15,28,0),0 14px 32px -8px rgba(63,10,16,.65)}}' +
    '@keyframes btnFaisceau{0%{left:-60%}50%,100%{left:130%}}' +
    '.intro.ouverture .cachet,.intro.ouverture .intro-btn,.intro.ouverture .intro-btn::after,.intro.ouverture .cachet::after{animation:none!important}' +
    '.intro.ouverture .cachet{opacity:1!important;transform:translate(-50%,-50%)!important;transition:none!important}' +
    '.intro.ouverture .intro-btn,.intro.ouverture .intro-surtitre{transition:opacity 1s ' + doux + ',transform 1s ' + doux + '!important}' +
    '.env-rabat{transition:transform 1.6s ' + lisse + ' .9s,z-index 0s linear 1.9s!important}' +
    '.env-carte{transition:transform 1.7s ' + doux + ' 1.9s!important}' +
    '.intro.portail{opacity:1!important;visibility:visible!important;transition:none!important}' +
    'html{scrollbar-gutter:stable}.env{will-change:transform}' +
    '@media (prefers-reduced-motion:no-preference){.site{transform:scale(1.1);transform-origin:50% 35%;transition:opacity 3.2s ' + doux + ',transform 4s cubic-bezier(.2,.6,.2,1)}body.revele .site{transform:none}}';
  document.head.appendChild(st);

  const haut = () => { try{ scrollTo({top:0,left:0,behavior:'instant'}); }catch(e){ scrollTo(0,0); } document.documentElement.scrollTop = 0; document.body.scrollTop = 0; };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  haut(); addEventListener('pageshow', haut);
  const DELAI_SITE = 1200;   // ms de retard avant l'apparition du site
  function retarder(el, cls){
    const add = el.classList.add.bind(el.classList);
    el.classList.add = function(...a){ if (a.indexOf(cls) < 0) return add(...a); ST(() => { haut(); add(...a); }, DELAI_SITE); };
  }
  // Le verrouillage du défilement est levé seulement une fois l'enveloppe partie : aucun décalage au décrochage
  function garderVerrou(){
    const rm = document.body.classList.remove.bind(document.body.classList);
    document.body.classList.remove = function(...a){ if (a.indexOf('locked') < 0) return rm(...a); ST(() => { rm(...a); haut(); }, 3600); };
  }
  let lance = false, P = {x: innerWidth/2, y: innerHeight/2};

  // Le cachet se soulève, se détache, rebondit doucement puis tombe dans le vide
  function detacher(){
    const seal = intro.querySelector('.cachet'); if (!seal) return;
    const r = seal.getBoundingClientRect();
    const box = document.createElement('div');
    box.setAttribute('aria-hidden','true');
    box.style.cssText = 'position:fixed;inset:0;z-index:55;pointer-events:none;overflow:hidden';
    const c = seal.cloneNode(true);
    c.style.cssText = 'position:absolute;left:0;top:0;margin:0;animation:none;transition:none;will-change:transform;width:'+r.width+'px;height:'+r.height+'px';
    box.appendChild(c); document.body.appendChild(box);
    seal.style.setProperty('visibility','hidden','important');
    const sens = Math.random() < .5 ? -1 : 1, sol = r.top + r.height*.7, t0 = performance.now();
    let x = r.left, y = r.top, vx = sens*26, vy = 0, rot = 0, vr = 0, rebond = 0, chute = false, dern = t0;
    (function tic(now){
      const dt = Math.min(.033, (now - dern)/1000); dern = now;
      const t = (now - t0)/1000;
      let sc = 1;
      if (t < .55){
        const k = t/.55, e = 1 - Math.pow(1-k, 3);
        y = r.top - 22*e; rot = sens*-6*e; sc = 1 + .08*e;
        vy = 0;
      } else {
        if (!chute){ chute = true; vr = sens*38; vy = -40; }
        vy += 1250*dt; x += vx*dt; y += vy*dt; rot += vr*dt; sc = 1.08;
        if (rebond < 1 && vy > 0 && y > sol){ y = sol; vy = -vy*.32; vr *= .6; rebond++; }
      }
      c.style.transform = 'translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) rotate('+rot.toFixed(2)+'deg) scale('+sc.toFixed(3)+')';
      if (y < innerHeight + 140) requestAnimationFrame(tic); else box.remove();
    })(t0);
  }

  function mesurer(){
    const noms = intro.querySelector('.carte-noms'), carte = intro.querySelector('.env-carte');
    if (!noms || !carte) return;
    const a = noms.getBoundingClientRect(), c = carte.getBoundingClientRect();
    P = {x: a.left + a.width/2, y: a.top + a.height/2 - c.height*.62};
  }

  // Chute de l'enveloppe : elle se soulève à peine, bascule et tombe, le site apparaît derrière
  new MutationObserver(() => {
    if (!intro.classList.contains('leaving') || intro.classList.contains('portail')) return;
    intro.classList.add('portail');
    const env = intro.querySelector('.env');
    const fond = getComputedStyle(intro).backgroundImage;
    const voile = document.createElement('div');
    voile.style.cssText = 'position:absolute;inset:0;z-index:-1;pointer-events:none;background:' + fond + ';opacity:1;transition:opacity 2.6s cubic-bezier(.4,0,.6,1) .25s';
    intro.insertBefore(voile, intro.firstChild);
    intro.style.background = 'none';
    void voile.offsetWidth; voile.style.opacity = '0';
    env.style.transition = 'none';
    // Doux soulèvement, puis descente avec inclinaison progressive ; vitesse nulle au départ, aucune cassure
    const bas = innerHeight * 1.35, lift = innerHeight * .04, N = 140, kf = [];
    const dep = u => u * u * u * (u * (u * 6 - 15) + 10) * .5 + Math.pow(u, 4) * .5;
    for (let i = 0; i <= N; i++){
      const u = i / N, v = Math.max(0, (u - .26) / .74);
      const bump = u < .4 ? Math.pow(Math.sin(Math.PI * u / .4), 2) : 0;
      const y = bas * dep(v) - lift * bump;
      const r = 8 * u * u * u * (u * (u * 6 - 15) + 10);
      kf.push({transform: 'translate3d(0,' + y.toFixed(2) + 'px,0) rotate(' + r.toFixed(3) + 'deg)', easing: 'linear'});
    }
    env.animate(kf, {duration: 3600, fill: 'forwards'});
  }).observe(intro, {attributes:true, attributeFilter:['class']});

  document.addEventListener('click', e => {
    if (lance || !e.target.closest('#ouvrir')) return;
    lance = true;
    haut();
    garderVerrou();
    retarder(document.body, 'revele');
    const hn = document.getElementById('heroNoms'); if (hn) retarder(hn, 'mots-visibles');
    mesurer();
    detacher();
    const env = intro.querySelector('.env'), eb = env.getBoundingClientRect();
    env.style.transformOrigin = (P.x - eb.left) + 'px ' + (P.y - eb.top) + 'px';
    window.setTimeout = function(fn, d, ...a){ return ST(fn, d === 3100 ? d + SUPPLEMENT : d === 4600 ? d + SUPPLEMENT + 2100 : d, ...a); };
    ST(() => { window.setTimeout = ST; }, 0);
  }, true);
})();
