import { test, expect } from '@playwright/test';
import { signUp } from './helpers';

test('recipe page: prefilled ingredient, add another via the filter bar', async ({ page }) => {
    await signUp(page);

    // seed TWO items so the fridge typeahead has something to offer
    await page.getByRole('button', { name: /quick add assistant/i }).click();   // open the bubble
    await page.getByPlaceholder(/add 12 eggs/i).fill('add 3 eggs expire today');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/added 3/i)).toBeVisible();   // assistant success message

    await page.getByRole('button', { name: /quick add assistant/i }).click();   // open the bubble
    await page.getByPlaceholder(/add 12 eggs/i).fill('add 3 tomato expire today');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/added 3/i)).toBeVisible();   // assistant success message

    // and it's really in the inventory
    await page.getByRole('button', { name: /view full inventory/i }).click();
    await expect(page.getByRole('heading', { name: 'Eggs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tomatoes' })).toBeVisible();

    // from the expiring items item, click check usage suggestions
    await page.getByRole('button', { name: /check usage suggestions/i }).click();
    await expect(page).toHaveURL(/dashboard\/recipes/);

    // eggs should be prefilled as a bubble
    await expect(page.locator('.ingredient-bubble', { hasText: 'Eggs' })).toBeVisible();

    // remove eggs
    await page.getByRole('button', { name: /remove eggs/i }).click();
    await expect(page.locator('.ingredient-bubble', { hasText: /eggs/i })).toHaveCount(0);

    // add eggs again through the filter bar
    await page.getByPlaceholder('Search ingredients to add...').fill('Eggs');
    await page.locator('.ingredient-suggestions').getByRole('button', { name: /eggs/i }).click();
    await expect(page.locator('.ingredient-bubble', { hasText: /eggs/i })).toBeVisible();

    // add bread through the filter bar
    await page.getByPlaceholder('Search ingredients to add...').fill('Bread');
    await page.locator('.ingredient-suggestions').getByRole('button', { name: /bread/i }).click();
    await expect(page.locator('.ingredient-bubble', { hasText: /bread/i })).toBeVisible();

    // remove it again
    await page.getByRole('button', { name: /remove bread/i }).click();
    await expect(page.locator('.ingredient-bubble', { hasText: /bread/i })).toHaveCount(0);
});