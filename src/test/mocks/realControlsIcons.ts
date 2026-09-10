import { addCollection } from '@iconify/react'
import * as paths from '@mdi/js'

// Use the installed icon paths instead of external Iconify requests in guarded previews.
addCollection({
  prefix: 'mdi',
  width: 24,
  height: 24,
  icons: Object.fromEntries(Object.entries(paths).filter(([name]) => /^mdi[A-Z]/.test(name)).map(([name, path]) => [
    name.slice(3).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase(),
    { body: `<path d="${path}"/>` },
  ])),
})
