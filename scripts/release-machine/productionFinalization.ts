export async function finalizeProductionRelease(
  finalizeProduction: () => Promise<void>,
  cleanupRepository: () => Promise<void>,
) {
  let productionError: unknown
  try {
    await finalizeProduction()
  } catch (error) {
    productionError = error
  }
  try {
    await cleanupRepository()
  } catch (cleanupError) {
    throw new AggregateError(
      productionError ? [productionError, cleanupError] : [cleanupError],
      'Release finalization failed',
      { cause: cleanupError },
    )
  }
  if (productionError) throw productionError
}
