import { test as base, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Fixtures = {
  managerPage: Page
  supabase: SupabaseClient
}

export const test = base.extend<Fixtures>({
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/manager.json',
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },

  supabase: async ({}, use) => {
    const url = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing E2E_SUPABASE_URL or E2E_SUPABASE_ANON_KEY env vars')
    }
    const client = createClient(url, key)
    await use(client)
  },
})

export { expect } from '@playwright/test'
