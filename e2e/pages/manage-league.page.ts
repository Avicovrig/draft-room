import type { Page } from '@playwright/test'

export class ManageLeaguePage {
  constructor(private page: Page) {}

  get heading() {
    return this.page.locator('h1').first()
  }

  get startDraftButton() {
    return this.page.getByRole('button', { name: /Start Draft/ })
  }

  get viewDraftButton() {
    return this.page.getByRole('link', { name: /View Draft/ })
  }

  // Tabs
  tab(name: 'Players' | 'Captains' | 'Fields' | 'Settings' | 'Share') {
    return this.page.getByRole('tab', { name })
  }

  get tabPanel() {
    return this.page.getByRole('tabpanel')
  }

  // Players tab
  get addPlayerButton() {
    return this.page.getByRole('button', { name: /Add Player/ })
  }

  // Captains tab
  get addCaptainButton() {
    return this.page.getByRole('button', { name: /Add Captain/ })
  }

  // Settings tab
  get copyLeagueButton() {
    return this.page.getByRole('button', { name: /Copy League/ })
  }
}
