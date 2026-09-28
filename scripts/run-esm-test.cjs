const { spawnSync } = require('node:child_process')

const testArgs = process.argv.slice(2)
if (testArgs.length === 0) {
  console.error('Usage: node scripts/run-esm-test.cjs <test-file> [...]')
  process.exit(2)
}

const nodeArgs = []
if (process.allowedNodeEnvironmentFlags.has('--experimental-default-type')) {
  nodeArgs.push('--experimental-default-type=module')
}
nodeArgs.push('--test', ...testArgs)

const result = spawnSync(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: process.env,
  windowsHide: true,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
