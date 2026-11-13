/**
 * SOURCE UNIQUE des questions du formulaire et de leur présentation dans le Studio.
 * Ajouter ou modifier une question = modifier ce fichier, rien d'autre :
 * le formulaire, la validation serveur, l'e-mail de confirmation et la fiche du Studio le lisent.
 */
import { formatAmount, formatFcfa } from './format';

export type ChoiceOption = string | { label: string; colors: string[] };
export type BlockKind = 'text' | 'area' | 'choice' | 'range' | 'scale' | 'toggles' | 'locations' | 'file';

export interface Block {
  id: string;
  kind: BlockKind;
  label: string;
  /** Libellé court affiché dans la fiche du Studio. */
  short?: string;
  req?: boolean;
  err?: string;
  /** text : type de champ HTML. */
  type?: 'text' | 'email' | 'tel' | 'date';
  auto?: string;
  vt?: 'email' | 'tel';
  /** choice */
  style?: 'cards' | 'chips';
  multi?: boolean;
  options?: ReadonlyArray<ChoiceOption>;
  /** range */
  min?: number;
  max?: number;
  step?: number;
  def?: number;
  unit?: string;
  minLabel?: string;
  maxLabel?: string;
  /** scale : `def` est l'index de l'option par défaut. */
  /** locations */
  place?: string;
  /** file */
  hint?: string;
  /** Affichage conditionnel : visible si la réponse `id` contient `has`. */
  showIf?: { id: string; has: string };
  /** Mise en forme dans la fiche du Studio. */
  studio?: 'date' | 'invites' | 'wide' | 'swatch';
  /** Champ « Autre » associé, ajouté à la valeur dans le Studio. */
  alt?: string;
}

export interface Section {
  title: string;
  sub: string;
  /** Regroupement dans la fiche du Studio. */
  studio: string;
  blocks: Block[];
}
export interface Step {
  group: string;
  title: string;
  sub: string;
  desc: string;
  sections: Section[];
}

export const welcome = {
  title: 'Votre invitation, à votre image.',
  promise:
    "Répondez à quelques questions. Nous concevons l'application d'invitation de votre événement, pensée pour vos invités et pour vous.",
  duration: 'Durée estimée : 4 minutes',
  note: 'Vos réponses sont enregistrées au fur et à mesure.',
};

export const done = {
  message:
    'Votre demande nous est bien parvenue. Nous la lisons avec attention et revenons vers vous avec une première proposition.',
};

export const recapStep = { title: 'Récapitulatif', sub: 'Relisez vos réponses avant de les envoyer.' };

/** Bornes des tranches de budget, en FCFA : modifiez-les ici, les libellés se recalculent. */
export const BUDGET_TIERS = [300_000, 650_000, 1_300_000] as const;
export const BUDGET_OPTIONS: string[] = [
  `Moins de ${formatFcfa(BUDGET_TIERS[0])}`,
  `${formatAmount(BUDGET_TIERS[0])} à ${formatFcfa(BUDGET_TIERS[1])}`,
  `${formatAmount(BUDGET_TIERS[1])} à ${formatFcfa(BUDGET_TIERS[2])}`,
  `Plus de ${formatFcfa(BUDGET_TIERS[2])}`,
  'Je ne sais pas encore',
];

export const TYPE_OPTIONS = ['Mariage', 'Anniversaire', 'Baptême', 'Autre'];

