import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/dashboard.page'
import { ManageLeaguePage } from '../pages/manage-league.page'
import { SummaryPage } from '../pages/summary.page'

test.describe.serial('Draft Lifecycle', () => {
  let leagueUrl: string
  let draftUrl: string

  test.setTimeout(90000)

  test('set up league for draft', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    await dashboard.goto()
    await dashboard.createLeagueButton.click()
    await managerPage.waitForURL('**/league/new')

    const leagueName = `E2E Draft ${Date.now()}`
    await managerPage.getByLabel('League Name').fill(leagueName)
    await managerPage.getByLabel('Draft Type').selectOption('snake')
    await managerPage.getByLabel('Time Limit Per Pick').selectOption('60')
    await managerPage.getByRole('button', { name: /Create League/ }).click()
    await managerPage.waitForURL('**/manage', { timeout: 10000 })

    const managePage = new ManageLeaguePage(managerPage)

    // Add 4 players
    await managePage.tab('Players').click()
    for (const name of ['Player A', 'Player B', 'Player C', 'Player D']) {
      await managePage.playerNameInput.fill(name)
      await managePage.addButton.click()
      await expect(managePage.tabPanel.getByText(name)).toBeVisible()
    }

    // Add 2 non-player captains
    await managePage.tab('Captains').click()
    await managePage.createNonPlayerCaptainButton.click()
    for (const name of ['Captain One', 'Captain Two']) {
      await managePage.captainNameInput.fill(name)
      await managePage.addButton.click()
      await expect(managePage.tabPanel.getByText(name)).toBeVisible()
    }

    leagueUrl = managerPage.url()
  })

  test('verify draft readiness and start', async ({ managerPage }) => {
    await managerPage.goto(leagueUrl)
    const managePage = new ManageLeaguePage(managerPage)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    // Start Draft button should be enabled (readiness met)
    await expect(managePage.startDraftButton).toBeEnabled()
    await managePage.startDraftButton.click()

    // Navigate to draft page
    await managerPage.waitForURL('**/draft', { timeout: 10000 })

    // Draft page shows "Ready to Draft" initially
    await expect(managerPage.getByText('Ready to Draft')).toBeVisible({ timeout: 10000 })
    await expect(managerPage.getByText('Draft Controls')).toBeVisible()

    // Click "Start Draft" in Draft Controls
    const startButton = managerPage.getByRole('button', { name: 'Start Draft' })
    await expect(startButton).toBeEnabled()
    await startButton.click()

    // Wait for draft to start
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 15000 })
    await expect(managerPage.getByRole('button', { name: /Pause Draft/ })).toBeVisible()

    draftUrl = managerPage.url()
  })

  test('make first pick', async ({ managerPage }) => {
    await managerPage.goto(draftUrl)
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 15000 })

    // Select a player from the pool
    await expect(managerPage.getByRole('heading', { name: 'Select a Player' })).toBeVisible()
    const playerList = managerPage.getByRole('listbox')
    const firstPlayer = playerList.getByRole('option').first()
    await firstPlayer.click()

    // Draft the selected player
    const draftButton = managerPage.getByRole('button', { name: /^Draft / })
    await expect(draftButton).toBeEnabled()
    await draftButton.click()

    // Verify pick counter advanced
    await expect(managerPage.getByText('Pick 2 of 4', { exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(managerPage.getByText(/3 players remaining/)).toBeVisible()
  })

  test('pause and resume draft', async ({ managerPage }) => {
    await managerPage.goto(draftUrl)
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 15000 })

    // Pause the draft
    await managerPage.getByRole('button', { name: /Pause Draft/ }).click()

    // Verify paused state
    await expect(managerPage.getByText('Draft Paused')).toBeVisible({ timeout: 5000 })
    await expect(managerPage.getByRole('button', { name: /Resume Draft/ })).toBeVisible()
    await expect(managerPage.getByRole('button', { name: 'Restart' })).toBeVisible()

    // Resume the draft
    await managerPage.getByRole('button', { name: /Resume Draft/ }).click()

    // Verify resumed state
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 10000 })
    await expect(managerPage.getByRole('button', { name: /Pause Draft/ })).toBeVisible()
  })

  test('undo last pick', async ({ managerPage }) => {
    await managerPage.goto(draftUrl)
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 15000 })

    // Click Undo Pick, then confirm
    await managerPage.getByRole('button', { name: 'Undo Pick' }).click()
    await managerPage.getByRole('button', { name: 'Confirm Undo' }).click()

    // Verify pick counter resets to Pick 1 of 4
    await expect(managerPage.getByText('Pick 1 of 4', { exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(managerPage.getByText(/4 players remaining/)).toBeVisible()
  })

  test('complete draft and verify summary', async ({ managerPage }) => {
    await managerPage.goto(draftUrl)
    await expect(managerPage.getByText(/Round 1 of \d+/)).toBeVisible({ timeout: 15000 })

    // Make 4 picks to complete the draft (2 captains × 2 rounds = 4 picks total)
    for (let i = 1; i <= 4; i++) {
      // Select first available player
      const playerList = managerPage.getByRole('listbox')
      const firstPlayer = playerList.getByRole('option').first()
      await firstPlayer.click()

      const draftButton = managerPage.getByRole('button', { name: /^Draft / })
      await expect(draftButton).toBeEnabled()
      await draftButton.click()

      if (i < 4) {
        // Wait for pick counter to advance
        await expect(managerPage.getByText(`Pick ${i + 1} of 4`, { exact: true })).toBeVisible({
          timeout: 10000,
        })
      }
    }

    // After final pick, wait for redirect to summary page
    await managerPage.waitForURL('**/summary', { timeout: 20000 })

    const summaryPage = new SummaryPage(managerPage)

    // Verify "Draft Complete!" heading
    await expect(summaryPage.heading).toBeVisible({ timeout: 10000 })

    // Verify stats
    await expect(summaryPage.totalPicks).toBeVisible()
    await expect(summaryPage.teamsCount).toBeVisible()

    // Verify team rosters
    await expect(summaryPage.teamRostersHeading).toBeVisible()

    // Verify pick history
    await expect(summaryPage.pickHistoryHeading).toBeVisible()

    // Verify export button
    await expect(summaryPage.exportButton).toBeVisible()
  })
})
