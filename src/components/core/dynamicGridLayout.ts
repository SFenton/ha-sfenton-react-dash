export function normalizedDynamicGridColumns(columns: number) {
  return Math.max(1, Math.floor(columns))
}

export function responsiveDynamicGridColumnCount(
  containerWidth: number,
  gap: number,
  minimumColumns: number,
  maximumCellWidth: number,
  maximumColumns = 12,
) {
  const minimum = normalizedDynamicGridColumns(minimumColumns)
  const maximum = Math.max(minimum, normalizedDynamicGridColumns(maximumColumns))
  if (containerWidth <= 0 || maximumCellWidth <= 0) return minimum
  const requested = Math.ceil(
    (containerWidth + Math.max(0, gap))
      / (maximumCellWidth + Math.max(0, gap)),
  )
  return Math.max(minimum, Math.min(maximum, requested))
}

function normalizedSpan(span: number, columns: number) {
  return Math.min(columns, Math.max(1, Math.ceil(span)))
}

export function uniformDynamicGridColumnCount(
  requiredCellWidths: readonly number[],
  containerWidth: number,
  gap: number,
  columnCount: number,
  tolerance = 0,
) {
  const columns = normalizedDynamicGridColumns(columnCount)
  if (containerWidth <= 0 || requiredCellWidths.length === 0) return columns

  for (let candidateColumns = columns; candidateColumns > 1; candidateColumns -= 1) {
    const cellWidth = (
      containerWidth - Math.max(0, gap) * (candidateColumns - 1)
    ) / candidateColumns
    if (requiredCellWidths.every((requiredWidth) => requiredWidth <= cellWidth + tolerance)) {
      return candidateColumns
    }
  }

  return 1
}

export function packDynamicGridSpans(minimumSpans: readonly number[], columnCount: number, fill: 'all' | 'except-last' = 'all') {
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

    let remainingColumns = fill === 'except-last' && itemIndex === minimumSpans.length
      ? 0
      : columns - occupiedColumns
    let rowIndex = row.length - 1

    while (remainingColumns > 0) {
      if (fill === 'except-last') rowIndex = row.lastIndexOf(Math.min(...row))
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

export function centeredDynamicGridStarts(spans: readonly number[], columnCount: number) {
  const columns = normalizedDynamicGridColumns(columnCount)
  const starts = Array.from({ length: spans.length }, () => 0)
  const rows: Array<{ firstIndex: number; occupied: number }> = []
  let firstIndex = 0
  let occupied = 0

  spans.forEach((span, index) => {
    const normalized = normalizedSpan(span, columns)
    if (occupied > 0 && occupied + normalized > columns) {
      rows.push({ firstIndex, occupied })
      firstIndex = index
      occupied = 0
    }
    occupied += normalized
  })
  if (spans.length > 0) rows.push({ firstIndex, occupied })

  const lastRow = rows.at(-1)
  if (lastRow && lastRow.occupied < columns) {
    starts[lastRow.firstIndex] = Math.floor((columns - lastRow.occupied) / 2) + 1
  }

  return starts
}
