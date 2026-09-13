import { readFile } from 'node:fs/promises'
import { validateRegressionDirectory, validateRegressionFixture } from './regressions'
import type { LightRegressionFixture } from './types'

const fixtureIndex = process.argv.indexOf('--fixture')
if (fixtureIndex >= 0) {
  const path = process.argv[fixtureIndex + 1]
  if (!path) throw new Error('Provide a fixture path after --fixture')
  const fixture = JSON.parse(await readFile(path, 'utf8')) as LightRegressionFixture
  const failures = validateRegressionFixture(fixture)
  if (!failures.length) {
    console.error('The proposed learned regression already passes on the base parser')
    process.exitCode = 1
  } else {
    console.log(JSON.stringify(failures))
  }
} else {
  const result = await validateRegressionDirectory(process.cwd())
  if (result.failures.length) {
    console.error(result.failures.join('\n'))
    process.exitCode = 1
  } else {
    console.log(`Validated ${result.files} learned light conversation regression fixture(s).`)
  }
}
