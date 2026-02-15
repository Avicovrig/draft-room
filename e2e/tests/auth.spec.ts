import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { DashboardPage } from '../pages/dashboard.page'

test.describe('Authentication', () => {
  test('login redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page)
    const dashboardPage = new DashboardPage(page)

    const email = process.env.E2E_QA_EMAIL || 'avi+qa@covrigaru.com'
    const password = process.env.E2E_QA_PASSWORD || 'Password123!'

    await loginPage.goto()
    await expect(loginPage.heading).toBeVisible()

    await loginPage.login(email, password)
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    await expect(dashboardPage.heading).toBeVisible()
  })
})
