import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/dashboard.page'
import { ManageLeaguePage } from '../pages/manage-league.page'

test.describe('Draft Flow', () => {
  // This test creates a full league, starts a draft, and makes a pick — needs extra time
  test.setTimeout(60000)

  test('start draft and make a pick as manager', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    // Create a league with enough players and captains to draft
    await dashboard.goto()
    await dashboard.createLeagueButton.click()
    await managerPage.waitForURL('**/league/new')

    const leagueName = `E2E Draft Test ${Date.now()}`
    await managerPage.getByLabel('League Name').fill(leagueName)
    await managerPage.getByLabel('Draft Type').selectOption('snake')
    await managerPage.getByLabel('Time Limit Per Pick').selectOption('60')
    await managerPage.getByRole('button', { name: /Create League/ }).click()
    await managerPage.waitForURL('**/manage', { timeout: 10000 })

    const managePage = new ManageLeaguePage(managerPage)

    // Add 4 players
    await managePage.tab('Players').click()
    for (const name of ['Player A', 'Player B', 'Player C', 'Player D']) {
      await managerPage.getByPlaceholder('Player name').fill(name)
      await managerPage.getByRole('button', { name: 'Add' }).click()
      await expect(managerPage.getByText(name)).toBeVisible()
    }

    // Add 2 non-player captains
    await managePage.tab('Captains').click()
    await managerPage.getByRole('button', { name: 'Create Non-Player Captain' }).click()
    for (const name of ['Captain One', 'Captain Two']) {
      await managerPage.getByPlaceholder('Captain name').fill(name)
      await managerPage.getByRole('button', { name: 'Add' }).click()
      await expect(managePage.tabPanel.getByText(name)).toBeVisible()
    }

    // Navigate to draft page via "Start Draft" button on manage page
    await managePage.startDraftButton.click()
    await managerPage.waitForURL('**/draft', { timeout: 10000 })

    // The draft page shows "Ready to Draft" initially — need to click Start Draft in controls
    await expect(managerPage.getByText('Ready to Draft')).toBeVisible({ timeout: 10000 })
    await expect(managerPage.getByText('Draft Controls')).toBeVisible()

    // Click the "Start Draft" button in the Draft Controls section
    const startButton = managerPage.getByRole('button', { name: 'Start Draft' })
    await expect(startButton).toBeEnabled()
    await startButton.click()

    // Wait for draft to actually start — heading changes from "Ready to Draft" to "Round X of Y"
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 15000 })

    // Verify draft controls updated (now shows "Pause Draft" instead of "Start Draft")
    await expect(managerPage.getByRole('button', { name: /Pause Draft/ })).toBeVisible()

    // Verify player pool is visible
    await expect(managerPage.getByRole('heading', { name: 'Select a Player' })).toBeVisible()
    await expect(managerPage.getByPlaceholder(/Search players/)).toBeVisible()

    // Select a player from the pool (players are <li role="option"> inside a <ul role="listbox">)
    const playerList = managerPage.getByRole('listbox')
    const firstPlayer = playerList.getByRole('option').first()
    await firstPlayer.click()

    // The draft button should now show "Draft <player name>" and be enabled
    const draftButton = managerPage.getByRole('button', { name: /^Draft / })
    await expect(draftButton).toBeEnabled()
    await draftButton.click()

    // After the pick, verify:
    // 1. Pick counter advanced (Pick 2 of 4)
    await expect(managerPage.getByText('Pick 2 of 4', { exact: true })).toBeVisible({
      timeout: 10000,
    })
    // 2. Players remaining decreased
    await expect(managerPage.getByText(/3 players remaining/)).toBeVisible()
    // 3. Teams section shows the drafted player assignment
    await expect(managerPage.getByText('Teams')).toBeVisible()
  })
})
