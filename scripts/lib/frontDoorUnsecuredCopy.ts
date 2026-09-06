// Home Assistant-owned wording produced by the repository's validated copy launcher.
export const frontDoorUnsecuredCopy = {
  action: 'Confirm: Lock Front Door',
  openSecurity: 'Open Security',
  titles: {
    unlocked: 'Front Door · Unlocked',
    pending: 'Front Door · Lock Pending',
    attention: 'Front Door · Needs Attention',
    failed: 'Front Door · Lock Not Confirmed',
    expired: 'Front Door · Lock Action Expired',
  },
  messages: {
    guest: 'Residents are away, and the front door is unlocked and closed. Guest mode is active and intentionally pauses automatic locking. Open Security to review the door.',
    away: 'Residents are away, and the front door is unlocked and closed. Guest mode is off. Lock the door or open Security to review it.',
    uncertain: 'Residents are away, and the front door is unlocked and closed. Guest mode could not be confirmed. Open Security to review the door.',
    armedAway: 'Residents are away, the security system is armed Away, and the front door is unlocked and closed. Lock the door or open Security to review it.',
    pending: 'A front-door lock request was sent, but locking is not yet confirmed. Confirmation is pending. Open Security to review the door.',
    open: 'The front door is now open during the unresolved incident. The notification lock action is unavailable while the door is open. Open Security to review the door.',
    unavailable: 'The front-door lock status cannot be confirmed during the unresolved incident. Open Security to check the lock.',
    failed: 'The front-door lock request was not confirmed within 20 seconds. There will be no automatic retry. Open Security to check the door or retry locking.',
    expired: 'The notification lock action expired after 30 minutes, and the front door is not confirmed secured. Open Security to review the door or lock it.',
    changing: 'The front-door lock is changing state and is not yet confirmed locked. The notification lock action is unavailable until the state is known. Open Security to review.',
    cancelled: 'The front door lock command was not sent because the door or lock conditions changed. Open Security to review the current status. No automatic retry will occur.',
    jammed: 'The front door lock is jammed. Open Security to review it.',
  },
} as const
