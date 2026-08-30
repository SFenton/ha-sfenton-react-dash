import { createContext, useContext } from 'react'
import { navigationLayoutForViewport, type NavigationLayout } from '../../constants/navigationLayout'

export const NavigationLayoutContext = createContext<NavigationLayout>(navigationLayoutForViewport({ height: 0, width: 0 }))

export function useNavigationLayout() {
  return useContext(NavigationLayoutContext)
}
