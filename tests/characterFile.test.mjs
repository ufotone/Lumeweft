import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCharacterPrompt, createCharacterFile, readCharacterFile, selectCharacterReferences } from '../src/services/characterFile.mjs'

if (!globalThis.File) globalThis.File = class File extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name } }
if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto

test('writes and reads an OmniChar-compatible minimal character file', async () => {
  const file = await createCharacterFile({
    name: 'Emmy', description: 'Dark hair and a floral shirt.',
    references: [
      { bytes: new Uint8Array([1, 2, 3]), role: 'face', width: 512, height: 512, name: 'face.png' },
      { bytes: new Uint8Array([4, 5]), role: 'cloth', width: 512, height: 768, name: 'shirt.png' },
    ],
  })
  const decoded = await readCharacterFile(file)
  assert.equal(decoded.manifest.magic, 'INLINECHAR')
  assert.equal(decoded.manifest.format_version, 1)
  assert.equal(decoded.name, 'Emmy')
  assert.equal(decoded.references[1].role, 'cloth')
  assert.match(decoded.description, /floral shirt/)
})

test('reference selection prioritizes identity, body and clothing within H3 cap', () => {
  const refs = ['cloth', 'face', 'body', 'face', 'cloth', 'face'].map((role, id) => ({ role, id }))
  assert.deepEqual(selectCharacterReferences(refs, 4).map(ref => ref.role), ['face', 'face', 'body', 'cloth'])
})

test('prompt fixes numbered reference roles', () => {
  const prompt = buildCharacterPrompt({ name: 'Emmy', description: 'Floral shirt.', prompt: 'Walk into frame.', references: [{ role: 'face' }, { role: 'body' }] })
  assert.match(prompt, /<Picture 1>.*face and identity/)
  assert.match(prompt, /same person in every frame/)
  assert.match(prompt, /Walk into frame/)
})
