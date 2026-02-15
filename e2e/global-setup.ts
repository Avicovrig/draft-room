import { chromium, type FullConfig } from '@playwright/test'

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!
  const email = process.env.E2E_QA_EMAIL || 'avi+qa@covrigaru.com'
  const password = process.env.E2E_QA_PASSWORD || 'Password123!'

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${baseURL}/auth/login`)
  await page.waitForLoadState('networkidle')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for redirect — Supabase auth can take a moment on cold start
  await page.waitForURL('**/dashboard', { timeout: 30000 })

  await page.context().storageState({ path: 'e2e/.auth/manager.json' })
  await browser.close()
}
