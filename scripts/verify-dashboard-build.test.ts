import { verifyBackdropDeclarations } from './verify-dashboard-build.mjs'

describe('built backdrop declarations', () => {
  it('accepts standard declarations and correctly ordered vendor fallbacks', () => {
    expect(() => verifyBackdropDeclarations('.overlay{backdrop-filter:blur(10px)}')).not.toThrow()
    expect(() => verifyBackdropDeclarations(
      '@media (max-width:759px){.overlay{-webkit-backdrop-filter:var(--blur-modal);backdrop-filter:var(--blur-modal)}}',
    )).not.toThrow()
  })

  it('rejects the minified prefix-only regression', () => {
    expect(() => verifyBackdropDeclarations(
      '.overlay{background:black;-webkit-backdrop-filter:var(--blur-modal)}',
      'app.css',
    )).toThrow('app.css contains a prefixed backdrop-filter without the standard declaration')
  })

  it('checks fallback and keyframe rules independently', () => {
    expect(() => verifyBackdropDeclarations(
      '.overlay{backdrop-filter:blur(10px)}@keyframes fade{from{-webkit-backdrop-filter:blur(0)}to{backdrop-filter:blur(10px)}}',
    )).toThrow('prefixed backdrop-filter without the standard declaration')
  })
})
