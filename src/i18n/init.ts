import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { APP_LANGUAGE } from './formatters'
import { copyNamespaces, resources } from './resources'

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      defaultNS: 'common',
      fallbackLng: APP_LANGUAGE,
      initAsync: false,
      interpolation: {
        escapeValue: false,
      },
      lng: APP_LANGUAGE,
      ns: copyNamespaces,
      react: {
        bindI18n: false,
        bindI18nStore: false,
        useSuspense: false,
      },
      resources,
      returnEmptyString: false,
      returnNull: false,
      saveMissing: false,
      supportedLngs: [APP_LANGUAGE],
    })
}

export default i18n
