import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import ts from 'typescript'

function componentName(node: ts.Node) {
  let owner: ts.Node | undefined = node.parent
  while (owner) {
    if (ts.isFunctionDeclaration(owner) && owner.name) return owner.name.text
    if (ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name) && owner.initializer
      && (ts.isArrowFunction(owner.initializer) || ts.isFunctionExpression(owner.initializer))) return owner.name.text
    owner = owner.parent
  }
  return '<module>'
}

export function callsites(source: string, filename: string) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = new Set(['ModalSheet'])
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.endsWith('/ModalSheet')) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === 'ModalSheet') names.add(binding.name.text)
    }
  }
  const sheets: Record<string, number> = {}
  const pickers: string[] = []
  const visit = (node: ts.Node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
    if (opening) {
      const tag = opening.tagName.getText(file)
      const id = `${filename}:${componentName(opening)}`
      if (names.has(tag)) sheets[id] = (sheets[id] ?? 0) + 1
      if (tag === 'OptionPickerDialog' && opening.attributes.properties.some((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'presentation'
        && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === 'sheet')) pickers.push(id)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { sheets, pickers }
}

function independentExpected(source: string) {
  const file = ts.createSourceFile('oracle.ts', source, ts.ScriptTarget.Latest, true)
  let sheets: Record<string, number> | undefined
  let pickers: string[] | undefined
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue
      if (declaration.name.text === 'EXPECTED_PHYSICAL_MODAL_CALLSITES' && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
        sheets = {}
        for (const property of declaration.initializer.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name) || !ts.isNumericLiteral(property.initializer)) throw new Error('Physical callsite oracle must remain explicit reviewed literals')
          sheets[property.name.text] = Number(property.initializer.text)
        }
      }
      if (declaration.name.text === 'EXPECTED_OPTION_PICKER_CONSUMERS' && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer)) {
        pickers = declaration.initializer.elements.map((element) => {
          if (!ts.isStringLiteral(element)) throw new Error('Picker consumer oracle must remain explicit reviewed literals')
          return element.text
        })
      }
    }
  }
  if (!sheets || !pickers) throw new Error('Missing independent modal source oracle')
  return { sheets, pickers }
}

export function assertSourceInventory(root: string) {
  const expected = independentExpected(readFileSync(resolve(root, 'e2e/responsive-modal-inventory.spec.ts'), 'utf8'))
  const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return path === resolve(root, 'src/test') ? [] : walk(path)
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : []
  })
  const sheets: Record<string, number> = {}
  const pickers: string[] = []
  for (const path of walk(resolve(root, 'src'))) {
    const observed = callsites(readFileSync(path, 'utf8'), relative(root, path).replaceAll('\\', '/'))
    Object.assign(sheets, observed.sheets)
    pickers.push(...observed.pickers)
  }
  const changed = [...new Set([...Object.keys(expected.sheets), ...Object.keys(sheets)])]
    .filter((id) => expected.sheets[id] !== sheets[id])
  if (changed.length || JSON.stringify(pickers.sort()) !== JSON.stringify(expected.pickers.sort())) {
    throw new Error(`Source inventory drift: ${changed.join(', ') || 'OptionPicker consumers'}. Update the independent reviewed oracle AND executable surface/state bindings; do not generate expectations from this scan.`)
  }
}
