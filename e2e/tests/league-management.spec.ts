import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/dashboard.page'
import { ManageLeaguePage } from '../pages/manage-league.page'

test.describe('League Management', () => {
  test('create a new league', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    await dashboard.goto()
    await expect(dashboard.heading).toBeVisible()

    await dashboard.createLeagueButton.click()
    await managerPage.waitForURL('**/league/new')

    // Fill out the create league form
    const leagueName = `E2E Test League ${Date.now()}`
    await managerPage.getByLabel('League Name').fill(leagueName)
    await managerPage.getByLabel('Draft Type').selectOption('snake')
    await managerPage.getByLabel('Time Limit Per Pick').selectOption('30')
    await managerPage.getByRole('button', { name: /Create League/ }).click()

    // Should redirect to the manage page
    await managerPage.waitForURL('**/manage', { timeout: 10000 })
    const managePage = new ManageLeaguePage(managerPage)
    await expect(managePage.heading).toContainText(leagueName)
  })

  test('add players and captains to a league', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    // Create a fresh league for this test
    await dashboard.goto()
    await dashboard.createLeagueButton.click()
    await managerPage.waitForURL('**/league/new')

    const leagueName = `E2E Players Test ${Date.now()}`
    await managerPage.getByLabel('League Name').fill(leagueName)
    await managerPage.getByLabel('Draft Type').selectOption('snake')
    await managerPage.getByLabel('Time Limit Per Pick').selectOption('30')
    await managerPage.getByRole('button', { name: /Create League/ }).click()
    await managerPage.waitForURL('**/manage', { timeout: 10000 })

    const managePage = new ManageLeaguePage(managerPage)

    // Add players via the Players tab
    await managePage.tab('Players').click()
    await managerPage.getByPlaceholder('Player name').fill('Alice')
    await managerPage.getByRole('button', { name: 'Add' }).click()
    await expect(managerPage.getByText('Alice')).toBeVisible()

    await managerPage.getByPlaceholder('Player name').fill('Bob')
    await managerPage.getByRole('button', { name: 'Add' }).click()
    await expect(managerPage.getByText('Bob')).toBeVisible()

    await managerPage.getByPlaceholder('Player name').fill('Charlie')
    await managerPage.getByRole('button', { name: 'Add' }).click()
    await expect(managerPage.getByText('Charlie')).toBeVisible()

    // Add a captain via the Captains tab — use "Create Non-Player Captain" mode
    await managePage.tab('Captains').click()
    await managerPage.getByRole('button', { name: 'Create Non-Player Captain' }).click()
    await managerPage.getByPlaceholder('Captain name').fill('Captain Alpha')
    await managerPage.getByRole('button', { name: 'Add' }).click()
    await expect(managePage.tabPanel.getByText('Captain Alpha')).toBeVisible()

    await managerPage.getByPlaceholder('Captain name').fill('Captain Beta')
    await managerPage.getByRole('button', { name: 'Add' }).click()
    await expect(managePage.tabPanel.getByText('Captain Beta')).toBeVisible()
  })
})
