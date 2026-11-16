/* Bouton « Répondre à l'invitation » vivant (pulsation + faisceau lumineux).
   À ajouter avant </body> :  <script src="bouton.js"></script> */
(function(){
  const btn = document.getElementById('rsvpLien') || document.querySelector('#rsvp a.btn');
  if (!btn) return;
  const st = document.createElement('style');
  st.textContent =
    '.rsvp-vivant{position:relative;overflow:hidden;isolation:isolate;min-height:58px;padding:0 38px;background:#F4ECE0;color:#3B2218;box-shadow:0 0 0 0 rgba(230,191,155,.55),0 10px 30px -8px rgba(184,90,53,.6)}' +
    '.rsvp-vivant::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:38%;z-index:-1;pointer-events:none;background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(255,236,205,.95) 50%,rgba(255,255,255,0) 100%);transform:skewX(-20deg)}' +
    '.rsvp-vivant::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:radial-gradient(120% 140% at 50% 0%,rgba(230,191,155,.55),rgba(244,236,224,0) 70%)}' +
    '@media (prefers-reduced-motion:no-preference){' +
    '.rsvp-vivant{animation:rsvpPulse 2.8s ease-in-out infinite}' +
    '.rsvp-vivant::after{animation:rsvpBeam 4.2s cubic-bezier(.45,.05,.3,1) infinite}}' +
    '@keyframes rsvpPulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(230,191,155,.6),0 10px 30px -8px rgba(184,90,53,.6)}50%{transform:scale(1.045);box-shadow:0 0 0 16px rgba(230,191,155,0),0 14px 38px -6px rgba(184,90,53,.8)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(230,191,155,0),0 10px 30px -8px rgba(184,90,53,.6)}}' +
    '@keyframes rsvpBeam{0%{left:-60%}55%,100%{left:130%}}' +
    '.rsvp-vivant:hover{animation-play-state:paused;background:#fff;color:#3B2218}';
  document.head.appendChild(st);
  btn.classList.add('rsvp-vivant');
})();
