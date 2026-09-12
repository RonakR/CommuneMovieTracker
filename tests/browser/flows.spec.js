import { test, expect } from '@playwright/test';

test('desktop: add, rewatch, correct dates, browse days, remove and isolate years', async ({
  page,
  request
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?year=2197');
  await expect(page.getByText('DEMO SHELF')).toBeVisible();
  await expect(page.getByText('A fresh shelf. A new season.')).toBeVisible();
  const origin = 'http://127.0.0.1:5174';
  let id;
  try {
    await page.getByRole('button', { name: '＋ Add movie', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search movie catalog' }).fill('Halloween');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.search-result')).toHaveCount(1);
    await page.getByRole('button', { name: '＋ Add', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Search movie catalog' })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Search movie catalog' })).toBeFocused();
    await expect(page.locator('.search-result')).toHaveCount(0);
    await expect(page.locator('.added-notice')).toContainText('Halloween added to 2197.');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const duplicate = await request.post('/api/entries', {
      headers: { origin },
      data: { year: 2197, tmdbId: 948 }
    });
    const result = await duplicate.json();
    expect(result.alreadyAdded).toBe(true);
    id = result.entry._id;
    await expect(page.locator('.movie-card')).toHaveCount(1);
    await page.getByRole('button', { name: '＋ Record viewing', exact: true }).click();
    await page.getByLabel('Watched on').fill('2197-09-15');
    await page.getByRole('button', { name: 'Save viewing', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /^Watched/ }).click();
    await expect(page.locator('.movie-card')).toHaveCount(1);
    await page.getByRole('button', { name: /Watch again/ }).click();
    await page.getByLabel('Watched on').fill('2197-09-15');
    await page.getByRole('button', { name: 'Save viewing', exact: true }).click();
    await expect(page.locator('.watched-sticker')).toContainText('×2');
    await page.getByRole('link', { name: 'Viewing history', exact: true }).click();
    await expect(page.locator('.history-row')).toHaveCount(2);
    await page
      .getByRole('button', { name: /^Edit viewing/ })
      .first()
      .click();
    await page.getByLabel('Watched on').fill('2197-09-16');
    await page.getByRole('button', { name: 'Save viewing', exact: true }).click();
    await expect(page.locator('.history-day')).toHaveCount(2);
    await page.screenshot({ path: 'test-results/history.png', fullPage: true });
    await expect(page.getByText('All days', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /week/i })).toHaveCount(0);
    await page
      .getByRole('button', { name: /^Remove viewing/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.locator('.history-row')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.history-row')).toHaveCount(1);
    const invalid = await request.post('/api/viewings', {
      headers: { origin },
      data: { yearEntryId: id, watchedOn: '2198-10-31' }
    });
    expect(invalid.status()).toBe(400);
    const invalidId = await request.post('/api/viewings', {
      headers: { origin },
      data: { yearEntryId: { $ne: null }, watchedOn: '2197-10-31' }
    });
    expect(invalidId.status()).toBe(400);
    const csrf = await request.post('/api/viewings', {
      headers: { origin: 'https://elsewhere.example' },
      data: { yearEntryId: id, watchedOn: '2197-10-31' }
    });
    expect(csrf.status()).toBe(403);
    await page.goto('/?year=2198');
    await expect(page.locator('.movie-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (id) await request.delete(`/api/entries/${id}`, { headers: { origin } });
  }
});

test('mobile: collection fits, modal works with keyboard, search and navigation', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.movie-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Collection year' }).selectOption('new');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Collection year' })).not.toHaveValue('new');
  await page.getByRole('textbox', { name: 'Search your collection' }).fill('Halloween');
  await expect(page.locator('.movie-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Details for Halloween' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search your collection' }).fill('');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('search details: top cast, genres, full details, back navigation and add reset', async ({
  page,
  request
}) => {
  const origin = 'http://127.0.0.1:5174';
  let id;
  await page.goto('/?year=2196');
  await expect(page.getByText('DEMO SHELF')).toBeVisible();
  try {
    await page.getByRole('button', { name: '＋ Add movie', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Search movie catalog' });
    await input.fill('Halloween');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const row = page.locator('.search-result');
    await expect(row).toContainText('Horror · Thriller');
    await expect(row.locator('.cast-preview')).toHaveText(
      'Donald Pleasence, Jamie Lee Curtis, Nancy Kyes'
    );
    await expect(row).not.toContainText('P. J. Soles');
    await page.screenshot({ path: 'test-results/search-list.png' });
    await page.getByRole('button', { name: 'View details for Halloween (1978)' }).click();
    await expect(page.locator('.catalog-cast')).toContainText('P. J. Soles');
    await expect(page.locator('.catalog-detail-top')).toContainText('91 min');
    await expect(page.locator('.tmdb-score')).toContainText('Not yet rated');
    await expect(page.locator('.catalog-overview')).toContainText('masked killer');
    await page.getByRole('button', { name: 'Back to results', exact: true }).click();
    await expect(input).toHaveValue('Halloween');
    await expect(
      page.getByRole('button', { name: 'View details for Halloween (1978)' })
    ).toBeFocused();
    await page.getByRole('button', { name: 'View details for Halloween (1978)' }).click();
    await expect(page.locator('.catalog-cast')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true
    );
    await page.screenshot({ path: 'test-results/search-details-mobile.png' });
    await page.route(
      '**/api/entries',
      (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Please retry your addition.' })
        }),
      { times: 1 }
    );
    await page.getByRole('button', { name: '＋ Add to 2196', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Please retry');
    await expect(page.locator('.catalog-detail-heading')).toContainText('Halloween');
    await page.getByRole('button', { name: '＋ Add to 2196', exact: true }).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(page.locator('.catalog-detail-top')).toHaveCount(0);
    await expect(page.locator('.added-notice')).toContainText('Halloween added to 2196.');
    const result = await request.post('/api/entries', {
      headers: { origin },
      data: { year: 2196, tmdbId: 948 }
    });
    id = (await result.json()).entry._id;
    await input.fill('Halloween');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('button', { name: '✓ Added', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'View details for Halloween (1978)' }).click();
    await expect(page.getByRole('button', { name: '✓ Already on your shelf' })).toBeDisabled();
  } finally {
    if (id) await request.delete(`/api/entries/${id}`, { headers: { origin } });
  }
});

test('details: ratings, missing metadata, and request failure recovery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('DEMO SHELF')).toBeVisible();
  await page.getByRole('button', { name: '＋ Add movie', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search movie catalog' }).fill('Psycho');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.search-result')).toContainText('Cast unavailable');
  await page.route(
    '**/api/movies/539',
    (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Details temporarily unavailable.' })
      }),
    { times: 1 }
  );
  await page.getByRole('button', { name: 'View details for Psycho (1960)' }).click();
  await expect(page.getByRole('alert')).toContainText('Details temporarily unavailable.');
  await page.route('**/api/movies/539', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.movie.rating = 8.2;
    data.movie.voteCount = 1234;
    await route.fulfill({ json: data });
  });
  await page.getByRole('button', { name: 'Retry details' }).click();
  await expect(page.locator('.tmdb-score')).toContainText('8.2 / 10');
  await expect(page.locator('.tmdb-score')).toContainText('1,234 votes');
  await expect(page.locator('.catalog-overview')).toContainText('No synopsis available.');
  await expect(page.locator('.catalog-cast')).toContainText('Cast information unavailable.');
});
