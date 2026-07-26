import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ByteBite/i);   // or check the landing page renders
});