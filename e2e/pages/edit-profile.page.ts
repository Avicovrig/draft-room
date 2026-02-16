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

  /** Fill any empty required schema fields with placeholder values so save doesn't fail. */
  async fillRequiredFields() {
    // Required fields have labels containing a red asterisk (*).
    // Find all text inputs and dropdowns inside the League Fields section that are empty.
    const inputs = this.page.locator('input[placeholder^="Enter "]')
    const count = await inputs.count()
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const value = await input.inputValue()
      if (!value.trim()) {
        const type = await input.getAttribute('type')
        await input.fill(type === 'number' ? '1' : 'E2E Default')
      }
    }
    // Handle required dropdowns — select first non-empty option
    const selects = this.page.locator('select')
    const selectCount = await selects.count()
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i)
      const value = await select.inputValue()
      if (!value) {
        const options = select.locator('option:not([value=""])')
        const optionCount = await options.count()
        if (optionCount > 0) {
          const optionValue = await options.first().getAttribute('value')
          if (optionValue) await select.selectOption(optionValue)
        }
      }
    }
  }
}
