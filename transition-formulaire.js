/* Formulaire : glissement du bas vers le haut (rapide, qui ralentit à l'arrivée) ; fermeture en sens inverse
   (part doucement, accélère en sortant). Aucun fondu.
   À ajouter APRÈS formulaire.js :  <script src="transition-formulaire.js"></script> */
(function(){
  var monte = 'cubic-bezier(.16,1,.3,1)', descend = 'cubic-bezier(.8,.1,.88,.1)';
  var DUREE_O = 950, DUREE_F = 650;
  var css =
    '#rsvpModal{background:rgba(18,2,5,.78)!important;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:none!important}' +
    '#rsvpModal.sort{opacity:1!important;visibility:visible!important}' +
    '#rsvpModal .rf{transition:none!important;will-change:transform}' +
    '#rsvpModal.ouvert .rf{animation:rfMonte ' + DUREE_O + 'ms ' + monte + ' both}' +
    '#rsvpModal.sort .rf{animation:rfDescend ' + DUREE_F + 'ms ' + descend + ' both}' +
    '@keyframes rfMonte{from{transform:translate3d(0,100%,0)}to{transform:translate3d(0,0,0)}}' +
    '@keyframes rfDescend{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,105%,0)}}';
  var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

  function brancher(){
    var m = document.getElementById('rsvpModal');
    if (!m) return setTimeout(brancher, 600);
    var etat = m.classList.contains('ouvert'), t = null;
    new MutationObserver(function(){
      var o = m.classList.contains('ouvert');
      if (o === etat) return; etat = o;
      clearTimeout(t);
      if (o) m.classList.remove('sort');
      else { m.classList.add('sort'); t = setTimeout(function(){ m.classList.remove('sort'); }, DUREE_F + 30); }
    }).observe(m, {attributes: true, attributeFilter: ['class']});
  }
  brancher();
})();
