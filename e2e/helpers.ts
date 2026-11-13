import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

const mailpit = `http://localhost:${process.env.MAILPIT_PORT}`;
export const ADMIN = () => process.env.ADMIN_EMAIL!.toLowerCase();

export async function waitMail(to: string, subjectPart: string) {
  let found: { Text: string; HTML: string } | undefined;
  await expect
    .poll(
      async () => {
        const list = (await (await fetch(`${mailpit}/api/v1/messages`)).json()) as {
          messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }>;
        };
        const m = list.messages.find(
          (x) =>
            x.Subject.includes(subjectPart) && x.To.some((t) => t.Address.toLowerCase() === to.toLowerCase()),
        );
        if (m)
          found = (await (await fetch(`${mailpit}/api/v1/message/${m.ID}`)).json()) as {
            Text: string;
            HTML: string;
          };
        return !!found;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

/** Connexion réelle du créateur : lien magique reçu par e-mail, ouvert dans le navigateur. */
export async function loginStudio(page: Page, request: APIRequestContext, baseURL: string) {
  await fetch(`${mailpit}/api/v1/messages`, { method: 'DELETE' });
  const r = await request.post('/api/auth/request', {
    data: { email: ADMIN() },
    headers: { origin: baseURL },
  });
  expect(r.status()).toBe(202);
  const mail = await waitMail(ADMIN(), 'lien de connexion');
  const token = /#\/connexion\/([\w-]+)/.exec(mail.Text)?.[1];
  expect(token).toBeTruthy();
  await page.goto(`/studio/#/connexion/${token}`);
  await expect(page.getByRole('heading', { name: 'Demandes', level: 1 })).toBeVisible();
}

export async function submitViaApi(request: APIRequestContext, answers: Record<string, unknown>) {
  const r = await request.post('/api/submissions', {
    data: {
      idempotencyKey: randomUUID(),
      answers,
      consent: true,
      turnstileToken: 'jeton-e2e',
      timeZone: 'Africa/Abidjan',
    },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).id as string;
}

export const answers = (over: Record<string, unknown> = {}) => ({
  nom: 'Nouvelle Cliente',
  email: 'nouvelle@example.org',
  type: 'Anniversaire',
  date: '2099-03-14',
  invites: 60,
  lieux: ['Abidjan'],
  langues: ['Français'],
  rubriques: ['Programme'],
  destination: 'E-mail',
  ambiance: 'Moderne',
  ...over,
});

export async function secondDevice(context: BrowserContext) {
  return context.browser()!.newContext({ locale: 'fr-FR', timezoneId: 'Africa/Abidjan' });
}
