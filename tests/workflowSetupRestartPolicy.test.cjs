const test = require('node:test')
const assert = require('node:assert/strict')
const { shouldRestartComfyAfterWorkflowSetup } = require('../electron/workflowSetupRestartPolicy')

test('model tasks require a restart even when an existing file skipped download', () => {
  assert.equal(shouldRestartComfyAfterWorkflowSetup({ models: [{ skipped: true }] }), true)
  assert.equal(shouldRestartComfyAfterWorkflowSetup({ models: [{ skipped: false }] }), true)
})

test('only changed node packs require a restart', () => {
  assert.equal(shouldRestartComfyAfterWorkflowSetup({ nodePacks: [{ skipped: true }] }), false)
  assert.equal(shouldRestartComfyAfterWorkflowSetup({ nodePacks: [{ skipped: false }] }), true)
})
