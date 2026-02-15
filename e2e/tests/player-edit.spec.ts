import { test, expect } from '../fixtures'
import { EditProfilePage } from '../pages/edit-profile.page'
import { getLeagueTokens } from '../helpers/tokens'

test.describe('Player Edit Profile', () => {
  let playerId: string
  let editToken: string

  test.beforeAll(async ({ supabase }) => {
    const email = process.env.E2E_QA_EMAIL || 'avi+qa@covrigaru.com'
    const password = process.env.E2E_QA_PASSWORD || 'Password123!'

    // Sign in as manager to find QA leagues
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) throw authError

    // Find a non-completed QA league that has players
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id')
      .in('status', ['not_started', 'in_progress', 'paused'])
      .limit(5)
    if (leaguesError) throw leaguesError
    if (!leagues?.length) throw new Error('No non-completed QA league found for player edit tests')

    // Try each league until we find one with players that have edit tokens
    for (const league of leagues) {
      const tokens = await getLeagueTokens(supabase, league.id, email, password)
      if (tokens.players.length > 0) {
        playerId = tokens.players[0].id
        editToken = tokens.players[0].edit_token
        break
      }
    }

    if (!playerId) throw new Error('No QA player with edit_token found')
  })

  test('loads profile page via edit token', async ({ page }) => {
    const editPage = new EditProfilePage(page)

    await editPage.goto(playerId, editToken)

    // Verify page loaded
    await expect(editPage.heading).toBeVisible({ timeout: 15000 })

    // Verify bio textarea visible
    await expect(editPage.bioInput).toBeVisible()

    // Verify Save and Cancel buttons
    await expect(editPage.saveButton).toBeVisible()
    await expect(editPage.cancelButton).toBeVisible()
  })

  test('edits bio and saves profile', async ({ page }) => {
    const editPage = new EditProfilePage(page)
    const ts = Date.now()

    await editPage.goto(playerId, editToken)
    await expect(editPage.heading).toBeVisible({ timeout: 15000 })

    // Clear and fill bio
    await editPage.bioInput.clear()
    await editPage.bioInput.fill(`E2E test bio ${ts}`)

    // Click Save
    await editPage.saveButton.click()

    // Verify success message
    await expect(editPage.successMessage).toBeVisible({ timeout: 10000 })

    // Verify "Edit Again" button is visible
    await expect(editPage.editAgainButton).toBeVisible()
  })

  test('edit again restores form with saved bio', async ({ page }) => {
    const editPage = new EditProfilePage(page)
    const bioText = `E2E round-trip ${Date.now()}`

    await editPage.goto(playerId, editToken)
    await expect(editPage.heading).toBeVisible({ timeout: 15000 })

    // Set a known bio value, save, then verify Edit Again restores it
    await editPage.bioInput.clear()
    await editPage.bioInput.fill(bioText)
    await editPage.saveButton.click()
    await expect(editPage.successMessage).toBeVisible({ timeout: 10000 })

    // Click "Edit Again"
    await editPage.editAgainButton.click()

    // Verify form is shown again with bio textarea containing our value
    await expect(editPage.bioInput).toBeVisible()
    await expect(editPage.bioInput).toHaveValue(bioText)
  })
})
