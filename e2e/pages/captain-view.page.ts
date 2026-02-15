import type { Page } from '@playwright/test'

export class CaptainViewPage {
  constructor(private page: Page) {}

  async goto(leagueId: string, token: string) {
    await this.page.goto(`/league/${leagueId}/captain?token=${token}`)
  }

  get heading() {
    return this.page.locator('h1').first()
  }

  get draftingAsText() {
    return this.page.getByText(/Drafting as/)
  }

  get playerSearchInput() {
    return this.page.getByPlaceholder(/Search players/)
  }

  get teamColorLabel() {
    return this.page.getByText('Team color')
  }

  get teamNameLabel() {
    return this.page.getByText('Team name')
  }

  get autoPickToggle() {
    return this.page.getByText('Auto-pick')
  }

  get myQueuePanel() {
    return this.page.getByText('My Queue')
  }
}
