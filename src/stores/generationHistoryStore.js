import { create } from 'zustand'
import { ensureNsfwPrefix } from '../services/nsfwWorkflowVisibility.mjs'

export const GENERATION_HISTORY_SCHEMA_VERSION = 2

const cloneSerializable = (value, fallback = null) => {
  if (value === undefined) return fallback
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return fallback
  }
}

const createId = (prefix) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const normalizeVersion = (version, index = 0) => ({
  ...(version || {}),
  id: String(version?.id || createId('generation-version')),
  number: Number.isFinite(Number(version?.number)) ? Number(version.number) : index + 1,
  createdAt: version?.createdAt || new Date().toISOString(),
  inputAssetIds: Array.isArray(version?.inputAssetIds) ? [...version.inputAssetIds] : [],
  outputAssetIds: Array.isArray(version?.outputAssetIds) ? [...version.outputAssetIds] : [],
  status: String(version?.status || 'completed'),
  nsfw: version?.nsfw === true,
  workflowLabel: version?.nsfw === true
    ? ensureNsfwPrefix(version?.workflowLabel, 'NSFW workflow')
    : (version?.workflowLabel || null),
})

const normalizeRecord = (record) => {
  const versions = (Array.isArray(record?.versions) ? record.versions : [])
    .map((version, index) => normalizeVersion(version, index))
  const activeVersionId = versions.some((version) => version.id === record?.activeVersionId)
    ? record.activeVersionId
    : versions.at(-1)?.id || null
  return {
    ...(record || {}),
    id: String(record?.id || createId('generation')),
    createdAt: record?.createdAt || new Date().toISOString(),
    updatedAt: record?.updatedAt || record?.createdAt || new Date().toISOString(),
    nsfw: record?.nsfw === true,
    title: record?.nsfw === true
      ? ensureNsfwPrefix(record?.title, 'Generation')
      : String(record?.title || 'Generation'),
    versions,
    activeVersionId,
  }
}

export function normalizeGenerationHistory(projectValue) {
  const source = projectValue && typeof projectValue === 'object' ? projectValue : {}
  return {
    schemaVersion: GENERATION_HISTORY_SCHEMA_VERSION,
    records: (Array.isArray(source.records) ? source.records : []).map(normalizeRecord),
  }
}

export const useGenerationHistoryStore = create((set, get) => ({
  schemaVersion: GENERATION_HISTORY_SCHEMA_VERSION,
  records: [],

  loadFromProject: (projectValue) => set(normalizeGenerationHistory(projectValue)),
  clear: () => set({ schemaVersion: GENERATION_HISTORY_SCHEMA_VERSION, records: [] }),
  getProjectData: () => cloneSerializable({
    schemaVersion: GENERATION_HISTORY_SCHEMA_VERSION,
    records: get().records,
  }, { schemaVersion: GENERATION_HISTORY_SCHEMA_VERSION, records: [] }),

  createRecord: (input = {}) => {
    const now = new Date().toISOString()
    const record = normalizeRecord({
      id: input.id,
      title: input.title,
      createdAt: input.createdAt || now,
      updatedAt: now,
      timelineId: input.timelineId || null,
      clipId: input.clipId || null,
      nsfw: input.nsfw === true,
      versions: [],
      activeVersionId: null,
    })
    set((state) => ({ records: [...state.records, record] }))
    return record
  },

  appendVersion: (recordId, input = {}) => {
    const record = get().records.find((entry) => entry.id === recordId)
    if (!record) return null
    const version = normalizeVersion({
      id: input.id,
      number: record.versions.length + 1,
      createdAt: input.createdAt || new Date().toISOString(),
      status: input.status || 'completed',
      workflowId: input.workflowId || null,
      workflowLabel: input.workflowLabel || null,
      promptId: input.promptId || null,
      prompt: input.prompt || '',
      sourcePrompt: input.sourcePrompt || '',
      promptLanguage: input.promptLanguage || null,
      seed: input.seed ?? null,
      settings: cloneSerializable(input.settings, {}),
      modelRefs: cloneSerializable(input.modelRefs, []),
      inputAssetIds: input.inputAssetIds || [],
      outputAssetIds: input.outputAssetIds || [],
      apiWorkflow: cloneSerializable(input.apiWorkflow),
      uiWorkflow: cloneSerializable(input.uiWorkflow),
      canvasWorkflow: cloneSerializable(input.canvasWorkflow),
      artifactPath: input.artifactPath || null,
      parentVersionId: input.parentVersionId || record.activeVersionId || null,
      error: input.error || null,
      nsfw: input.nsfw === true,
    }, record.versions.length)
    set((state) => ({
      records: state.records.map((entry) => (entry.id === recordId
        ? {
            ...entry,
            nsfw: entry.nsfw || version.nsfw,
            title: version.nsfw ? ensureNsfwPrefix(entry.title) : entry.title,
            versions: [...entry.versions, version],
            activeVersionId: input.activate === false ? entry.activeVersionId : version.id,
            updatedAt: new Date().toISOString(),
          }
        : entry)),
    }))
    return version
  },

  setActiveVersion: (recordId, versionId) => {
    let changed = false
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId || !record.versions.some((version) => version.id === versionId)) return record
        changed = true
        return { ...record, activeVersionId: versionId, updatedAt: new Date().toISOString() }
      }),
    }))
    return changed
  },

  bindRecordToClip: (recordId, timelineId, clipId) => {
    let changed = false
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record
        changed = true
        return {
          ...record,
          timelineId: timelineId || null,
          clipId: clipId || null,
          updatedAt: new Date().toISOString(),
        }
      }),
    }))
    return changed
  },

  removeVersion: (recordId, versionId) => {
    let changed = false
    set((state) => ({
      records: state.records.flatMap((record) => {
        if (record.id !== recordId) return [record]
        const versions = record.versions.filter((version) => version.id !== versionId)
        if (versions.length === record.versions.length) return [record]
        changed = true
        if (versions.length === 0) return []
        const activeVersionId = versions.some((version) => version.id === record.activeVersionId)
          ? record.activeVersionId
          : versions.at(-1)?.id || null
        return [{
          ...record,
          versions,
          activeVersionId,
          updatedAt: new Date().toISOString(),
        }]
      }),
    }))
    return changed
  },

  removeRecord: (recordId) => {
    let changed = false
    set((state) => {
      const records = state.records.filter((record) => record.id !== recordId)
      changed = records.length !== state.records.length
      return changed ? { records } : state
    })
    return changed
  },

  removeRecords: (recordIds) => {
    const ids = new Set((Array.isArray(recordIds) ? recordIds : []).map((id) => String(id || '')).filter(Boolean))
    if (ids.size === 0) return 0
    let removedCount = 0
    set((state) => {
      const records = state.records.filter((record) => {
        const remove = ids.has(record.id)
        if (remove) removedCount += 1
        return !remove
      })
      return removedCount > 0 ? { records } : state
    })
    return removedCount
  },
}))

export default useGenerationHistoryStore
