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

    // Navigate to Settings tab and open the fields modal
    await managePage.tab('Settings').click()
    await managePage.manageFieldsButton.click()
    await expect(managePage.fieldsModal).toBeVisible()

    // Add a text field
    await managePage.fieldNameInput.fill('E2E Role')
    await managePage.fieldTypeSelect.selectOption('text')
    await managePage.fieldsModal.getByRole('button', { name: 'Add' }).click()

    // Verify field appears in list with its type badge
    const roleRow = managePage.fieldsModal.locator('li').filter({ hasText: 'E2E Role' })
    await expect(roleRow).toBeVisible()
    await expect(roleRow.getByText('Text', { exact: true })).toBeVisible()

    // Add a number field: Height
    await managePage.fieldNameInput.fill('Height')
    await managePage.fieldTypeSelect.selectOption('number')
    await managePage.fieldsModal.getByRole('button', { name: 'Add' }).click()

    const heightRow = managePage.fieldsModal.locator('li').filter({ hasText: 'Height' })
    await expect(heightRow).toBeVisible()
    await expect(heightRow.getByText('Number', { exact: true })).toBeVisible()

    // Verify "Fields (2)" count
    await expect(managePage.fieldsModal.getByText('Fields (2)')).toBeVisible()

    // Close modal
    await managePage.closeFieldsModalButton.click()
  })

  test('edit a field schema', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    // Open fields modal from Settings
    await managePage.tab('Settings').click()
    await managePage.manageFieldsButton.click()
    await expect(managePage.fieldsModal).toBeVisible()
    await expect(managePage.fieldsModal.getByText('E2E Role', { exact: true })).toBeVisible()

    // Click edit on "E2E Role" field
    const roleRow = managePage.fieldsModal.locator('li').filter({ hasText: 'E2E Role' })
    await roleRow.getByLabel('Edit field').click()

    // Check the "Required" checkbox
    const editPanel = managePage.fieldsModal
      .getByRole('list')
      .locator('label')
      .filter({ hasText: 'Required' })
    await editPanel.click()

    // Save the edit
    await managePage.fieldsModal.getByRole('list').getByRole('button', { name: 'Save' }).click()

    // After saving, verify "Required" badge appears on E2E Role
    const updatedRow = managePage.fieldsModal.locator('li').filter({ hasText: 'E2E Role' })
    await expect(updatedRow.getByText('Required')).toBeVisible({ timeout: 5000 })

    await managePage.closeFieldsModalButton.click()
  })

  test('delete a field schema', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    // Open fields modal from Settings
    await managePage.tab('Settings').click()
    await managePage.manageFieldsButton.click()
    await expect(managePage.fieldsModal).toBeVisible()
    await expect(managePage.fieldsModal.getByText('Height', { exact: true })).toBeVisible()

    // Click delete on "Height" field
    const heightRow = managePage.fieldsModal.locator('li').filter({ hasText: 'Height' })
    await heightRow.getByLabel('Delete field').click()

    // Confirm deletion
    await managePage.fieldsModal.getByRole('button', { name: 'Delete', exact: true }).click()

    // Verify Height is gone
    await expect(managePage.fieldsModal.getByText('Height', { exact: true })).not.toBeVisible()

    // Verify "Fields (1)" count
    await expect(managePage.fieldsModal.getByText('Fields (1)')).toBeVisible()

    await managePage.closeFieldsModalButton.click()
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

    await managePage.tab('Roster').click()

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

    await managePage.tab('Roster').click()
    await expect(managePage.tabPanel.getByText('Eve', { exact: true })).toBeVisible()

    // Find Eve's row and click delete
    const eveRow = managePage.tabPanel.locator('li').filter({ hasText: 'Eve' })
    await eveRow.getByTitle('Delete player').click()

    // Verify Eve is removed
    await expect(managePage.tabPanel.getByText('Eve', { exact: true })).not.toBeVisible()

    // Verify 4 players remain
    await expect(managePage.tabPanel.getByText('Available Players (4)')).toBeVisible()
  })

  test('add captains (make captain + non-player)', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Roster').click()

    // Add non-player captains: Team Alpha, Team Beta
    await managePage.captainNameInput.fill('Team Alpha')
    await managePage.addCaptainButton.click()
    // Wait for Draft Order to show 1 captain (name may be truncated on mobile)
    await expect(managePage.tabPanel.getByText(/Draft Order \(1 Captain/)).toBeVisible()

    await managePage.captainNameInput.fill('Team Beta')
    await managePage.addCaptainButton.click()
    await expect(managePage.tabPanel.getByText('Draft Order (2 Captains)')).toBeVisible()

    // Make Alice a captain via crown button
    await managePage.makeCaptainButton('Alice').click()

    // Alice should now appear as a captain in the draft order
    await expect(managePage.tabPanel.getByText('Draft Order (3 Captains)')).toBeVisible()
  })

  test('reorder captains', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Roster').click()
    await expect(managePage.tabPanel.getByText('Draft Order (3 Captains)')).toBeVisible()

    // Move up/down buttons are hidden on mobile (hidden sm:flex).
    const viewport = managerPage.viewportSize()

    if (viewport && viewport.width >= 640) {
      // Move down buttons only exist in the Draft Order section
      const firstMoveDown = managePage.tabPanel.getByLabel('Move down').first()
      const firstCaptainLabel = managePage.tabPanel
        .getByLabel('Move down')
        .first()
        .locator('xpath=ancestor::li')
      const firstCaptainText = await firstCaptainLabel.textContent()

      await firstMoveDown.click()

      // Wait for reorder to complete — the first position should have changed
      await managerPage.waitForTimeout(1000)
      const newFirstCaptainText = await firstCaptainLabel.textContent()
      expect(newFirstCaptainText).not.toBe(firstCaptainText)
    } else {
      // On mobile, verify the captain list renders by checking Draft Order count
      await expect(managePage.tabPanel.getByText('Draft Order (3 Captains)')).toBeVisible()
    }
  })

  test('verify captain links on roster', async ({ managerPage }) => {
    const managePage = new ManageLeaguePage(managerPage)
    await managerPage.goto(leagueUrl)
    await expect(managePage.heading).toBeVisible({ timeout: 10000 })

    await managePage.tab('Roster').click()

    // Verify copy link buttons exist for each captain in the draft order section
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
