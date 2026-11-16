/* Popup « Répondre à l'invitation » : s'affiche quand l'invité, après avoir parcouru toute la page, remonte jusqu'au milieu.
   Elle ne revient plus une fois la réponse envoyée.
   À ajouter avant </body> (avant installer.js) :  <script src="rappel-reponse.js"></script> */
const RAPPEL_REPONSE = {
  surtitre: "Votre réponse",
  titre: "Votre présence nous est précieuse",
  texte: "Il ne vous reste qu’un instant pour nous confirmer votre venue.",
  plusTard: "Plus tard",
  seuil: 0.95,      // part de la page à parcourir pour valider « parcours complet »
  milieu: 0.5       // position (0 = haut, 1 = bas) à atteindre en remontant pour déclencher
};

(function(){
  const R = RAPPEL_REPONSE, FAIT = 'invitation-reponse-envoyee';
  const lien = document.getElementById('rsvpLien') || document.querySelector('#rsvp a.btn');
  if (!lien) return;
  const lu = () => { try { return localStorage.getItem(FAIT) === '1'; } catch(x){ return false; } };
  const ecrire = () => { try { localStorage.setItem(FAIT, '1'); } catch(x){} };
  if (lu()) return;

  let affiche = false, complet = false, dernier = scrollY, remonte = 0;
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BORD = '#3F0A10', OR = '#C49A4A', CREME = '#FBF8F1', RUBIS = '#8B0F1C', doux = 'cubic-bezier(.22,.61,.36,1)';
  const suivre = () => {
    const m = document.getElementById('rsvpModal');
    if (!m) return setTimeout(suivre, 1500);
    new MutationObserver(() => { if (m.classList.contains('fini')) ecrire(); }).observe(m, {attributes: true, attributeFilter: ['class']});
  };
  suivre();

  const st = document.createElement('style');
  st.textContent =
    '#rpPop{position:fixed;inset:0;z-index:92;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(18,2,5,.82);-webkit-backdrop-filter:blur(10px) saturate(.8);backdrop-filter:blur(10px) saturate(.8);opacity:0;visibility:hidden;transition:opacity .9s ' + doux + ',visibility 0s linear .9s}' +
    '#rpPop.on{opacity:1;visibility:visible;transition:opacity .9s ' + doux + '}' +
    '#rpPop .rp{position:relative;width:100%;max-width:400px;text-align:center;padding:4px;border-radius:3px;background:linear-gradient(112deg,#7A5518 0%,#D9B466 14%,#FBEBB4 24%,#B58A38 36%,#7A5518 50%,#E8C879 64%,#FFF3C8 74%,#A87C2E 88%,#6E4A12 100%);background-size:320% 100%;filter:drop-shadow(0 0 26px rgba(236,196,110,.3)) drop-shadow(0 24px 40px rgba(0,0,0,.55));opacity:0;transform:translate3d(0,28px,0) scale(.94);transition:transform 1.1s ' + doux + ' .1s,opacity .9s ease .1s}' +
    '#rpPop.on .rp{opacity:1;transform:none}' +
    '#rpPop .rp-in{position:relative;background:' + CREME + ';color:' + BORD + ';padding:46px 28px 28px;border-radius:1px;background-image:radial-gradient(circle,rgba(176,134,52,.45) 0 1px,transparent 1.4px);background-size:8px 8px;background-position:center}' +
    '#rpPop .rp-in::before{content:"";position:absolute;inset:7px;background:' + CREME + ';border:1px solid rgba(176,134,52,.85);border-radius:1px}' +
    '#rpPop .rp-in>*{position:relative}' +
    '#rpPop .rp-or{display:block;width:12px;height:12px;margin:0 auto 18px;background:' + CREME + ';border:1px solid ' + OR + ';transform:rotate(45deg);box-shadow:-34px 0 0 -5px ' + OR + ',34px 0 0 -5px ' + OR + '}' +
    '#rpPop .rp-s{display:block;font:500 11px/1 var(--capitale,serif);letter-spacing:.3em;text-transform:uppercase;color:#7A0F1B;margin-bottom:14px}' +
    '#rpPop .rp-t{font:400 clamp(26px,7vw,32px)/1.15 var(--titre,serif);margin:0 0 12px;text-wrap:balance}' +
    '#rpPop .rp-p{font:400 15px/1.55 var(--texte,sans-serif);color:#6A2E33;margin:0 auto 26px;max-width:30ch;text-wrap:pretty}' +
    '#rpPop .rp-go{position:relative;overflow:hidden;isolation:isolate;width:100%;min-height:58px;border:0;border-radius:999px;background:' + BORD + ';color:#F6F1E7;font:500 12px/1 var(--capitale,serif);letter-spacing:.2em;text-transform:uppercase;cursor:pointer;padding:0 22px;transition:background .5s ease}' +
    '#rpPop .rp-go:hover{background:' + RUBIS + '}' +
    '#rpPop .rp-go::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:36%;z-index:-1;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(224,191,126,.55),rgba(255,255,255,0))}' +
    '#rpPop .rp-later{display:block;margin:14px auto 0;min-height:44px;padding:0 14px;border:0;background:none;font:400 13px/1 var(--texte,sans-serif);color:#6A2E33;text-decoration:underline;cursor:pointer}' +
    '@media (prefers-reduced-motion:no-preference){#rpPop.on .rp-go{animation:rpPulse 2.8s ease-in-out 1.4s infinite}#rpPop.on .rp-go::after{animation:rpBeam 4s cubic-bezier(.45,.05,.3,1) 1.6s infinite}}' +
    '@keyframes rpPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(196,154,74,.5)}50%{transform:scale(1.025);box-shadow:0 0 0 12px rgba(196,154,74,0)}}' +
    '@keyframes rpBeam{0%{left:-60%}55%,100%{left:130%}}' +
    '@media (prefers-reduced-motion:reduce){#rpPop,#rpPop *{transition:none!important}}';
  document.head.appendChild(st);

  const p = document.createElement('div');
  p.id = 'rpPop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-label', R.titre);
  p.innerHTML = '<div class="rp"><div class="rp-in"><i class="rp-or"></i><span class="rp-s">' + R.surtitre + '</span><h2 class="rp-t">' + R.titre + '</h2><p class="rp-p">' + R.texte + '</p><button type="button" class="rp-go"></button><button type="button" class="rp-later">' + R.plusTard + '</button></div></div>';
  document.body.appendChild(p);
  const go = p.querySelector('.rp-go');
  const ferme = () => p.classList.remove('on');
  p.querySelector('.rp-later').addEventListener('click', ferme);
  p.addEventListener('click', ev => { if (ev.target === p) ferme(); });
  addEventListener('keydown', ev => { if (ev.key === 'Escape') ferme(); });
  go.addEventListener('click', () => { ferme(); setTimeout(() => lien.click(), 350); });

  const bannierePwa = () => { const b = document.getElementById('pwaBan'); return b && b.classList.contains('on'); };
  const modalOuverte = () => { const m = document.getElementById('rsvpModal'); return m && m.classList.contains('ouvert'); };
  function montrer(){
    if (lu()) return;
    if (bannierePwa() || modalOuverte()) return setTimeout(montrer, 4000);
    const rp = p.querySelector('.rp');
    if (!rp.querySelector('.g-o1')) document.querySelectorAll('#grille .g-enc:first-child .g-o1, #grille .g-enc:first-child .g-o2, .g-enc .g-o1, .g-enc .g-o2').forEach((o, i) => { if (i < 2) rp.appendChild(o.cloneNode(true)); });
    go.textContent = lien.textContent.trim() || 'Répondre à l’invitation';
    p.classList.add('on');
  }
  const fin = () => {
    if (affiche) return;
    const h = document.documentElement, haut = Math.max(h.scrollHeight, 1), y = scrollY;
    if (!complet) { if ((y + innerHeight) / haut >= R.seuil) complet = true; dernier = y; return; }
    remonte = y < dernier ? remonte + (dernier - y) : 0;
    dernier = y;
    if (remonte < 40) return;
    if ((y + innerHeight / 2) / haut > R.milieu) return;
    affiche = true; removeEventListener('scroll', fin);
    montrer();
  };
  addEventListener('scroll', fin, {passive: true});
})();
