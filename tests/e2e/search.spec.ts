import { expect, test } from '@playwright/test';

// The search box is a progressive enhancement on the All Words page: hidden
// without JS (the page's year-grouped list is the fallback), live filtering with JS.

test.describe('word search', () => {
  test('enhances the All Words page with live filtering and navigates to a result', async ({ page }) => {
    await page.goto('/word');

    const input = page.locator('#word-search-input');
    await expect(input).toBeVisible();

    // Discover a real word from the list, then search a prefix of it (no hardcoded words).
    const firstWord = ((await page.locator('#words-list a.word-link .word-link__word').first().textContent()) ?? '').trim();
    expect(firstWord.length).toBeGreaterThan(0);

    await input.fill(firstWord.slice(0, 3).toLowerCase());

    const results = page.locator('#word-search-results');
    await expect(results).toBeVisible();
    await expect(page.locator('#words-list')).toBeHidden();

    const firstResult = results.locator('a').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();
    await expect(page.locator('#word-title')).toBeVisible();
  });

  test('shows a no-results message and restores the list when cleared', async ({ page }) => {
    await page.goto('/word');
    const input = page.locator('#word-search-input');

    await input.fill('zzznotarealword');
    await expect(page.locator('#word-search-empty')).toBeVisible();

    await input.fill('');
    await expect(page.locator('#words-list')).toBeVisible();
  });

  test('degrades gracefully without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/word');

    // No dead control, and the full list is present and navigable.
    await expect(page.locator('#word-search')).toBeHidden();
    const wordLink = page.locator('#words-list a.word-link').first();
    await expect(wordLink).toBeVisible();
    await wordLink.click();
    await expect(page.locator('#word-title')).toBeVisible();

    await context.close();
  });
});
