import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {
  planGenerationHistoryDeletion,
  planGenerationResultDeletion,
} from '../src/services/generationResultDeletion.js'

const generateWorkspaceSource = await fs.readFile(
  new URL('../src/components/GenerateWorkspace.jsx', import.meta.url),
  'utf8',
)
const generationLibrarySource = await fs.readFile(
  new URL('../src/components/generate/GenerationLibrary.jsx', import.meta.url),
  'utf8',
)

test('generation result deletion removes owned files and its complete history version', () => {
  const plan = planGenerationResultDeletion({
    job: { resultAssetIds: ['result-a', 'result-b'] },
    assets: [
      { id: 'result-a', path: 'assets/audio/a.flac', proxyPath: 'cache/a.mp3', url: 'blob:a' },
      { id: 'result-b', path: 'assets/audio/b.flac', absolutePath: 'C:/duplicate/b.flac' },
      { id: 'input', path: 'assets/audio/reference.wav' },
    ],
    historyRecords: [{
      id: 'record-1',
      versions: [{ id: 'version-1', outputAssetIds: ['result-a', 'result-b'] }],
    }],
  })

  assert.deepEqual(plan.assetIds, ['result-a', 'result-b'])
  assert.deepEqual(plan.relativePaths, ['assets/audio/a.flac', 'cache/a.mp3', 'assets/audio/b.flac'])
  assert.deepEqual(plan.absolutePaths, [])
  assert.deepEqual(plan.historyVersions, [{ recordId: 'record-1', versionId: 'version-1' }])
})

test('generation result deletion keeps shared files, inputs, and partially matched history versions', () => {
  const plan = planGenerationResultDeletion({
    job: { resultAssetIds: ['result'] },
    assets: [
      { id: 'result', path: 'assets/video/shared.mp4', poster: { posterPath: 'C:/cache/shared.jpg' } },
      { id: 'other', path: 'assets/video/shared.mp4', poster: { posterPath: 'C:/cache/shared.jpg' } },
      { id: 'input', path: 'assets/images/reference.png' },
    ],
    historyRecords: [{
      id: 'record-1',
      versions: [{ id: 'version-1', outputAssetIds: ['result', 'other'] }],
    }],
  })

  assert.deepEqual(plan.relativePaths, [])
  assert.deepEqual(plan.absolutePaths, [])
  assert.deepEqual(plan.historyVersions, [])
  assert.equal(plan.assetIds.includes('input'), false)
})

test('failed generation without outputs produces a history-only empty plan', () => {
  const plan = planGenerationResultDeletion({ job: { status: 'error' }, assets: [] })
  assert.deepEqual(plan.assetIds, [])
  assert.deepEqual(plan.relativePaths, [])
  assert.deepEqual(plan.absolutePaths, [])
})

test('history version deletion protects outputs shared by an unselected version', () => {
  const historyRecords = [{
    id: 'record-1',
    versions: [
      { id: 'version-1', outputAssetIds: ['unique-a', 'shared'] },
      { id: 'version-2', outputAssetIds: ['shared', 'unique-b'] },
    ],
  }]
  const plan = planGenerationHistoryDeletion({
    versionRefs: [{ recordId: 'record-1', versionId: 'version-1' }],
    assets: [
      { id: 'unique-a', path: 'assets/a.png' },
      { id: 'shared', path: 'assets/shared.png' },
      { id: 'unique-b', path: 'assets/b.png' },
    ],
    historyRecords,
  })

  assert.deepEqual(plan.assetIds, ['unique-a'])
  assert.deepEqual(plan.relativePaths, ['assets/a.png'])
  assert.deepEqual(plan.historyVersions, [{ recordId: 'record-1', versionId: 'version-1' }])
})

test('whole history record deletion includes all unshared output assets', () => {
  const historyRecords = [{
    id: 'record-1',
    versions: [
      { id: 'version-1', outputAssetIds: ['a'] },
      { id: 'version-2', outputAssetIds: ['b'] },
    ],
  }]
  const plan = planGenerationHistoryDeletion({
    recordIds: ['record-1'],
    assets: [{ id: 'a', path: 'assets/a.png' }, { id: 'b', path: 'assets/b.png' }],
    historyRecords,
  })

  assert.deepEqual(plan.assetIds, ['a', 'b'])
  assert.equal(plan.historyVersions.length, 2)
})

test('Generate queue exposes the per-result file deletion action for terminal jobs', () => {
  assert.match(generateWorkspaceSource, /const handleDeleteGenerationResult = useCallback/)
  assert.match(generateWorkspaceSource, /deleteProjectFile\(currentProjectHandle, relativePath\)/)
  assert.match(generateWorkspaceSource, /plan\.assetIds\.forEach\(\(assetId\) => assetsState\.removeAsset\(assetId\)\)/)
  assert.match(generateWorkspaceSource, /plan\.historyVersions\.forEach/)
  assert.match(generateWorkspaceSource, /handleDeleteGenerationResult\(job\)/)
  assert.match(generateWorkspaceSource, /<Trash2 className="h-3\.5 w-3\.5"/)
})

test('Generation History deletes versions, assets, and project files together', () => {
  assert.match(generationLibrarySource, /planGenerationHistoryDeletion/)
  assert.match(generationLibrarySource, /const executeHistoryDeletion = async/)
  assert.match(generationLibrarySource, /deleteProjectFile\(currentProjectHandle, relativePath\)/)
  assert.match(generationLibrarySource, /plan\.assetIds\.forEach\(\(assetId\) => removeAsset\(assetId\)\)/)
  assert.match(generationLibrarySource, /plan\.historyVersions\.forEach/)
  assert.match(generationLibrarySource, /onDeletedAssets\?\.\(plan\.assetIds\)/)
})

test('Generation History uses the generated eighth-note art for non-visual outputs', async () => {
  const thumbnail = await fs.stat(new URL('../public/generated-thumbnails/audio-eighth-note.webp', import.meta.url))
  assert.ok(thumbnail.size > 0)
  assert.match(generationLibrarySource, /AUDIO_HISTORY_THUMBNAIL_URL = '\/generated-thumbnails\/audio-eighth-note\.webp'/)
  assert.match(generationLibrarySource, /const previewIsVisual = preview\?\.type === 'image' \|\| preview\?\.type === 'video'/)
  assert.match(generationLibrarySource, /src=\{AUDIO_HISTORY_THUMBNAIL_URL\}/)
  assert.match(generationLibrarySource, /src=\{AUDIO_HISTORY_THUMBNAIL_URL\}[^>]+object-contain/)
  assert.match(generationLibrarySource, /generate\.history\.audioThumbnailAlt/)
})
