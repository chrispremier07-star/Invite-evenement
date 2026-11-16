/* Invitation à installer le site sur l'écran d'accueil (Android + iPhone/iPad).
   À ajouter avant </body> :  <script src="installer.js"></script>   (retirer la ligne = plus de proposition)
   Le rappel revient à chaque visite et toutes les quelques secondes tant que l'application n'est pas installée. */

const INSTALLER = {
  premiereApparition: 6,   // secondes avant la proposition (visites suivantes)
  finParcours: 0.97,       // proportion de la page à parcourir avant la proposition (0.97 = bas de page)
  rappel: 40,              // secondes avant de reproposer après « Plus tard »
  titre: "Gardez notre invitation sur votre téléphone",
  texte: "Ajoutez l’icône à votre écran d’accueil pour retrouver le programme, le lieu et votre réponse à tout moment.",
  installer: "Installer l’application",
  plusTard: "Plus tard",
  dejaFait: "J’ai déjà installé l’application",
  iosTitre: "Ajouter à l’écran d’accueil",
  iosEtapes: ["Touchez le bouton Partager {ico} en bas de l’écran", "Faites défiler puis touchez « Sur l’écran d’accueil »", "Touchez « Ajouter » en haut à droite"],
  iosNavigateur: "Ouvrez d’abord cette page dans Safari (touchez ⋯ ou l’icône boussole, puis « Ouvrir dans Safari »).",
  androidEtapes: ["Touchez le menu ⋮ de votre navigateur", "Touchez « Installer l’application » ou « Ajouter à l’écran d’accueil »"],
  androidNavigateur: "Ouvrez d’abord cette page dans Chrome (menu ⋮ puis « Ouvrir dans le navigateur »).",
  ok: "J’ai compris",
  confirmTitre: "Icône ajoutée ?",
  confirmTexte: "Avez-vous ajouté l’invitation à l’écran d’accueil de votre téléphone ?",
  confirmOui: "Oui, c’est fait",
  confirmNon: "Pas encore"
};

