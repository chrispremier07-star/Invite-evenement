import { formatDateFr } from './format';
import { isEmpty, isVisible, type Answers } from './schemas';
import { optionColors, steps, type Block } from './questions';

/** Texte affichable d'une réponse (récapitulatif du formulaire, e-mails, fiche du Studio). */
export function displayValue(
  block: Block,
  answers: Answers,
  fileNames?: ReadonlyMap<string, string>,
): string {
  const v = answers[block.id];
  if (isEmpty(v) && block.kind !== 'range' && block.kind !== 'scale') return '';
  switch (block.kind) {
    case 'locations':
      return (v as string[]).join('\n');
    case 'file':
      return (v as string[]).map((id) => fileNames?.get(id) ?? 'Fichier joint').join('\n');
    case 'range':
      return `≈ ${(v as number | undefined) ?? block.def ?? ''} ${block.unit ?? ''}`.trim();
    case 'scale':
      return block.options?.[(v as number | undefined) ?? block.def ?? 0] as string;
    default:
      break;
  }
  if (Array.isArray(v)) return v.join(', ');
  if (block.type === 'date' && typeof v === 'string') return formatDateFr(v);
  return String(v);
}

export interface StudioRow {
  key: string;
  label: string;
  value: string;
  wide: boolean;
  swatches: string[];
}
export interface StudioGroup {
  title: string;
  rows: StudioRow[];
}

/** Fiche détaillée d'une demande, regroupée comme dans le Studio. Les champs « Autre » sont fusionnés à leur question. */
export function studioGroups(answers: Answers, fileNames?: ReadonlyMap<string, string>): StudioGroup[] {
  const groups: StudioGroup[] = [];
  for (const step of steps) {
    for (const section of step.sections) {
      let group = groups.find((g) => g.title === section.studio);
      if (!group) groups.push((group = { title: section.studio, rows: [] }));
      for (const block of section.blocks) {
        if (block.showIf || !isVisible(block, answers)) continue;
        let value = displayValue(block, answers, fileNames);
        if (block.alt && answers[block.alt])
          value += value ? ` — ${String(answers[block.alt])}` : String(answers[block.alt]);
        const picked =
          block.studio === 'swatch' && typeof answers[block.id] === 'string'
            ? optionColors(block, answers[block.id] as string)
            : [];
        group.rows.push({
          key: block.id,
          label: block.short ?? block.label,
          value,
          wide: block.studio === 'wide',
          swatches: picked,
        });
      }
    }
  }
  return groups;
}
