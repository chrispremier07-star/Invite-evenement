import { describe, expect, it } from 'vitest';
import {
  BUDGET_OPTIONS,
  blockById,
  formatDateFr,
  formatFcfa,
  formatResponseDelay,
  validateAnswers,
  blockError,
} from './index';

const valid = {
  nom: 'Awa Diallo',
  email: 'awa@example.org',
  type: 'Mariage',
  langues: ['Français'],
  rubriques: ['Programme'],
  destination: 'E-mail',
  ambiance: 'Moderne',
};

describe('formats', () => {
  it('formate les montants en FCFA avec espaces insécables', () => {
    expect(formatFcfa(1_300_000)).toBe('1 300 000 FCFA');
    expect(BUDGET_OPTIONS[2]).toBe('650 000 à 1 300 000 FCFA');
  });
  it('formate les dates en fr-FR sans décalage de fuseau', () => {
    expect(formatDateFr('2027-06-12')).toBe('12 juin 2027');
    expect(
      formatDateFr(
        '2027-06-12T23:30:00Z',
        { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' },
        'Africa/Abidjan',
      ),
    ).toContain('23:30');
  });
  it('affiche le délai de réponse configuré', () => {
    expect(formatResponseDelay(48)).toBe('Réponse sous 2 jours');
    expect(formatResponseDelay(36)).toBe('Réponse sous 36 heures');
    expect(formatResponseDelay(1)).toBe('Réponse sous 1 heure');
  });
});

describe('validateAnswers', () => {
  it('accepte des réponses complètes et nettoie les espaces', () => {
    const r = validateAnswers({ ...valid, nom: '  Awa Diallo ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.nom).toBe('Awa Diallo');
  });
  it('exige les champs obligatoires avec le message français', () => {
    const r = validateAnswers({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.nom).toBe('Indiquez votre prénom et votre nom.');
      expect(r.errors.langues).toBe('Choisissez au moins une langue.');
    }
  });
  it('rend « Autre » obligatoire seulement quand il est choisi', () => {
    expect(validateAnswers({ ...valid, type: 'Autre' }).ok).toBe(false);
    expect(validateAnswers({ ...valid, type: 'Autre', type_autre: 'Gala' }).ok).toBe(true);
  });
  it('ignore les blocs masqués', () => {
    const r = validateAnswers({ ...valid, type_autre: 'Gala' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.type_autre).toBeUndefined();
  });
  it('refuse les clés inconnues, les choix hors liste et les dates impossibles', () => {
    expect(validateAnswers({ ...valid, intrus: 1 }).ok).toBe(false);
    expect(validateAnswers({ ...valid, type: 'Fête' }).ok).toBe(false);
    expect(validateAnswers({ ...valid, date: '2027-02-31' }).ok).toBe(false);
    expect(validateAnswers({ ...valid, invites: 55 }).ok).toBe(false);
    expect(validateAnswers({ ...valid, invites: 120 }).ok).toBe(true);
  });
  it('valide le format e-mail et téléphone', () => {
    expect(blockError(blockById.get('email')!, 'a@b')).toBe('Cette adresse e-mail semble incomplète.');
    expect(blockError(blockById.get('tel')!, '12')).toBe('Ce numéro semble incomplet.');
    expect(blockError(blockById.get('tel')!, '+225 07 00 00 00 00')).toBe('');
  });
});
