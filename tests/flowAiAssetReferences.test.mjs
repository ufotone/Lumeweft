import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  removeFlowAssetReferences,
  removeFlowProjectAssetReferences,
} from '../src/services/flowAiAssetReferences.mjs'

test('removes every CANVAS node reference to a deleted asset', () => {
  const nodes = [
    {
      id: 'input',
      data: {
        assetId: 'asset-delete',
        assetLabel: 'source.png',
        status: 'done',
        error: 'old error',
        statusMessage: 'complete',
      },
    },
    {
      id: 'output',
      data: {
        outputAssetIds: ['asset-keep', 'asset-delete'],
        resolvedAssetIds: ['asset-delete'],
        characterReferenceAssetId: 'asset-delete',
        sourceAssetIds: ['asset-delete', 'asset-keep'],
      },
    },
  ]

  const result = removeFlowAssetReferences(nodes, 'asset-delete')

  assert.deepEqual(result[0].data, {
    assetId: '',
    assetLabel: '',
    status: 'idle',
    error: '',
    statusMessage: '',
  })
  assert.deepEqual(result[1].data, {
    outputAssetIds: ['asset-keep'],
    resolvedAssetIds: [],
    characterReferenceAssetId: '',
    sourceAssetIds: ['asset-keep'],
  })
  assert.equal(nodes[0].data.assetId, 'asset-delete', 'input remains immutable')
})

test('uses live active-document nodes and clears references in every document', () => {
  const project = {
    activeDocumentId: 'doc-a',
    documents: [
      { id: 'doc-a', nodes: [{ id: 'stale', data: { assetId: 'old' } }] },
      { id: 'doc-b', nodes: [{ id: 'other', data: { outputAssetIds: ['old'] } }] },
    ],
  }
  const liveNodes = [{ id: 'live', data: { assetId: 'old', assetLabel: 'old.png' } }]

  const result = removeFlowProjectAssetReferences(project, 'old', 'doc-a', liveNodes)

  assert.equal(result.documents[0].nodes[0].id, 'live')
  assert.equal(result.documents[0].nodes[0].data.assetId, '')
  assert.deepEqual(result.documents[1].nodes[0].data.outputAssetIds, [])
})

test('returns the same node collection when the asset is not referenced', () => {
  const nodes = [{ id: 'input', data: { assetId: 'keep' } }]
  assert.equal(removeFlowAssetReferences(nodes, 'missing'), nodes)
})

test('CANVAS asset deletion remains available while a flow is running', async () => {
  const source = await readFile(
    new URL('../src/components/FlowAIWorkspace.jsx', import.meta.url),
    'utf8',
  )
  const handler = source.slice(
    source.indexOf('const handleDeleteBrowserAsset'),
    source.indexOf('const handleDeleteBrowserAsset') + 500,
  )
  const deleteButton = source.slice(
    source.indexOf('title="素材を削除"') - 500,
    source.indexOf('title="素材を削除"') + 300,
  )

  assert.doesNotMatch(handler, /assetPendingDeletion\s*\|\|\s*isRunning/)
  assert.doesNotMatch(deleteButton, /disabled=\{isRunning\}/)
  assert.match(deleteButton, /onPointerDown=/)
})

test('confirmation dialogs render outside clipped workspace containers', async () => {
  const source = await readFile(
    new URL('../src/components/ConfirmDialog.jsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /createPortal\(dialog, document\.body\)/)
})
