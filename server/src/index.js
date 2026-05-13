import 'dotenv/config'
import cors from 'cors'
import express from 'express'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

function parseAllowedOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173'
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const allowedOrigins = parseAllowedOrigins()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      console.warn('[cors] blocked:', origin)
      return callback(null, false)
    },
    credentials: true,
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'openai-proxy' })
})

app.post('/v1/chat/completions', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'Server misconfiguration: OPENAI_API_KEY is missing' },
    })
  }

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body ?? {}),
    })

    const contentType =
      upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.status(upstream.status).setHeader('Content-Type', contentType).send(buf)
  } catch (err) {
    console.error('[proxy]', err)
    res.status(502).json({
      error: {
        message: err instanceof Error ? err.message : 'Upstream request failed',
      },
    })
  }
})

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  console.log(`[openai-proxy] http://localhost:${port}`)
  console.log(`[openai-proxy] POST /v1/chat/completions → OpenAI`)
  console.log(`[openai-proxy] allowed CORS origins (${allowedOrigins.length}):`, allowedOrigins.join(', ') || '(none)')
})
