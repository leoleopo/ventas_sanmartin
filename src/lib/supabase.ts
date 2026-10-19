import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const MAX_ATTEMPTS = 6
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 15000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(input, init)

      if (response.ok || !isRetryableStatus(response.status)) {
        return response
      }

      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS))
    }
  }

  throw lastError ?? new Error('Request failed')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithRetry }
})

export async function pingDatabase(): Promise<boolean> {
  const { error } = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .limit(1)
  return !error
}
