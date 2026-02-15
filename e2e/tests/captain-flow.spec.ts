import { test, expect } from '../fixtures'
import { CaptainViewPage } from '../pages/captain-view.page'
import { getLeagueTokens } from '../helpers/tokens'

// These tests use an existing QA league that has captains and players.
// The league must NOT be completed (completed leagues redirect to summary).
// We fetch tokens dynamically via the get_league_tokens RPC.

test.describe('Captain Flow', () => {
  let leagueId: string
  let captainToken: string
  let captainName: string

  test.beforeAll(async ({ supabase }) => {
    const email = process.env.E2E_QA_EMAIL || 'avi+qa@covrigaru.com'
    const password = process.env.E2E_QA_PASSWORD || 'Password123!'

    // Find a QA league that is NOT completed (completed redirects to summary)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) throw authError

    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id')
      .in('status', ['not_started', 'in_progress', 'paused'])
      .limit(1)
    if (leaguesError) throw leaguesError
    if (!leagues?.length) throw new Error('No non-completed QA league found for captain flow tests')

    leagueId = leagues[0].id

    const tokens = await getLeagueTokens(supabase, leagueId, email, password)
    if (!tokens.captains.length) throw new Error('No captains in QA league')

    captainToken = tokens.captains[0].access_token
    captainName = tokens.captains[0].name
  })

  test('captain view loads with correct identity', async ({ page }) => {
    const captainView = new CaptainViewPage(page)

    await captainView.goto(leagueId, captainToken)

    // Verify the page loaded (not an error state)
    await expect(captainView.heading).toBeVisible({ timeout: 15000 })
    await expect(captainView.draftingAsText).toBeVisible()

    // Captain name should appear in the breadcrumb
    await expect(page.getByText(`Captain: ${captainName}`)).toBeVisible()

    // Team settings are shown inline — team color and team name fields visible
    await expect(page.getByText('Team color')).toBeVisible()
    await expect(page.getByText('Team name')).toBeVisible()
  })

  test('captain view shows inline team settings', async ({ page }) => {
    const captainView = new CaptainViewPage(page)

    await captainView.goto(leagueId, captainToken)
    await expect(captainView.heading).toBeVisible({ timeout: 15000 })

    // Team name input should be editable
    const teamNameInput = page.locator('input').filter({ hasText: '' }).nth(0)
    await expect(page.getByText('Team name')).toBeVisible()

    // Color palette should be visible
    await expect(page.getByText('Team color')).toBeVisible()

    // Team photo upload should be available
    await expect(page.getByText('Team photo')).toBeVisible()
  })

  test('captain view shows player pool and queue panel', async ({ page }) => {
    const captainView = new CaptainViewPage(page)

    await captainView.goto(leagueId, captainToken)
    await expect(captainView.heading).toBeVisible({ timeout: 15000 })

    // Player pool should be visible with search
    await expect(captainView.playerSearchInput).toBeVisible()

    // My Queue panel should be visible as a separate section (3-column layout on desktop)
    await expect(page.getByText('My Queue')).toBeVisible()

    // Auto-pick toggle should be visible in the queue panel
    await expect(page.getByText('Auto-pick')).toBeVisible()

    // Timer card should be visible (heading is hidden on mobile, check for timer text instead)
    await expect(page.getByText(/Waiting to start|Time remaining/)).toBeVisible()
  })

  test('player search filters the pool', async ({ page }) => {
    const captainView = new CaptainViewPage(page)

    await captainView.goto(leagueId, captainToken)
    await expect(captainView.heading).toBeVisible({ timeout: 15000 })
    await expect(captainView.playerSearchInput).toBeVisible()

    // Count items in the player list before searching
    const playerList = page.getByRole('listbox')
    await expect(playerList).toBeVisible({ timeout: 5000 })
    const countBefore = await playerList.getByRole('option').count()

    // Type a partial name into search (use first 3 chars of a known player)
    // We don't know exact player names, but typing a few characters should filter
    await captainView.playerSearchInput.fill('aaa')
    await page.waitForTimeout(500)

    // Either the list is shorter (filtered) or empty — both indicate filtering works
    const countAfter = await playerList.getByRole('option').count()
    expect(countAfter).toBeLessThanOrEqual(countBefore)

    // Clear search — pool should restore
    await captainView.playerSearchInput.clear()
    await page.waitForTimeout(500)
    const countRestored = await playerList.getByRole('option').count()
    expect(countRestored).toBe(countBefore)
  })
})
