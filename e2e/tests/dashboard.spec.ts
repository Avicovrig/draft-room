import { test, expect } from '../fixtures'
import { DashboardPage } from '../pages/dashboard.page'

test.describe('Dashboard', () => {
  test('displays leagues with correct heading', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    await dashboard.goto()

    // Verify page heading
    await expect(dashboard.heading).toBeVisible()

    // Verify logged-in user info
    await expect(managerPage.getByText(/Logged in as/)).toBeVisible()

    // Verify at least 1 league card is visible (QA has seeded leagues)
    await expect(managerPage.locator('[class*="grid"] a, [class*="border"] a').first()).toBeVisible(
      {
        timeout: 10000,
      }
    )
  })

  test('searches leagues by name', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    await dashboard.goto()
    await expect(dashboard.heading).toBeVisible()

    // Wait for known seed leagues to load
    await expect(dashboard.leagueCard('Kickball Casual')).toBeVisible({ timeout: 10000 })

    // Search for a known seed league
    await dashboard.searchInput.fill('Kickball')

    // Verify matching league is visible
    await expect(dashboard.leagueCard('Kickball Casual')).toBeVisible()

    // Verify non-matching league is hidden
    await expect(dashboard.leagueCard('Basketball League 2026')).toBeHidden()

    // Clear search — all leagues restored
    await dashboard.searchInput.clear()
    await expect(dashboard.leagueCard('Basketball League 2026')).toBeVisible({ timeout: 5000 })
  })

  test('filters leagues by status', async ({ managerPage }) => {
    const dashboard = new DashboardPage(managerPage)

    await dashboard.goto()
    await expect(dashboard.heading).toBeVisible()

    // Wait for leagues to load
    await managerPage.waitForTimeout(1000)

    // Click "Not Started" filter
    await dashboard.filterByStatus('Not Started').click()
    // Either see leagues with Not Started badges or "No not started leagues" message
    await expect(
      managerPage
        .getByText('Not Started')
        .first()
        .or(managerPage.getByText(/No not started/))
    ).toBeVisible({ timeout: 5000 })

    // Click "Completed" filter
    await dashboard.filterByStatus('Completed').click()
    await expect(
      managerPage
        .getByText('Completed')
        .first()
        .or(managerPage.getByText(/No completed/))
    ).toBeVisible({ timeout: 5000 })

    // Click "All" filter — all leagues visible again
    await dashboard.filterByStatus('All').click()
    await expect(managerPage.locator('[class*="grid"] a, [class*="border"] a').first()).toBeVisible(
      {
        timeout: 5000,
      }
    )
  })
})
