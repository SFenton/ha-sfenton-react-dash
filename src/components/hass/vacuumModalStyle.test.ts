import { describe, expect, it } from 'vitest'
import { VACUUM_AREA_EDITOR_MODAL_STYLE, VACUUM_MODAL_STYLE } from './vacuumModalStyle'

describe('VACUUM_MODAL_STYLE', () => {
  it('lets desktop vacuum modals grow to fit the map and status pane', () => {
    expect(VACUUM_MODAL_STYLE).toMatchObject({
      '--modal-desktop-body-overflow-y': 'hidden',
      '--modal-desktop-height': 'auto',
      '--modal-desktop-max-width': '980px',
      '--modal-desktop-width': '980px',
    })
    expect(VACUUM_MODAL_STYLE).not.toHaveProperty('--modal-desktop-max-height')
  })

  it('locks body scrolling while the map editor owns touch gestures', () => {
    expect(VACUUM_AREA_EDITOR_MODAL_STYLE).toMatchObject({
      '--modal-body-overflow-y': 'hidden',
      '--modal-desktop-body-overflow-y': 'hidden',
      '--modal-desktop-height': 'min(760px, calc(100dvh - 64px))',
      '--modal-desktop-max-width': '980px',
    })
  })
})
