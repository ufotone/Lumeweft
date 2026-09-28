import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const source = await fs.readFile(new URL('../src/components/FlowAIWorkspace.jsx', import.meta.url), 'utf8')

test('CANVAS image previews contain the full image without cover cropping or drift zoom', () => {
  assert.match(source, /className="relative h-full w-full object-contain p-1"/)
  assert.doesNotMatch(source, /flow-ai-preview-drift/)
  assert.doesNotMatch(source, /className="flow-ai-preview-drift h-full w-full object-cover"/)
})

test('generation and output nodes retain up to six individual preview assets', () => {
  assert.match(source, /const FLOW_NODE_PREVIEW_MAX_OUTPUT_ITEMS = 6/)
  assert.match(source, /const items = buildOutputPreviewItems\(outputAssetIds, assetById\)/)
  assert.match(source, /if \(previewItems\.length > 1\)/)
  assert.match(source, /className="mt-3 grid grid-cols-2 gap-2"/)
})
