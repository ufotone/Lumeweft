import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const schemaSource = await fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8')
const workspaceSource = await fs.readFile(new URL('../src/components/FlowAIWorkspace.jsx', import.meta.url), 'utf8')
const japanese = JSON.parse(await fs.readFile(new URL('../public/lang/lang_jp.json', import.meta.url), 'utf8'))
const english = JSON.parse(await fs.readFile(new URL('../public/lang/lang_en.json', import.meta.url), 'utf8'))

const expectedCategories = new Set(['i2v', 't2v', 't2i', 'i2i', 'video-tools', 'audio', 'utility'])
const templateBlock = schemaSource.slice(
  schemaSource.indexOf('export const FLOW_AI_TEMPLATES'),
  schemaSource.indexOf('export const FLOW_AI_TEMPLATE_INFO'),
)
const templates = [...templateBlock.matchAll(/\{[\s\S]*?\}/g)].map(match => ({
  id: match[0].match(/id: '([^']+)'/)?.[1] || '',
  label: match[0].match(/label: '([^']+)'/)?.[1] || '',
  category: match[0].match(/category: '([^']+)'/)?.[1] || '',
  section: match[0].match(/section: '([^']+)'/)?.[1] || '',
})).filter(template => template.id)

test('CANVAS presets use the same seven purpose categories as Generate', () => {
  assert.deepEqual(new Set(templates.map(template => template.category)), expectedCategories)
  assert.match(workspaceSource, /FLOW_TEMPLATE_CATEGORIES/)
  assert.doesNotMatch(workspaceSource, /FLOW_ADVANCED_TEMPLATES|FLOW_NSFW_TEMPLATES/)
  assert.deepEqual(Object.keys(japanese.canvas.templateCategories), ['i2v', 't2v', 't2i', 'i2i', 'videoTools', 'audio', 'utility'])
  assert.deepEqual(Object.keys(english.canvas.templateCategories), ['i2v', 't2v', 't2i', 'i2i', 'videoTools', 'audio', 'utility'])
})

test('every NSFW preset has a visible NSFW prefix', () => {
  const nsfwTemplates = templates.filter(template => template.section === 'nsfw')
  assert.ok(nsfwTemplates.length > 0)
  for (const template of nsfwTemplates) {
    assert.match(template.label, /^\[NSFW\] /, template.id)
    assert.match(japanese.canvas.templates[template.id]?.label || '', /^\[NSFW\] /, `Japanese: ${template.id}`)
    assert.match(english.canvas.templates[template.id]?.label || '', /^\[NSFW\] /, `English: ${template.id}`)
  }
})

test('preset labels stay concise and identify the model or tool', () => {
  for (const template of templates) {
    assert.ok(template.label.length <= 36, `${template.id}: ${template.label}`)
  }
})
