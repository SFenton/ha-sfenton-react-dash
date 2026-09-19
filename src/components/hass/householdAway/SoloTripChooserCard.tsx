import type { HouseholdAwaySnapshot } from './householdAwayContract'
import { Card, type CardColor } from '../../core/Card'
import { MaterialIcon } from '../../core/Icon'
import { useCopy, SOLO_TRIP_COPY_KEYS as C, SOLO_TRIP_COPY_NAMESPACE } from '../../../i18n'

const SOLO_TRIP_COLOR: CardColor = { r: 91, g: 141, b: 239 }

/** Idle-page option tile: opens the Solo Trip editor. Hidden once Vacation or Solo Trip is engaged. */
export function SoloTripChooserCard({ onOpen, snapshot }: { onOpen: () => void; snapshot: HouseholdAwaySnapshot }) {
  const copy = useCopy(SOLO_TRIP_COPY_NAMESPACE)
  const unavailable = !snapshot.available || !snapshot.commandAvailable
  return (
    <Card
      ariaLabel={copy(C.chooser.soloTrip)}
      color={SOLO_TRIP_COLOR}
      disclosure
      icon={<MaterialIcon name="mdi:bag-suitcase" size={38} />}
      muted={unavailable}
      onClick={onOpen}
      semantics={{ kind: 'modal' }}
      size="wide"
      subtitle={copy(unavailable ? C.chooser.setupRequiredSubtitle : C.chooser.soloTripSubtitle)}
      title={copy(C.chooser.soloTrip)}
    />
  )
}
