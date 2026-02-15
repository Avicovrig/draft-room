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
  get playerNameInput() {
    return this.page.getByPlaceholder('Player name')
  }

  get addButton() {
    return this.page.getByRole('button', { name: 'Add' })
  }

  get addPlayerButton() {
    return this.page.getByRole('button', { name: /Add Player/ })
  }

  // Captains tab
  get addCaptainButton() {
    return this.page.getByRole('button', { name: /Add Captain/ })
  }

  get createNonPlayerCaptainButton() {
    return this.page.getByRole('button', { name: 'Create Non-Player Captain' })
  }

  get selectFromPlayersButton() {
    return this.page.getByRole('button', { name: 'Select from Players' })
  }

  get captainNameInput() {
    return this.page.getByPlaceholder('Captain name')
  }

  get selectCaptainPlayer() {
    // The captain-player dropdown is a native <select> rendered as combobox in ARIA
    return this.page.getByRole('tabpanel').getByRole('combobox')
  }

  // Fields tab
  get fieldNameInput() {
    return this.page.locator('#new-field-name')
  }

  get fieldTypeSelect() {
    return this.page.locator('#new-field-type')
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

  // Share tab
  get spectatorLinkCard() {
    return this.page.getByText('Spectator Link')
  }

  get captainLinksCard() {
    return this.page.getByText('Captain Links')
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
