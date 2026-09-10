const QUIET_FOCUS_ATTRIBUTE = 'data-rd-quiet-focus'
const LEGACY_IME_KEY_CODE = 229
const installations = new WeakMap<Document, () => void>()
const navigationKeys = new Set([
  'Tab', 'Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
])
const nonTextInputTypes = new Set([
  'button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden',
])

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const control = target.closest('input, textarea, [contenteditable], [role="textbox"]')
  if (control instanceof HTMLInputElement) return !nonTextInputTypes.has(control.type)
  if (control instanceof HTMLTextAreaElement) return true
  return control !== null && control.getAttribute('contenteditable') !== 'false'
}

/** Preserve browser focus ownership while quieting decoration after pointer input. */
export function installFocusAppearance(doc: Document = document) {
  const installed = installations.get(doc)
  if (installed) return installed

  const root = doc.documentElement
  const previousAttribute = root.getAttribute(QUIET_FOCUS_ATTRIBUTE)
  const quiet = () => root.setAttribute(QUIET_FOCUS_ATTRIBUTE, '')
  const keyboard = () => root.removeAttribute(QUIET_FOCUS_ATTRIBUTE)
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === LEGACY_IME_KEY_CODE || !navigationKeys.has(event.key)) return
    if (isTextEntry(event.target) && event.key !== 'Tab' && event.key !== 'Escape') return
    keyboard()
  }
  const onClick = (event: MouseEvent) => {
    if (event.isTrusted && event.detail === 0 && !(event as PointerEvent).pointerType) keyboard()
  }

  quiet()
  doc.addEventListener('pointerdown', quiet, { capture: true, passive: true })
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('click', onClick, true)

  const dispose = () => {
    doc.removeEventListener('pointerdown', quiet, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('click', onClick, true)
    if (previousAttribute === null) keyboard()
    else root.setAttribute(QUIET_FOCUS_ATTRIBUTE, previousAttribute)
    installations.delete(doc)
  }
  installations.set(doc, dispose)
  return dispose
}
