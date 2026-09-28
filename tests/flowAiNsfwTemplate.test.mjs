import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const schemaSource = await fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8')
const runtimeSource = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
const comfyuiSource = await fs.readFile(new URL('../src/services/comfyui.js', import.meta.url), 'utf8')
const workspaceSource = await fs.readFile(new URL('../src/components/FlowAIWorkspace.jsx', import.meta.url), 'utf8')
const dependencySource = await fs.readFile(new URL('../src/config/workflowDependencyPacks.js', import.meta.url), 'utf8')
const installSource = await fs.readFile(new URL('../src/config/workflowInstallCatalog.js', import.meta.url), 'utf8')
const generateConfigSource = await fs.readFile(new URL('../src/config/generateWorkspaceConfig.js', import.meta.url), 'utf8')
const registrySource = await fs.readFile(new URL('../src/config/workflowRegistry.js', import.meta.url), 'utf8')
const ltxAudioGraph = JSON.parse(await fs.readFile(new URL('../public/workflows/video_ltx2_3_id_lora.json', import.meta.url), 'utf8'))

function extractExportedFunction(source, functionName) {
  const start = source.indexOf(`export function ${functionName}`)
  assert.notEqual(start, -1, `missing ${functionName}`)
  const end = source.indexOf('\n/**', start)
  assert.notEqual(end, -1, `missing end marker for ${functionName}`)
  return source.slice(start, end).replace(/^export\s+/, '')
}

test('CANVAS categorizes the anime talking-video preset as I2V and prefixes its name', () => {
  assert.match(schemaSource, /id: 'nsfw-anime-talking-video'/)
  assert.match(schemaSource, /section: 'nsfw'/)
  assert.match(schemaSource, /label: '\[NSFW\] Irodori \+ LTX Talking I2V'/)
  assert.match(workspaceSource, /FLOW_TEMPLATE_CATEGORIES/)
  assert.match(workspaceSource, /canvas\.templateCategories\.i2v/)
})

test('CANVAS animates outgoing edges from muted nodes only while they are passing data through', () => {
  assert.match(workspaceSource, /node\?\.data\?\.muted !== true[\s\S]*outputAssetIds[\s\S]*outputText/)
  assert.match(workspaceSource, /isActive: activeTargetNodeIds\.has\(edge\.target\) && animatedSourceNodeIds\.has\(edge\.source\)/)
})

test('CANVAS stop aborts local polling immediately and still interrupts ComfyUI', () => {
  assert.match(workspaceSource, /activeFlowAbortControllerRef\.current\?\.abort\(\)/)
  assert.match(workspaceSource, /signal: abortController\.signal/)
  assert.match(workspaceSource, /await comfyui\.interrupt\(\)/)
  assert.match(runtimeSource, /await waitForFlowPoll\(POLL_INTERVAL_MS, signal\)/)
  assert.match(runtimeSource, /throwIfFlowInterrupted\(options\.signal\)/)
})

test('anime talking-video template wires Irodori v4.1 Anime audio into Exact Audio lip-sync', () => {
  assert.match(schemaSource, /workflowId: 'irodori-v4-1-anime'/)
  assert.match(generateConfigSource, /audio:\s*\[[\s\S]*id: IRODORI_TTS_WORKFLOW_ID/)
  assert.match(schemaSource, /workflowId: 'ltx23-latentsync'/)
  assert.match(schemaSource, /source: voice\.id, sourceHandle: 'out:audio', target: lipSync\.id, targetHandle: 'in:voice'/)
  assert.match(runtimeSource, /'irodori-v4-1-anime': modifyIrodoriTextToSpeechWorkflow/)
  assert.match(runtimeSource, /model: IRODORI_ANIME_MODEL_FILENAME/)
  assert.match(runtimeSource, /'ltx23-latentsync': modifyLTX23LatentSyncWorkflow/)
})

test('CANVAS repairs cached pre-v3 Irodori workflow inputs before queueing', () => {
  for (const inputName of [
    'enable_watermark',
    'compile_model',
    'compile_dynamic',
    'batch_size',
    'decode_mode',
    'context_kv_cache',
    'max_text_len',
    'trim_tail',
  ]) {
    assert.match(comfyuiSource, new RegExp(`node\\.inputs\\.${inputName}\\s*=`))
  }
  assert.match(comfyuiSource, /delete node\.inputs\.audioUI/)
  assert.match(runtimeSource, /workflowId === 'irodori-tts' \|\| workflowId === 'irodori-v4-1-anime'\) return `audio\/\$\{token\}`/)
})

