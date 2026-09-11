import { validateRegressionDirectory } from './regressions'

const result = await validateRegressionDirectory(process.cwd())
if (result.failures.length) {
  console.error(result.failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${result.files} learned light conversation regression fixture(s).`)
}
