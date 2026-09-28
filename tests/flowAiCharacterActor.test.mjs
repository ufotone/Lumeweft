import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

test('character builder and fixed-character movie are separate reusable flows', async () => {
  const source = await fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8')
  assert.match(source, /id: 'h3-character-builder'/)
  assert.match(source, /function buildH3CharacterBuilderTemplate\(\)/)
  assert.match(source, /function buildH3CharacterActorTemplate\(\)/)
  assert.match(source, /workflowId: 'minimax-h3-character-actor'/)
  assert.match(source, /sourceHandle: 'out:character'.*targetHandle: 'in:character'/)
  assert.equal((source.match(/targetHandle: 'in:face'/g) || []).length >= 2, true)

  const builder = source.split('function buildH3CharacterBuilderTemplate()')[1].split('function buildH3CharacterActorTemplate()')[0]
  const movie = source.split('function buildH3CharacterActorTemplate()')[1].split('function buildNsfwThreeReferenceVideoTemplate()')[0]
  assert.doesNotMatch(builder, /FLOW_AI_NODE_TYPES\.videoGen/)
  assert.match(movie, /FLOW_AI_NODE_TYPES\.characterInput/)
  assert.doesNotMatch(movie, /FLOW_AI_NODE_TYPES\.characterBuilder/)
})
