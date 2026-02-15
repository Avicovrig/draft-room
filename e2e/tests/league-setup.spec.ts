import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/dashboard.page'
import { ManageLeaguePage } from '../pages/manage-league.page'

test.describe.serial('League Setup', () => {
  let leagueUrl: string
  let copiedLeagueUrl: string

  const ts = Date.now()

  test('create a new league', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    await dashboard.goto()
    await expect(dashboard.heading).toBeVisible()

    await dashboard.createLeagueButton.click()
    await managerPage.waitForURL('**/league/new')

    const leagueName = `E2E Setup ${ts}`
    await managerPage.getByLabel('League Name').fill(leagueName)
    await managerPage.getByLabel('Draft Type').selectOption('snake')
    await managerPage.getByLabel('Time Limit Per Pick').selectOption('60')
    await managerPage.getByRole('button', { name: /Create League/ }).click()

    await managerPage.waitForURL('**/manage', { timeout: 10000 })
    const managePage = new ManageLeaguePage(managerPage)
    await expect(managePage.heading).toContainText(leagueName)

    leagueUrl = managerPage.url()
  })

  test('add custom field schemas', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Fields').click()

    // Add a text field
    await managePage.fieldNameInput.fill('E2E Role')
    await managePage.fieldTypeSelect.selectOption('text')
    await managePage.tabPanel.getByRole('button', { name: 'Add' }).click()

    // Verify field appears in list with its type badge
    const roleRow = managePage.tabPanel.locator('li').filter({ hasText: 'E2E Role' })
    await expect(roleRow).toBeVisible()
    await expect(roleRow.getByText('Text', { exact: true })).toBeVisible()

    // Add a number field: Height
    await managePage.fieldNameInput.fill('Height')
    await managePage.fieldTypeSelect.selectOption('number')
    await managePage.tabPanel.getByRole('button', { name: 'Add' }).click()

    const heightRow = managePage.tabPanel.locator('li').filter({ hasText: 'Height' })
    await expect(heightRow).toBeVisible()
    await expect(heightRow.getByText('Number', { exact: true })).toBeVisible()

    // Verify "Fields (2)" count
    await expect(managePage.tabPanel.getByText('Fields (2)')).toBeVisible()
  })

  test('edit a field schema', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Fields').click()
    await expect(managePage.tabPanel.getByText('E2E Role', { exact: true })).toBeVisible()

    // Click edit on "E2E Role" field
    const roleRow = managePage.tabPanel.locator('li').filter({ hasText: 'E2E Role' })
    await roleRow.getByLabel('Edit field').click()

    // After clicking Edit, the li content changes to an edit form.
    // The "Required" checkbox is within the list's edit panel.
    // Target the checkbox inside the list area specifically.
    const editPanel = managePage.tabPanel
      .getByRole('list')
      .locator('label')
      .filter({ hasText: 'Required' })
    await editPanel.click()

    // Save the edit
    await managePage.tabPanel.getByRole('list').getByRole('button', { name: 'Save' }).click()

    // After saving, verify "Required" badge appears on E2E Role
    const updatedRow = managePage.tabPanel.locator('li').filter({ hasText: 'E2E Role' })
    await expect(updatedRow.getByText('Required')).toBeVisible({ timeout: 5000 })
  })

  test('delete a field schema', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Fields').click()
    await expect(managePage.tabPanel.getByText('Height', { exact: true })).toBeVisible()

    // Click delete on "Height" field
    const heightRow = managePage.tabPanel.locator('li').filter({ hasText: 'Height' })
    await heightRow.getByLabel('Delete field').click()

    // Confirm deletion (use exact match to avoid matching the "Delete field" aria-label button)
    await managePage.tabPanel.getByRole('button', { name: 'Delete', exact: true }).click()

    // Verify Height is gone
    await expect(managePage.tabPanel.getByText('Height', { exact: true })).not.toBeVisible()

    // Verify "Fields (1)" count
    await expect(managePage.tabPanel.getByText('Fields (1)')).toBeVisible()
  })

  test('update league settings', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Settings').click()

    const updatedName = `E2E Updated ${ts}`
    await managePage.leagueNameInput.clear()
    await managePage.leagueNameInput.fill(updatedName)
    await managePage.timeLimitSelect.selectOption('120') // 2 minutes
    await managePage.saveSettingsButton.click()

    // Verify heading updates with new name
    await expect(managePage.heading).toContainText(updatedName, { timeout: 5000 })
  })

  test('add players', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Players').click()

    for (const name of ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']) {
      await managePage.playerNameInput.fill(name)
      await managePage.addButton.click()
      await expect(managePage.tabPanel.getByText(name)).toBeVisible()
    }
  })

  test('delete a player', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Players').click()
    await expect(managePage.tabPanel.getByText('Eve')).toBeVisible()

    // Find Eve's row and click delete
    const eveRow = managePage.tabPanel.locator('li').filter({ hasText: 'Eve' })
    await eveRow.getByTitle('Delete player').click()

    // Verify Eve is removed
    await expect(managePage.tabPanel.getByText('Eve')).not.toBeVisible()

    // Verify 4 players remain
    await expect(managePage.tabPanel.getByText('Available Players (4)')).toBeVisible()
  })

  test('add captains (both modes)', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Captains').click()

    // Create Non-Player Captain: Team Alpha
    await managePage.createNonPlayerCaptainButton.click()
    await managePage.captainNameInput.fill('Team Alpha')
    await managePage.addButton.click()
    await expect(managePage.tabPanel.getByText('Team Alpha', { exact: true })).toBeVisible()

    // Create Non-Player Captain: Team Beta
    await managePage.captainNameInput.fill('Team Beta')
    await managePage.addButton.click()
    await expect(managePage.tabPanel.getByText('Team Beta', { exact: true })).toBeVisible()

    // Select from Players: Alice
    await managePage.selectFromPlayersButton.click()

    // Wait for the select dropdown to appear and be enabled
    const selectDropdown = managePage.selectCaptainPlayer
    await expect(selectDropdown).toBeVisible({ timeout: 5000 })
    await expect(selectDropdown).toBeEnabled()
    await selectDropdown.selectOption({ label: 'Alice' })
    await managePage.tabPanel.getByRole('button', { name: 'Add' }).click()
    await expect(managePage.tabPanel.getByText('Alice', { exact: true })).toBeVisible()

    // Verify 3 captains listed
    await expect(managePage.tabPanel.getByText('Draft Order (3 Captains)')).toBeVisible()
  })

  test('reorder captains', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Captains').click()
    await expect(managePage.tabPanel.getByText('Draft Order (3 Captains)')).toBeVisible()

    // Move up/down buttons are hidden on mobile (hidden sm:flex).
    // On mobile, skip the button-based reorder and verify list is at least visible.
    const viewport = managerPage.viewportSize()
    const moveDownButton = managePage.tabPanel.locator('li').first().getByLabel('Move down')

    if (viewport && viewport.width >= 640) {
      const captainRows = managePage.tabPanel.locator('li')
      const firstCaptainText = await captainRows.first().textContent()

      await moveDownButton.click()

      // Wait for reorder to complete — the first position should have changed
      await managerPage.waitForTimeout(1000)
      const newFirstCaptainText = await captainRows.first().textContent()
      expect(newFirstCaptainText).not.toBe(firstCaptainText)
    } else {
      // On mobile, verify the captain list renders correctly
      const captainRows = managePage.tabPanel.locator('li')
      expect(await captainRows.count()).toBe(3)
    }
  })

  test('verify share tab', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Share').click()

    // Verify spectator link section with its Copy Link button
    await expect(managePage.spectatorLinkCard).toBeVisible()
    await expect(
      managePage.tabPanel.getByRole('button', { name: 'Copy Link', exact: true })
    ).toBeVisible()

    // Verify captain links section
    await expect(managePage.captainLinksCard).toBeVisible()

    // Verify 3 captain link buttons are visible (via aria-label)
    await expect(managePage.tabPanel.getByLabel('Copy link for Team Alpha')).toBeVisible()
    await expect(managePage.tabPanel.getByLabel('Copy link for Team Beta')).toBeVisible()
    await expect(managePage.tabPanel.getByLabel('Copy link for Alice')).toBeVisible()
  })

  test('copy league', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Settings').click()

    // Click the "Copy League" button in the settings tab
    await managePage.copyLeagueButton.click()

    // Modal opens — verify input is pre-filled
    await expect(managePage.copyLeagueNameInput).toBeVisible()
    const prefilled = await managePage.copyLeagueNameInput.inputValue()
    expect(prefilled).toContain('Copy of')

    // Change name and submit
    const copyName = `E2E Copy ${ts}`
    await managePage.copyLeagueNameInput.clear()
    await managePage.copyLeagueNameInput.fill(copyName)
    await managePage.copyLeagueModalButton.click()

    // Wait for navigation to new league manage page
    await managerPage.waitForURL('**/manage', { timeout: 15000 })
    await expect(managePage.heading).toContainText(copyName)

    copiedLeagueUrl = managerPage.url()
  })

  test('delete the copied league', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(copiedLeagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Settings').click()

    // Click "Delete League"
    await managePage.deleteLeagueButton.click()

    // Verify confirmation prompt
    await expect(managerPage.getByText('Are you sure')).toBeVisible()

    // Confirm deletion
    await managePage.confirmDeleteButton.click()

    // Should redirect to dashboard
    await managerPage.waitForURL('**/dashboard', { timeout: 10000 })
  })
})
