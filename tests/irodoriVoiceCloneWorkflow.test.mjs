import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const workflow = JSON.parse(await fs.readFile(
  new URL('../public/workflows/irodori_tts_voice_clone.json', import.meta.url),
  'utf8',
))
const comfyuiSource = await fs.readFile(
  new URL('../src/services/comfyui.js', import.meta.url),
  'utf8',
)
const creatorSource = await fs.readFile(
  new URL('../src/components/generate/IrodoriVoiceCloneCreator.jsx', import.meta.url),
  'utf8',
)
const workspaceSource = await fs.readFile(
  new URL('../src/components/GenerateWorkspace.jsx', import.meta.url),
  'utf8',
)
const dependencySource = await fs.readFile(
  new URL('../src/config/workflowDependencyPacks.js', import.meta.url),
  'utf8',
)
const installCatalogSource = await fs.readFile(
  new URL('../src/config/workflowInstallCatalog.js', import.meta.url),
  'utf8',
)
const registrySource = await fs.readFile(
  new URL('../src/config/workflowRegistry.js', import.meta.url),
  'utf8',
)
const setupManagerSource = await fs.readFile(
  new URL('../src/services/workflowSetupManager.js', import.meta.url),
  'utf8',
)

test('Irodori Voice Clone sends Save Audio Advanced format as a DynamicCombo option key', () => {
  assert.equal(workflow['5'].class_type, 'SaveAudioAdvanced')
  assert.equal(workflow['5'].inputs.format, 'flac')
  assert.match(comfyuiSource, /node\.inputs\.format = String\(outputFormat \|\| 'flac'\)/)
  assert.doesNotMatch(comfyuiSource, /node\.inputs\.format = \{ format: outputFormat/)
})

test('Irodori Emoji Picker keeps fixed-size buttons and uses tooltips for cue descriptions', () => {
  assert.match(creatorSource, /title=\{label\}/)
  assert.match(creatorSource, /aria-label=\{`\$\{emoji\} \$\{label\}`\}/)
  assert.match(creatorSource, /className="flex h-10 w-10 shrink-0/)
  assert.doesNotMatch(creatorSource, /group-hover:inline/)
})

test('Irodori Voice Studio supports standard TTS and switches the shared graph only when VoiceDesign is requested', () => {
  assert.equal(workflow['6'].class_type, 'jupo.IrodoriTTS.VoiceDesignConfig')
  assert.match(comfyuiSource, /const useVoiceDesign = !safeAudio && Boolean\(safeVoiceDesignCaption\)/)
  assert.match(comfyuiSource, /delete node\.inputs\.ref_config/)
  assert.match(comfyuiSource, /node\.inputs\.voice_design_config = \[voiceDesignNodeId, 0\]/)
  assert.match(comfyuiSource, /if \(!safeAudio && referenceNodeId\) delete modified\[referenceNodeId\]/)
})

test('Irodori Voice Studio offers the v4.1 Anime voice checkpoint', () => {
  assert.match(creatorSource, /changeVoiceMode\('anime'\)/)
  assert.match(creatorSource, /enableAnime/)
  assert.match(workspaceSource, /IRODORI_ANIME_MODEL_FILENAME/)
  assert.match(dependencySource, /Irodori v4\.1 Anime Voice/)
  assert.match(installCatalogSource, /irodori-tts-v4\.1-anime\.safetensors/)
})

test('Irodori Voice Studio exposes selectable voice presets and prompt parts', () => {
  assert.match(creatorSource, /const VOICE_DESIGN_PRESETS/)
  assert.match(creatorSource, /id: 'calm-female'/)
  assert.match(creatorSource, /id: 'articulate-male'/)
  assert.match(creatorSource, /function buildVoiceDesignCaption/)
  assert.match(creatorSource, /referenceAudioAssetId: referenceAsset\?\.id \|\| ''/)
  assert.match(creatorSource, /useState\('standard'\)/)
  assert.match(creatorSource, /voiceMode: isAnimeVoiceMode \? 'anime' : isVoiceDesignMode \? 'design' : 'standard'/)
})

test('Irodori Voice Studio queues standard v3 by default and VoiceDesign only when selected', () => {
  assert.match(workspaceSource, /const requestedVoiceMode = String\(options\?\.voiceMode \|\| 'standard'\)/)
  assert.match(workspaceSource, /const isVoiceDesign = !referenceAsset && requestedVoiceMode === 'design'/)
  assert.match(workspaceSource, /const isStandardVoice = !referenceAsset && !isVoiceDesign/)
  assert.match(workspaceSource, /IRODORI_VOICE_DESIGN_DEPENDENCY_ID/)
  assert.match(workspaceSource, /isVoiceDesign \? IRODORI_VOICE_DESIGN_MODEL_FILENAME : IRODORI_TTS_MODEL_FILENAME/)
  assert.match(dependencySource, /jupo\.IrodoriTTS\.VoiceDesignConfig/)
  assert.match(installCatalogSource, /irodori-tts-500m-v2-VoiceDesign\.safetensors/)
  assert.match(installCatalogSource, /8b703c28e88f160dee0258b1136f8fe1ea68c063b45fc28375b5a134d6ce1131/)
  assert.match(registrySource, /starterPackDependencyIds: \[IRODORI_ANIME_DEPENDENCY_ID, IRODORI_VOICE_DESIGN_DEPENDENCY_ID\]/)
  assert.match(registrySource, /\[IRODORI_VOICE_DESIGN_DEPENDENCY_ID\]: getBundledWorkflowPath\('irodori_tts_voice_clone\.json'\)/)
  assert.match(setupManagerSource, /WORKFLOW_SETUP_DEPENDENCY_ONLY_WORKFLOWS/)
  assert.match(workspaceSource, /onOpenWorkflowSetup\?\.\(\{ workflowIds: \[dependencyId\] \}\)/)
})
