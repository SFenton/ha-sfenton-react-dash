import type { ReactNode } from 'react'
import styles from './SmoothRouteOutlet.module.css'

export type RouteTransitionState = 'entering' | 'exiting' | 'idle' | 'pre-entering'
type LeadingChromeTransition = 'changing' | 'stable'

interface SmoothRouteOutletProps {
  children: ReactNode
  leadingChromeTransition: LeadingChromeTransition
  routePath: string
  transitionState: RouteTransitionState
}

export function SmoothRouteOutlet({ children, leadingChromeTransition, routePath, transitionState }: SmoothRouteOutletProps) {
  return (
    <div className={styles.outlet} data-route-leading-chrome-transition={leadingChromeTransition} data-route-path={routePath} data-route-transition-state={transitionState}>
      <div className={styles.route}>{children}</div>
    </div>
  )
}
