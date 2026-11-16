/* Formulaire de réponse intégré au site (remplace le lien Google Forms).
   À ajouter avant </body> :  <script src="formulaire.js"></script>   (retirer la ligne = retour au lien d'origine)
   Les réponses arrivent par e-mail via Formspree (formspree.io) ou Web3Forms (web3forms.com), ou dans un tableau Google Sheets (script Google Apps Script). */

const FORMULAIRE = {
  /* ---- À RENSEIGNER ---- */
  endpoint: "https://formspree.io/f/xyewyjvn",   // Google Sheets : l'adresse https://script.google.com/macros/s/.../exec
  // Formspree : "https://formspree.io/f/xxxxxxxx"   |   Web3Forms : "https://api.web3forms.com/submit"
  accessKey: "",         // Web3Forms uniquement : la clé reçue par e-mail (laissez "" avec Formspree)

  /* ---- Textes ---- */
  surtitre: "Votre réponse",
  titre: "Confirmer ma présence",
  intro: "Quelques informations suffisent. Cela nous aide à tout préparer pour vous accueillir.",
  libNom: "Nom et prénom",
  libPresence: "Serez-vous des nôtres ?",
  oui: "Oui, avec joie",
  non: "Je ne pourrai pas venir",
  libNombre: "Nombre de personnes (vous compris)",
  libRegime: "Allergies ou régime alimentaire",
  phRegime: "Facultatif",
  libMessage: "Un mot pour les mariés",
  phMessage: "Facultatif",
  envoyer: "Envoyer ma réponse",
  envoi: "Envoi en cours…",
  erreur: "L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez.",
  champNom: "Merci d’indiquer votre nom.",
  champMenu: "Merci de choisir un menu.",
  champPresence: "Merci de choisir une réponse.",
  merciOui: "Merci, nous avons hâte de vous retrouver.",
  merciNon: "Merci de nous avoir prévenus. Vous nous manquerez.",
  libMenu: "Quel serait votre choix de menu ?",
  menus: ["Tchep au poulet", "Tchep au poisson", "Placali sauce côpê", "Attiéké poisson braisé", "Attiéké poisson frit", "Alloco & frites"],
  fermer: "Fermer",
  dejaRepondu: "Votre réponse a bien été enregistrée. Merci !",
  rappelLibelle: "Me rappeler l’invitation",
  rappelAide: "Recevez un rappel régulier par notification.",
  rappelTitre: "Carole & Antoine",
  rappelTexte: "N’oubliez pas notre invitation : programme, lieu et réponse en un geste.",
  rappelHeures: 48,
  rappelRefus: "Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur.",
  rappelIos: "Sur iPhone, installez d’abord l’application sur l’écran d’accueil, puis rouvrez-la pour activer le rappel.",
  rappelNonDispo: "Les notifications ne sont pas disponibles sur ce navigateur."
};

(function(){
  const F = FORMULAIRE, K = 'invitation-rappel', T = 'invitation-rappel-dernier';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const appli = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ok = 'Notification' in window && 'serviceWorker' in navigator;
  const actif = () => { try { return localStorage.getItem(K) === '1' && Notification.permission === 'granted'; } catch(x){ return false; } };
  async function montrer(){
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(F.rappelTitre, {body: F.rappelTexte, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'rappel-invitation', data: {url: './'}});
    try { localStorage.setItem(T, String(Date.now())); } catch(x){}
  }
  window.__rappel = {
    ok, actif,
    async activer(){
      if (!ok) return F.rappelNonDispo;
      if (ios && !appli) return F.rappelIos;
      const p = await Notification.requestPermission();
      if (p !== 'granted') return F.rappelRefus;
      try { localStorage.setItem(K, '1'); } catch(x){}
      try { await navigator.serviceWorker.register('sw.js'); const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.register('rappel-invitation', {minInterval: F.rappelHeures * 3600 * 1000}); } catch(x){}
      try { await montrer(); } catch(x){}
      return '';
    },
    desactiver(){
      try { localStorage.removeItem(K); } catch(x){}
      navigator.serviceWorker && navigator.serviceWorker.ready.then(r => r.periodicSync && r.periodicSync.unregister('rappel-invitation')).catch(() => {});
    }
  };
  if (ok && actif()) {
    let d = 0; try { d = +localStorage.getItem(T) || 0; } catch(x){}
    if (Date.now() - d > F.rappelHeures * 3600 * 1000) setTimeout(() => montrer().catch(() => {}), 4000);
  }
})();

