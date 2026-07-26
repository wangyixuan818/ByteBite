import { test, expect } from '@playwright/test';
import { signUp } from './helpers';

const PASSWORD = 'password123';


test('sign up and land on the dashboard', async ({ page }) => {
    const email = await signUp(page);   // helper does the assertions
});

test('log in with an existing account', async ({ page, request }) => {
    const email = await signUp(page);  // Use the signUp helper to create the account

    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/your fridge/i)).toBeVisible();
});

test('rejects a wrong password', async ({ page, request }) => {
    const email = `wrongpw-${Date.now()}@example.com`;
    await signUp(page, email);          // real account exists...

    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill('totallywrong');   // ...but wrong password
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();   // error message shows
    await expect(page).toHaveURL(/login/);                 // stayed on login, no redirect
});

test('redirects a logged-out user away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);   // ProtectedRoute bounces to login
});