/* Palette définitive : bordeaux profond, rouge rubis, or antique, beige sablé, ivoire pur.
   À ajouter avant </body> :  <script src="couleurs.js"></script>   (retirer la ligne = retour aux couleurs d'origine) */
(function(){
  const st = document.createElement('style');
  st.textContent = `
:root{
  --creme:#F6F1E7; --creme-2:#EBDDC9;
  --brun:#3F0A10; --brun-2:#6A2E33;
  --terra:#8B0F1C; --terra-fonce:#6F0B16; --terra-encre:#7A0F1B;
  --or:#C49A4A;
}
/* Enveloppe */
.env-back{background:#650B16!important}
.env-poche::after{background:#74101C!important}
.env-rabat::before{background:#9A1524!important}
.cachet{background:radial-gradient(circle at 35% 30%,#E7CD8C 0%,#C49A4A 55%,#8F6A27 100%)!important;
  box-shadow:0 0 0 3px #A87D34,0 0 0 4px rgba(90,60,15,.45),0 6px 12px rgba(40,10,10,.4),inset 0 2px 4px rgba(255,240,200,.35),inset 0 -3px 6px rgba(70,45,10,.3)!important}
.cachet::before{border-color:rgba(63,10,16,.35)!important}
.cachet span{color:#3F0A10!important;text-shadow:0 1px 0 rgba(255,235,190,.4)!important}
.env-carte::before{border-color:rgba(139,15,28,.35)!important}
/* Accueil */
.hero::after{background:linear-gradient(180deg,rgba(40,6,10,0) 0%,rgba(40,6,10,0) 38%,rgba(40,6,10,.62) 56%,rgba(32,4,8,.86) 74%,rgba(26,3,6,.96) 100%)!important}
.hero .surtitre,.hero-noms .et{color:#E0BF7E!important}
/* Détails */
.ornement i{background:rgba(139,15,28,.4)!important}
.ornement b{border-color:var(--terra-encre)!important}
.rsvp .surtitre,.rsvp-avant{color:#E0BF7E!important}
.rsvp .ornement i{background:rgba(224,191,126,.5)!important}.rsvp .ornement b{border-color:#E0BF7E!important}
.etape.visible::before{box-shadow:0 0 0 6px rgba(139,15,28,.12)!important}
.pied-initiales{color:#D9B97A!important}
.pied-initiales-ancien{}
.galerie{background:var(--creme-2)!important}
/* Pied de page inversé : bordeaux profond */
.pied{background:#3F0A10!important;color:#F6F1E7!important}
.pied-merci{color:#F6F1E7!important}
.pied-initiales{color:#D9B97A!important}
.pied-hashtag{color:#E0BF7E!important}
.pied .m{color:inherit}
`;
  document.head.appendChild(st);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = '#3F0A10';
  /* Icônes de titres (decor.js) */
  document.querySelectorAll('.deco-icone').forEach(d => { d.style.color = d.closest('#rsvp') ? '#E0BF7E' : '#7A0F1B'; });
})();