(function(){
  const F = FORMULAIRE, bouton = document.getElementById('rsvpLien') || document.querySelector('#rsvp a.btn');
  if (!F.endpoint || !bouton) return;
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const e = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const OR = '#C49A4A', BORD = '#3F0A10', RUBIS = '#8B0F1C';
  const doux = 'cubic-bezier(.22,.61,.36,1)';

  const st = document.createElement('style');
  st.textContent =
    '#rsvpModal{position:fixed;inset:0;z-index:95;display:flex;align-items:flex-end;justify-content:center;background:rgba(26,3,6,.8);opacity:0;visibility:hidden;transition:opacity .6s ' + doux + ',visibility 0s linear .6s}' +
    '#rsvpModal.ouvert{opacity:1;visibility:visible;transition:opacity .6s ' + doux + '}' +
    '#rsvpModal .rf{position:relative;width:100%;max-width:520px;max-height:94svh;overflow-y:auto;overscroll-behavior:contain;background:#FBF8F1;color:' + BORD + ';border-radius:18px 18px 0 0;padding:34px 22px calc(28px + env(safe-area-inset-bottom));transform:translate3d(0,40px,0);transition:transform .8s ' + doux + '}' +
    '#rsvpModal.ouvert .rf{transform:none}' +
    '@media (min-width:640px){#rsvpModal{align-items:center}#rsvpModal .rf{border-radius:6px;padding:44px 40px 36px;max-height:90vh}}' +
    '#rsvpModal .rf-x{position:absolute;right:10px;top:10px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:' + BORD + ';background:transparent;border:0;cursor:pointer}' +
    '#rsvpModal .rf-x:hover{background:rgba(63,10,16,.07)}' +
    '#rsvpModal .rf-sur{display:block;text-align:center;font:500 11px/1 var(--capitale,serif);letter-spacing:.3em;text-transform:uppercase;color:#7A0F1B;margin-bottom:14px}' +
    '#rsvpModal .rf-titre{text-align:center;font:400 clamp(28px,8vw,36px)/1.1 var(--titre,serif);margin:0 0 10px}' +
    '#rsvpModal .rf-intro{text-align:center;color:#6A2E33;font-size:15px;line-height:1.55;max-width:34ch;margin:0 auto 26px;text-wrap:pretty}' +
    '#rsvpModal label,#rsvpModal legend{display:block;font:500 11px/1.3 var(--capitale,serif);letter-spacing:.18em;text-transform:uppercase;color:#6A2E33;margin:0 0 9px;padding:0}' +
    '#rsvpModal .rf-ch{margin:0 0 22px;border:0;padding:0;min-width:0}' +
    '#rsvpModal input[type=text],#rsvpModal textarea{width:100%;font:400 16px/1.4 var(--texte,sans-serif);color:' + BORD + ';background:#fff;border:1px solid rgba(63,10,16,.22);border-radius:4px;padding:14px;outline:0;transition:border-color .4s ease,box-shadow .4s ease;-webkit-appearance:none;appearance:none}' +
    '#rsvpModal textarea{min-height:84px;resize:vertical}' +
    '#rsvpModal input:focus,#rsvpModal textarea:focus{border-color:' + RUBIS + ';box-shadow:0 0 0 3px rgba(139,15,28,.12)}' +
    '#rsvpModal .rf-choix{display:grid;gap:10px}' +
    '#rsvpModal .rf-choix>div{position:relative}' +
    '#rsvpModal .rf-choix input{position:absolute;opacity:0;pointer-events:none}' +
    '#rsvpModal .rf-pill{display:flex;align-items:center;gap:12px;min-height:54px;padding:0 16px;border:1px solid rgba(63,10,16,.22);border-radius:4px;background:#fff;font:400 16px/1.3 var(--texte,sans-serif);letter-spacing:0;text-transform:none;color:' + BORD + ';margin:0;cursor:pointer;transition:background .4s ease,border-color .4s ease,color .4s ease}' +
    '#rsvpModal .rf-pill::before{content:"";flex:none;width:18px;height:18px;border-radius:50%;border:1px solid ' + RUBIS + ';transition:background .4s ease,box-shadow .4s ease}' +
    '#rsvpModal .rf-choix input:checked+.rf-pill{background:' + BORD + ';border-color:' + BORD + ';color:#F6F1E7}' +
    '#rsvpModal .rf-choix input:checked+.rf-pill::before{background:#E0BF7E;border-color:#E0BF7E;box-shadow:inset 0 0 0 4px ' + BORD + '}' +
    '#rsvpModal .rf-choix input:focus-visible+.rf-pill{box-shadow:0 0 0 3px rgba(139,15,28,.25)}' +
    '#rsvpModal .rf-pas{display:inline-flex;align-items:center;border:1px solid rgba(63,10,16,.22);border-radius:999px;background:#fff}' +
    '#rsvpModal .rf-pas button{width:52px;height:52px;border:0;background:transparent;font-size:24px;color:' + BORD + ';cursor:pointer;border-radius:50%}' +
    '#rsvpModal .rf-pas button:active{background:rgba(63,10,16,.08)}' +
    '#rsvpModal .rf-pas output{min-width:44px;text-align:center;font:400 24px/1 var(--titre,serif)}' +
    '#rsvpModal .rf-det{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .7s ' + doux + ',opacity .6s ease}' +
    '#rsvpModal .rf-det.on{grid-template-rows:1fr;opacity:1}' +
    '#rsvpModal .rf-det>div{min-height:0;overflow:hidden;padding:2px}' +
    '#rsvpModal .rf-go{width:100%;min-height:56px;border:0;border-radius:999px;background:' + BORD + ';color:#F6F1E7;font:500 12px/1 var(--capitale,serif);letter-spacing:.22em;text-transform:uppercase;cursor:pointer;transition:background .5s ease}' +
    '#rsvpModal .rf-go:hover{background:' + RUBIS + '}#rsvpModal .rf-go[disabled]{opacity:.6;cursor:wait}' +
    '#rsvpModal .rf-msg{min-height:20px;margin:12px 0 0;text-align:center;font-size:14px;color:#9A1524}' +
    '#rsvpModal .rf-pot{position:absolute!important;left:-9999px;width:1px;height:1px;opacity:0}' +
    '#rsvpModal .rf-ok{display:none;text-align:center;padding:24px 0 8px}' +
    '#rsvpModal.fini .rf-form{display:none}#rsvpModal.fini .rf-ok{display:block}' +
    '#rsvpModal .rf-ok svg{width:84px;height:84px;margin:0 auto 18px;display:block}' +
    '#rsvpModal .rf-ok p{font:italic 400 26px/1.25 var(--titre,serif);margin:0 auto 24px;max-width:18ch;text-wrap:balance}' +
    '#rsvpModal .rf-ferme{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 28px;border:1px solid #7A0F1B;border-radius:999px;background:transparent;color:#7A0F1B;font:500 11px/1 var(--capitale,serif);letter-spacing:.2em;text-transform:uppercase;cursor:pointer}' +
    '#rsvpModal .rf-rap{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 22px;padding:14px 16px;border:1px solid rgba(63,10,16,.18);border-radius:4px;background:#fff}' +
    '#rsvpModal .rf-rap b{display:block;font:500 11px/1.3 var(--capitale,serif);letter-spacing:.16em;text-transform:uppercase;color:' + BORD + '}#rsvpModal .rf-rap span{display:block;margin-top:5px;font-size:13.5px;line-height:1.4;color:#6A2E33}' +
    '#rsvpModal .rf-sw{flex:none;position:relative;width:56px;height:32px;border-radius:999px;border:1px solid rgba(63,10,16,.3);background:#E9DFD0;cursor:pointer;padding:0;transition:background .4s ease,border-color .4s ease}' +
    '#rsvpModal .rf-sw::after{content:"";position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(26,3,6,.35);transition:transform .4s ' + doux + '}' +
    '#rsvpModal .rf-sw[aria-checked=true]{background:' + BORD + ';border-color:' + BORD + '}#rsvpModal .rf-sw[aria-checked=true]::after{transform:translateX(24px);background:#E0BF7E}' +
    '#rsvpModal .rf-sw:focus-visible{box-shadow:0 0 0 3px rgba(139,15,28,.25)}' +
    '@media (prefers-reduced-motion:reduce){#rsvpModal,#rsvpModal *{transition:none!important}}';
  document.head.appendChild(st);

  const m = document.createElement('div');
  m.id = 'rsvpModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', F.titre);
  m.innerHTML =
    '<div class="rf"><button type="button" class="rf-x" aria-label="' + e(F.fermer) + '"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<form class="rf-form" novalidate>' +
      '<span class="rf-sur">' + e(F.surtitre) + '</span><h2 class="rf-titre">' + e(F.titre) + '</h2><p class="rf-intro">' + e(F.intro) + '</p>' +
      '<div class="rf-ch"><label for="rf-nom">' + e(F.libNom) + '</label><input type="text" id="rf-nom" name="nom" autocomplete="name" enterkeyhint="next"></div>' +
      '<fieldset class="rf-ch"><legend>' + e(F.libPresence) + '</legend><div class="rf-choix">' +
        '<div><input type="radio" id="rf-oui" name="presence" value="Oui"><label class="rf-pill" for="rf-oui">' + e(F.oui) + '</label></div>' +
        '<div><input type="radio" id="rf-non" name="presence" value="Non"><label class="rf-pill" for="rf-non">' + e(F.non) + '</label></div></div></fieldset>' +
      '<div class="rf-det" id="rf-det"><div>' +
        '<div class="rf-ch"><label>' + e(F.libNombre) + '</label><div class="rf-pas"><button type="button" data-d="-1" aria-label="Moins">−</button><output id="rf-n">1</output><button type="button" data-d="1" aria-label="Plus">+</button></div></div>' +
        '<div class="rf-ch"><label for="rf-reg">' + e(F.libRegime) + '</label><textarea id="rf-reg" name="regime" placeholder="' + e(F.phRegime) + '"></textarea></div>' +
        '<fieldset class="rf-ch"><legend>' + e(F.libMenu) + '</legend><div class="rf-choix">' + F.menus.map((t, i) => '<div><input type="radio" id="rf-menu-' + i + '" name="menu" value="' + e(t) + '"><label class="rf-pill" for="rf-menu-' + i + '">' + e(t) + '</label></div>').join('') + '</div></fieldset>' +
      '</div></div>' +
      '<div class="rf-ch"><label for="rf-msg">' + e(F.libMessage) + '</label><textarea id="rf-msg" name="message" placeholder="' + e(F.phMessage) + '"></textarea></div>' +
      '<div class="rf-rap"><div><b>' + e(F.rappelLibelle) + '</b><span class="rf-rap-t">' + e(F.rappelAide) + '</span></div><button type="button" class="rf-sw" role="switch" aria-checked="false" aria-label="' + e(F.rappelLibelle) + '"></button></div>' +
      '<input class="rf-pot" type="text" name="site_web" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<button type="submit" class="rf-go">' + e(F.envoyer) + '</button><p class="rf-msg" role="alert"></p>' +
    '</form>' +
    '<div class="rf-ok"><svg viewBox="0 0 84 84" fill="none" stroke="' + OR + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle class="c" cx="42" cy="42" r="36" stroke-dasharray="227" stroke-dashoffset="' + (calme ? 0 : 227) + '"/><path class="k" d="M26 43l11 11 21-24" stroke-dasharray="52" stroke-dashoffset="' + (calme ? 0 : 52) + '"/></svg><p class="rf-merci"></p><button type="button" class="rf-ferme">' + e(F.fermer) + '</button></div></div>';
  document.body.appendChild(m);

  const q = s => m.querySelector(s), form = q('.rf-form'), det = q('#rf-det'), nEl = q('#rf-n'), msg = q('.rf-msg'), go = q('.rf-go');
  let n = 1, ouvert = false;
  const CLE = 'invitation-reponse-envoyee', CLE_T = 'invitation-reponse-type';
  const dejaRepondu = () => { try { return localStorage.getItem(CLE) === '1'; } catch(x){ return false; } };
  const ouvrir = () => {
    if (dejaRepondu()) {
      let t = ''; try { t = localStorage.getItem(CLE_T) || ''; } catch(x){}
      q('.rf-merci').textContent = t === 'Oui' ? F.merciOui : (t === 'Non' ? F.merciNon : F.dejaRepondu);
      q('.c').style.strokeDashoffset = 0; q('.k').style.strokeDashoffset = 0;
      m.classList.add('fini');
    }
    ouvert = true; m.classList.add('ouvert'); document.body.style.overflow = 'hidden'; };
  const fermer = () => { ouvert = false; m.classList.remove('ouvert'); document.body.style.overflow = ''; };
  bouton.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); ouvrir(); }, true);
  q('.rf-x').addEventListener('click', fermer); q('.rf-ferme').addEventListener('click', fermer);
  m.addEventListener('click', ev => { if (ev.target === m) fermer(); });
  addEventListener('keydown', ev => { if (ouvert && ev.key === 'Escape') fermer(); });
  form.addEventListener('change', ev => { if (ev.target.name === 'presence') det.classList.toggle('on', ev.target.value === 'Oui'); });
  m.querySelectorAll('.rf-pas button').forEach(b => b.addEventListener('click', () => { n = Math.max(1, Math.min(12, n + +b.dataset.d)); nEl.textContent = n; }));

  const sw = q('.rf-sw'), rt = q('.rf-rap-t'), R = window.__rappel;
  const maj = on => sw.setAttribute('aria-checked', on ? 'true' : 'false');
  if (R) maj(R.actif());
  sw.addEventListener('click', async () => {
    if (!R) return;
    if (sw.getAttribute('aria-checked') === 'true') { R.desactiver(); maj(false); rt.textContent = F.rappelAide; return; }
    const err = await R.activer();
    maj(!err); rt.textContent = err || F.rappelAide;
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault(); msg.textContent = '';
    const d = new FormData(form), nom = (d.get('nom') || '').trim(), pres = d.get('presence');
    if (d.get('site_web')) return;
    if (!nom){ msg.textContent = F.champNom; q('#rf-nom').focus(); return; }
    if (!pres){ msg.textContent = F.champPresence; return; }
    if (pres === 'Oui' && !d.get('menu')){ msg.textContent = F.champMenu; return; }
    const oui = pres === 'Oui', corps = {nom, menu: oui ? (d.get('menu') || '') : '', presence: pres, nombre_de_personnes: pres === 'Oui' ? n : 0, regime: pres === 'Oui' ? (d.get('regime') || '') : '', message: d.get('message') || '', subject: 'Réponse mariage : ' + nom + ' (' + pres + ')', from_name: nom};
    if (F.accessKey) corps.access_key = F.accessKey;
    go.disabled = true; go.textContent = F.envoi;
    try {
      if (/script\.google\.com/.test(F.endpoint)) {
        await fetch(F.endpoint, {method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(corps)});
      } else {
        const r = await fetch(F.endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify(corps)});
        if (!r.ok) throw new Error(r.status);
      }
      q('.rf-merci').textContent = pres === 'Oui' ? F.merciOui : F.merciNon;
      try { localStorage.setItem(CLE, '1'); localStorage.setItem(CLE_T, pres); } catch(x){}
      m.classList.add('fini');
      if (!calme){
        q('.c').animate([{strokeDashoffset: 227}, {strokeDashoffset: 0}], {duration: 1100, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards'});
        q('.k').animate([{strokeDashoffset: 52}, {strokeDashoffset: 0}], {duration: 700, delay: 800, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards'});
      }
      try { navigator.vibrate && navigator.vibrate([20, 50, 20]); } catch(x){}
    } catch(err){
      msg.textContent = F.erreur; go.disabled = false; go.textContent = F.envoyer;
    }
  });
})();
