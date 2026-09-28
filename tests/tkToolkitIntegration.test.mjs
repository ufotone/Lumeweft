import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  TK_TOOLKIT_NODE_CLASS,
  TK_TOOLKIT_PANEL_PATH,
  TK_TOOLKIT_REPOSITORY_URL,
  TK_TOOLKIT_WORKFLOW_ID,
} from '../src/services/tkToolkitIntegration.mjs'

test('TK Toolkit integration uses the published repository and stable ComfyUI surfaces', () => {
  assert.equal(TK_TOOLKIT_WORKFLOW_ID, 'tk-toolkit')
  assert.equal(TK_TOOLKIT_NODE_CLASS, 'TK Batch LoRA Loader')
  assert.equal(TK_TOOLKIT_REPOSITORY_URL, 'https://github.com/Ararararararaki/comfyui-anima-toolkit')
  assert.equal(TK_TOOLKIT_PANEL_PATH, '/extensions/ComfyUI-Anima-Batch-LoRA/app/')
})

test('TK Toolkit is registered for Workflow Setup and Backstage', () => {
  const installCatalog = readFileSync(new URL('../src/config/workflowInstallCatalog.js', import.meta.url), 'utf8')
  const dependencies = readFileSync(new URL('../src/config/workflowDependencyPacks.js', import.meta.url), 'utf8')
  const registry = readFileSync(new URL('../src/config/workflowRegistry.js', import.meta.url), 'utf8')
  const generateCatalog = readFileSync(new URL('../src/config/generateWorkflowCatalog.js', import.meta.url), 'utf8')

  assert.match(installCatalog, /id: 'tk-toolkit'[\s\S]*repoUrl: 'https:\/\/github\.com\/Ararararararaki\/comfyui-anima-toolkit'/)
  assert.match(dependencies, /'tk-toolkit': Object\.freeze\([\s\S]*classType: 'TK Batch LoRA Loader'/)
  assert.match(registry, /id: 'tk-toolkit'[\s\S]*capability: 'tool'/)
  assert.match(generateCatalog, /id: 'tk-toolkit'[\s\S]*presentation: 'comfy-tool'[\s\S]*workspace: 'backstage'/)
})
