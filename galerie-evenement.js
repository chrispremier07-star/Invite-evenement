/* Rubrique « Galerie de l'événement » : photos et vidéos du mariage, affichées automatiquement.
   À ajouter avant </body> :  <script src="galerie-evenement.js"></script>

   COMMENT AJOUTER DES MÉDIAS (aucune modification du site) :
   Option A (recommandée, 100 % automatique) : renseignez "github" ci-dessous (ex. "moncompte/mon-depot"),
     puis déposez simplement vos photos/vidéos dans le dossier « galerie-evenement » du dépôt GitHub.
   Option B : sans GitHub, créez le fichier galerie-evenement/medias.json contenant la liste, ex. :
     ["photo1.jpg", "photo2.jpg", "film.mp4"]   (ou des adresses https:// complètes)                    */
const GALERIE_EVENEMENT = {
  github: "",                        // "propriétaire/dépôt" du site sur GitHub (laisser "" si option B)
  branche: "",                       // laisser vide pour la branche par défaut
  dossier: "galerie-evenement",      // dossier des médias dans le dépôt
  liste: "galerie-evenement/medias.json",
  surtitre: "Souvenirs",
  titre: "Galerie de l’événement",
  intro: "Les photos et vidéos de notre journée, à retrouver et à partager.",
  vide: "Les plus beaux souvenirs de cette journée seront bientôt disponibles ici.<br>Revenez découvrir les photos et vidéos de l’événement !",
  masquer: "Masquer la galerie",
  badge: "Galerie",
  bouton: "Accéder à la galerie",
  tout: "Tout", photos: "Photos", videos: "Vidéos",
  telecharger: "Télécharger", fermer: "Fermer"
};

