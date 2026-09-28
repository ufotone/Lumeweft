import test from 'node:test'
import assert from 'node:assert/strict'
import { createCanvasArchive, readCanvasArchive } from '../src/services/canvasWorkflowArchive.mjs'

test('CANVAS snapshot preserves graph and strips transient preview data', () => {
  const document = { name: 'My:Flow', nodes: [{ id: 'a', type: 'prompt', position: { x: 1, y: 2 }, data: { promptText: '日本語', _previewItems: ['blob:temp'], status: 'running' } }], edges: [], viewport: { x: 10, y: 20, zoom: 0.7 } }
  const archive = createCanvasArchive(document, new Date(2026, 8, 12, 10, 11, 12, 13))
  assert.equal(archive.filename, 'CANVAS_My_Flow_2026-09-12_10-11-12-013.canvas.json')
  const restored = readCanvasArchive(JSON.stringify(archive))
  assert.equal(restored.nodes[0].data.promptText, '日本語')
  assert.equal(restored.nodes[0].data._previewItems, undefined)
  assert.equal(restored.nodes[0].data.status, 'idle')
  assert.deepEqual(restored.viewport, document.viewport)
  assert.equal(document.nodes[0].data.status, 'running')
})

test('rejects ComfyUI graphs and broken CANVAS edges', () => {
  assert.throws(() => readCanvasArchive({ nodes: [], links: [] }), /CANVAS/)
  assert.throws(() => readCanvasArchive({ kind: 'lumeweft-canvas', schemaVersion: 1, document: { nodes: [], edges: [{ source: 'missing', target: 'missing' }] } }), /接続/)
})
