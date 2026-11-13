import { expect, test } from '@playwright/test';
import { waitMail } from './helpers';

test('un client remplit le formulaire, joint un fichier et reçoit son e-mail de confirmation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute(
    'aria-label',
    'Votre invitation, à votre image.',
  );
  await page.getByRole('button', { name: 'Commencer' }).click();

  // Étape 1
  await page.locator('#f-nom').fill('Awa Diallo');
  await page.locator('#f-email').fill('awa.diallo@example.org');
  await page.locator('#f-tel').fill('+225 07 00 00 00 00');
  await page.getByRole('button', { name: 'Mariage' }).click();
  await page.locator('#f-date').fill('2099-06-12');
  await page.locator('#loc-1').fill('Grand-Bassam');
  await page.getByRole('button', { name: 'Français' }).click();

  // Le brouillon survit à un rechargement
  await page.reload();
  await expect(page.locator('#f-nom')).toHaveValue('Awa Diallo');
  await expect(page.getByRole('button', { name: 'Mariage' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étape 2 : champ obligatoire manquant -> message en français
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Choisissez au moins une rubrique.')).toBeVisible();
  await page.getByRole('button', { name: 'Programme' }).click();
  await page.getByRole('button', { name: 'E-mail', exact: true }).click();
  await page.getByRole('button', { name: 'Moderne' }).click();

  // Vrai téléversement vers le stockage
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'faire-part.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Envoyé', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Étape 3 : récapitulatif, consentement, anti-robot
  await expect(page.getByRole('heading', { name: "Avant l'envoi" })).toBeVisible();
  await expect(page.getByText('faire-part.png')).toBeVisible();
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByText('Cochez cette case pour envoyer votre demande.')).toBeVisible();
  await page.locator('#consent').click();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('aria-label', 'Merci, Awa.', {
    timeout: 20_000,
  });
  await expect(page.getByText('Réponse sous 2 jours')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cree:brouillon'))).toBeNull();

  const mail = await waitMail('awa.diallo@example.org', 'bien été reçue');
  expect(mail.Text).toContain('Awa Diallo');
  expect(mail.Text).toContain('faire-part');
  expect(mail.Text).toContain('Grand-Bassam');

  expect(errors.filter((e) => !/turnstile|cloudflare|challenges/i.test(e))).toEqual([]);
});

test('pas de défilement horizontal et cibles tactiles suffisantes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('#f-nom')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([type=file]):not([aria-hidden=true])',
      ),
    )
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el: el.id || el.className || el.tagName, h: el.getBoundingClientRect().height }))
      .filter((x) => x.h > 0 && x.h < 44),
  );
  expect(small).toEqual([]);
  const fonts = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        'input:not([type=file]):not([type=range]):not([type=checkbox]):not([aria-hidden=true]),textarea',
      ),
    )
      .map((el) => parseFloat(getComputedStyle(el).fontSize))
      .filter((s) => s < 16),
  );
  expect(fonts).toEqual([]);
});

test('la page de confidentialité affiche les informations de configuration', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.getByRole('heading', { name: 'Confidentialité', level: 1 })).toBeVisible();
  await expect(page.getByText(process.env.PRIVACY_CONTACT_EMAIL!).first()).toBeVisible();
});
