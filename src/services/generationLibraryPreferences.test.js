import test from 'node:test'
import assert from 'node:assert/strict'

import { readCollapsedIds, writeCollapsedIds } from './generationLibraryPreferences.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('persists and restores collapsed generation item ids', () => {
  const storage = memoryStorage()
  assert.equal(writeCollapsedIds(storage, 'collapsed', new Set(['a', 'b'])), true)
  assert.deepEqual([...readCollapsedIds(storage, 'collapsed')], ['a', 'b'])
})

test('returns an empty set for invalid stored preferences', () => {
  const storage = memoryStorage({ collapsed: '{invalid' })
  assert.deepEqual([...readCollapsedIds(storage, 'collapsed')], [])
})

