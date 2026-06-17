import { modalSquareGridModalStyle, modalSquareGridModalStyleForHash } from './modalSquareGrid'

describe('modal square grid sizing', () => {
  it('sizes desktop square-grid modals to the card rows plus modal chrome', () => {
    expect(modalSquareGridModalStyle({ cardSize: 168, columns: 3, modalWidth: 590, rows: 2 })).toEqual({
      '--modal-desktop-width': '590px',
      '--modal-desktop-height': '493px',
    })
  })

  it('keeps AQI on auto height because its room cards have dynamic copy', () => {
    expect(modalSquareGridModalStyleForHash('#aqi-overview', { cardSize: 168, columns: 3, modalWidth: 590, rows: 2 })).toEqual({
      '--modal-desktop-width': '590px',
      '--modal-desktop-height': 'auto',
    })
  })
})
