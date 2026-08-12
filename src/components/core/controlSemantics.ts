export type ControlSemantics =
  | { kind: 'static' }
  | { kind: 'command' }
  | { kind: 'toggle'; checked: boolean }
  | { kind: 'selection'; selected: boolean }
  | { kind: 'value'; text: string }
  | { kind: 'state'; text?: string }
  | { kind: 'navigate' }
  | { kind: 'modal' }
  | { kind: 'external' }

export function controlDisclosureTarget(semantics: ControlSemantics | undefined) {
  if (semantics?.kind === 'modal') return 'modal'
  if (semantics?.kind === 'navigate') return 'navigation'
  return null
}
