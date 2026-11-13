import nodemailer from 'nodemailer';
import {
  displayValue,
  formatDateFr,
  formatResponseDelay,
  isVisible,
  steps,
  type Answers,
} from '@cree/shared';
import type { Env } from '../env';
import { escapeHtml } from '../util';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}
export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

export function createMailer(env: Env): Mailer {
  const transport = nodemailer.createTransport(env.SMTP_URL);
  return {
    async send(msg) {
      await transport.sendMail({ from: env.MAIL_FROM, ...msg });
    },
  };
}

const shell = (
  title: string,
  body: string,
  footer: string,
) => `<!doctype html><html lang="fr"><body style="margin:0;background:#F5F2FC;font-family:Arial,Helvetica,sans-serif;color:#15112A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;padding:32px">
<tr><td><h1 style="margin:0 0 16px;font-size:24px;font-weight:600">${escapeHtml(title)}</h1>${body}
<p style="margin:28px 0 0;font-size:13px;color:#625C78">${footer}</p></td></tr></table></td></tr></table></body></html>`;

interface RecapRow {
  label: string;
  value: string;
}
function recapRows(answers: Answers): { title: string; rows: RecapRow[] }[] {
  const out: { title: string; rows: RecapRow[] }[] = [];
  for (const step of steps) {
    for (const section of step.sections) {
      const rows = section.blocks
        .filter((b) => isVisible(b, answers))
        .map((b) => ({ label: b.label, value: displayValue(b, answers) }))
        .filter((r) => r.value);
      if (rows.length) out.push({ title: section.title, rows });
    }
  }
  return out;
}

const recapHtml = (answers: Answers) =>
  recapRows(answers)
    .map(
      (g) =>
        `<h2 style="margin:20px 0 6px;font-size:16px">${escapeHtml(g.title)}</h2>` +
        g.rows
          .map(
            (r) =>
              `<p style="margin:0 0 6px;font-size:14px;line-height:1.5"><span style="color:#625C78">${escapeHtml(r.label)} :</span> ${escapeHtml(r.value).replace(/\n/g, '<br>')}</p>`,
          )
          .join(''),
    )
    .join('');

const recapText = (answers: Answers) =>
  recapRows(answers)
    .map(
      (g) => `${g.title}\n${g.rows.map((r) => `- ${r.label} : ${r.value.replace(/\n/g, ' / ')}`).join('\n')}`,
    )
    .join('\n\n');

export function confirmationEmail(a: {
  answers: Answers;
  receivedAt: Date;
  timeZone?: string | null;
  delayHours: number;
  controller: string;
  contactEmail: string;
}): Omit<MailMessage, 'to'> {
  const first =
    String(a.answers.nom ?? '')
      .trim()
      .split(/\s+/)[0] || '';
  const when = formatDateFr(
    a.receivedAt.toISOString(),
    { dateStyle: 'long', timeStyle: 'short' },
    a.timeZone ?? undefined,
  );
  const delay = formatResponseDelay(a.delayHours);
  const intro = `Merci${first ? `, ${first}` : ''}. Votre demande nous est bien parvenue le ${when}. ${delay}.`;
  return {
    subject: `Votre demande a bien été reçue — ${a.controller}`,
    replyTo: a.contactEmail,
    html: shell(
      `Merci${first ? `, ${escapeHtml(first)}` : ''}.`,
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p><p style="margin:0;font-size:15px;line-height:1.6">Voici le récapitulatif de vos réponses.</p>${recapHtml(a.answers)}`,
      `Vous recevez ce message car vous avez rempli notre formulaire. Pour consulter, corriger ou faire supprimer vos données, écrivez à ${escapeHtml(a.contactEmail)}.`,
    ),
    text: `${intro}\n\nVoici le récapitulatif de vos réponses.\n\n${recapText(a.answers)}\n\nPour consulter, corriger ou faire supprimer vos données : ${a.contactEmail}`,
  };
}

export function alertEmail(a: {
  answers: Answers;
  studioUrl: string;
  submissionId: string;
}): Omit<MailMessage, 'to'> {
  const name = String(a.answers.nom ?? 'Un client');
  const link = `${a.studioUrl.replace(/\/$/, '')}/#/demande/${a.submissionId}`;
  return {
    subject: `Nouvelle demande : ${name}`,
    replyTo: typeof a.answers.email === 'string' ? a.answers.email : undefined,
    html: shell(
      'Nouvelle demande',
      `<p style="margin:0 0 12px;font-size:15px">${escapeHtml(name)} vient d'envoyer une demande.</p><p style="margin:0 0 12px"><a href="${escapeHtml(link)}" style="color:#5A36D6">Ouvrir dans Crée Studio</a></p>${recapHtml(a.answers)}`,
      'Alerte envoyée par Crée Studio. Vous pouvez la désactiver dans les réglages.',
    ),
    text: `${name} vient d'envoyer une demande.\n${link}\n\n${recapText(a.answers)}`,
  };
}

export function loginEmail(a: { link: string; minutes: number }): Omit<MailMessage, 'to'> {
  return {
    subject: 'Votre lien de connexion à Crée Studio',
    html: shell(
      'Connexion à Crée Studio',
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Ce lien est valable ${a.minutes} minutes et ne fonctionne qu'une fois.</p><p style="margin:0"><a href="${escapeHtml(a.link)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#6A3DE8;color:#ffffff;text-decoration:none;font-weight:600">Se connecter</a></p>`,
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    ),
    text: `Votre lien de connexion (valable ${a.minutes} minutes, à usage unique) :\n${a.link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  };
}
