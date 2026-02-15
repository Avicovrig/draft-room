import { test, expect } from '../fixtures'
import { SpectatorViewPage } from '../pages/spectator-view.page'
import { getLeagueTokens } from '../helpers/tokens'

test.describe('Spectator Flow', () => {
  let leagueId: string
  let spectatorToken: string

  test.beforeAll(async ({ supabase }) => {
    const email = process.env.E2E_QA_EMAIL || 'avi+qa@covrigaru.com'
    const password = process.env.E2E_QA_PASSWORD || 'Password123!'

    // Find a QA league that is NOT completed (completed redirects to summary page)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) throw authError

    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id')
      .in('status', ['not_started', 'in_progress', 'paused'])
      .limit(1)
    if (leaguesError) throw leaguesError
    if (!leagues?.length)
      throw new Error('No non-completed QA league found for spectator flow tests')

    leagueId = leagues[0].id

    const tokens = await getLeagueTokens(supabase, leagueId, email, password)
    spectatorToken = tokens.spectator_token
  })

  test('spectator view loads with read-only state', async ({ page }) => {
    const spectatorView = new SpectatorViewPage(page)

    await spectatorView.goto(leagueId, spectatorToken)

    // Verify page loaded correctly
    await expect(spectatorView.heading).toBeVisible({ timeout: 15000 })
    await expect(spectatorView.spectatorLabel).toBeVisible()

    // Player pool heading should say "Available Players" (not "Select a Player")
    await expect(page.getByText('Available Players')).toBeVisible()

    // There should be no draft/pick button (canPick is false)
    await expect(page.getByRole('button', { name: /^Draft / })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Select a player to draft' })).not.toBeVisible()

    // Teams section should be visible
    await expect(page.getByText('Teams')).toBeVisible()

    // Draft Controls section should NOT be visible (not a manager)
    await expect(page.getByText('Draft Controls')).not.toBeVisible()

    // Queue panel should NOT be visible (not a captain)
    await expect(page.getByText('My Queue')).not.toBeVisible()
  })
})