export const steps: Step[] = [
  {
    group: 'Votre événement',
    title: 'Parlons de votre événement',
    sub: 'Vos coordonnées, la date et les lieux.',
    desc: 'Coordonnées, date, invités, lieux.',
    sections: [
      {
        title: 'Vos coordonnées',
        sub: 'Pour vous recontacter.',
        studio: 'Coordonnées et événement',
        blocks: [
          {
            id: 'nom',
            kind: 'text',
            label: 'Prénom et nom',
            short: 'Nom',
            auto: 'name',
            req: true,
            err: 'Indiquez votre prénom et votre nom.',
          },
          {
            id: 'email',
            kind: 'text',
            type: 'email',
            label: 'Adresse e-mail',
            short: 'E-mail',
            auto: 'email',
            req: true,
            vt: 'email',
            err: 'Indiquez votre adresse e-mail.',
          },
          { id: 'tel', kind: 'text', type: 'tel', label: 'Téléphone', auto: 'tel', vt: 'tel' },
        ],
      },
      {
        title: "L'événement",
        sub: "Le type, la date et le nombre d'invités.",
        studio: 'Coordonnées et événement',
        blocks: [
          {
            id: 'type',
            kind: 'choice',
            style: 'cards',
            label: "Quel est le type d'événement ?",
            short: "Type d'événement",
            req: true,
            err: "Choisissez un type d'événement.",
            options: TYPE_OPTIONS,
            alt: 'type_autre',
          },
          {
            id: 'type_autre',
            kind: 'text',
            label: "Précisez l'événement",
            req: true,
            err: 'Précisez votre choix.',
            showIf: { id: 'type', has: 'Autre' },
          },
          { id: 'date', kind: 'text', type: 'date', label: 'Date prévue', studio: 'date' },
          {
            id: 'invites',
            kind: 'range',
            label: "Combien d'invités environ ?",
            short: 'Invités',
            min: 10,
            max: 500,
            step: 10,
            def: 100,
            unit: 'invités',
            minLabel: '10',
            maxLabel: '500 et plus',
            studio: 'invites',
          },
        ],
      },
      {
        title: 'Lieux et langues',
        sub: 'Où se déroule la fête, et pour qui.',
        studio: 'Coordonnées et événement',
        blocks: [
          {
            id: 'lieux',
            kind: 'locations',
            label: 'Un ou plusieurs lieux',
            short: 'Lieux',
            place: 'Nom ou ville du lieu',
          },
          {
            id: 'langues',
            kind: 'choice',
            style: 'chips',
            multi: true,
            label: 'Dans quelle(s) langue(s) sera le site ?',
            short: 'Langues',
            req: true,
            err: 'Choisissez au moins une langue.',
            options: [
              'Français',
              'Anglais',
              'Espagnol',
              'Arabe',
              'Allemand',
              'Italien',
              'Portugais',
              'Autre',
            ],
            alt: 'langues_autre',
          },
          {
            id: 'langues_autre',
            kind: 'text',
            label: 'Autre(s) langue(s)',
            req: true,
            err: 'Précisez la langue.',
            showIf: { id: 'langues', has: 'Autre' },
          },
        ],
      },
    ],
  },
  {
    group: 'Votre site',
    title: 'Imaginons votre site',
    sub: 'Le contenu, les réponses des invités et le style.',
    desc: 'Contenu, réponses, style.',
    sections: [
      {
        title: 'Contenu',
        sub: 'Ce que vos invités pourront consulter.',
        studio: 'Contenu et réponses',
        blocks: [
          {
            id: 'rubriques',
            kind: 'choice',
            style: 'cards',
            multi: true,
            label: 'Rubriques souhaitées',
            short: 'Rubriques',
            req: true,
            err: 'Choisissez au moins une rubrique.',
            options: [
              'Programme',
              'Lieu et itinéraire',
              'Dress code',
              'Hébergement',
              'Liste de cadeaux',
              'Contacts',
              'Galerie photos et vidéos',
              'Menu',
              'Autre',
            ],
            alt: 'rubriques_autre',
          },
          {
            id: 'rubriques_autre',
            kind: 'text',
            label: 'Autre rubrique',
            req: true,
            err: 'Précisez la rubrique.',
            showIf: { id: 'rubriques', has: 'Autre' },
          },
          {
            id: 'deroule',
            kind: 'area',
            label: 'Déroulé de la journée',
            short: 'Déroulé de la journée',
            studio: 'wide',
          },
        ],
      },
      {
        title: 'Réponses des invités',
        sub: 'Ce que vous leur demandez, et où le recevoir.',
        studio: 'Contenu et réponses',
        blocks: [
          {
            id: 'infos',
            kind: 'choice',
            style: 'cards',
            multi: true,
            label: 'Informations à recueillir',
            short: 'Informations à recueillir',
            options: ['Présence', 'Nombre de personnes', 'Régime alimentaire', 'Choix de menu', 'Message'],
          },
          {
            id: 'destination',
            kind: 'choice',
            style: 'chips',
            label: 'Où recevoir les réponses ?',
            short: 'Destination des réponses',
            req: true,
            err: 'Choisissez une destination.',
            options: ['Tableur', 'E-mail', 'Autre'],
            alt: 'destination_autre',
          },
          {
            id: 'destination_autre',
            kind: 'text',
            label: 'Précisez la destination',
            req: true,
            err: 'Précisez votre choix.',
            showIf: { id: 'destination', has: 'Autre' },
          },
          {
            id: 'limite',
            kind: 'text',
            type: 'date',
            label: 'Date limite de réponse',
            short: 'Date limite',
            studio: 'date',
          },
          {
            id: 'modifiable',
            kind: 'choice',
            style: 'chips',
            label: 'Une réponse peut-elle être changée ?',
            short: 'Réponse',
            options: ['Réponse unique', 'Réponse modifiable'],
          },
        ],
      },
      {
        title: 'Style visuel',
        sub: "L'atmosphère et les couleurs.",
        studio: 'Style visuel',
        blocks: [
          {
            id: 'ambiance',
            kind: 'choice',
            style: 'cards',
            label: 'Ambiance',
            short: 'Ambiance',
            req: true,
            err: 'Choisissez une ambiance.',
            studio: 'swatch',
            alt: 'ambiance_autre',
            options: [
              { label: 'Classique', colors: ['#EFE6D2', '#15112A'] },
              { label: 'Romantique', colors: ['#F2D9D6', '#B9857F'] },
              { label: 'Moderne', colors: ['#F2F0EC', '#2B2B2B'] },
              { label: 'Champêtre', colors: ['#DCE3CC', '#7C8B5E'] },
              { label: 'Luxueuse', colors: ['#D9BC72', '#2A1119'] },
              { label: 'Autre', colors: [] },
            ],
          },
          {
            id: 'ambiance_autre',
            kind: 'text',
            label: "Décrivez l'ambiance",
            req: true,
            err: 'Précisez votre choix.',
            showIf: { id: 'ambiance', has: 'Autre' },
          },
          {
            id: 'palette',
            kind: 'choice',
            style: 'cards',
            label: 'Palette préférée',
            short: 'Palette',
            studio: 'swatch',
            options: [
              { label: 'Ivoire et or', colors: ['#F6EEDC', '#C9A24F'] },
              { label: 'Rose poudré', colors: ['#EFCFCB', '#9C5B5F'] },
              { label: 'Vert sauge', colors: ['#C9D3B8', '#5F6F4A'] },
              { label: 'Bleu nuit', colors: ['#1F2A44', '#D9BC72'] },
              { label: 'Terracotta', colors: ['#C8785A', '#F1DCC8'] },
            ],
          },
          { id: 'palette_txt', kind: 'text', label: 'Ou décrivez votre palette', short: 'Palette décrite' },
          { id: 'eviter', kind: 'text', label: 'Couleurs à éviter', short: 'Couleurs à éviter' },
        ],
      },
      {
        title: 'Inspirations',
        sub: 'Tout est facultatif ici.',
        studio: 'Style visuel',
        blocks: [
          {
            id: 'fichiers',
            kind: 'file',
            label: 'Logo, faire-part, photos',
            short: 'Fichiers',
            hint: 'Images, PDF ou vidéos. Ils sont envoyés avec votre demande.',
          },
          {
            id: 'refs',
            kind: 'area',
            label: 'Deux ou trois références appréciées',
            short: 'Références',
            studio: 'wide',
          },
          { id: 'deteste', kind: 'text', label: 'Une chose que vous détestez', short: 'À éviter absolument' },
        ],
      },
    ],
  },
  {
    group: 'Finaliser',
    title: 'Les dernières précisions',
    sub: "L'expérience, la mise en ligne, puis l'envoi.",
    desc: 'Expérience, mise en ligne, envoi.',
    sections: [
      {
        title: 'Expérience',
        sub: 'Le premier geste et les fonctions.',
        studio: 'Expérience et mise en ligne',
        blocks: [
          {
            id: 'ouverture',
            kind: 'choice',
            style: 'cards',
            label: 'Ouverture animée',
            short: 'Ouverture',
            options: ['Enveloppe', 'Rideau', 'Cachet de cire', 'Aucune'],
          },
          {
            id: 'animation',
            kind: 'scale',
            label: "Niveau d'animation",
            short: "Niveau d'animation",
            def: 1,
            options: ['Discret', 'Modéré', 'Spectaculaire'],
          },
          { id: 'musique', kind: 'text', label: 'Musique de fond (titre ou style)', short: 'Musique' },
          {
            id: 'fonctions',
            kind: 'toggles',
            label: 'Fonctions souhaitées',
            short: 'Fonctions',
            options: [
              "Installation sur l'écran d'accueil",
              'Ajout au calendrier',
              'Rappels par notification',
              'Compte à rebours',
              'Hashtag dédié',
            ],
          },
        ],
      },
      {
        title: 'Mise en ligne',
        sub: 'Adresse, date, visibilité et gestion.',
        studio: 'Expérience et mise en ligne',
        blocks: [
          { id: 'domaine', kind: 'text', label: 'Nom de domaine souhaité', short: 'Nom de domaine' },
          {
            id: 'miseenligne',
            kind: 'text',
            type: 'date',
            label: 'Date de mise en ligne souhaitée',
            short: 'Mise en ligne',
            studio: 'date',
          },
          {
            id: 'acces',
            kind: 'choice',
            style: 'chips',
            label: 'Qui peut voir le site ?',
            short: 'Accès',
            options: ['Accès libre', 'Lien privé'],
          },
          {
            id: 'editeur',
            kind: 'choice',
            style: 'chips',
            label: 'Qui modifiera le contenu ?',
            short: 'Modifié par',
            options: ['Moi seul(e)', 'Plusieurs personnes', 'Votre équipe, pour moi'],
          },
          {
            id: 'aisance',
            kind: 'choice',
            style: 'chips',
            label: 'Votre aisance avec le numérique',
            short: 'Aisance',
            options: ['Débutant', "À l'aise", "Très à l'aise"],
          },
        ],
      },
      {
        title: 'Budget et demande',
        sub: 'Pour vous faire une proposition juste.',
        studio: 'Expérience et mise en ligne',
        blocks: [
          {
            id: 'budget',
            kind: 'choice',
            style: 'chips',
            label: 'Budget approximatif',
            short: 'Budget',
            options: BUDGET_OPTIONS,
          },
          {
            id: 'demande',
            kind: 'area',
            label: 'Une demande particulière',
            short: 'Demande particulière',
            studio: 'wide',
          },
        ],
      },
    ],
  },
];

export const allBlocks: Block[] = steps.flatMap((s) => s.sections.flatMap((x) => x.blocks));
export const blockById = new Map(allBlocks.map((x) => [x.id, x] as const));

export function optionLabel(o: ChoiceOption): string {
  return typeof o === 'string' ? o : o.label;
}
export function optionColors(block: Block, label: string): string[] {
  const o = block.options?.find((x) => optionLabel(x) === label);
  return o && typeof o !== 'string' ? o.colors : [];
}

/** Limites techniques partagées par le formulaire et le serveur. */
export const LIMITS = {
  text: 300,
  area: 4000,
  locations: 5,
  files: 10,
  fileBytes: 25 * 1024 * 1024,
  fileTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
  ],
} as const;
