import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/t';
import { createOnboardedUser } from './helpers/onboard';

/**
 * Photo logging end to end (improvement plan B9, B26): the composer's photo
 * actions, a real upload to the MinIO bucket from docker-compose.yml, the
 * stub AI's "Unknown dish" answer with its portion question, save, the
 * photo on Meal details and its removal. Needs the five S3_* variables
 * (.env.example) and PHOTO_LOGGING_ENABLED=true (the Playwright config sets
 * the flag). A fresh user per run; nothing shared is touched.
 *
 * On the mobile project (Pixel 7, coarse pointer) the picker shows Take photo
 * and Choose from gallery; on desktop one Add photo. The flag-off branch
 * (button hidden) is a unit test of the composer, not an e2e.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 90_000 });

const FIXTURE = path.join(__dirname, 'fixtures/meal.jpg');

/** Opens the composer and answers the late-night prompt with Today when the local clock is 00:00–03:59. */
async function openComposer(page: Page) {
  await page.getByTestId('log-meal').click();
  const composer = page.getByTestId('meal-composer');
  await expect(composer).toBeVisible();
  const lateNight = page.getByTestId('late-night');
  if (await lateNight.isVisible().catch(() => false)) {
    await lateNight.getByRole('button', { name: t('meal.compose.lateNight.today') }).click();
  }
  return composer;
}

test('photo meal: picker actions, upload, stub analysis, save, details, remove', async ({
  page,
  isMobile,
}) => {
  await createOnboardedUser(page, { skipPlan: true, prefix: 'photo' });
  await openComposer(page);

  // ── The control is a label around a real file input (B9) ──────────────
  const gallery = page.getByTestId('add-photo');
  const galleryInput = page.getByTestId('photo-input');
  await expect(gallery).toBeVisible();
  await expect(galleryInput).toHaveAttribute('type', 'file');
  await expect(galleryInput).toHaveAttribute('accept', 'image/*,.heic,.heif');
  await expect(galleryInput).toHaveAttribute('multiple', '');
  await expect(galleryInput).not.toHaveAttribute('capture', /.*/);
  // Tapping the label is what opens the OS picker: Playwright surfaces that as a file chooser.
  const chooser = page.waitForEvent('filechooser');
  await gallery.click();
  expect((await chooser).isMultiple()).toBe(true);

  if (isMobile) {
    const camera = page.getByTestId('take-photo');
    const cameraInput = page.getByTestId('photo-input-camera');
    await expect(camera).toBeVisible();
    await expect(camera).toContainText(t('meal.compose.photoTake'));
    await expect(gallery).toContainText(t('meal.compose.photoGallery'));
    await expect(cameraInput).toHaveAttribute('capture', 'environment');
    await expect(cameraInput).toHaveAttribute('accept', 'image/*');
    await expect(cameraInput).not.toHaveAttribute('multiple', /.*/);
    await expect(page.getByLabel(t('meal.compose.photoTake'))).toHaveCount(1);
  } else {
    await expect(gallery).toContainText(t('meal.compose.addPhoto'));
    await expect(page.getByTestId('take-photo')).toHaveCount(0);
    await expect(page.getByTestId('photo-input-camera')).toHaveCount(0);
  }

  // ── Upload for real (B26): 201 from /api/uploads, thumbnail staged ────
  const upload = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/uploads'),
  );
  await galleryInput.setInputFiles(FIXTURE);
  expect((await upload).status()).toBe(201);
  await expect(
    page.getByRole('img', { name: t('meal.compose.photoPreview', { index: 1 }) }),
  ).toBeVisible();
  await expect(page.getByText(t('meal.compose.photosMax', { max: 3 }))).toBeVisible();

  // ── Analyse through the stub: notice, "Unknown dish", one portion question ──
  await page.getByTestId('analyze').click();
  const notice = page.getByTestId('ai-notice');
  await expect(notice).toContainText(t('aiNotice.meal'));
  await notice.getByRole('button', { name: t('aiNotice.continue') }).click();
  await expect(page.getByRole('heading', { name: t('meal.review.title') })).toBeVisible({
    timeout: 30_000,
  });
  const items = page.getByTestId('meal-items').getByRole('listitem');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Unknown dish');
  const questions = page.getByTestId('meal-questions');
  await expect(questions).toBeVisible();
  await expect(questions).toContainText('How much of this did you eat?');
  await expect(questions.getByRole('radio')).toHaveCount(3);
  await expect(page.getByTestId('unknown-values')).toContainText(t('meal.review.unknownValues'));

  // ── Save with the values still unknown ─────────────────────────────────
  await page.getByTestId('save-meal').click();
  await expect(page.getByText(t('meal.saved')).first()).toBeVisible();
  await expect(page.getByTestId('meal-composer')).toBeHidden();
  const mealId = await page.getByTestId('meal-saved').getAttribute('data-meal-id');
  expect(mealId).toBeTruthy();

  // ── Meal details streams the stored object, then Remove photo ──────────
  await page.goto(`/meals/${mealId}`);
  await expect(page.getByTestId('meal-details')).toBeVisible();
  const photos = page.getByTestId('meal-photos');
  const img = photos.getByRole('img', { name: t('meal.details.photoAlt', { index: 1 }) });
  await expect(img).toHaveAttribute('src', /\/api\/photos\//);
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);

  await photos.getByRole('button', { name: t('meal.details.removePhoto') }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('meal.details.removePhotoTitle'));
  await dialog.getByRole('button', { name: t('meal.details.removePhoto') }).click();
  await expect(page.getByText(t('meal.details.photoRemoved')).first()).toBeVisible();
  await expect(page.getByTestId('meal-photos')).toHaveCount(0);
  await expect(page.getByTestId('meal-details')).toContainText('Unknown dish');
});
