/* Guide : un clic sur le cachet fait vibrer le bouton « Ouvrir notre invitation ».
   À ajouter avant </body> :  <script src="cachet-guide.js"></script>   (retirer la ligne = retour à l'état précédent) */
(function(){
  const intro = document.getElementById('intro'), btn = document.getElementById('ouvrir');
  if (!intro || !btn) return;
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cachet = intro.querySelector('.cachet') || intro.querySelector('.env');
  if (!cachet) return;

  const st = document.createElement('style');
  st.textContent = '#intro .env{pointer-events:none}#intro .cachet{cursor:default;pointer-events:auto}';
  document.head.appendChild(st);

  let occupe = false;
  cachet.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    if (intro.classList.contains('ouverture') || occupe) return;
    occupe = true;
    try { navigator.vibrate && navigator.vibrate([14, 40, 14]); } catch(err){}
    if (calme){ setTimeout(() => occupe = false, 400); return; }
    const x = [0, -7, 7, -6, 6, -4, 4, -2, 0].map(v => ({translate: v + 'px 0px'}));
    const anim = btn.animate(x, {duration: 760, easing: 'cubic-bezier(.36,.07,.19,.97)'});
    btn.animate([{scale: 1}, {scale: 1.09, offset: .18}, {scale: 1.03, offset: .6}, {scale: 1}], {duration: 760, easing: 'ease-in-out'});
    btn.animate([{filter: 'brightness(1)'}, {filter: 'brightness(1.28)', offset: .2}, {filter: 'brightness(1)'}], {duration: 760});
    anim.onfinish = () => { occupe = false; };
  }, true);
})();
