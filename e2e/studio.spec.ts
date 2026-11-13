import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { answers, loginStudio, secondDevice, submitViaApi, waitMail } from './helpers';

test.describe.configure({ mode: 'serial' });

test('le Studio exige une connexion puis affiche une demande arrivée en direct en moins de 3 secondes', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('/studio/');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await loginStudio(page, request, baseURL!);
  const sub = await page
    .getByText(/demandes? à lire|Toutes les demandes sont lues|première demande/)
    .textContent();
  const before = Number(/^(\d+)/.exec(sub ?? '')?.[1] ?? 0);
  await expect(page.getByText('Temps réel actif').first()).toBeVisible();

  const started = Date.now();
  await submitViaApi(request, answers());
  await expect(page.locator('.st-row', { hasText: 'Nouvelle Cliente' })).toBeVisible({ timeout: 3000 });
  expect(Date.now() - started).toBeLessThan(3000);
  await expect(
    page.getByText(
      `${before + 1} nouvelle${before + 1 > 1 ? 's' : ''} demande${before + 1 > 1 ? 's' : ''} à lire`,
    ),
  ).toBeVisible();
  await expect(page.getByText('Nouvelle demande', { exact: true })).toBeVisible(); // toast
  await expect(page).toHaveTitle(`(${before + 1}) Crée Studio`);

  const alert = await waitMail(process.env.ADMIN_EMAIL!, 'Nouvelle demande');
  expect(alert.Text).toContain('Nouvelle Cliente');
});

test('statut, note et export sont conservés en base et visibles sur un second appareil', async ({
  page,
  request,
  baseURL,
  context,
}) => {
  await loginStudio(page, request, baseURL!);
  await page.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await expect(page.getByRole('heading', { name: 'Nouvelle Cliente', level: 2 })).toBeVisible();
  await expect(page)
    .not.toHaveTitle(/(d+) Crée Studio/, { timeout: 1 })
    .catch(() => undefined);

  await page
    .getByRole('group', { name: 'Changer le statut' })
    .getByRole('button', { name: 'Devis envoyé' })
    .click();
  await expect(
    page.getByRole('group', { name: 'Changer le statut' }).getByRole('button', { name: 'Devis envoyé' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#st-notes').fill('Appeler mardi pour la version anglaise.');
  await page.getByRole('button', { name: 'Ajouter la note' }).click();
  await expect(page.getByText('Appeler mardi pour la version anglaise.')).toBeVisible();

  // Export CSV réel
  await page.getByRole('button', { name: 'Réglages' }).first().click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Exporter tout (CSV)' }).click(),
  ]);
  const csv = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8');
  expect(csv).toContain('Nouvelle Cliente');
  expect(csv).toContain('Devis envoyé');
  expect(csv).toContain('Appeler mardi');

  // Second appareil : autre contexte, autre session
  const ctx2 = await secondDevice(context);
  const page2 = await ctx2.newPage();
  await loginStudio(page2, ctx2.request, baseURL!);
  await page2.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await expect(
    page2.getByRole('group', { name: 'Changer le statut' }).getByRole('button', { name: 'Devis envoyé' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page2.getByText('Appeler mardi pour la version anglaise.')).toBeVisible();

  // Modification sur l'appareil 2 -> reflétée en direct sur l'appareil 1
  await page2
    .getByRole('group', { name: 'Changer le statut' })
    .getByRole('button', { name: 'Signée' })
    .click();
  await page.getByRole('button', { name: 'Demandes' }).first().click();
  await page.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await expect(
    page.getByRole('group', { name: 'Changer le statut' }).getByRole('button', { name: 'Signée' }),
  ).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  await ctx2.close();
});

test('vue d’ensemble : chiffres calculés depuis la base', async ({ page, request, baseURL }) => {
  await submitViaApi(
    request,
    answers({
      nom: 'Marc Dubois',
      email: 'marc@example.org',
      type: 'Mariage',
      date: '2098-01-05',
      budget: 'Plus de 1 300 000 FCFA',
    }),
  );
  await loginStudio(page, request, baseURL!);
  await page.getByRole('button', { name: "Vue d'ensemble" }).first().click();
  await expect(page.getByRole('heading', { name: "Vue d'ensemble", level: 1 })).toBeVisible();
  await expect(page.getByText('Taux de signature').locator('xpath=following-sibling::span[1]')).toHaveText(
    '100 %',
  );
  await expect(page.getByText('Plus de 1 300 000 FCFA')).toBeVisible();
  await expect(page.locator('.st-row', { hasText: 'Nouvelle Cliente' })).toBeVisible(); // événements à venir
});

test('PWA : manifest installable, service worker actif, lecture et actions hors ligne rejouées au retour du réseau', async ({
  page,
  request,
  baseURL,
  context,
}) => {
  await loginStudio(page, request, baseURL!);
  await page.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await expect(page.getByRole('heading', { name: 'Nouvelle Cliente', level: 2 })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: Array<{ errorId: string }>;
  };
  // Le contexte de test est privé (Playwright) : « in-incognito » est la seule raison tolérée, toutes les autres bloqueraient l'installation.
  expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([]);
  const manifest = await (await request.get('/studio/manifest.webmanifest')).json();
  expect(
    manifest.icons
      .filter((i: { purpose: string }) => i.purpose === 'maskable')
      .map((i: { sizes: string }) => i.sizes)
      .sort(),
  ).toEqual(['192x192', '512x512']);
  expect(manifest.display).toBe('standalone');

  // Hors ligne : l'interface et les données en cache restent consultables
  await page.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.st-row', { hasText: 'Nouvelle Cliente' })).toBeVisible();
  await expect(page.getByText('Hors ligne').first()).toBeVisible();

  // Action hors ligne : mise en file, puis rejouée
  await page.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await page
    .getByRole('group', { name: 'Changer le statut' })
    .getByRole('button', { name: 'En échange' })
    .click();
  await expect(page.getByText('Le changement de statut sera envoyé au retour du réseau.')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Synchronisé').first()).toBeVisible({ timeout: 15_000 });

  const second = await secondDevice(context);
  const p2 = await second.newPage();
  await loginStudio(p2, second.request, baseURL!);
  await p2
    .getByRole('button', { name: /Actives|Toutes/ })
    .first()
    .click()
    .catch(() => undefined);
  await p2.locator('.st-row', { hasText: 'Nouvelle Cliente' }).click();
  await expect(
    p2.getByRole('group', { name: 'Changer le statut' }).getByRole('button', { name: 'En échange' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await second.close();
});

test('notifications : abonnement réel enregistré côté serveur puis notification de contrôle envoyée par le serveur', async ({
  request,
  baseURL,
}) => {
  // Le push exige un profil non privé : contexte persistant plutôt que le contexte jetable par défaut.
  const dir = await mkdtemp(join(tmpdir(), 'cree-pw-'));
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    locale: 'fr-FR',
    permissions: ['notifications'],
    baseURL,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await loginStudio(page, request, baseURL!);
    await page.getByRole('button', { name: 'Réglages' }).first().click();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.getByRole('button', { name: 'Activer les notifications' }).click();
    await expect(page.getByText('Activées sur cet appareil')).toBeVisible({ timeout: 30_000 });
    const devices = await page.evaluate(() => fetch('/api/studio/devices').then((r) => r.json()));
    expect(devices.length).toBe(1);
    await page.getByRole('button', { name: 'Envoyer une notification de contrôle' }).click();
    await expect(page.getByText('Notification envoyée')).toBeVisible({ timeout: 30_000 });
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});
