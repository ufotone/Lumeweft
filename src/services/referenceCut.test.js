import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReferenceCutPlan,
  buildReferenceCutSegments,
  getLinkedReferenceAudioClips,
  getReferenceCutOutputDirectory,
  getReferenceOutputPreset,
  normalizeReferenceCutRange,
} from './referenceCut.js'

test('caps each marker span and excludes overflow from output segments', () => {
  const plan = buildReferenceCutPlan({
    start: 2,
    end: 15,
    markers: [{ time: 6 }, { time: 13 }],
    maxDuration: 5,
  })
  assert.deepEqual(
    plan.segments.map(({ start, end }) => [start, end]),
    [[2, 6], [6, 11], [13, 15]]
  )
  assert.deepEqual(
    plan.excludedRanges.map(({ start, end }) => [start, end]),
    [[11, 13]]
  )
  assert.equal(plan.segments[1].truncated, true)
})

test('does not create a short trailing asset beyond the maximum', () => {
  const plan = buildReferenceCutPlan({ start: 0, end: 5.79, maxDuration: 5 })
  assert.deepEqual(plan.segments.map(({ start, end }) => [start, end]), [[0, 5]])
  assert.deepEqual(plan.excludedRanges.map(({ start, end }) => [start, end]), [[5, 5.79]])
})

test('keeps cut outputs beside project-owned source assets', () => {
  assert.deepEqual(getReferenceCutOutputDirectory('assets/video/scenes/source.mp4'), {
    parts: ['assets', 'video', 'scenes'],
    relativePath: 'assets/video/scenes',
  })
  assert.deepEqual(getReferenceCutOutputDirectory('assets\\video\\source.mp4'), {
    parts: ['assets', 'video'],
    relativePath: 'assets/video',
  })
  assert.deepEqual(getReferenceCutOutputDirectory('D:/outside/source.mp4'), {
    parts: ['assets', 'video'],
    relativePath: 'assets/video',
  })
  assert.deepEqual(getReferenceCutOutputDirectory('../outside/source.mp4'), {
    parts: ['assets', 'video'],
    relativePath: 'assets/video',
  })
})

test('finds only audio clips linked to the selected video', () => {
  const video = { id: 'video-1', type: 'video', linkGroupId: 'group-a' }
  const linkedAudio = { id: 'audio-1', type: 'audio', linkGroupId: 'group-a' }
  const clips = [
    video,
    linkedAudio,
    { id: 'audio-2', type: 'audio', linkGroupId: 'group-b' },
    { id: 'video-2', type: 'video', linkGroupId: 'group-a' },
  ]
  assert.deepEqual(getLinkedReferenceAudioClips(clips, video), [linkedAudio])
  assert.deepEqual(getLinkedReferenceAudioClips(clips, { ...video, linkGroupId: '' }), [])
})

test('ignores duplicate and out-of-range markers', () => {
  const segments = buildReferenceCutSegments({ start: 4, end: 9, markers: [1, 4, 6, 6, 12], maxDuration: 15 })
  assert.deepEqual(segments.map(({ start, end }) => [start, end]), [[4, 6], [6, 9]])
})

test('flags clips shorter than the documented H3 minimum', () => {
  const segments = buildReferenceCutSegments({ start: 0, end: 3, markers: [1], maxDuration: 5 })
  assert.equal(segments[0].tooShort, true)
  assert.equal(segments[1].tooShort, false)
})

test('normalizes ranges and resolves the 768p presets', () => {
  assert.deepEqual(normalizeReferenceCutRange(-1, 20, 12), { start: 0, end: 12, duration: 12 })
  assert.deepEqual(getReferenceOutputPreset('portrait'), {
    id: 'portrait', label: '9:16', width: 768, height: 1344,
  })
})
