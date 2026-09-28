import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const workspaceSource = await fs.readFile(new URL('../src/components/FlowAIWorkspace.jsx', import.meta.url), 'utf8')
const appSource = await fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const schemaSource = await fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8')

test('new CANVAS projects still start on Blank Canvas', () => {
  assert.match(schemaSource, /createDefaultFlowAiProjectData\(\)[\s\S]*name: 'Blank Canvas'[\s\S]*templateId: 'blank'/)
})

test('a recipe template request is consumed once instead of continuously forcing AfterMidnightR2V', () => {
  assert.match(workspaceSource, /consumedTemplateRequestRef\.current === requestId/)
  assert.match(workspaceSource, /consumedTemplateRequestRef\.current = requestId/)
  assert.match(workspaceSource, /documentBeforeTemplateRequestRef\.current = activeDocumentId/)
})

test('leaving a recipe restores the document that was active before it opened', () => {
  assert.match(workspaceSource, /if \(!requestId\)[\s\S]*previousDocumentId[\s\S]*setActiveDocumentId\(previousDocumentId\)/)
})

test('explicit title-bar navigation clears temporary recipe requests', () => {
  assert.match(appSource, /const handleMainTabChange = useCallback[\s\S]*setFlowAiTemplateRequest\(null\)[\s\S]*setMainTab\(tabId\)/)
  assert.match(appSource, /onTabChange=\{handleMainTabChange\}/)
})
