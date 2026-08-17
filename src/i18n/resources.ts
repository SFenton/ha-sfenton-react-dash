import common from './locales/en.json' with { type: 'json' }
import core from './locales/en/core.json' with { type: 'json' }
import modalBathroomFan from './locales/en/modals/bathroomFan.json' with { type: 'json' }
import modalCamera from './locales/en/modals/camera.json' with { type: 'json' }
import modalRecipe from './locales/en/modals/recipe.json' with { type: 'json' }
import modalVacuum from './locales/en/modals/vacuum.json' with { type: 'json' }
import pageAdmin from './locales/en/pages/admin.json' with { type: 'json' }
import pageFood from './locales/en/pages/food.json' with { type: 'json' }
import pageGuests from './locales/en/pages/guests.json' with { type: 'json' }
import pageSecurity from './locales/en/pages/security.json' with { type: 'json' }
import pageSettings from './locales/en/pages/settings.json' with { type: 'json' }
import pageSpecialDeviceModes from './locales/en/pages/specialDeviceModes.json' with { type: 'json' }
import pageVacation from './locales/en/pages/vacation.json' with { type: 'json' }
import shell from './locales/en/shell.json' with { type: 'json' }

export const resources = {
  en: {
    common,
    core,
    modalBathroomFan,
    modalCamera,
    modalRecipe,
    modalVacuum,
    pageAdmin,
    pageFood,
    pageGuests,
    pageSecurity,
    pageSettings,
    pageSpecialDeviceModes,
    pageVacation,
    shell,
  },
} as const

export type CopyResources = typeof resources.en
export type CopyNamespace = keyof CopyResources
export const copyNamespaces = Object.keys(resources.en) as CopyNamespace[]