(function(){
  const G = GALERIE_EVENEMENT;
  const rsvp = document.getElementById('rsvp');
  if (!rsvp) return;
  const OR = '#C49A4A', BORD = '#3F0A10', CREME = '#FBF8F1', RUBIS = '#8B0F1C', OROC = '#E0BF7E', doux = 'cubic-bezier(.22,.61,.36,1)';
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const EXT_IMG = /\.(jpe?g|png|webp|gif|avif|heic)$/i, EXT_VID = /\.(mp4|mov|m4v|webm)$/i;
  const type = u => EXT_VID.test(u.split('?')[0]) ? 'video' : (EXT_IMG.test(u.split('?')[0]) ? 'photo' : null);

  const st = document.createElement('style');
  st.textContent =
    '#galerie-evenement{position:relative;display:none;background:' + RUBIS + ';color:#F6F1E7;overflow:hidden}' +
    '#galerie-evenement::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 40% at 50% 0%,rgba(224,191,126,.28),transparent 70%),radial-gradient(50% 30% at 50% 100%,rgba(26,3,6,.35),transparent 70%)}' +
    '#galerie-evenement .ge{position:relative;z-index:2;max-width:1000px;margin:0 auto;padding:84px 22px 84px}' +
    '#galerie-evenement .ge-fx{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}' +
    '#galerie-evenement .ge-fx i{position:absolute;left:0;top:0;display:block;will-change:transform,opacity}' +
    '#galerie-evenement .ge-acces{display:flex;justify-content:center;margin-top:48px}' +
    '#galerie-evenement .ge-go{position:relative;overflow:hidden;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:58px;padding:0 38px;border-radius:999px;background:#fff;color:' + BORD + ';border:1px solid ' + OROC + ';box-shadow:0 0 0 4px ' + RUBIS + ',0 0 0 5px rgba(224,191,126,.6),0 14px 30px -12px rgba(26,3,6,.6);font:500 12px/1 var(--capitale,serif);letter-spacing:.22em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .5s ease,transform .5s ' + doux + '}' +
    '#galerie-evenement .ge-go:hover{background:#F6F1E7;transform:translateY(-2px)}' +
    '#galerie-evenement .ge-go svg{transition:transform .8s ' + doux + ';transform:rotate(90deg)}#galerie-evenement .ge-go[aria-expanded=true] svg{transform:rotate(-90deg)}' +
    '#galerie-evenement .ge-go::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:36%;z-index:-1;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(224,191,126,.5),rgba(255,255,255,0))}' +
    '@media (prefers-reduced-motion:no-preference){#galerie-evenement .ge-go::after{animation:geBeam 4.2s cubic-bezier(.45,.05,.3,1) infinite}#galerie-evenement .ge-go[aria-expanded=false]{animation:gePulse 2.8s ease-in-out infinite}}' +
    '@keyframes geBeam{0%{left:-60%}55%,100%{left:130%}}@keyframes gePulse{0%,100%{box-shadow:0 0 0 4px ' + RUBIS + ',0 0 0 5px rgba(224,191,126,.6),0 0 0 5px rgba(224,191,126,.5)}50%{box-shadow:0 0 0 4px ' + RUBIS + ',0 0 0 5px rgba(224,191,126,.6),0 0 0 18px rgba(224,191,126,0)}}' +
    '#galerie-evenement .ge-rl{display:block}' +
    '#galerie-evenement .ge-rl .a{opacity:0;transform:translate3d(0,26px,0) scale(.97);filter:blur(8px);transition:opacity .9s ease,transform 1.2s ' + doux + ',filter .9s ease}' +
    '#galerie-evenement .ge-rl.on .a{opacity:1;transform:none;filter:none}' +
    '#galerie-evenement .ge-rl:not(.on) .a{transition:opacity .3s ease,transform .5s ' + doux + ',filter .3s ease;transition-delay:0s!important}' +
    '#galerie-evenement .ge-t{text-align:center;margin-bottom:44px}' +
    '#galerie-evenement .ge-s{display:block;font:500 11px/1 var(--capitale,serif);letter-spacing:.32em;text-transform:uppercase;color:' + OROC + ';margin-bottom:18px}' +
    '#galerie-evenement h2{font:400 clamp(36px,9vw,54px)/1.08 var(--titre,serif);letter-spacing:-.01em;margin:0;text-wrap:balance;background:linear-gradient(100deg,#F6F1E7 38%,#FFF6CF 50%,#F6F1E7 62%);background-size:250% 100%;background-position:0 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}' +
    '@media (prefers-reduced-motion:no-preference){#galerie-evenement .ge-rl.on h2{animation:geShine 3.4s ease 1.1s 2}}@keyframes geShine{0%{background-position:100% 0}100%{background-position:0 0}}' +
    '#galerie-evenement .ge-i{max-width:36ch;margin:16px auto 0;color:rgba(246,241,231,.92);font:400 16px/1.55 var(--texte,sans-serif);text-wrap:pretty}' +
    '#galerie-evenement .ge-orn{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:24px}#galerie-evenement .ge-orn i{width:56px;height:1px;background:rgba(224,191,126,.6)}#galerie-evenement .ge-orn b{width:9px;height:9px;border:1px solid ' + OROC + ';transform:rotate(45deg)}' +
    '#galerie-evenement .ge-vide{position:relative;max-width:460px;margin:0 auto;padding:46px 28px;text-align:center;border:1px solid rgba(224,191,126,.8);outline:1px solid rgba(224,191,126,.35);outline-offset:6px;background:' + CREME + ';box-shadow:0 0 40px rgba(224,191,126,.25)}' +
    '#galerie-evenement .ge-vide p{margin:0;font:italic 400 clamp(19px,5vw,22px)/1.5 var(--titre,serif);color:#4A1A20;text-wrap:balance}' +
    '#galerie-evenement .ge-vide .ge-orn{margin:0 0 22px}#galerie-evenement .ge-vide .ge-orn i{background:rgba(122,15,27,.4)}#galerie-evenement .ge-vide .ge-orn b{border-color:#7A0F1B}' +
    '#galerie-evenement .ge-f{display:flex;justify-content:center;gap:8px;margin:0 0 34px;flex-wrap:wrap}' +
    '#galerie-evenement .ge-f button{min-height:44px;padding:0 22px;border-radius:999px;border:1px solid rgba(224,191,126,.6);background:transparent;color:' + OROC + ';font:500 11px/1 var(--capitale,serif);letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .4s ease,color .4s ease}' +
    '#galerie-evenement .ge-f button[aria-pressed=true]{background:' + OROC + ';border-color:' + OROC + ';color:' + BORD + '}' +
    '#galerie-evenement .ge-g{columns:2;column-gap:14px}' +
    '@media (min-width:700px){#galerie-evenement .ge-g{columns:3;column-gap:18px}}' +
    '#galerie-evenement .ge-c{position:relative;display:block;width:100%;break-inside:avoid;margin:0 0 14px;padding:3px;border:0;cursor:pointer;background:linear-gradient(112deg,#7A5518,#D9B466 20%,#FBEBB4 32%,#B58A38 48%,#7A5518 62%,#E8C879 80%,#8F6A20);filter:drop-shadow(0 0 8px rgba(236,196,110,.25)) drop-shadow(0 2px 4px rgba(26,3,6,.3));-webkit-tap-highlight-color:transparent;opacity:0;transform:translate3d(0,26px,0);transition:opacity 1s ' + doux + ',transform 1s ' + doux + ',filter .6s ease}' +
    '@media (min-width:700px){#galerie-evenement .ge-c{margin-bottom:18px}}' +
    '#galerie-evenement .ge-c.v{opacity:1;transform:none}' +
    '#galerie-evenement .ge-c:hover{filter:drop-shadow(0 0 20px rgba(236,196,110,.6)) drop-shadow(0 4px 8px rgba(26,3,6,.35))}' +
    '#galerie-evenement .ge-in{position:relative;display:block;overflow:hidden;background:#E9DFD0;border:2px solid ' + CREME + '}' +
    '#galerie-evenement .ge-in img,#galerie-evenement .ge-in video{display:block;width:100%;height:auto;min-height:90px;object-fit:cover;transition:transform 1.4s ' + doux + '}' +
    '#galerie-evenement .ge-c:hover .ge-in img,#galerie-evenement .ge-c:hover .ge-in video{transform:scale(1.05)}' +
    '#galerie-evenement .ge-play{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;display:grid;place-items:center;background:rgba(26,3,6,.55);border:1px solid rgba(255,243,200,.75);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}' +
    '#galerie-evenement .ge-play::after{content:"";margin-left:4px;border-style:solid;border-width:8px 0 8px 13px;border-color:transparent transparent transparent #FFF3C8}' +
    '#geBadge{position:fixed;right:0;top:calc(50% - 26px);z-index:55;display:flex;align-items:center;height:52px;padding:0 6px 0 10px;border:1px solid rgba(224,191,126,.5);border-right:0;border-radius:14px 0 0 14px;background:rgba(63,10,16,.86);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#F6F1E7;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 2px 12px rgba(26,3,6,.2);opacity:0;pointer-events:none;transform:translate3d(100%,0,0);transition:transform .9s ' + doux + ',opacity .6s ease,border-color .5s ease}' +
    '#geBadge::before{content:"";position:absolute;inset:-6px 0 -6px -10px}' +
    '#geBadge.pret{opacity:1;pointer-events:auto;transform:none}' +
    '#geBadge .gb-i{flex:none;display:grid;place-items:center;width:22px;height:22px;color:' + OROC + '}' +
    '#geBadge .gb-t{display:block;max-width:0;overflow:hidden;white-space:nowrap;opacity:0;font:500 10px/1 var(--capitale,serif);letter-spacing:.22em;text-transform:uppercase;transition:max-width .7s ' + doux + ',opacity .3s ease,margin .7s ' + doux + '}' +
    '#geBadge .gb-d{position:absolute;left:4px;top:5px;width:5px;height:5px;border-radius:50%;background:' + OROC + ';transition:opacity .4s ease}' +
    '#geBadge[aria-expanded=true]{border-color:rgba(224,191,126,.85)}' +
    '#geBadge[aria-expanded=true] .gb-t{max-width:150px;opacity:1;margin:0 8px 0 10px;transition:max-width .7s ' + doux + ',opacity .5s ease .2s,margin .7s ' + doux + '}' +
    '#geBadge[aria-expanded=true] .gb-d{opacity:0}' +
    '@media (prefers-reduced-motion:no-preference){#geBadge.pret[aria-expanded=false] .gb-d{animation:geDot 3.2s ease-in-out 2s infinite}}' +
    '@keyframes geDot{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.3)}}' +
    '@media (prefers-reduced-motion:reduce){#geBadge,#geBadge *{transition:none!important}}' +
    '#ge-lb{position:fixed;inset:0;z-index:96;display:flex;align-items:center;justify-content:center;background:rgba(18,2,5,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:0;visibility:hidden;transition:opacity .5s ease,visibility 0s linear .5s}' +
    '#ge-lb.on{opacity:1;visibility:visible;transition:opacity .5s ease}' +
    '#ge-lb .ge-lf{position:relative;padding:3px;background:linear-gradient(112deg,#7A5518,#D9B466 20%,#FBEBB4 32%,#B58A38 48%,#7A5518 62%,#E8C879 80%,#8F6A20);filter:drop-shadow(0 0 22px rgba(236,196,110,.28))}' +
    '#ge-lb .ge-lm{display:block;border:3px solid ' + CREME + ';background:#000}' +
    '#ge-lb .ge-lm>*{display:block;max-width:calc(100vw - 28px);max-height:calc(100svh - 150px);width:auto;height:auto;object-fit:contain}' +
    '#ge-lb button,#ge-lb a.ge-dl{position:absolute;z-index:2;display:grid;place-items:center;min-width:48px;height:48px;border:0;border-radius:50%;background:rgba(246,241,231,.12);color:#F6F1E7;cursor:pointer;-webkit-tap-highlight-color:transparent;text-decoration:none}' +
    '#ge-lb button:hover,#ge-lb a.ge-dl:hover{background:rgba(224,191,126,.35)}' +
    '#ge-lb .ge-x{right:10px;top:calc(10px + env(safe-area-inset-top))}' +
    '#ge-lb .ge-p{left:8px;top:50%;margin-top:-24px}#ge-lb .ge-n{right:8px;top:50%;margin-top:-24px}' +
    '#ge-lb .ge-dl{left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);width:auto;padding:0 22px;border-radius:999px;font:500 11px/1 var(--capitale,serif);letter-spacing:.2em;text-transform:uppercase}' +
    '#ge-lb .ge-cpt{position:absolute;left:0;right:0;top:calc(22px + env(safe-area-inset-top));text-align:center;color:' + OROC + ';font:500 11px/1 var(--capitale,serif);letter-spacing:.3em}' +
    '@media (prefers-reduced-motion:reduce){#galerie-evenement *,#ge-lb{transition:none!important}#galerie-evenement .ge-c{opacity:1;transform:none}#galerie-evenement .ge-rl .a{opacity:1;transform:none;filter:none}}';
  document.head.appendChild(st);

  const sec = document.createElement('section');
  sec.id = 'galerie-evenement'; sec.setAttribute('data-screen-label', 'Galerie de l’événement');
  sec.innerHTML = '<div class="ge-fx"></div><div class="ge">' +
    '<div class="ge-rl" aria-hidden="true"><div><header class="ge-t"><span class="ge-s a" style="transition-delay:.55s">' + esc(G.surtitre) + '</span><h2 class="a" style="transition-delay:.75s">' + esc(G.titre) + '</h2><p class="ge-i a" style="transition-delay:1s">' + esc(G.intro) + '</p><div class="ge-orn a" style="transition-delay:1.2s"><i></i><b></b><i></i></div></header><div class="ge-corps a" style="transition-delay:1.4s"></div><div class="ge-acces a" style="transition-delay:1.6s"><button type="button" class="ge-go ge-ferme" aria-expanded="true"><span>' + esc(G.masquer) + '</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></div></div></div>';
  rsvp.parentNode.insertBefore(sec, rsvp);
  const corps = sec.querySelector('.ge-corps'), fx = sec.querySelector('.ge-fx'), rl = sec.querySelector('.ge-rl'), ferme = sec.querySelector('.ge-ferme');
  const vide = () => { corps.innerHTML = '<div class="ge-vide"><div class="ge-orn"><i></i><b></b><i></i></div><p>' + G.vide + '</p></div>'; };
  vide();

  async function charger(){
    let noms = [];
    if (G.github) {
      try {
        const r = await fetch('https://api.github.com/repos/' + G.github + '/contents/' + G.dossier + (G.branche ? '?ref=' + encodeURIComponent(G.branche) : ''), {headers: {Accept: 'application/vnd.github+json'}});
        if (r.ok) noms = (await r.json()).filter(f => f.type === 'file').map(f => G.dossier + '/' + f.name);
      } catch(x){}
    }
    if (!noms.length) {
      try {
        const r = await fetch(G.liste + '?t=' + Date.now(), {cache: 'no-store'});
        if (r.ok) noms = (await r.json()).map(s => typeof s === 'string' ? s : (s.src || s.url || '')).map(s => /^(https?:)?\/\//.test(s) || s.indexOf('/') > -1 ? s : G.dossier + '/' + s);
      } catch(x){}
    }
    return noms.filter(u => u && type(u)).sort((a, b) => a.localeCompare(b, undefined, {numeric: true})).map(u => ({src: u, t: type(u)}));
  }

  let items = [], vues = [], idx = 0, lb = null;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('v'); io.unobserve(e.target); } }), {threshold: .12, rootMargin: '0px 0px -6% 0px'}) : null;
  function grille(filtre){
    vues = items.filter(m => !filtre || m.t === filtre);
    const g = corps.querySelector('.ge-g'); g.innerHTML = '';
    vues.forEach((m, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ge-c'; b.setAttribute('aria-label', (m.t === 'video' ? 'Vidéo ' : 'Photo ') + (i + 1));
      b.innerHTML = '<span class="ge-in">' + (m.t === 'video' ? '<video src="' + esc(m.src) + '#t=0.1" preload="metadata" muted playsinline></video><span class="ge-play"></span>' : '<img src="' + esc(m.src) + '" alt="" loading="lazy" decoding="async">') + '</span>';
      b.addEventListener('click', () => ouvrir(i));
      g.appendChild(b);
      if (calme || !io) b.classList.add('v'); else { b.style.transitionDelay = (i % 3) * .12 + 's'; io.observe(b); }
    });
  }
  function afficher(){
    const p = items.filter(m => m.t === 'photo').length, v = items.length - p;
    corps.innerHTML = (p && v ? '<div class="ge-f"><button type="button" aria-pressed="true" data-f="">' + esc(G.tout) + ' · ' + items.length + '</button><button type="button" aria-pressed="false" data-f="photo">' + esc(G.photos) + ' · ' + p + '</button><button type="button" aria-pressed="false" data-f="video">' + esc(G.videos) + ' · ' + v + '</button></div>' : '') + '<div class="ge-g"></div>';
    corps.querySelectorAll('.ge-f button').forEach(b => b.addEventListener('click', () => { corps.querySelectorAll('.ge-f button').forEach(y => y.setAttribute('aria-pressed', y === b ? 'true' : 'false')); grille(b.dataset.f); }));
    grille('');
  }

  function creerLb(){
    lb = document.createElement('div'); lb.id = 'ge-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    const fl = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
    lb.innerHTML = '<div class="ge-cpt"></div><button type="button" class="ge-x" aria-label="' + esc(G.fermer) + '">' + fl('M6 6l12 12M18 6L6 18') + '</button><button type="button" class="ge-p" aria-label="Précédent">' + fl('M15 5l-7 7 7 7') + '</button><button type="button" class="ge-n" aria-label="Suivant">' + fl('M9 5l7 7-7 7') + '</button><div class="ge-lf"><span class="ge-lm"></span></div><a class="ge-dl" download target="_blank" rel="noopener">' + esc(G.telecharger) + '</a>';
    document.body.appendChild(lb);
    lb.querySelector('.ge-x').addEventListener('click', fermer);
    lb.querySelector('.ge-p').addEventListener('click', () => aller(-1));
    lb.querySelector('.ge-n').addEventListener('click', () => aller(1));
    lb.addEventListener('click', e => { if (e.target === lb) fermer(); });
    let x0 = null;
    lb.addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, {passive: true});
    lb.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) aller(dx < 0 ? 1 : -1); x0 = null; });
    addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') fermer(); else if (e.key === 'ArrowRight') aller(1); else if (e.key === 'ArrowLeft') aller(-1); });
  }
  function montrer(){
    const m = vues[idx], z = lb.querySelector('.ge-lm');
    z.innerHTML = m.t === 'video' ? '<video src="' + esc(m.src) + '" controls autoplay playsinline></video>' : '<img src="' + esc(m.src) + '" alt="">';
    lb.querySelector('.ge-cpt').textContent = (idx + 1) + ' / ' + vues.length;
    lb.querySelector('.ge-dl').href = m.src;
    const multi = vues.length > 1; lb.querySelector('.ge-p').style.display = lb.querySelector('.ge-n').style.display = multi ? '' : 'none';
    if (!calme) z.animate([{opacity: 0, transform: 'scale(.97)'}, {opacity: 1, transform: 'none'}], {duration: 500, easing: doux});
  }
  function ouvrir(i){ if (!lb) creerLb(); idx = i; montrer(); lb.classList.add('on'); document.body.style.overflow = 'hidden'; }
  function aller(d){ idx = (idx + d + vues.length) % vues.length; montrer(); }
  function fermer(){ lb.classList.remove('on'); document.body.style.overflow = ''; const v = lb.querySelector('video'); if (v) v.pause(); }


  /* ---- Effets festifs à l'ouverture ---- */
  const COUL = ['#FFF3C8', '#E0BF7E', '#F3DC96', '#D2A74F', '#F6F1E7', '#F2B8A2'];
  const R = (a, b) => a + Math.random() * (b - a);
  function fete(){
    if (calme) return;
    const s = sec.getBoundingClientRect(), cx = s.width / 2, cy = 190;
    const mk = (css, kf, opt) => { const e = document.createElement('i'); e.style.cssText = css; fx.appendChild(e); const a = e.animate(kf, opt); a.onfinish = () => e.remove(); return e; };
    mk('left:' + (cx - 20) + 'px;top:' + (cy - 20) + 'px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(255,243,200,.95),rgba(224,191,126,.5) 40%,transparent 70%)', [{transform: 'scale(.2)', opacity: 1}, {transform: 'scale(16)', opacity: 0}], {duration: 1500, easing: 'cubic-bezier(.2,.6,.3,1)'});
    [0, 220].forEach(d => mk('left:' + (cx - 30) + 'px;top:' + (cy - 30) + 'px;width:60px;height:60px;border-radius:50%;border:2px solid rgba(255,243,200,.9)', [{transform: 'scale(.3)', opacity: .9}, {transform: 'scale(9)', opacity: 0}], {duration: 1400, delay: d, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'backwards'}));
    mk('top:-20%;bottom:-20%;left:0;width:30%;background:linear-gradient(100deg,transparent,rgba(255,243,200,.32),transparent);transform:skewX(-14deg)', [{transform: 'translateX(-60%) skewX(-14deg)'}, {transform: 'translateX(' + (s.width * 3.8) + 'px) skewX(-14deg)'}], {duration: 2000, delay: 250, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'backwards'});
    const forme = i => [
      'border-radius:50%',
      'transform-origin:center;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)',
      'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)',
      'border-radius:1px'][i % 4];
    for (let i = 0; i < 56; i++) {
      const sz = R(5, 13), ang = R(0, Math.PI * 2), dist = R(70, Math.min(330, s.width * .75)), dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * .8 - R(20, 90), rot = R(-540, 540), dur = R(1700, 3200);
      mk('left:' + cx + 'px;top:' + cy + 'px;width:' + sz + 'px;height:' + (i % 4 === 3 ? sz * 1.8 : sz) + 'px;background:' + COUL[i % COUL.length] + ';box-shadow:0 0 8px rgba(255,236,170,.9);' + forme(i),
        [{transform: 'translate(-50%,-50%) scale(0) rotate(0)', opacity: 1}, {transform: 'translate(' + (dx * .75 - sz / 2) + 'px,' + (dy * .75 - sz / 2) + 'px) scale(1.1) rotate(' + rot * .5 + 'deg)', opacity: 1, offset: .35}, {transform: 'translate(' + (dx - sz / 2) + 'px,' + (dy + 150 - sz / 2) + 'px) scale(.3) rotate(' + rot + 'deg)', opacity: 0}],
        {duration: dur, delay: R(0, 350), easing: 'cubic-bezier(.15,.7,.35,1)', fill: 'backwards'});
    }
    for (let i = 0; i < 14; i++) {
      const sz = R(6, 12);
      const e = mk('left:' + R(4, 96) + '%;top:' + R(130, 620) + 'px;width:' + sz + 'px;height:' + sz + 'px;background:#FFF3C8;box-shadow:0 0 10px rgba(255,236,170,.95);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)',
        [{opacity: 0, transform: 'scale(0)'}, {opacity: 1, transform: 'scale(1.2) rotate(45deg)'}, {opacity: 0, transform: 'scale(0) rotate(90deg)'}], {duration: R(1600, 2600), delay: 900 + R(0, 3500), iterations: 3, easing: 'ease-in-out', fill: 'backwards'});
    }
  }

  let ouvert = false, anim = false;
  const doc = document.documentElement;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const anime = (dur, f) => new Promise(res => {
    if (calme) { f(1); return res(); }
    const t0 = performance.now();
    const pas = n => { const p = Math.min((n - t0) / dur, 1); f(ease(p)); p < 1 ? requestAnimationFrame(pas) : res(); };
    requestAnimationFrame(pas);
  });
  const sauter = y => scrollTo({top: y, behavior: 'instant'});
  const versSection = () => { const y = sec.getBoundingClientRect().top + scrollY - 8; scrollTo({top: y, behavior: calme ? 'auto' : 'smooth'}); };
  function suivi(){ let libre = false; const stop = () => { libre = true; }; addEventListener('wheel', stop, {once: true, passive: true}); addEventListener('touchstart', stop, {once: true, passive: true}); return () => libre; }
  function deplier(){
    if (anim) return; anim = true; ouvert = true;
    sec.style.display = 'block'; sec.style.height = 'auto';
    const H = sec.offsetHeight, y0 = scrollY, haut = sec.getBoundingClientRect().top + y0, yT = Math.max(0, haut - 8);
    sec.style.height = '0px'; doc.style.overflowAnchor = 'none';
    const libre = suivi();
    rl.setAttribute('aria-hidden', 'false');
    setTimeout(() => rl.classList.add('on'), 180);
    fete();
    anime(Math.min(2000, 1200 + H * .2), e => { sec.style.height = (H * e) + 'px'; if (!libre()) sauter(y0 + (yT - y0) * e); })
      .then(() => { sec.style.height = ''; doc.style.overflowAnchor = ''; anim = false; });
  }
  function replier(){
    if (anim) return; anim = true; ouvert = false;
    rl.classList.remove('on'); rl.setAttribute('aria-hidden', 'true');
    const H = sec.offsetHeight, y0 = scrollY, haut = sec.getBoundingClientRect().top + y0, yF = y0 > haut ? haut : y0;
    doc.style.overflowAnchor = 'none';
    const libre = suivi();
    setTimeout(() => anime(Math.min(1800, 900 + H * .25), e => { sec.style.height = (H * (1 - e)) + 'px'; if (!libre()) sauter(y0 + (yF - y0) * e); })
      .then(() => { sec.style.display = 'none'; sec.style.height = ''; doc.style.overflowAnchor = ''; anim = false; }), 280);
  }
  ferme.addEventListener('click', replier);

  /* ---- Badge flottant rétractable (bord droit) ---- */
  const bd = document.createElement('button');
  bd.id = 'geBadge'; bd.type = 'button'; bd.setAttribute('aria-expanded', 'false'); bd.setAttribute('aria-label', G.titre);
  bd.innerHTML = '<i class="gb-d"></i><span class="gb-i"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="9" cy="10.5" r="1.3"/><path d="M4 17l5-4.2 3.6 2.8 3-2.4L20 16.5"/></svg></span><span class="gb-t">' + esc(G.badge) + '</span>';
  document.body.appendChild(bd);
  let tr = null;
  const compact = () => { clearTimeout(tr); bd.setAttribute('aria-expanded', 'false'); };
  bd.addEventListener('click', () => {
    if (bd.getAttribute('aria-expanded') !== 'true') { bd.setAttribute('aria-expanded', 'true'); clearTimeout(tr); tr = setTimeout(compact, 6000); return; }
    compact();
    if (anim) return;
    if (ouvert) versSection(); else deplier();
  });
  document.addEventListener('pointerdown', e => { if (!bd.contains(e.target)) compact(); }, true);
  const pret = () => document.body.classList.contains('revele');
  const montrerBadge = () => setTimeout(() => bd.classList.add('pret'), 1200);
  if (pret()) montrerBadge(); else { const mo = new MutationObserver(() => { if (pret()) { mo.disconnect(); montrerBadge(); } }); mo.observe(document.body, {attributes: true, attributeFilter: ['class']}); }

  charger().then(l => { if (l.length) { items = l; afficher(); } }).catch(() => {});
})();
