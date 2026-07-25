import { test, expect } from '@playwright/test';

test('sign up and land on the dashboard', async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;   // unique each run, so signup never collides

    await page.goto('/signup');

    await page.getByPlaceholder('Display Name').fill('E2E User');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill('password123');
    await page.getByPlaceholder('Confirm your password again').fill('password123');

    await page.getByRole('button', { name: /sign up/i }).click();

    // signup should redirect into the dashboard
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/your fridge/i)).toBeVisible();
});