import type { Page } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/login')
  }

  get emailInput() {
    return this.page.getByLabel('Email')
  }

  get passwordInput() {
    return this.page.getByLabel('Password')
  }

  get signInButton() {
    return this.page.getByRole('button', { name: 'Sign In' })
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Log In' })
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.signInButton.click()
  }
}
