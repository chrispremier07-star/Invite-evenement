/* Effet de mouvement de la photo SANS demande d'autorisation sur iPhone.
   Le site croit que l'autorisation est accordée, puis reçoit un mouvement doux et continu
   (léger balancement + réaction au toucher et au défilement), sans capteur ni message.
   À ajouter dans index.html AVANT les autres scripts :  <script src="sans-mouvement.js"></script> */
(function(){
  var D = window.DeviceOrientationEvent;
  if (!(D && typeof D.requestPermission === 'function')) return;          // Android / ordinateur : capteur réel, rien à faire
  var calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ['DeviceOrientationEvent', 'DeviceMotionEvent'].forEach(function(n){
    var C = window[n];
    if (C && typeof C.requestPermission === 'function') { try { C.requestPermission = function(){ return Promise.resolve('granted'); }; } catch(e){} }
  });
  if (calme) return;

  var tx = 0, ty = 0, cx = 0, cy = 0, derniere = 0, y0 = scrollY, vit = 0;
  addEventListener('touchmove', function(e){
    var t = e.touches[0]; if (!t) return;
    tx = (t.clientX / innerWidth - .5) * 26; ty = (t.clientY / innerHeight - .5) * 22;
  }, {passive: true});
  addEventListener('scroll', function(){ vit = Math.max(-1, Math.min(1, (scrollY - y0) / 40)); y0 = scrollY; }, {passive: true});

  function pas(t){
    requestAnimationFrame(pas);
    if (document.hidden || t - derniere < 33) return;
    derniere = t;
    var s = t / 1000;
    cx += (tx - cx) * .08; cy += (ty - cy) * .08; vit *= .92;
    var gamma = Math.sin(s * .55) * 9 + cx;
    var beta = 50 + Math.sin(s * .42 + 1) * 7 + cy + vit * 8;
    try { dispatchEvent(new DeviceOrientationEvent('deviceorientation', {alpha: 0, beta: beta, gamma: gamma, absolute: false})); } catch(e){}
  }
  requestAnimationFrame(pas);
})();
