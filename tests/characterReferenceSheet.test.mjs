import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

import {
  getCharacterReferenceSheetLayout,
  getContainedImageRect,
} from '../src/services/characterReferenceSheet.mjs'

test('eight character angles form a 4 by 2 reference sheet', () => {
  assert.deepEqual(getCharacterReferenceSheetLayout(8), {
    count: 8,
    columns: 4,
    rows: 2,
    cellSize: 512,
    width: 2048,
    height: 1024,
  })
})

test('contained images remain centered without cropping', () => {
  assert.deepEqual(getContainedImageRect(1024, 2048, 0, 0, 512, 12), {
    x: 134,
    y: 12,
    width: 244,
    height: 488,
  })
})

test('LoRA recipes create and retain the combined reference separately from dataset export', async () => {
  const workspaceSource = await fs.readFile(new URL('../src/components/FlowAIWorkspace.jsx', import.meta.url), 'utf8')
  assert.match(workspaceSource, /characterReferenceAssetId/)
  assert.match(workspaceSource, /kind: 'character-reference-sheet'/)
  assert.match(workspaceSource, /result\.importedAssetIds\.slice\(-8\)/)
  assert.match(workspaceSource, /await createCharacterReferenceFromAssets[\s\S]*?await handleLaunchInstalledFactory/)
  assert.doesNotMatch(workspaceSource, /exportLoraAssetsToDirectory\(\{[\s\S]{0,200}characterReferenceAssetId/)
})
