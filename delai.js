/* Date limite de réponse : présentée comme un rappel distinct de la date du mariage.
   À ajouter avant </body> :  <script src="delai.js"></script>   (retirer la ligne = présentation d'origine) */
(function(){
  const avant = document.querySelector('.rsvp-avant'), date = document.querySelector('.rsvp-date');
  if (!avant || !date) return;
  const LIBELLE = 'Date limite de réponse';        // libellé affiché au-dessus de la date
  avant.textContent = LIBELLE;

  const st = document.createElement('style');
  st.textContent =
    '.rsvp-avant{margin-bottom:12px!important}' +
    '.rsvp-date{display:inline-flex!important;align-items:center;justify-content:center;gap:12px;margin:0 auto 40px!important;padding:13px 24px;border:1px solid rgba(224,191,126,.6);border-radius:999px;font:400 15px/1 var(--texte,Jost,sans-serif)!important;font-style:normal!important;letter-spacing:.14em;text-transform:uppercase;color:#F6F1E7;background:rgba(224,191,126,.08)}' +
    '.rsvp-date svg{flex:none;width:18px;height:18px;color:#E0BF7E}' +
    '.rsvp .rsvp-bloc-date{display:flex;flex-direction:column;align-items:center}';
  document.head.appendChild(st);

  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  date.insertAdjacentHTML('afterbegin', svg);

  const bloc = document.createElement('div');
  bloc.className = 'rsvp-bloc-date apparait';
  avant.parentNode.insertBefore(bloc, avant);
  bloc.appendChild(avant); bloc.appendChild(date);
  avant.classList.remove('apparait'); date.classList.remove('apparait');
  avant.style.opacity = date.style.opacity = '1'; avant.style.transform = date.style.transform = 'none';
  const io = new IntersectionObserver(e => { if (e[0].isIntersecting){ bloc.classList.add('visible'); io.disconnect(); } }, {threshold:.2});
  io.observe(bloc);
})();
