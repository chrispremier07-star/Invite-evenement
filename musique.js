/* Musique en boucle. À ajouter avant </body> :  <script src="musique.js"></script> */
const MUSIQUE = "musique/Musique_mariage.mp3";   // chemin de votre MP3 (majuscules comprises)

(function(){
  if (!MUSIQUE) return;
  // Désactive la musique intégrée à index.html (évite la lecture en double)
  const ancien = document.getElementById('audio'), ancienBtn = document.getElementById('son');
  if (ancien){ ancien.muted = true; ancien.pause(); ancien.addEventListener('play', () => ancien.pause()); ancien.removeAttribute('src'); ancien.load(); }
  if (ancienBtn) ancienBtn.remove();
  const audio = new Audio();
  audio.loop = true; audio.preload = 'auto'; audio.src = MUSIQUE;
  let voulu = false;

  const b = document.createElement('button');
  b.setAttribute('aria-label', 'Couper ou relancer la musique');
  b.style.cssText = 'position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;width:48px;height:48px;border-radius:50%;border:0;display:grid;place-items:center;background:rgba(244,236,224,.92);color:#3B2218;box-shadow:0 4px 16px rgba(59,34,24,.25);cursor:pointer;opacity:0;pointer-events:none;transition:opacity 1.4s ease';
  const svg = (muet) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/>' + (muet ? '<path d="M16 9.5l5 5M21 9.5l-5 5"/>' : '<path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>') + '</svg>';
  b.innerHTML = svg(true);
  document.body.appendChild(b);

  // Message d'erreur visible (diagnostic)
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;left:16px;right:76px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;padding:10px 14px;border-radius:10px;background:#3B2218;color:#F4ECE0;font:400 13px/1.4 system-ui,sans-serif;opacity:0;pointer-events:none;transition:opacity .5s ease';
  document.body.appendChild(msg);
  let mt;
  function alerter(t){ msg.textContent = t; msg.style.opacity = 1; clearTimeout(mt); mt = setTimeout(() => msg.style.opacity = 0, 9000); }

  // L'icône suit l'état réel de la lecture
  audio.addEventListener('playing', () => b.innerHTML = svg(false));
  audio.addEventListener('pause', () => b.innerHTML = svg(true));

  function jouer(){
    voulu = true;
    const p = audio.play();
    if (p && p.catch) p.catch(e => {
      voulu = false; b.innerHTML = svg(true);
      const c = audio.error ? audio.error.code : 0;
      alerter('Lecture impossible (' + (e && e.name) + (c ? ', code ' + c : '') + '). ' +
        (c === 4 ? 'Fichier introuvable ou format non lisible : réencodez le MP3.' :
         c === 3 ? 'Fichier audio corrompu : renvoyez-le.' :
         'Appuyez à nouveau sur le bouton.'));
    });
  }
  function couper(){ voulu = false; audio.pause(); }
  b.addEventListener('click', () => voulu ? couper() : jouer());

  function montrer(){ b.style.opacity = 1; b.style.pointerEvents = 'auto'; }
  const ouvrir = document.getElementById('ouvrir');
  if (ouvrir){
    ouvrir.addEventListener('click', () => { jouer(); setTimeout(montrer, 3500); });
  } else {
    montrer();
    addEventListener('pointerdown', function une(){ removeEventListener('pointerdown', une); if (!voulu) jouer(); }, {once:true});
  }

  audio.addEventListener('error', () => {
    const c = audio.error ? audio.error.code : 0;
    montrer();
    alerter(c === 4 ? 'Fichier audio introuvable ou illisible : ' + MUSIQUE : 'Erreur audio (code ' + c + ')');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause(); else if (voulu) audio.play().catch(() => {});
  });
})();
