import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { modifyMinimaxH3CharacterActorWorkflow } from '../src/services/minimaxH3CharacterActorWorkflow.mjs'

test('converts the lightweight Ref2VA graph to image-only character generation', async () => {
  const graph = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_gguf_r2v.json', import.meta.url), 'utf8'))
  const modified = modifyMinimaxH3CharacterActorWorkflow(graph, { prompt: 'walk', referenceImages: ['face.png', 'body.png'], width: 608, height: 352, duration: 5 })
  assert.equal(modified['1'], undefined)
  assert.equal(modified['6'].inputs['ref_videos.ref_video_0'], undefined)
  assert.deepEqual(modified['6'].inputs['ref_images.ref_image_1'], ['h3_ref_1', 0])
  assert.equal(modified['10'].inputs.steps, 8)
})
