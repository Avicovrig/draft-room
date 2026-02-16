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
  tab(name: 'Roster' | 'Settings') {
    return this.page.getByRole('tab', { name })
  }

  get tabPanel() {
    return this.page.getByRole('tabpanel')
  }

  // Roster tab — Players
  get playerNameInput() {
    return this.page.getByPlaceholder('Player name')
  }

  get addButton() {
    return this.page.getByRole('button', { name: 'Add', exact: true })
  }

  get addPlayerButton() {
    return this.page.getByRole('button', { name: /Add Player/ })
  }

  // Roster tab — Captains
  makeCaptainButton(playerName: string) {
    return this.page.getByLabel(`Make ${playerName} a captain`)
  }

  get captainNameInput() {
    return this.page.getByPlaceholder('Captain name')
  }

  get addCaptainButton() {
    return this.page.getByRole('button', { name: 'Add Captain' })
  }

  // Fields (now in modal from Settings tab)
  get manageFieldsButton() {
    return this.page.getByRole('button', { name: /Manage Fields/ })
  }

  get fieldNameInput() {
    return this.page.locator('#new-field-name')
  }

  get fieldTypeSelect() {
    return this.page.locator('#new-field-type')
  }

  // The fields modal overlay (for scoping field interactions)
  get fieldsModal() {
    return this.page.locator('.fixed').filter({ hasText: 'Custom Fields' })
  }

  get closeFieldsModalButton() {
    return this.page.getByLabel('Close custom fields')
  }

  // Settings tab
  get leagueNameInput() {
    return this.page.getByLabel('League Name')
  }

  get draftTypeSelect() {
    return this.page.getByLabel('Draft Type')
  }

  get timeLimitSelect() {
    return this.page.getByLabel('Time Limit Per Pick')
  }

  get saveSettingsButton() {
    return this.page.getByRole('button', { name: 'Save Settings' })
  }

  get copyLeagueButton() {
    return this.page.getByRole('button', { name: /Copy League/ }).first()
  }

  get deleteLeagueButton() {
    return this.page.getByRole('button', { name: /Delete League/ })
  }

  get confirmDeleteButton() {
    return this.page.getByRole('button', { name: /Yes, Delete League/ })
  }

  // Copy League modal
  get copyLeagueNameInput() {
    return this.page.locator('#copy-league-name')
  }

  get copyLeagueModalButton() {
    // The "Copy League" button inside the modal (second one on the page)
    return this.page.locator('.fixed').getByRole('button', { name: /Copy League/ })
  }
}
