import common from './locales/en.json' with { type: 'json' }
import core from './locales/en/core.json' with { type: 'json' }
import modalCamera from './locales/en/modals/camera.json' with { type: 'json' }
import pageAdmin from './locales/en/pages/admin.json' with { type: 'json' }
import pageFood from './locales/en/pages/food.json' with { type: 'json' }
import pageGuests from './locales/en/pages/guests.json' with { type: 'json' }
import pageSecurity from './locales/en/pages/security.json' with { type: 'json' }
import pageSettings from './locales/en/pages/settings.json' with { type: 'json' }
import pageVacation from './locales/en/pages/vacation.json' with { type: 'json' }
import shell from './locales/en/shell.json' with { type: 'json' }

export const resources = {
  en: {
    common,
    core,
    modalCamera,
    pageAdmin,
    pageFood,
    pageGuests,
    pageSecurity,
    pageSettings,
    pageVacation,
    shell,
  },
} as const

export type CopyResources = typeof resources.en
export type CopyNamespace = keyof CopyResources
export const copyNamespaces = Object.keys(resources.en) as CopyNamespace[]