(function(){
  const I = INSTALLER, KEY = 'invitation-installee';
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const fait = () => { try { localStorage.setItem(KEY, '1'); } catch(x){} };
  const estFait = () => { try { return localStorage.getItem(KEY) === '1'; } catch(x){ return false; } };

  if (standalone()) { fait(); return; }
  if (estFait() || (!ios && !android)) return;

  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  const appli = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|WhatsApp|Snapchat|TikTok|; wv\)/i.test(ua);
  const safari = ios && !appli && /Safari/.test(ua);
  const chrome = android && !appli && /Chrome\//.test(ua) && !/SamsungBrowser|Firefox|OPR|EdgA/.test(ua);
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OR = '#C49A4A', BORD = '#3F0A10', CREME = '#FBF8F1', RUBIS = '#8B0F1C';
  const doux = 'cubic-bezier(.22,.61,.36,1)';
  const ico = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

  const st = document.createElement('style');
  st.textContent =
    '#pwaBan{position:fixed;left:0;right:0;bottom:0;z-index:90;display:flex;justify-content:center;padding:0 12px calc(12px + env(safe-area-inset-bottom));pointer-events:none;transform:translate3d(0,120%,0);transition:transform ' + (calme ? '0s' : '.8s ' + doux) + '}' +
    '#pwaBan.on{transform:none}' +
    '#pwaBan .pw{pointer-events:auto;position:relative;width:100%;max-width:480px;background:' + CREME + ';color:' + BORD + ';border:1px solid ' + OR + ';border-radius:14px;padding:18px 18px 14px;box-shadow:0 18px 50px rgba(26,3,6,.45)}' +
    '#pwaBan .pw-t{font:400 20px/1.2 var(--titre,serif);margin:0 0 6px;padding-right:4px}' +
    '#pwaBan .pw-p{font:400 14px/1.5 var(--texte,sans-serif);color:#6A2E33;margin:0 0 14px;text-wrap:pretty}' +
    '#pwaBan ol{margin:0 0 14px;padding:0 0 0 20px;font:400 14.5px/1.5 var(--texte,sans-serif);color:' + BORD + '}#pwaBan li{margin:0 0 6px}' +
    '#pwaBan .pw-note{font:italic 400 14px/1.5 var(--texte,sans-serif);color:#9A1524;margin:0 0 14px}' +
    '#pwaBan .pw-r{display:flex;gap:10px;flex-wrap:wrap}' +
    '#pwaBan button{font:500 11px/1 var(--capitale,serif);letter-spacing:.18em;text-transform:uppercase;min-height:48px;padding:0 20px;border-radius:999px;cursor:pointer}' +
    '#pwaBan .pw-go{flex:1 1 auto;border:0;background:' + BORD + ';color:#F6F1E7}#pwaBan .pw-go:active{background:' + RUBIS + '}' +
    '#pwaBan .pw-tard{border:1px solid #7A0F1B;background:transparent;color:#7A0F1B}' +
    '#pwaBan .pw-deja{display:block;margin:10px auto 0;border:0;background:none;min-height:36px;padding:0 6px;font:400 12.5px/1.2 var(--texte,sans-serif);letter-spacing:0;text-transform:none;color:#6A2E33;text-decoration:underline}' +
    '@media (min-width:640px){#pwaBan{justify-content:flex-end;padding-right:24px}}';
  document.head.appendChild(st);

  const b = document.createElement('div');
  b.id = 'pwaBan'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', I.titre);
  document.body.appendChild(b);

  let evt = null, vu = 0, minuteur = null, mode = 'invite';
  const VUE = 'invitation-vue';
  const premiere = true; // à chaque visite : attendre le bas de page
  let pret = !premiere;
  const montrer = html => { b.innerHTML = '<div class="pw">' + html + '</div>'; requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('on'))); };
  const cacher = () => b.classList.remove('on');
  const plusTard = () => { cacher(); mode = 'invite'; clearTimeout(minuteur); minuteur = setTimeout(afficher, I.rappel * 1000); };
  const termine = () => { fait(); clearTimeout(minuteur); cacher(); };
  const deja = '<button type="button" class="pw-deja" data-a="deja">' + I.dejaFait + '</button>';

  function etapes(liste, note){
    mode2 = 'etapes';
    montrer('<h2 class="pw-t">' + (ios ? I.iosTitre : I.titre) + '</h2>' + (note ? '<p class="pw-note">' + note + '</p>' : '') +
      '<ol>' + liste.map(s => '<li>' + s.replace('{ico}', ico) + '</li>').join('') + '</ol>' +
      '<div class="pw-r"><button type="button" class="pw-go" data-a="tard">' + I.ok + '</button></div>' + deja);
  }
  let apiInstalle = null, mode2 = '';
  const VUES = 'invitation-etapes-vues';
  const etapesVues = () => { try { return localStorage.getItem(VUES) === '1'; } catch(x){ return false; } };
  const verifier = () => navigator.getInstalledRelatedApps ? navigator.getInstalledRelatedApps().then(a => (apiInstalle = a.length > 0), () => (apiInstalle = null)).catch(() => null) : Promise.resolve(null);
  function confirmer(){
    mode2 = 'confirm';
    montrer('<h2 class="pw-t">' + I.confirmTitre + '</h2><p class="pw-p">' + I.confirmTexte + '</p><div class="pw-r"><button type="button" class="pw-go" data-a="deja">' + I.confirmOui + '</button><button type="button" class="pw-tard" data-a="revoir">' + I.confirmNon + '</button></div>');
  }
  function afficher(){
    if (estFait() || standalone()) return termine();
    const rp = document.getElementById('rpPop');
    if (rp && rp.classList.contains('on')) { clearTimeout(minuteur); minuteur = setTimeout(afficher, 4000); return; }
    verifier().then(v => { if (v === true) return termine(); rendre(); });
  }
  function rendre(){
    if (estFait()) return;
    if (ios) return etapesVues() ? confirmer() : etapes(I.iosEtapes, safari ? '' : I.iosNavigateur);
    if (evt) { mode2 = ''; return montrer('<h2 class="pw-t">' + I.titre + '</h2><p class="pw-p">' + I.texte + '</p><div class="pw-r"><button type="button" class="pw-go" data-a="inst">' + I.installer + '</button><button type="button" class="pw-tard" data-a="tard">' + I.plusTard + '</button></div>' + deja); }
    if (chrome && apiInstalle !== false) return;
    if (etapesVues()) return confirmer();
    etapes(I.androidEtapes, chrome ? '' : (appli ? I.androidNavigateur : ''));
  }
  const intro = () => montrer('<h2 class="pw-t">' + I.titre + '</h2><p class="pw-p">' + I.texte + '</p><div class="pw-r"><button type="button" class="pw-go" data-a="aide">' + I.installer + '</button><button type="button" class="pw-tard" data-a="tard">' + I.plusTard + '</button></div>' + deja);

  b.addEventListener('click', async ev => {
    const a = ev.target.closest('[data-a]'); if (!a) return;
    const k = a.dataset.a;
    if (k === 'tard') { if (mode2 === 'etapes') { try { localStorage.setItem(VUES, '1'); } catch(x){} } plusTard(); }
    else if (k === 'revoir') { try { localStorage.removeItem(VUES); } catch(x){} etapes(ios ? I.iosEtapes : I.androidEtapes, ios && !safari ? I.iosNavigateur : ''); }
    else if (k === 'deja') termine();
    else if (k === 'aide') etapes(ios ? I.iosEtapes : I.androidEtapes, ios && !safari ? I.iosNavigateur : (android && appli ? I.androidNavigateur : ''));
    else if (k === 'inst' && evt) {
      evt.prompt();
      const r = await evt.userChoice.catch(() => ({}));
      evt = null;
      if (r.outcome === 'accepted') termine(); else plusTard();
    }
  });

  addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); evt = ev; vu = 1; if (pret && (b.classList.contains('on') || performance.now() > I.premiereApparition * 1000)) afficher(); });
  addEventListener('appinstalled', termine);
  matchMedia('(display-mode: standalone)').addEventListener && matchMedia('(display-mode: standalone)').addEventListener('change', e => { if (e.matches) termine(); });

  const debut = () => {
    if (estFait()) return;
    if (ios) return etapesVues() ? afficher() : intro();
    if (evt) return afficher();
    if (!chrome) return etapesVues() ? afficher() : intro();
    afficher();
  };
  verifier().then(v => { if (v === true) termine(); });
  if (!premiere) minuteur = setTimeout(debut, I.premiereApparition * 1000);
  else {
    const fin = () => {
      const h = document.documentElement, p = (scrollY + innerHeight) / Math.max(h.scrollHeight, 1);
      if (p < I.finParcours) return;
      removeEventListener('scroll', fin);
      pret = true; minuteur = setTimeout(debut, 1500);
    };
    addEventListener('scroll', fin, {passive: true}); fin();
  }
})();
