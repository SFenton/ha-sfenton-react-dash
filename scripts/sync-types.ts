import { typeSync } from '@hakit/core/sync'
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.development' })

await typeSync({
  url: process.env.VITE_HA_URL!,
  token: process.env.VITE_HA_TOKEN!,
})