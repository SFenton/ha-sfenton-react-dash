export function normalizedDynamicGridColumns(columns: number) {
  return Math.max(1, Math.floor(columns))
}

function normalizedSpan(span: number, columns: number) {
  return Math.min(columns, Math.max(1, Math.ceil(span)))
}

export function equivalentDynamicGridColumnCount(minimumSpans: readonly number[], columnCount: number) {
  const columns = normalizedDynamicGridColumns(columnCount)
  const widestSpan = minimumSpans.reduce(
    (widest, span) => Math.max(widest, normalizedSpan(span, columns)),
    1,
  )

  return Math.max(1, Math.floor(columns / widestSpan))
}

export function packDynamicGridSpans(minimumSpans: readonly number[], columnCount: number) {
  const columns = normalizedDynamicGridColumns(columnCount)
  const spans: number[] = []
  let itemIndex = 0

  while (itemIndex < minimumSpans.length) {
    const row: number[] = []
    let occupiedColumns = 0

    while (itemIndex < minimumSpans.length) {
      const span = normalizedSpan(minimumSpans[itemIndex], columns)
      if (row.length > 0 && occupiedColumns + span > columns) break
      row.push(span)
      occupiedColumns += span
      itemIndex += 1
    }

    let remainingColumns = columns - occupiedColumns
    let rowIndex = row.length - 1

    while (remainingColumns > 0) {
      if (row[rowIndex] < columns) {
        row[rowIndex] += 1
        remainingColumns -= 1
      }
      rowIndex = rowIndex === 0 ? row.length - 1 : rowIndex - 1
    }

    spans.push(...row)
  }

  return spans
}
