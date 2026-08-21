import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGenerationArtifact, safeArtifactFilename } from './generationArtifactExport.js'

test('builds a versioned Lumeweft recipe artifact without mutating its source', () => {
  const source = { id: 'recipe-1', title: 'Portrait', recipe: { settings: { steps: 8 } } }
  const artifact = buildGenerationArtifact('recipe', source, '2026-08-21T00:00:00.000Z')
  artifact.data.recipe.settings.steps = 12

  assert.equal(artifact.format, 'lumeweft-generation-recipe')
  assert.equal(artifact.version, 1)
  assert.equal(source.recipe.settings.steps, 8)
})

test('sanitizes Windows-forbidden filename characters', () => {
  assert.equal(safeArtifactFilename('Shot: 01 / hero?'), 'Shot 01 hero')
})
