/* Icônes animées (Lottie) des cartes du programme.
   À ajouter avant </body> (l'ordre n'a pas d'importance) :
   <script src="lottie-icones.js"></script>
   <script src="programme-lottie.js"></script>
   (retirer les deux lignes = retour aux icônes fixes) */
(function(){
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let essais = 0;

  function pret(){
    const liste = document.getElementById('programmeListe');
    return liste && liste.querySelector('.p-ico') && window.LOTTIE_ICONES;
  }

  function demarrer(){
    if (!pret()){ if (++essais < 120) setTimeout(demarrer, 250); return; }
    const liste = document.getElementById('programmeListe');
    const st = document.createElement('style');
    st.textContent =
      '#programmeListe .p-ico{width:36px!important;height:36px!important;opacity:1!important;transform:none!important}' +
      '#programmeListe .p-ico svg{width:100%!important;height:100%!important}';
    document.head.appendChild(st);

    const lib = document.createElement('script');
    lib.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
    lib.async = true;
    lib.onload = function(){
      [...liste.querySelectorAll('.p-ico')].forEach((el, i) => {
        const data = JSON.parse(JSON.stringify(window.LOTTIE_ICONES[i % window.LOTTIE_ICONES.length]));
        el.innerHTML = '';
        const a = lottie.loadAnimation({container: el, renderer: 'svg', loop: true, autoplay: false, animationData: data, rendererSettings: {preserveAspectRatio: 'xMidYMid meet'}});
        if (calme){ a.goToAndStop(0, true); return; }
        new IntersectionObserver(e => e[0].isIntersecting ? a.play() : a.pause(), {threshold: .1}).observe(el);
      });
    };
    document.head.appendChild(lib);
  }
  demarrer();
})();
