import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export const CHARACTER_FILE_MAGIC = 'INLINECHAR'
export const CHARACTER_FILE_VERSION = 1
export const CHARACTER_REFERENCE_ROLES = Object.freeze(['face', 'body', 'cloth'])

const textEncoder = new TextEncoder()

function safeRole(value) {
  const role = String(value || 'face').trim().toLowerCase()
  return CHARACTER_REFERENCE_ROLES.includes(role) ? role : 'face'
}

function safeName(value, fallback = 'Character') {
  return String(value || fallback).trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ') || fallback
}

async function sha256Hex(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function manifestJson(manifest) {
  // Key order is part of OmniChar's cheap signature check.
  const ordered = {
    magic: CHARACTER_FILE_MAGIC,
    format_version: CHARACTER_FILE_VERSION,
    char_id: manifest.char_id,
    name: manifest.name,
    created_at: manifest.created_at,
    modified_at: manifest.modified_at,
    app: 'lumeweft',
    app_version: manifest.app_version || '',
    refs: manifest.refs,
    derived: [],
    text: manifest.text,
    payloads: {},
    scoring: {},
    hints: [],
    apply: { 'minimax-h3': 'reference' },
    reserved: { adapters: {}, video_payloads: {}, members: [] },
  }
  return JSON.stringify(ordered)
}

export async function createCharacterFile({ name, description = '', references = [], appVersion = '' } = {}) {
  const normalized = references.filter(ref => ref?.bytes).slice(0, 9)
  if (!normalized.some(ref => safeRole(ref.role) === 'face')) {
    throw new Error('顔リファレンスを1枚以上追加してください。 / Add at least one face reference.')
  }
  const now = Math.floor(Date.now() / 1000)
  const members = {}
  const refs = []
  for (let index = 0; index < normalized.length; index += 1) {
    const source = normalized[index]
    const bytes = source.bytes instanceof Uint8Array ? source.bytes : new Uint8Array(source.bytes)
    const path = `refs/${String(index).padStart(3, '0')}.png`
    members[path] = bytes
    refs.push({
      path,
      sha256: await sha256Hex(bytes),
      width: Math.max(1, Math.round(Number(source.width) || 1)),
      height: Math.max(1, Math.round(Number(source.height) || 1)),
      source_name: String(source.name || path),
      origin: 'original',
      role: safeRole(source.role),
    })
  }
  const characterName = safeName(name)
  const manifest = {
    char_id: crypto.randomUUID?.() || `lumeweft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: characterName,
    created_at: now,
    modified_at: now,
    app_version: String(appVersion || ''),
    refs,
    text: { description: 'text/description.md' },
  }
  // fflate preserves insertion order, keeping manifest.json as the first ZIP member.
  const archive = zipSync({
    'manifest.json': [strToU8(manifestJson(manifest)), { level: 6 }],
    ...members,
    'text/description.md': [textEncoder.encode(String(description || '').trim()), { level: 6 }],
  })
  return new File([archive], `${characterName}.char`, { type: 'application/x-inline-character' })
}

export async function readCharacterFile(source) {
  const bytes = source instanceof Uint8Array
    ? source
    : new Uint8Array(source instanceof ArrayBuffer ? source : await source.arrayBuffer())
  let members
  try {
    members = unzipSync(bytes)
  } catch (error) {
    throw new Error(`読み取れないキャラクターファイルです。 / Unreadable character file: ${error.message}`)
  }
  if (!members['manifest.json']) throw new Error('manifest.json がないため .char として読み取れません。')
  const rawManifest = strFromU8(members['manifest.json'])
  if (!rawManifest.startsWith(`{"magic":"${CHARACTER_FILE_MAGIC}","format_version":`)) {
    throw new Error('OmniChar互換の .char ファイルではありません。')
  }
  const manifest = JSON.parse(rawManifest)
  if (Number(manifest.format_version) > CHARACTER_FILE_VERSION) {
    throw new Error(`この .char は新しい形式 v${manifest.format_version} です。`)
  }
  const descriptionPath = String(manifest?.text?.description || 'text/description.md')
  const description = members[descriptionPath] ? strFromU8(members[descriptionPath]) : ''
  const references = (Array.isArray(manifest.refs) ? manifest.refs : []).map((ref, index) => {
    const path = String(ref?.path || '')
    const data = members[path]
    if (!path || !data) throw new Error(`.char の参照画像 ${index + 1} が見つかりません。`)
    return {
      bytes: data,
      path,
      role: safeRole(ref.role),
      width: Number(ref.width) || 0,
      height: Number(ref.height) || 0,
      sourceName: String(ref.source_name || path),
    }
  })
  if (!references.some(ref => ref.role === 'face')) throw new Error('.char に顔リファレンスがありません。')
  return { manifest, name: safeName(manifest.name), description: description.trim(), references }
}

export function selectCharacterReferences(references = [], maximum = 9) {
  const limit = Math.max(1, Math.min(9, Math.round(Number(maximum) || 9)))
  const queues = Object.fromEntries(CHARACTER_REFERENCE_ROLES.map(role => [role, references.filter(ref => safeRole(ref.role) === role)]))
  const selected = []
  // Face identity is most important; then preserve body and clothing before filling remaining slots.
  for (const role of ['face', 'face', 'body', 'cloth']) {
    const next = queues[role].shift()
    if (next && selected.length < limit) selected.push(next)
  }
  for (const role of ['face', 'body', 'cloth']) {
    while (queues[role].length && selected.length < limit) selected.push(queues[role].shift())
  }
  return selected
}

export function buildCharacterPrompt({ name = 'the character', description = '', prompt = '', references = [] } = {}) {
  const roleLabels = { face: 'face and identity', body: 'body and proportions', cloth: 'clothing and materials' }
  const referenceLines = references.map((ref, index) => `<Picture ${index + 1}> is the fixed ${roleLabels[safeRole(ref.role)]} reference for ${name}.`)
  return [
    ...referenceLines,
    `Keep ${name} as the same person in every frame: stable face, body, hair, clothing, colors, and distinguishing details.`,
    String(description || '').trim(),
    String(prompt || '').trim(),
  ].filter(Boolean).join('\n')
}
