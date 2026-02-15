import type { Page } from '@playwright/test'

export class EditProfilePage {
  constructor(private page: Page) {}

  async goto(playerId: string, token: string) {
    await this.page.goto(`/player/${playerId}/edit?token=${token}`)
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Edit Your Profile' })
  }

  get bioInput() {
    return this.page.getByLabel('Bio')
  }

  get saveButton() {
    return this.page.getByRole('button', { name: 'Save' })
  }

  get cancelButton() {
    return this.page.getByRole('button', { name: 'Cancel' })
  }

  get successMessage() {
    return this.page.getByText('Your profile has been saved!')
  }

  get editAgainButton() {
    return this.page.getByRole('button', { name: 'Edit Again' })
  }
}
