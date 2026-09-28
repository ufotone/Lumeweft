import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const repoUrl = new URL('../', import.meta.url)
const workflow = JSON.parse(await fs.readFile(new URL('public/workflows/minimax_h3_media_promptor.json', repoUrl), 'utf8'))
const dependencies = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installs = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')
const runtime = await fs.readFile(new URL('src/services/flowAiRuntime.js', repoUrl), 'utf8')
const comfyui = await fs.readFile(new URL('src/services/comfyui.js', repoUrl), 'utf8')

test('bundled H3 Promptor workflow uses the current v1.5 node schema', () => {
  assert.equal(workflow['1']?.class_type, 'H3_Vision')
  assert.equal(workflow['2']?.class_type, 'H3_Promptor')
  assert.ok(Object.hasOwn(workflow['2']?.inputs || {}, 'scene_direction'))
  assert.ok(!Object.hasOwn(workflow['2']?.inputs || {}, 'description'))
})

test('setup targets the current H3 Vision node schema', () => {
  assert.match(dependencies, /classType: 'H3_Vision'/)
  assert.doesNotMatch(dependencies, /H3_Vision_Analyzer/)
  assert.match(installs, /classTypes: \['H3_Vision', 'H3_Promptor'\]/)
  assert.doesNotMatch(installs, /H3_Vision_Analyzer/)
})

test('runtime uses only the current H3 schema', () => {
  assert.doesNotMatch(runtime, /H3_Vision_Analyzer/)
  assert.doesNotMatch(comfyui, /H3_Vision_Analyzer/)
  assert.match(comfyui, /node\.inputs\.scene_direction = description/)
})
