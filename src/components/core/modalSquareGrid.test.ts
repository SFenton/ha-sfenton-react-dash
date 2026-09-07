import { modalSquareGridCenteredGeometry, modalSquareGridLayout } from './modalSquareGrid'

describe('modal square grid geometry', () => {
  it('creates viewport-independent centered geometry from the balanced card count', () => {
    expect(modalSquareGridCenteredGeometry('room-grid', 16)).toEqual({
      blockPolicy: 'fixed',
      blockSize: '849px',
      id: 'room-grid',
      inlineSize: '766px',
    })
  })

  it('distributes landscape row width equally instead of leaving fixed 132px tracks', () => {
    expect(modalSquareGridLayout(16, 675, 'landscape-dialog')).toEqual({
      cardSize: 158.25,
      columns: 4,
      modalWidth: 727,
      rows: 4,
    })
  })

  it('keeps incomplete state groups the same size as full rows', () => {
    const full = modalSquareGridLayout(16, 675, 'landscape-dialog')
    for (const count of [1, 2, 3, 4, 7, 13]) {
      const group = modalSquareGridLayout(count, 675, 'landscape-dialog')
      expect(group.cardSize).toBe(full.cardSize)
      expect(group.columns).toBe(4)
      expect(group.rows).toBe(Math.ceil(count / 4))
    }
  })

  it.each([
    [285, 1, 273],
    [286, 2, 132],
    [287, 2, 132.5],
    [711, 4, 167.25],
    [712, 5, 132],
    [713, 5, 132.2],
    [1206, 8, 140.5],
  ])('reflows at actual available track boundaries for %ipx', (width, columns, cardSize) => {
    const layout = modalSquareGridLayout(16, width, 'landscape-dialog')
    expect(layout.columns).toBe(columns)
    expect(layout.cardSize).toBeCloseTo(cardSize)
  })

  it('supports the compact navigation grid without adding square-grid edge gutters', () => {
    const layout = modalSquareGridLayout(7, 691, 'landscape-dialog', 0)
    expect(layout.columns).toBe(4)
    expect(layout.cardSize).toBe(165.25)
  })

  it('retains 168px dialog tracks and never changes portrait sizing', () => {
    expect(modalSquareGridLayout(16, 675, 'dialog').cardSize).toBe(168)
    expect(modalSquareGridLayout(16, 359, 'sheet').cardSize).toBe(168)
  })
})
