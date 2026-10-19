// Respaldo del keep-alive de Supabase.
//
// GitHub Actions ya pingea cada 6 horas, pero sus cron se deshabilitan
// solos en repos publicos sin actividad. Este cron de Vercel no depende de
// GitHub, asi que cubre ese escenario.
//
// Supabase pausa los proyectos del plan Free tras 7 dias sin actividad en la
// base de datos. Solo cuentan las queries que llegan a Postgres: por eso se
// consultan tablas reales y no /rest/v1/ (que exige service_role y nunca
// ejecuta SQL contra la base).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vzzmuavylibrdswzagfp.supabase.co'
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_k2qX6MNFfC0r5qFHPKwnpQ_Mg92JzbS'

const TABLES = ['productos', 'pedidos']

export default async function handler(req, res) {
  const results = []

  for (const table of TABLES) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`

    try {
      const response = await fetch(url, {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(20000),
      })

      // 2xx: la query corrio. 401/403: RLS la denies, pero la query igual
      // llego a Postgres, asi que tambien cuenta como actividad.
      const ok = response.ok || response.status === 401 || response.status === 403
      results.push({ table, status: response.status, ok })
    } catch (error) {
      results.push({ table, error: String(error), ok: false })
    }
  }

  const allOk = results.every((r) => r.ok)
  const summary = results.map((r) => `${r.table}:${r.status ?? 'error'}`).join(' ')

  console.log(`[keepalive] ${summary}`)

  res.status(allOk ? 200 : 502).json({ ok: allOk, results })
}
