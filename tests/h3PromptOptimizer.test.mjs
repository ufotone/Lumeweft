import test from 'node:test'
import assert from 'node:assert/strict'
import { formatH3Prompt, optimizeH3Prompt } from '../src/services/h3PromptOptimizer.mjs'

const fields = { integrated_multimodal_description: '[Shot 1] A woman (S1) says: <d>[Japanese]こんにちは。</d>', overall_soundscape: 'Quiet room tone.', non_diegetic_music: 'N/A' }
const original = '女性が「こんにちは。」と話す。音楽なし。'
test('preserves Japanese speech and adds only the requested frame alignment', () => {
  const text = formatH3Prompt(JSON.stringify(fields), { mode: 'I2VA', duration: 5, original })
  assert.ok(text.startsWith('For the target video, at 0.00'))
  assert.ok(text.includes('<d>[Japanese]こんにちは。</d>'))
  assert.ok(text.includes('non_diegetic_music: N/A'))
  assert.ok(formatH3Prompt(JSON.stringify(fields), { mode: 'T2VA', original }).startsWith('integrated_multimodal_description:'))
})
test('last-frame alignment uses the actual final shot and duration', () => {
  const data = { ...fields, integrated_multimodal_description: fields.integrated_multimodal_description + '\n[Shot 2] At 00:03.000, the camera cuts to the door.' }
  assert.ok(formatH3Prompt(JSON.stringify(data), { mode: 'FL2VA', duration: 5.8, original }).includes('Picture 2 (from Shot 2) aligns with the 5.80-second'))
  assert.throws(() => formatH3Prompt(JSON.stringify(data), { duration: 2, original }), /カット時刻/)
})
test('rejects changed dialogue, missing fields and invented references', () => {
  assert.throws(() => formatH3Prompt(JSON.stringify(fields), { original: '別の台詞' }), /台詞が原文/)
  assert.throws(() => formatH3Prompt('{}'), /ありません/)
  assert.throws(() => formatH3Prompt(JSON.stringify({ ...fields, overall_soundscape: 'Use <Audio 9>.' }), { original }), /未指定/)
})
test('Ref2VA uses six sections and requires reference roles', async () => {
  await assert.rejects(optimizeH3Prompt(original, { h3Mode: 'Ref2VA' }), /参照素材/)
  const data = { subject_definitions: '<Subject 1> is the person in <Picture 1>.', summary: '[reference generation] A greeting.', retention_analysis: '<Subject 1>: fully_preserved - identity.', detailed_description: fields.integrated_multimodal_description, overall_soundscape: 'Quiet room tone.', non_diegetic_music: 'N/A' }
  const result = await optimizeH3Prompt(original, { h3Mode: 'Ref2VA', referenceNotes: '<Picture 1>: person' }, async options => {
    assert.equal(options.modelFamily, 'any')
    return { text: JSON.stringify(data), modelId: 'local', truncated: false }
  })
  assert.ok(result.text.startsWith('subject_definitions:'))
  assert.ok(!result.text.includes('integrated_multimodal_description:'))
})
test('truncated model output never reaches the video workflow', async () => {
  await assert.rejects(optimizeH3Prompt(original, {}, async () => ({ text: '{}', truncated: true })), /出力上限/)
})
