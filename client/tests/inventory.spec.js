import { test, expect } from '@playwright/test';
import { signUp } from './helpers';

test('add an item through the add-food modal (new category)', async ({ page }) => {
    await signUp(page);

    await page.getByRole('button', { name: /add item/i }).click();

    // new category -> goes straight to the details step
    await page.getByPlaceholder('e.g. Fermented food').fill('E2E Category');
    await page.getByRole('button', { name: /continue/i }).click();

    // details step: type the item name, keep default quantity, add it
    await page.getByLabel('Name').fill('E2E Milk');
    await page.getByRole('button', { name: /add item to inventory/i }).click();

    // it should appear in the full inventory
    await page.getByRole('button', { name: /view full inventory/i }).click();
    await expect(page.getByText('E2E Milk')).toBeVisible();
});

test('quick-add a food item by command', async ({ page }) => {
    await signUp(page);

    await page.getByRole('button', { name: /quick add assistant/i }).click();   // open the bubble
    await page.getByPlaceholder(/add 12 eggs/i).fill('add 3 eggs');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/added 3/i)).toBeVisible();   // assistant success message

    // and it's really in the inventory
    await page.getByRole('button', { name: /view full inventory/i }).click();
    await expect(page.getByRole('heading', { name: 'Eggs' })).toBeVisible();
});

test('an expiring item appears in the alert panel', async ({ page }) => {
    await signUp(page);

    // quick-add something expiring in 2 days
    await page.getByRole('button', { name: /quick add assistant/i }).click();
    await page.getByPlaceholder(/add 12 eggs/i).fill('add 1 milk expire in 2 days');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    // "Expires in 2 days" text only appears in the Needs-attention alert panel
    await expect(page.getByText(/expires in 2 days/i)).toBeVisible();
});

test('check usage suggestions navigates to the recipe page', async ({ page }) => {
    await signUp(page);

    // create an expiring item so the button has something to act on
    await page.getByRole('button', { name: /quick add assistant/i }).click();
    await page.getByPlaceholder(/add 12 eggs/i).fill('add 1 milk expire in 2 days');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/expires in 2 days/i)).toBeVisible();

    await page.getByRole('button', { name: /check usage suggestions/i }).click();
    await expect(page).toHaveURL(/dashboard\/recipes/);
});