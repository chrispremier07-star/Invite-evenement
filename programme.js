/* Section « Le programme » : frise verticale vivante. À ajouter avant </body> :  <script src="programme.js"></script>
   (retirer la ligne = présentation d'origine) */
(function(){
  const liste = document.getElementById('programmeListe');
  if (!liste) return;
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICONES = [
    '<path d="M7 3h10l-1 7a4 4 0 01-8 0z"/><path d="M12 14v6M8.5 20h7"/>',
    '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M12 4l1.2 2.2L12 8.4 10.8 6.2z"/>',
    '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2h5L16 7"/>',
    '<path d="M7 3v8a2 2 0 002 2v8M11 3v8a2 2 0 01-2 2M17 3c-2 2-3 5-3 8h3v10"/>',
    '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>'
  ];

  const st = document.createElement('style');
  st.textContent =
    '#programmeListe{position:relative;border-top:0!important;padding:0}' +
    '#programmeListe .p-rail{position:absolute;left:11px;top:32px;bottom:44px;width:1px;background:rgba(59,34,24,.14)}' +
    '#programmeListe .p-rail i{position:absolute;inset:0;background:linear-gradient(180deg,#8B0F1C,#C49A4A);transform-origin:50% 0;transform:scaleY(0)}' +
    '#programmeListe li{position:relative;display:grid!important;grid-template-columns:34px minmax(0,1fr);gap:0!important;padding:7px 0!important;border:0!important;align-items:start}' +
    '#programmeListe li::before{content:"";position:absolute;left:5px;top:26px;width:13px;height:13px;border-radius:50%;background:var(--creme,#F6F1E7);border:1px solid var(--terra,#8B0F1C);z-index:1;transition:background 1s ease,box-shadow 1s ease,transform 1s ease}' +
    '#programmeListe li.actif::before{background:var(--terra,#8B0F1C);box-shadow:0 0 0 5px rgba(139,15,28,.14);transform:scale(1.12)}' +
    '#programmeListe .p-carte{grid-column:2;position:relative;background:#FBF8F1;border-radius:6px;padding:14px 16px 16px;box-shadow:0 1px 0 rgba(59,34,24,.06),0 10px 22px -18px rgba(59,34,24,.35);transition:transform .9s cubic-bezier(.22,.61,.36,1),box-shadow .9s cubic-bezier(.22,.61,.36,1)}' +
    '#programmeListe li.actif .p-carte{transform:translateX(3px);box-shadow:0 1px 0 rgba(59,34,24,.06),0 14px 26px -18px rgba(139,15,28,.38)}' +
    '#programmeListe .p-carte::before{content:"";position:absolute;left:-6px;top:26px;width:11px;height:11px;background:#FBF8F1;transform:rotate(45deg);border-radius:2px}' +
    '#programmeListe .p-tete{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}' +
    '#programmeListe .p-heure{display:block!important;text-align:left!important;padding:0!important;font-size:23px!important;line-height:1.1!important;white-space:nowrap}' +
    '#programmeListe .p-ico{flex:none;width:24px;height:24px;color:var(--terra-encre,#7A0F1B);opacity:.8;transition:transform 1.2s cubic-bezier(.22,.61,.36,1),opacity 1s ease}' +
    '#programmeListe .p-ico svg{display:block;width:24px;height:24px}' +
    '#programmeListe li.actif .p-ico{transform:rotate(-6deg);opacity:1}' +
    '#programmeListe .p-titre{margin:0 0 4px!important;font-size:12px!important;letter-spacing:.16em!important;line-height:1.45!important}' +
    '#programmeListe .p-texte{margin:0!important;font-size:15px!important;line-height:1.5!important}' +
    '@media (min-width:560px){#programmeListe .p-carte{padding:18px 22px 20px}#programmeListe .p-heure{font-size:26px!important}#programmeListe .p-titre{font-size:13px!important}#programmeListe .p-texte{font-size:16px!important}}';
  st.textContent += '#programme .bloc{padding-bottom:40px!important}#lieu .bloc{padding-top:40px!important}@media (min-width:760px){#programme .bloc{padding-bottom:64px!important}#lieu .bloc{padding-top:64px!important}}';
  document.head.appendChild(st);

  const items = [...liste.querySelectorAll('li')];
  items.forEach((li, i) => {
    const textes = li.querySelector('div'), heure = li.querySelector('.p-heure');
    if (!textes || !heure || li.querySelector('.p-carte')) return;
    textes.classList.add('p-carte');
    const tete = document.createElement('div');
    tete.className = 'p-tete';
    const ico = document.createElement('span');
    ico.className = 'p-ico'; ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' + ICONES[i % ICONES.length] + '</svg>';
    tete.appendChild(heure); tete.appendChild(ico);
    textes.insertBefore(tete, textes.firstChild);
  });

  const rail = document.createElement('div');
  rail.className = 'p-rail'; rail.innerHTML = '<i></i>';
  liste.insertBefore(rail, liste.firstChild);
  const rempli = rail.firstChild;

  if (calme){ rempli.style.transform = 'scaleY(1)'; items.forEach(li => li.classList.add('actif')); return; }

  let attente = false;
  function maj(){
    attente = false;
    const vh = innerHeight, r = liste.getBoundingClientRect(), ligne = vh * .62;
    rempli.style.transform = 'scaleY(' + Math.min(1, Math.max(0, (ligne - r.top) / r.height)).toFixed(4) + ')';
    items.forEach(li => li.classList.toggle('actif', li.getBoundingClientRect().top + 34 < ligne));
  }
  const plan = () => { if (!attente){ attente = true; requestAnimationFrame(maj); } };
  addEventListener('scroll', plan, {passive:true}); addEventListener('resize', plan); plan();
})();
