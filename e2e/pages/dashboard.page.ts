import type { Page } from '@playwright/test'

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard')
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Your Leagues' })
  }

  get createLeagueButton() {
    return this.page.getByRole('link', { name: /Create League/ })
  }

  filterByStatus(status: 'All' | 'Not Started' | 'In Progress' | 'Paused' | 'Completed') {
    return this.page.getByRole('button', { name: status })
  }

  leagueCard(name: string) {
    return this.page.getByRole('link').filter({ hasText: name })
  }
}
