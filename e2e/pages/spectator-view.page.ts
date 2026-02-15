import type { Page } from '@playwright/test'

export class SpectatorViewPage {
  constructor(private page: Page) {}

  async goto(leagueId: string, token: string) {
    await this.page.goto(`/league/${leagueId}/spectate?token=${token}`)
  }

  get heading() {
    return this.page.locator('h1').first()
  }

  get spectatorLabel() {
    return this.page.getByText('Spectator View')
  }

  get playerSearchInput() {
    return this.page.getByPlaceholder(/Search players/)
  }
}
