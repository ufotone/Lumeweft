const EPSILON = 1e-6

export const REFERENCE_SIZE_PRESETS = Object.freeze({
  landscape: { id: 'landscape', label: '16:9', width: 1344, height: 768 },
  portrait: { id: 'portrait', label: '9:16', width: 768, height: 1344 },
  square: { id: 'square', label: '1:1', width: 768, height: 768 },
  source: { id: 'source', label: 'Source', width: null, height: null },
})

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function normalizeReferenceCutRange(start, end, sourceDuration = Infinity) {
  const safeDuration = Math.max(0, finiteNumber(sourceDuration, Infinity))
  const safeStart = Math.max(0, Math.min(safeDuration, finiteNumber(start, 0)))
  const safeEnd = Math.max(safeStart, Math.min(safeDuration, finiteNumber(end, safeDuration)))
  return { start: safeStart, end: safeEnd, duration: safeEnd - safeStart }
}

/**
 * Split a source range at explicit cut markers. Each marker-defined span is
 * capped at the selected H3-friendly maximum; its overflow is excluded rather
 * than emitted as another asset.
 */
export function buildReferenceCutPlan({
  start = 0,
  end = 0,
  markers = [],
  maxDuration = 5,
  minimumDuration = 2,
} = {}) {
  const range = normalizeReferenceCutRange(start, end)
  if (range.duration <= EPSILON) return { segments: [], excludedRanges: [] }

  const maximum = Math.max(0.1, finiteNumber(maxDuration, 5))
  const minimum = Math.max(0, finiteNumber(minimumDuration, 2))
  const markerTimes = [...new Set(
    markers
      .map((marker) => finiteNumber(marker?.time ?? marker, NaN))
      .filter((time) => Number.isFinite(time) && time > range.start + EPSILON && time < range.end - EPSILON)
      .map((time) => Number(time.toFixed(6)))
  )].sort((a, b) => a - b)

  const boundaries = [range.start, ...markerTimes, range.end]
  const rawSegments = []
  const excludedRanges = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const boundaryStart = boundaries[index]
    const boundaryEnd = boundaries[index + 1]
    const outputEnd = Math.min(boundaryEnd, boundaryStart + maximum)
    if (outputEnd - boundaryStart > EPSILON) {
      rawSegments.push({
        start: boundaryStart,
        end: outputEnd,
        truncated: boundaryEnd - outputEnd > EPSILON,
      })
    }
    if (boundaryEnd - outputEnd > EPSILON) {
      excludedRanges.push({
        id: `reference-cut-excluded-${index + 1}`,
        start: outputEnd,
        end: boundaryEnd,
        duration: boundaryEnd - outputEnd,
      })
    }
  }

  const segments = rawSegments.map((segment, index) => {
    const duration = segment.end - segment.start
    return {
      ...segment,
      id: `reference-cut-${index + 1}`,
      index,
      duration,
      tooShort: duration + EPSILON < minimum,
      tooLong: duration > 15 + EPSILON,
    }
  })

  return { segments, excludedRanges }
}

export function buildReferenceCutSegments(options = {}) {
  return buildReferenceCutPlan(options).segments
}

export function getReferenceOutputPreset(presetId = 'landscape') {
  return REFERENCE_SIZE_PRESETS[presetId] || REFERENCE_SIZE_PRESETS.landscape
}

/**
 * Keep rendered cuts beside a project-owned source asset. External and invalid
 * paths fall back to the portable project video directory.
 */
export function getReferenceCutOutputDirectory(assetPath = '') {
  const fallback = { parts: ['assets', 'video'], relativePath: 'assets/video' }
  const normalized = String(assetPath || '').trim().replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) return fallback

  const pathParts = normalized.split('/').filter(Boolean)
  if (pathParts.length < 2 || pathParts.some((part) => part === '.' || part === '..')) return fallback

  const directoryParts = pathParts.slice(0, -1)
  if (directoryParts[0]?.toLowerCase() !== 'assets') return fallback
  return { parts: directoryParts, relativePath: directoryParts.join('/') }
}

/** Return only the audio clips explicitly linked to the selected video clip. */
export function getLinkedReferenceAudioClips(clips = [], videoClip = null) {
  const linkGroupId = String(videoClip?.linkGroupId || '').trim()
  if (!linkGroupId || !Array.isArray(clips)) return []
  return clips.filter((clip) => (
    clip?.id !== videoClip?.id
    && clip?.type === 'audio'
    && String(clip?.linkGroupId || '').trim() === linkGroupId
  ))
}
