import type { Page } from '@playwright/test'

export class SummaryPage {
  constructor(private page: Page) {}

  get heading() {
    return this.page.getByRole('heading', { name: 'Draft Complete!' })
  }

  get totalPicks() {
    return this.page.getByText('Total Picks')
  }

  get teamsCount() {
    return this.page.getByText('Teams').first()
  }

  get teamRostersHeading() {
    return this.page.getByText('Team Rosters')
  }

  get pickHistoryHeading() {
    return this.page.getByText('Pick History')
  }

  get exportButton() {
    return this.page.getByRole('button', { name: /Export Results/ })
  }

  get shareButton() {
    return this.page.getByRole('button', { name: /Share Results/ })
  }
}
