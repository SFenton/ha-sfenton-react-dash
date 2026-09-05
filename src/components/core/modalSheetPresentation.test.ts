import {
  modalBodyTierForInlineSize,
  modalSheetPresentationForViewport,
} from './modalSheetPresentation'

describe('modalSheetPresentationForViewport', () => {
  it('classifies portrait sheets, compact landscape dialogs, and full dialogs by available space', () => {
    expect(modalSheetPresentationForViewport(393, 852)).toBe('sheet')
    expect(modalSheetPresentationForViewport(568, 320)).toBe('landscape-dialog')
    expect(modalSheetPresentationForViewport(852, 393)).toBe('landscape-dialog')
    expect(modalSheetPresentationForViewport(820, 1180)).toBe('dialog')
    expect(modalSheetPresentationForViewport(1180, 820)).toBe('dialog')
    expect(modalSheetPresentationForViewport(1440, 500)).toBe('landscape-dialog')
  })

  it('classifies measured modal body widths into compact, fields, standard, and wide tiers', () => {
    expect(modalBodyTierForInlineSize(479)).toBe('compact')
    expect(modalBodyTierForInlineSize(480)).toBe('fields')
    expect(modalBodyTierForInlineSize(619)).toBe('fields')
    expect(modalBodyTierForInlineSize(620)).toBe('standard')
    expect(modalBodyTierForInlineSize(679)).toBe('standard')
    expect(modalBodyTierForInlineSize(680)).toBe('wide')
  })
})
