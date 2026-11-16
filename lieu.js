/* Section « Le lieu » mise en valeur : fond bordeaux, cadre doré, carte encadrée.
   À ajouter avant </body> :  <script src="lieu.js"></script>   (retirer la ligne = présentation d'origine) */
(function(){
  const lieu = document.getElementById('lieu');
  if (!lieu) return;
  const OR = '#E0BF7E', FOND = '#3F0A10', IVOIRE = '#F6F1E7';

  const st = document.createElement('style');
  st.textContent =
    'section#lieu{background:' + FOND + '!important;color:' + IVOIRE + '!important}' +
    'section#lieu .bloc{padding-top:92px!important;padding-bottom:96px!important}' +
    'section#programme .bloc{padding-bottom:88px!important}' +
    '#lieu .surtitre{color:' + OR + '!important}' +
    '#lieu .titre{color:' + IVOIRE + '!important}' +
    '#lieu .deco-icone{color:' + OR + '!important}' +
    '#lieu .ornement i{background:rgba(224,191,126,.5)!important}#lieu .ornement b{border-color:' + OR + '!important}' +
    '#lieu .lieu-carte{position:relative;margin:0 auto 36px;padding:38px 22px 34px;border:1px solid rgba(224,191,126,.5);outline:1px solid rgba(224,191,126,.2);outline-offset:7px;max-width:440px}' +
    '#lieu .lieu-carte::before{content:"";position:absolute;left:50%;top:-7px;width:12px;height:12px;margin-left:-6px;background:' + FOND + ';border:1px solid ' + OR + ';transform:rotate(45deg)}' +
    '#lieu .lieu-pin{display:flex;justify-content:center;margin-bottom:14px;color:' + OR + '}' +
    '#lieu .lieu-nom{font-size:clamp(32px,9vw,42px)!important;line-height:1.12!important;margin:0 0 14px!important;color:' + IVOIRE + '!important;text-wrap:balance}' +
    '#lieu .lieu-adresse{margin:0!important;font-size:18px;line-height:1.6;letter-spacing:.02em;color:rgba(246,241,231,.88)!important}' +
    '#lieu .carte{filter:grayscale(.2) sepia(.12);border:1px solid rgba(224,191,126,.6)!important;box-shadow:0 0 0 8px ' + FOND + ',0 0 0 9px rgba(224,191,126,.35),0 30px 60px -30px rgba(0,0,0,.7);margin-bottom:44px!important;width:calc(100% - 20px)!important;margin-left:10px!important;margin-right:10px!important}' +
    '#lieu #itineraire{background:' + IVOIRE + ';border-color:' + IVOIRE + ';color:' + FOND + ';min-height:56px;padding:0 34px}' +
    '#lieu #itineraire:hover{background:' + OR + ';border-color:' + OR + ';color:' + FOND + '}' +
    '#lieu .btn-fonce{background:' + OR + '!important;color:' + FOND + '!important}' +
    '#lieu .btn-fonce:hover{background:#fff!important}' +
    '#lieu .btn-ligne:not(#itineraire){border-color:rgba(224,191,126,.6);color:' + IVOIRE + '}' +
    '#lieu .btn-ligne:not(#itineraire):hover{background:' + OR + ';color:' + FOND + '}' +
    '@keyframes agPulseOr{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(224,191,126,.45)}50%{transform:scale(1.04);box-shadow:0 0 0 14px rgba(224,191,126,0)}}' +
    '@media (prefers-reduced-motion:no-preference){#lieu #agendaIcs{animation-name:agPulseOr!important}}';
  document.head.appendChild(st);

  const nom = lieu.querySelector('.lieu-nom'), adr = lieu.querySelector('.lieu-adresse');
  if (nom && adr && !lieu.querySelector('.lieu-carte')){
    const carte = document.createElement('div');
    carte.className = 'lieu-carte apparait';
    nom.parentNode.insertBefore(carte, nom);
    nom.classList.remove('apparait'); adr.classList.remove('apparait');
    nom.style.opacity = adr.style.opacity = '1'; nom.style.transform = adr.style.transform = 'none';
    carte.appendChild(nom); carte.appendChild(adr);
    const io = new IntersectionObserver(en => { if (en[0].isIntersecting){ carte.classList.add('visible'); io.disconnect(); } }, {threshold:.2});
    io.observe(carte);
  }
})();
