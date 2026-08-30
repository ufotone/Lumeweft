const compactStrings = (values = []) => Array.from(new Set(
  values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean),
))

const getRelativeAssetPaths = (asset) => compactStrings([
  asset?.path,
  asset?.playbackCachePath,
  asset?.proxyPath,
])

const getAbsoluteAssetPaths = (asset) => compactStrings([
  !asset?.path ? asset?.absolutePath : '',
  asset?.sprite?.spritePath,
  asset?.poster?.posterPath,
])

/**
 * Build a conservative deletion plan for one completed/failed Generate job.
 * Only result assets owned by the job are included. Shared paths referenced by
 * another asset are retained, and history versions are removed only when all
 * of their outputs are part of the same deletion.
 */
export function planGeneratedAssetDeletion({ assetIds: requestedAssetIds = [], assets = [], historyRecords = [] } = {}) {
  const assetIds = compactStrings(requestedAssetIds)
  const assetIdSet = new Set(assetIds)
  const resultAssets = (Array.isArray(assets) ? assets : []).filter((asset) => assetIdSet.has(asset?.id))
  const remainingAssets = (Array.isArray(assets) ? assets : []).filter((asset) => !assetIdSet.has(asset?.id))
  const retainedRelativePaths = new Set(remainingAssets.flatMap(getRelativeAssetPaths))
  const retainedAbsolutePaths = new Set(remainingAssets.flatMap(getAbsoluteAssetPaths))

  const relativePaths = compactStrings(resultAssets.flatMap(getRelativeAssetPaths))
    .filter((path) => !retainedRelativePaths.has(path))
  const absolutePaths = compactStrings(resultAssets.flatMap(getAbsoluteAssetPaths))
    .filter((path) => !retainedAbsolutePaths.has(path))
  const blobUrls = compactStrings(resultAssets.map((asset) => asset?.url))
    .filter((url) => url.startsWith('blob:'))

  const historyVersions = []
  for (const record of (Array.isArray(historyRecords) ? historyRecords : [])) {
    for (const version of (Array.isArray(record?.versions) ? record.versions : [])) {
      const outputIds = compactStrings(Array.isArray(version?.outputAssetIds) ? version.outputAssetIds : [])
      if (outputIds.length > 0 && outputIds.every((id) => assetIdSet.has(id))) {
        historyVersions.push({ recordId: record.id, versionId: version.id })
      }
    }
  }

  return {
    assetIds,
    resultAssets,
    relativePaths,
    absolutePaths,
    blobUrls,
    historyVersions,
  }
}

export function planGenerationResultDeletion({ job, assets = [], historyRecords = [] } = {}) {
  return planGeneratedAssetDeletion({
    assetIds: Array.isArray(job?.resultAssetIds) ? job.resultAssetIds : [],
    assets,
    historyRecords,
  })
}

export function planGenerationHistoryDeletion({
  recordIds = [],
  versionRefs = [],
  assets = [],
  historyRecords = [],
} = {}) {
  const recordIdSet = new Set(compactStrings(recordIds))
  const versionKeySet = new Set((Array.isArray(versionRefs) ? versionRefs : [])
    .map((ref) => `${String(ref?.recordId || '').trim()}::${String(ref?.versionId || '').trim()}`)
    .filter((key) => !key.startsWith('::') && !key.endsWith('::')))
  const targetedVersions = []
  const retainedOutputAssetIds = new Set()
  const targetOutputAssetIds = new Set()
  const emptyRecordIds = []

  for (const record of (Array.isArray(historyRecords) ? historyRecords : [])) {
    const versions = Array.isArray(record?.versions) ? record.versions : []
    if (recordIdSet.has(record?.id) && versions.length === 0) emptyRecordIds.push(record.id)
    for (const version of versions) {
      const key = `${String(record?.id || '').trim()}::${String(version?.id || '').trim()}`
      const targeted = recordIdSet.has(record?.id) || versionKeySet.has(key)
      const outputIds = compactStrings(Array.isArray(version?.outputAssetIds) ? version.outputAssetIds : [])
      if (targeted) {
        targetedVersions.push({ recordId: record.id, versionId: version.id })
        outputIds.forEach((id) => targetOutputAssetIds.add(id))
      } else {
        outputIds.forEach((id) => retainedOutputAssetIds.add(id))
      }
    }
  }

  const deletableAssetIds = [...targetOutputAssetIds].filter((id) => !retainedOutputAssetIds.has(id))
  const assetPlan = planGeneratedAssetDeletion({ assetIds: deletableAssetIds, assets })
  return {
    ...assetPlan,
    historyVersions: targetedVersions,
    emptyRecordIds,
  }
}

export default planGenerationResultDeletion
