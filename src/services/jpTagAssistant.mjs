const DATA_FILES = Object.freeze({
  tags: 'danbooru.csv',
  manualLabels: 'danbooru-jp.csv',
  machineLabels: 'danbooru-machine-jp.csv',
  dictionary: 'jp_tag_dictionary.csv',
})

let bundledIndexPromise = null

function parseCsvLine(line = '') {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

function normalized(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[＿_\s-]+/g, ' ')
}

function rows(text = '') {
  return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(parseCsvLine)
}

function addExact(index, key, tag) {
  const normalizedKey = normalized(key)
  if (!normalizedKey) return
  const tags = index.get(normalizedKey) || []
  if (!tags.includes(tag)) tags.push(tag)
  index.set(normalizedKey, tags)
}

export function buildJpTagIndexFromTexts({ tagsText = '', manualLabelsText = '', machineLabelsText = '', dictionaryText = '' } = {}) {
  const entries = new Map()
  const exact = new Map()

  for (const [tag, rawCategory, rawCount, rawAliases = ''] of rows(tagsText)) {
    const cleanTag = String(tag || '').trim()
    if (!cleanTag) continue
    const aliases = String(rawAliases || '').split(',').map(item => item.trim()).filter(Boolean)
    const entry = {
      tag: cleanTag,
      category: Number(rawCategory),
      count: Number(rawCount) || 0,
      aliases,
      manualLabels: [],
      machineLabels: [],
      dictionaryTerms: [],
    }
    entries.set(cleanTag, entry)
    addExact(exact, cleanTag, cleanTag)
    for (const alias of aliases) addExact(exact, alias, cleanTag)
  }

  const attachLabels = (text, key) => {
    for (const [tag, label] of rows(text)) {
      const entry = entries.get(String(tag || '').trim())
      const cleanLabel = String(label || '').trim()
      if (!entry || !cleanLabel) continue
      if (!entry[key].includes(cleanLabel)) entry[key].push(cleanLabel)
      addExact(exact, cleanLabel, entry.tag)
    }
  }
  attachLabels(manualLabelsText, 'manualLabels')
  attachLabels(machineLabelsText, 'machineLabels')

  for (const [ja, tag, rawAliases = ''] of rows(dictionaryText)) {
    if (normalized(ja) === 'ja' && normalized(tag) === 'tag') continue
    const entry = entries.get(String(tag || '').trim())
    if (!entry) continue
    const terms = [ja, ...String(rawAliases || '').split('|')].map(item => item.trim()).filter(Boolean)
    for (const term of terms) {
      if (!entry.dictionaryTerms.includes(term)) entry.dictionaryTerms.push(term)
      addExact(exact, term, entry.tag)
    }
  }

  return { entries: [...entries.values()], entriesByTag: entries, exact }
}

function entrySearchValues(entry, useMachineLabels) {
  return [
    entry.tag,
    ...entry.aliases,
    ...entry.dictionaryTerms,
    ...entry.manualLabels,
    ...(useMachineLabels ? entry.machineLabels : []),
  ]
}

function scoreEntry(entry, term, useMachineLabels) {
  let best = 0
  for (const value of entrySearchValues(entry, useMachineLabels)) {
    const candidate = normalized(value)
    if (!candidate) continue
    if (candidate === term) return 1000
    if (candidate.startsWith(term)) best = Math.max(best, 700)
    else if (candidate.includes(term)) best = Math.max(best, 400)
  }
  return best
}

function splitTerms(query = '') {
  return String(query || '').normalize('NFKC').split(/[\s,、，]+/).map(normalized).filter(Boolean)
}

export function searchJpTagIndex(index, query, options = {}) {
  const limit = Math.max(1, Math.min(100, Math.round(Number(options.limit) || 12)))
  const useMachineLabels = options.useMachineLabels !== false
  const excludeLicensed = options.excludeLicensed !== false
  const insertSpaces = Boolean(options.insertSpaces)
  const terms = splitTerms(query)
  const candidates = new Map()

  for (const term of terms) {
    const exactTags = index.exact.get(term) || []
    for (const tag of exactTags) {
      const entry = index.entriesByTag.get(tag)
      if (entry && scoreEntry(entry, term, useMachineLabels) === 1000) candidates.set(tag, { entry, score: 1000 })
    }
    for (const entry of index.entries) {
      if (excludeLicensed && (entry.category === 3 || entry.category === 4)) continue
      const score = scoreEntry(entry, term, useMachineLabels)
      if (!score) continue
      const existing = candidates.get(entry.tag)
      const combinedScore = score + Math.min(250, Math.log10(entry.count + 1) * 25)
      if (!existing || combinedScore > existing.score) candidates.set(entry.tag, { entry, score: combinedScore })
    }
  }

  const results = [...candidates.values()]
    .filter(({ entry }) => !excludeLicensed || (entry.category !== 3 && entry.category !== 4))
    .sort((left, right) => right.score - left.score || right.entry.count - left.entry.count || left.entry.tag.localeCompare(right.entry.tag))
    .slice(0, limit)
    .map(({ entry }) => ({
      tag: insertSpaces ? entry.tag.replaceAll('_', ' ') : entry.tag,
      sourceTag: entry.tag,
      label: entry.manualLabels[0] || (useMachineLabels ? entry.machineLabels[0] : '') || '',
      category: entry.category,
      count: entry.count,
    }))

  return {
    tags: results.map(result => result.tag).join(', '),
    candidates: results,
    terms,
  }
}

function assetUrl(filename) {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : '/'
  return `${base.endsWith('/') ? base : `${base}/`}data/jp-tag-assistant/${filename}`
}

async function fetchText(filename, fetchImpl) {
  const response = await fetchImpl(assetUrl(filename))
  if (!response.ok) throw new Error(`Could not load bundled JP tag data (${filename}, ${response.status}).`)
  return response.text()
}

export async function loadBundledJpTagIndex(fetchImpl = fetch) {
  if (!bundledIndexPromise) {
    bundledIndexPromise = Promise.all([
      fetchText(DATA_FILES.tags, fetchImpl),
      fetchText(DATA_FILES.manualLabels, fetchImpl),
      fetchText(DATA_FILES.machineLabels, fetchImpl),
      fetchText(DATA_FILES.dictionary, fetchImpl),
    ]).then(([tagsText, manualLabelsText, machineLabelsText, dictionaryText]) => (
      buildJpTagIndexFromTexts({ tagsText, manualLabelsText, machineLabelsText, dictionaryText })
    )).catch(error => {
      bundledIndexPromise = null
      throw error
    })
  }
  return bundledIndexPromise
}

export async function searchBundledJpTags(query, options = {}) {
  const index = await loadBundledJpTagIndex(options.fetchImpl || fetch)
  return searchJpTagIndex(index, query, options)
}

export function resetBundledJpTagIndexForTests() {
  bundledIndexPromise = null
}
