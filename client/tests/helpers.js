import { expect } from '@playwright/test';

export async function signUp(page, email = `e2e-${Date.now()}@example.com`) {
    await page.goto('/signup', { waitUntil: 'commit'});
    await page.getByLabel('Display name').fill('E2E User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Reconfirm password').fill('password123');
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    return email;
}