test('anime talking-video uses native LTX exact-audio conditioning without LatentSyncNode', () => {
  assert.match(comfyuiSource, /class_type: 'LTXVAudioVAEEncode'/)
  assert.match(comfyuiSource, /class_type: 'LTXVSetAudioRefTokens'/)
  assert.match(comfyuiSource, /createVideoNode\.inputs\.audio = \[loadAudioId, 0\]/)
  assert.doesNotMatch(comfyuiSource, /class_type: 'LatentSyncNode'/)
  assert.match(dependencySource, /classType: 'LTXVAudioVAEEncode'/)
  assert.match(dependencySource, /classType: 'LTXVSetAudioRefTokens'/)
  assert.doesNotMatch(dependencySource, /classType: 'LatentSyncNode'/)
  assert.match(registrySource, /\[UGC_EXACT_LIPSYNC_WORKFLOW_ID\]: getBundledWorkflowPath\('video_ltx2_3_id_lora\.json'\)/)
})

test('native LTX modifier freezes the supplied audio and muxes its original waveform', () => {
  const factory = new Function([
    extractExportedFunction(comfyuiSource, 'modifyLTX23I2VWorkflow'),
    extractExportedFunction(comfyuiSource, 'modifyLTX23LatentSyncWorkflow'),
    'return modifyLTX23LatentSyncWorkflow',
  ].join('\n'))
  const modify = factory()
  const result = modify(ltxAudioGraph, {
    inputImage: 'anime.png',
    inputAudio: 'irodori.wav',
    prompt: 'subtle anime character motion',
    width: 960,
    height: 544,
    duration: 4,
    fps: 25,
    seed: 123,
  })

  assert.equal(result['276'].inputs.audio, 'irodori.wav')
  assert.equal(result['269'].inputs.image, 'anime.png')
  assert.equal(result['340:319'].inputs.value, 'subtle anime character motion')
  assert.equal(result['340:330'].inputs.value, 960)
  assert.equal(result['340:324'].inputs.value, 544)
  assert.equal(result['lumeweft_exact_audio_encode'].class_type, 'LTXVAudioVAEEncode')
  assert.equal(result['lumeweft_exact_audio_conditioning'].class_type, 'LTXVSetAudioRefTokens')
  assert.deepEqual(result['340:326'].inputs.audio_latent, ['lumeweft_exact_audio_conditioning', 2])
  assert.deepEqual(result['340:312'].inputs.audio, ['276', 0])
  assert.equal(Object.values(result).some((node) => node.class_type === 'LTXVReferenceAudio'), false)
  assert.equal(result['340:346'], undefined)
  for (const node of Object.values(result)) {
    assert.notEqual(node.inputs?.lora_name, 'ltx-2.3-id-lora-talkvid-3k.safetensors')
    for (const value of Object.values(node.inputs || {})) {
      if (Array.isArray(value)) assert.notEqual(value[0], '340:346')
    }
  }
  assert.ok(Object.values(result).some(node => node.class_type === 'CFGGuider' && node.inputs.model[0] === '340:293'))
  assert.ok(ltxAudioGraph['340:346'], 'shared TalkVid template is not mutated')
})

test('CANVAS exposes separate quality and eight-step MiniMax H3 NSFW flows', () => {
  assert.match(schemaSource, /id: 'nsfw-minimax-h3-pink-bunny'/)
  assert.match(schemaSource, /id: 'nsfw-minimax-h3-pink-reference'/)
  assert.match(schemaSource, /id: 'nsfw-minimax-h3-aftermidnight-r2v'/)
  assert.match(schemaSource, /id: 'nsfw-minimax-h3-scene-character-props'/)
  assert.match(schemaSource, /id: 'nsfw-minimax-h3-motion-8step'/)
  assert.match(schemaSource, /workflowId: isMotion \? 'minimax-h3-nsfw-motion-8step' : 'minimax-h3-nsfw-pink-bunny'/)
  assert.match(runtimeSource, /PinkFluffyBunny-unpruned-v2-rank128\.safetensors/)
  assert.match(runtimeSource, /minimax-h3_fl2v_8Step_motion_enhancer\.safetensors/)
  assert.match(runtimeSource, /steps: \['minimax-h3-naughty-times', 'minimax-h3-nsfw-pink-bunny'\]\.includes\(workflowId\) \? 20 : 8/)
  assert.match(dependencySource, /PinkFluffyBunny-unpruned-v2-rank128\.safetensors/)
  assert.match(dependencySource, /minimax-h3_fl2v_8Step_motion_enhancer\.safetensors/)
  assert.match(installSource, /SexGod1979\/PinkFluffyBunny-MiniMax-H3/)
  assert.match(installSource, /SexGod1979\/AfterMidnight-MiniMax-H3-NSFW/)
  assert.match(installSource, /rzgar\/minimax-h3_fl2v_8Step_motion_enhancer/)
})
