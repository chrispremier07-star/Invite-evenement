/* =====================================================================
   RÉGLAGES : le seul fichier à modifier pour changer textes, dates, contacts,
   menus et adresse du formulaire. Modifiez uniquement ce qui est entre guillemets.
   ===================================================================== */

/* =====================================================================
   VOS TEXTES — modifiez uniquement ce qui est entre guillemets "..."
   ===================================================================== */
const INVITATION = {
  prenom1: "Carole",
  prenom2: "Hermann",
  hashtag: "#CaroleEtHermann2027",

  // Musique en boucle : déposez votre MP3 dans le dossier « musique » (laissez "" pour aucune musique)
  musique: "musique/Musique_mariage.mp3",

  // Date et heure de la cérémonie, format AAAA-MM-JJTHH:MM (sert au compte à rebours)
  dateMariage: "2027-02-02T10:00",
  dateTexte: "Samedi 02 Février 2027",

  enveloppe: {
    surtitre: "Une invitation pour vous",
    carte: "Vous êtes invités",
    bouton: "Ouvrir notre invitation"
  },

  accueil: {
    photo: "photos/accueil.jpg",
    surtitre: "Nous nous marions",
    phrase: "Nous avons la joie de vous convier à notre mariage et serions heureux de partager ce jour avec vous.",
    compteur: ["180", "23", "25", "30"],
    jourJ: "C’est aujourd’hui !"
  },

  histoire: {
    surtitre: "Il était une fois",
    titre: "Notre histoire",
    etapes: [
      { date: "Septembre 2019", titre: "La rencontre", texte: "Un dîner chez des amis communs, une conversation qui ne voulait pas finir." },
      { date: "Octobre 2019", titre: "Le premier rendez-vous", texte: "Un café qui devait durer une heure et s’est terminé à la fermeture." },
      { date: "Août 2026", titre: "La demande", texte: "Face à la mer, au coucher du soleil. La réponse a été oui." }
    ]
  },

  galerie: {
    surtitre: "Souvenirs",
    titre: "Quelques instants",
    photos: ["photos/galerie-1.jpg", "photos/galerie-2.jpg", "photos/galerie-3.jpg", "photos/galerie-4.jpg", "photos/galerie-5.jpg"]
  },

  programme: {
    surtitre: "Le jour J",
    titre: "Le programme",
    moments: [
      { heure: "14h30", titre: "Accueil des invités", texte: "Rafraîchissements dans le jardin." },
      { heure: "15h00", titre: "Cérémonie", texte: "Sous les platanes du parc." },
      { heure: "16h30", titre: "Photos", texte: "Photos de groupe et vin d’honneur." },
      { heure: "19h30", titre: "Repas", texte: "Dîner servi dans la grande salle." },
      { heure: "23h00", titre: "Remerciements", texte: "Quelques mots, puis place à la fête." }
    ]
  },

  lieu: {
    surtitre: "Nous rejoindre",
    titre: "Le lieu",
    nom: "Domaine des Oliviers",
    adresse: "12 chemin des Vignes",
    ville: "84000 Avignon",
    // Facultatif : lien de la carte « Intégrer une carte » de Google Maps (uniquement l'adresse https://www.google.com/maps/embed?pb=... ). Laissez "" pour une carte automatique.
    carteIntegree: "",
    bouton: "Ouvrir l’itinéraire"
  },

  tenue: {
    surtitre: "Dress code",
    titre: "Tenue",
    texte: "Tenue chic et champêtre. Nous serions ravis de vous voir dans ces tons chauds et naturels.",
    couleurs: [
      { nom: "Sable", code: "#D8C2A3" },
      { nom: "Terracotta", code: "#B85A35" },
      { nom: "Olive", code: "#7A7A55" }
    ]
  },

  rsvp: {
    surtitre: "Votre réponse",
    titre: "Confirmer ma présence",
    texte: "Merci de nous indiquer si vous serez des nôtres, ainsi que vos éventuelles contraintes alimentaires.",
    avant: "Réponse souhaitée avant le",
    dateLimite: "1er mai 2027",
    lien: "https://forms.gle/VOTRE-FORMULAIRE",
    bouton: "Répondre à l’invitation"
  },

  piedDePage: {
    merci: "Merci de faire partie de notre histoire"
  }
};
/* ===================================================================== */

/* ---------- CONTACTS : à modifier ici ---------- */
const CONTACTS = {
  surtitre: "Une question ?",
  titre: "Nous contacter",
  texte: "N’hésitez pas à nous joindre ou à joindre nos témoins pour toute question.",
  // tel au format international sans espaces ni « + » pour WhatsApp (ex. 33612345678). Laissez "" pour masquer un bouton.
  personnes: [
    { nom: "Camille", role: "La mariée", tel: "+33612345678", whatsapp: "33612345678", email: "camille@exemple.fr" },
    { nom: "Antoine", role: "Le marié", tel: "+33687654321", whatsapp: "33687654321", email: "antoine@exemple.fr" }
  ]
};

/* ---------- FORMULAIRE DE RÉPONSE (menus, textes, adresse) ---------- */
const FORMULAIRE = {
  /* ---- À RENSEIGNER ---- */
  endpoint: "",          // COLLEZ ICI l'adresse de votre script Google (https://script.google.com/macros/s/.../exec). Vide = le bouton garde le lien Google Forms.
  accessKey: "",         // Web3Forms uniquement : la clé reçue par e-mail (laissez "" avec Formspree)

  /* ---- Textes ---- */
  surtitre: "Votre réponse",
  titre: "Confirmer ma présence",
  intro: "Quelques informations suffisent. Cela nous aide à tout préparer pour vous accueillir.",
  libNom: "Nom et prénom",
  libPresence: "Serez-vous des nôtres ?",
  oui: "Oui, avec joie",
  non: "Je ne pourrai pas venir",
  libNombre: "Nombre de personnes (vous compris)",
  libRegime: "Allergies ou régime alimentaire",
  phRegime: "Facultatif",
  libMessage: "Un mot pour les mariés",
  phMessage: "Facultatif",
  envoyer: "Envoyer ma réponse",
  envoi: "Envoi en cours…",
  erreur: "L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez.",
  champNom: "Merci d’indiquer votre nom.",
  champMenu: "Merci de choisir un menu.",
  champPresence: "Merci de choisir une réponse.",
  merciOui: "Merci, nous avons hâte de vous retrouver.",
  merciNon: "Merci de nous avoir prévenus. Vous nous manquerez.",
  libMenu: "Quel serait votre choix de menu ?",
  menus: ["Tchep au poulet", "Tchep au poisson", "Placali sauce côpê", "Attiéké poisson braisé", "Attiéké poisson frit", "Alloco & frites"],
  fermer: "Fermer"
};
