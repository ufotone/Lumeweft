import { AINVFX_FLUID_MODELS, AINVFX_FLUID_NODES } from './ainvfxFluidConfig.js'
import { VDN_H3_STAGE_FILES } from './vdnH3Config.js'
/**
 * Workflow dependency manifests used for preflight checks before queueing jobs.
 * Phase 1 intentionally focuses on required dependencies only.
 */

import { TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID } from './topazVideoUpscaleConfig.js'
import { MUSIC_VIDEO_SHOT_WORKFLOW_ID, VOCAL_EXTRACT_WORKFLOW_ID } from './musicVideoShotConfig.js'
import {
  ELEVENLABS_TTS_WORKFLOW_ID,
  IRODORI_ANIME_DEPENDENCY_ID,
  IRODORI_ANIME_MODEL_FILENAME,
  IRODORI_TTS_MODEL_FILENAME,
  IRODORI_TTS_WORKFLOW_ID,
  IRODORI_VOICE_CLONE_WORKFLOW_ID,
  IRODORI_VOICE_DESIGN_DEPENDENCY_ID,
  IRODORI_VOICE_DESIGN_MODEL_FILENAME,
  SHORT_FILM_DIALOGUE_VIDEO_WORKFLOW_ID,
} from './shortFilmConfig.js'
import { getImportedDependencyPack } from './importedWorkflowRegistry.js'

const COMFY_REGISTRY_URL = 'https://registry.comfy.org'
const NANO_BANANA_2_FALLBACK_ESTIMATED_CREDITS = Object.freeze({
  // Resolution-dependent partner-node pricing currently spans roughly $0.0696-$0.123 per image.
  // Converted using Comfy's documented 211 credits = $1 rate.
  min: 14.6856,
  max: 25.953,
})

const QWEN_IMAGE_EDIT_SHARED_MODELS = Object.freeze([
  {
    classType: 'VAELoader',
    inputKey: 'vae_name',
    filename: 'qwen_image_vae.safetensors',
    targetSubdir: 'vae',
  },
  {
    classType: 'CLIPLoaderGGUF',
    inputKey: 'clip_name',
    filename: 'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
    targetSubdir: 'text_encoders',
  },
  {
    // ComfyUI-GGUF discovers the matching mmproj beside the selected encoder.
    // Keep it as an explicit dependency even though it is not a node widget.
    classType: 'CLIPLoaderGGUF',
    inputKey: 'clip_name',
    filename: 'Qwen2.5-VL-7B-Instruct-mmproj-BF16.gguf',
    targetSubdir: 'text_encoders',
  },
  {
    classType: 'UnetLoaderGGUF',
    inputKey: 'unet_name',
    filename: 'Qwen-Image-Edit-2509-Q4_K_M.gguf',
    targetSubdir: 'diffusion_models',
  },
  {
    classType: 'LoraLoaderModelOnly',
    inputKey: 'lora_name',
    filename: 'Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors',
    targetSubdir: 'loras',
  },
])

const QWEN_IMAGE_21_HERETIC_REQUIRED_NODES = Object.freeze([
  'UNETLoader', 'CLIPLoaderGGUF', 'VAELoader', 'TextEncodeQwenImage21',
  'KSampler', 'VAEDecode', 'SaveImage',
].map(classType => ({ classType })))

const QWEN_IMAGE_21_HERETIC_NODE_PACKS = Object.freeze([
  { id: 'comfyui-gguf-qwen3vl-te', installDirName: 'ComfyUI-GGUF-Qwen3VL-TE' },
])

const QWEN_IMAGE_21_HERETIC_MODELS = Object.freeze([
  { classType: 'UNETLoader', inputKey: 'unet_name', filename: 'qwen_image_2.1_int8_convrot.safetensors', targetSubdir: 'diffusion_models' },
  { classType: 'CLIPLoaderGGUF', inputKey: 'clip_name', filename: 'qwen3vl_8b_heretic-Q4_K_M.gguf', targetSubdir: 'text_encoders' },
  { classType: 'CLIPLoaderGGUF', inputKey: 'clip_name', filename: 'mmproj-qwen3vl_8b_heretic-f16.gguf', targetSubdir: 'text_encoders', exactPath: true },
  { classType: 'VAELoader', inputKey: 'vae_name', filename: 'qwen_image_2.1_vae_bf16.safetensors', targetSubdir: 'vae' },
])

const QWEN_IMAGE_21_NSFW_LORA_MODELS = Object.freeze([
  ...QWEN_IMAGE_21_HERETIC_MODELS,
  { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: 'NSFW Qwen Lora.safetensors', targetSubdir: 'loras' },
])

const QWEN_MULTI_ANGLE_2511_MODELS = Object.freeze([
  {
    classType: 'VAELoader',
    inputKey: 'vae_name',
    filename: 'qwen_image_vae.safetensors',
    targetSubdir: 'vae',
  },
  {
    classType: 'CLIPLoader',
    inputKey: 'clip_name',
    filename: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
    targetSubdir: 'text_encoders',
  },
  {
    classType: 'UnetLoaderGGUF',
    inputKey: 'unet_name',
    filename: 'qwen-image-edit-2511-Q5_K_M.gguf',
    targetSubdir: 'diffusion_models',
  },
  {
    classType: 'LoraLoaderModelOnly',
    inputKey: 'lora_name',
    filename: 'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',
    targetSubdir: 'loras',
  },
  {
    classType: 'LoraLoaderModelOnly',
    inputKey: 'lora_name',
    filename: 'qwen-image-edit-2511-multiple-angles-lora.safetensors',
    targetSubdir: 'loras',
  },
])

const QWEN_IMAGE_EDIT_REQUIRED_NODES = Object.freeze([
  { classType: 'UnetLoaderGGUF' },
  { classType: 'CLIPLoaderGGUF' },
  { classType: 'TextEncodeQwenImageEditPlus' },
  { classType: 'FluxKontextImageScale' },
  { classType: 'ImageToMask' },
  { classType: 'ImageCompositeMasked' },
  { classType: 'KSampler' },
  { classType: 'SaveImage' },
])

export const WORKFLOW_DEPENDENCY_PACKS = Object.freeze({
  'ainvfx-fluid': Object.freeze({
    id: 'ainvfx-fluid', displayName: 'AInVFX Fluid (LTX 2.5)',
    requiredNodes: Object.freeze(AINVFX_FLUID_NODES.map(classType => ({ classType }))),
    requiredModels: AINVFX_FLUID_MODELS,
    docsUrl: 'https://huggingface.co/AInVFX/ainvfx-fluid',
  }),
  'tk-toolkit': Object.freeze({
    id: 'tk-toolkit',
    displayName: 'TK Toolkit',
    requiredNodes: Object.freeze([
      { classType: 'TK Batch LoRA Loader' },
    ]),
    requiredModels: Object.freeze([]),
    docsUrl: 'https://github.com/Ararararararaki/comfyui-anima-toolkit',
  }),
  'anima-lora-upscale': Object.freeze({
    id: 'anima-lora-upscale',
    displayName: 'ANIMA Multi-LoRA + Upscale',
    requiredNodes: Object.freeze([
      { classType: 'CheckpointLoaderSimple' },
      { classType: 'LoraLoader' },
      { classType: 'CLIPTextEncode' },
      { classType: 'EmptyLatentImage' },
      { classType: 'Flux2Scheduler' },
      { classType: 'ClownsharKSampler_Beta' },
      { classType: 'VAEDecode' },
      { classType: 'UpscaleModelLoader' },
      { classType: 'ImageUpscaleWithModel' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    docsUrl: 'https://civitai.com/models/2637356/anima-lora-upscaler-resizer',
  }),
  'vdn-h3-t2va': Object.freeze({
    id: 'vdn-h3-t2va', displayName: 'VDN-H3 8step',
    requiredNodes: Object.freeze([
      { classType: 'UNETLoader' },
      { classType: 'CLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'MiniMaxH3ImageToVideo' },
      { classType: 'RandomNoise' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'BasicScheduler' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'VAEDecode' },
      { classType: 'VAEDecodeAudio' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
      { classType: 'ApplyVDNH3' },
    ]),
    requiredModels: Object.freeze([
      { classType: 'UNETLoader', inputKey: 'unet_name', filename: 'minimax_h3_fl2va_int8_convrot.safetensors', targetSubdir: 'diffusion_models' },
      { classType: 'CLIPLoader', inputKey: 'clip_name', filename: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_int8_convrot.safetensors', targetSubdir: 'vae' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
      ...VDN_H3_STAGE_FILES.map(file => ({ classType: 'ApplyVDNH3', inputKey: 'vdn_checkpoint', filename: file.filename, targetSubdir: file.targetSubdir, exactPath: true })),
    ]),
    docsUrl: 'https://github.com/Saganaki22/ComfyUI-VDN-H3',
  }),
  'fast-minimax-h3-t2va': Object.freeze({
    id: 'fast-minimax-h3-t2va',
    displayName: 'Fast MiniMax H3 T2VA (Anime)',
    requiredNodes: Object.freeze([
      { classType: 'DiffusionModelLoaderKJ' },
      { classType: 'CLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'MiniMaxH3ReferenceToVideo' },
      { classType: 'RandomNoise' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'ManualSigmas' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'VAEDecode' },
      { classType: 'VAEDecodeAudio' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
      { classType: 'MiniMaxH3SigmaShift' },
      { classType: 'LoadImage' },
      { classType: 'LoadAudio' },
    ]),
    requiredModels: Object.freeze([
      { classType: 'DiffusionModelLoaderKJ', inputKey: 'model_name', filename: 'minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors', targetSubdir: 'diffusion_models' },
      { classType: 'CLIPLoader', inputKey: 'clip_name', filename: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_int8_convrot.safetensors', targetSubdir: 'vae' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
    ]),
    docsUrl: 'https://civitai.red/models/2906467?modelVersionId=3291309',
  }),
  'minimax-h3-360-orbit': Object.freeze({
    id: 'minimax-h3-360-orbit',
    displayName: 'H3バレットタイム',
    requiredNodes: Object.freeze([
      'LoadImage', 'UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly',
      'MiniMaxH3ImageToVideo', 'RandomNoise', 'BasicGuider', 'KSamplerSelect',
      'BasicScheduler', 'SamplerCustomAdvanced', 'VAEDecode', 'CreateVideo', 'SaveVideo',
    ].map(classType => ({ classType }))),
    requiredModels: Object.freeze([
      { classType: 'UNETLoader', inputKey: 'unet_name', filename: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', targetSubdir: 'diffusion_models' },
      { classType: 'CLIPLoader', inputKey: 'clip_name', filename: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_int8_convrot.safetensors', targetSubdir: 'vae' },
      { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: 'minimax_h3_flf2v_lora_v1.safetensors', targetSubdir: 'loras' },
    ]),
    docsUrl: 'https://huggingface.co/pablodawson/MiniMax-H3-360-Orbit-LoRA',
  }),
  'minimax-h3-handheld': Object.freeze({
    id: 'minimax-h3-handheld',
    displayName: 'H3ハンドヘルドカメラ',
    requiredNodes: Object.freeze([
      'LoadImage', 'UNETLoader', 'CLIPLoader', 'VAELoader', 'LoraLoaderModelOnly',
      'MiniMaxH3ImageToVideo', 'RandomNoise', 'BasicGuider', 'KSamplerSelect',
      'BasicScheduler', 'SamplerCustomAdvanced', 'VAEDecode', 'VAEDecodeAudio',
      'CreateVideo', 'SaveVideo',
    ].map(classType => ({ classType }))),
    requiredModels: Object.freeze([
      { classType: 'UNETLoader', inputKey: 'unet_name', filename: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', targetSubdir: 'diffusion_models' },
      { classType: 'CLIPLoader', inputKey: 'clip_name', filename: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_int8_convrot.safetensors', targetSubdir: 'vae' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
      { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: 'handheld_h3_100.safetensors', targetSubdir: 'loras' },
    ]),
    docsUrl: 'https://huggingface.co/neph1/minimax_h3_handheld_shaky_camera',
  }),
  'minimax-h3-pink-reference': Object.freeze({
    id: 'minimax-h3-pink-reference',
    displayName: 'MiniMax H3 PinkFluffyBunny Reference Video',
    requiredNodes: Object.freeze([
      { classType: 'VHS_LoadVideo' },
      { classType: 'H3ModelLoaderAny' },
      { classType: 'H3ClipLoaderAny' },
      { classType: 'UnetLoaderGGUF' },
      { classType: 'CLIPLoaderGGUF' },
      { classType: 'VAELoader' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'PathchSageAttentionKJ' },
      { classType: 'MiniMaxH3SigmaShift' },
      { classType: 'MiniMaxH3ReferenceToVideo' },
      { classType: 'RandomNoise' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'BasicScheduler' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'VAEDecode' },
      { classType: 'VAEDecodeAudio' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
      { classType: 'LoadImage' },
    ]),
    requiredModels: Object.freeze([
      { classType: 'H3ModelLoaderAny', inputKey: 'model_name', filename: 'minimax-h3-ref2va-Q4_0.gguf', targetSubdir: 'diffusion_models' },
      { classType: 'H3ClipLoaderAny', inputKey: 'clip_name', filename: 'MiniMax-H3-encoder-Q4_K_M.gguf', targetSubdir: 'text_encoders' },
      { classType: 'H3ClipLoaderAny', inputKey: 'mmproj_name', filename: 'MiniMax-H3-encoder-mmproj-F16.gguf', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_fp16.safetensors', targetSubdir: 'vae' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
      { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: 'PinkFluffyBunny-unpruned-v2-rank128.safetensors', targetSubdir: 'loras' },
    ]),
    docsUrl: 'https://huggingface.co/SexGod1979/PinkFluffyBunny-MiniMax-H3',
  }),
  'minimax-h3-gguf-r2v': Object.freeze({
    id: 'minimax-h3-gguf-r2v',
    displayName: 'MiniMax H3 GGUF Reference Video to Video',
    requiredNodes: Object.freeze([
      { classType: 'PathchSageAttentionKJ' },
      { classType: 'VHS_LoadVideo' },
      { classType: 'H3ModelLoaderAny' },
      { classType: 'H3ClipLoaderAny' },
      { classType: 'VAELoader' },
      { classType: 'MiniMaxH3ReferenceToVideo' },
      { classType: 'RandomNoise' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'BasicScheduler' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'MiniMaxH3SigmaShift' },
      { classType: 'VAEDecode' },
      { classType: 'VAEDecodeAudio' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
      { classType: 'LoadImage' },
      { classType: 'UnetLoaderGGUF' },
      { classType: 'CLIPLoaderGGUF' },
    ]),
    requiredModels: Object.freeze([
      { classType: 'H3ModelLoaderAny', inputKey: 'model_name', filename: 'minimax-h3-ref2va-Q4_0.gguf', targetSubdir: 'diffusion_models' },
      { classType: 'H3ClipLoaderAny', inputKey: 'clip_name', filename: 'MiniMax-H3-encoder-Q4_K_M.gguf', targetSubdir: 'text_encoders' },
      { classType: 'H3ClipLoaderAny', inputKey: 'mmproj_name', filename: 'MiniMax-H3-encoder-mmproj-F16.gguf', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_fp16.safetensors', targetSubdir: 'vae' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
      { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: 'MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors', targetSubdir: 'loras' },
    ]),
    docsUrl: 'https://huggingface.co/Kijai/MiniMax-H3-experimental/tree/main/loras',
  }),
  'minimax-h3-character-sheet': Object.freeze({
    id: 'minimax-h3-character-sheet',
    displayName: 'MiniMax H3 Character Sheet (4 Panel)',
    requiredNodes: Object.freeze([
      { classType: 'LoadImage' },
      { classType: 'H3ModelLoaderAny' },
      { classType: 'H3ClipLoaderAny' },
      { classType: 'UnetLoaderGGUF' },
      { classType: 'CLIPLoaderGGUF' },
      { classType: 'VAELoader' },
      { classType: 'MiniMaxH3ReferenceToVideo' },
      { classType: 'RandomNoise' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'BasicScheduler' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'VAEDecode' },
      { classType: 'ImageFromBatch' },
      { classType: 'ImageStitch' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([
      { classType: 'H3ModelLoaderAny', inputKey: 'model_name', filename: 'minimax-h3-ref2va-Q4_0.gguf', targetSubdir: 'diffusion_models' },
      { classType: 'H3ClipLoaderAny', inputKey: 'clip_name', filename: 'MiniMax-H3-encoder-Q4_K_M.gguf', targetSubdir: 'text_encoders' },
      { classType: 'H3ClipLoaderAny', inputKey: 'mmproj_name', filename: 'MiniMax-H3-encoder-mmproj-F16.gguf', targetSubdir: 'text_encoders' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_fp16.safetensors', targetSubdir: 'vae' },
      { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
    ]),
    docsUrl: 'https://huggingface.co/PoopMan333/H3_Character_Sheet_Generator',
  }),
  'minimax-h3-gguf-i2v': Object.freeze({
    id: 'minimax-h3-gguf-i2v',
    displayName: 'MiniMax H3 Fused Turbo + SLA Image-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'UNETLoader' },
      { classType: 'CLIPLoader' },
      { classType: 'MiniMaxChunkFeedForward' },
      { classType: 'H3SLAAttention' },
      { classType: 'MiniMaxH3ImageToVideo' },
      { classType: 'MiniMaxH3SigmaShift' },
      { classType: 'VAEDecodeAudio' },
      { classType: 'VAEDecode' },
      { classType: 'VAELoader' },
      { classType: 'BasicScheduler' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'RandomNoise' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'minimax_h3_video_vae_int8_convrot.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'minimax_h3_audio_vae_fp32.safetensors',
        targetSubdir: 'vae',
      },
    ]),
    docsUrl: 'https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot',
  }),
  'minimax-h3-media-promptor': Object.freeze({
    id: 'minimax-h3-media-promptor',
    displayName: 'Media to Prompt (MiniMax H3 Promptor)',
    requiredNodes: Object.freeze([
      { classType: 'H3_Vision' },
      { classType: 'H3_Promptor' },
      { classType: 'PreviewAny' },
    ]),
    requiredModels: Object.freeze([]),
  }),
  'wan22-i2v': Object.freeze({
    id: 'wan22-i2v',
    displayName: 'WAN 2.2 Image-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoaderGGUF' },
      { classType: 'VAELoader' },
      { classType: 'UnetLoaderGGUF' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'WanImageToVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'CLIPLoaderGGUF',
        inputKey: 'clip_name',
        filename: 'umt5-xxl-encoder-Q4_K_M.gguf',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'wan_2.1_vae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'UnetLoaderGGUF',
        inputKey: 'unet_name',
        filename: 'Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'UnetLoaderGGUF',
        inputKey: 'unet_name',
        filename: 'Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors',
        targetSubdir: 'loras',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'wan22-t2v': Object.freeze({
    id: 'wan22-t2v',
    displayName: 'WAN 2.2 Text-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoaderGGUF' },
      { classType: 'VAELoader' },
      { classType: 'UnetLoaderGGUF' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'ModelSamplingSD3' },
      { classType: 'EmptyHunyuanLatentVideo' },
      { classType: 'KSamplerAdvanced' },
      { classType: 'ComfySwitchNode' },
      { classType: 'ComfyMathExpression' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'CLIPLoaderGGUF',
        inputKey: 'clip_name',
        filename: 'umt5-xxl-encoder-Q4_K_M.gguf',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'wan_2.1_vae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'UnetLoaderGGUF',
        inputKey: 'unet_name',
        filename: 'Wan2.2-T2V-A14B-LowNoise-Q4_K_M.gguf',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'UnetLoaderGGUF',
        inputKey: 'unet_name',
        filename: 'Wan2.2-T2V-A14B-HighNoise-Q4_K_M.gguf',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors',
        targetSubdir: 'loras',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'nsfw-wan-1-3b-e10-t2v': Object.freeze({
    id: 'nsfw-wan-1-3b-e10-t2v',
    displayName: 'NSFW Wan 1.3B e10 Text-to-Video',
    requiredNodes: Object.freeze([
      'UNETLoader', 'CLIPLoader', 'VAELoader', 'CLIPTextEncode',
      'EmptyHunyuanLatentVideo', 'ModelSamplingSD3', 'KSampler',
      'VAEDecode', 'CreateVideo', 'SaveVideo',
    ].map(classType => ({ classType }))),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'wan_1.3B_e10.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'wan_2.1_vae.safetensors',
        targetSubdir: 'vae',
      },
    ]),
    docsUrl: 'https://huggingface.co/NSFW-API/NSFW_Wan_1.3b/blob/main/wan_1.3B_e10.safetensors',
  }),

  'ltx23-i2v': Object.freeze({
    id: 'ltx23-i2v',
    displayName: 'LTX 2.3 Image-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'CheckpointLoaderSimple' },
      { classType: 'LTXAVTextEncoderLoader' },
      { classType: 'LTXVAudioVAELoader' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'LoraLoader' },
      { classType: 'ComfyMathExpression' },
      { classType: 'ComfySwitchNode' },
      { classType: 'TextGenerateLTX2Prompt' },
      { classType: 'ResizeImageMaskNode' },
      { classType: 'ResizeImagesByLongerEdge' },
      { classType: 'LTXVPreprocess' },
      { classType: 'EmptyLTXVLatentVideo' },
      { classType: 'LTXVImgToVideoInplace' },
      { classType: 'LTXVConditioning' },
      { classType: 'LTXVCropGuides' },
      { classType: 'LTXVEmptyLatentAudio' },
      { classType: 'LTXVSeparateAVLatent' },
      { classType: 'LTXVConcatAVLatent' },
      { classType: 'LTXVLatentUpsampler' },
      { classType: 'LatentUpscaleModelLoader' },
      { classType: 'LTXVAudioVAEDecode' },
      { classType: 'VAEDecodeTiled' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'CheckpointLoaderSimple',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LTXVAudioVAELoader',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LTXAVTextEncoderLoader',
        inputKey: 'text_encoder',
        filename: 'gemma_3_12B_it_fp4_mixed.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'LTXAVTextEncoderLoader',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'LoraLoader',
        inputKey: 'lora_name',
        filename: 'gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'LatentUpscaleModelLoader',
        inputKey: 'model_name',
        filename: 'ltx-2.3-spatial-upscaler-x2-1.1.safetensors',
        targetSubdir: 'latent_upscale_models',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'ltx23-latentsync': Object.freeze({
    id: 'ltx23-latentsync',
    displayName: 'Exact Audio Lip-Sync (LTX 2.3 Native)',
    requiredNodes: Object.freeze([
      { classType: 'CheckpointLoaderSimple' },
      { classType: 'LTXAVTextEncoderLoader' },
      { classType: 'LTXVAudioVAELoader' },
      { classType: 'LTXVAudioVAEEncode' },
      { classType: 'LTXVSetAudioRefTokens' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'LoraLoader' },
      { classType: 'ComfyMathExpression' },
      { classType: 'ComfySwitchNode' },
      { classType: 'TextGenerateLTX2Prompt' },
      { classType: 'ResizeImageMaskNode' },
      { classType: 'ResizeImagesByLongerEdge' },
      { classType: 'LTXVPreprocess' },
      { classType: 'EmptyLTXVLatentVideo' },
      { classType: 'LTXVImgToVideoInplace' },
      { classType: 'LTXVConditioning' },
      { classType: 'LTXVCropGuides' },
      { classType: 'LTXVEmptyLatentAudio' },
      { classType: 'LTXVSeparateAVLatent' },
      { classType: 'LTXVConcatAVLatent' },
      { classType: 'LTXVLatentUpsampler' },
      { classType: 'LatentUpscaleModelLoader' },
      { classType: 'LTXVAudioVAEDecode' },
      { classType: 'VAEDecodeTiled' },
      { classType: 'LoadAudio' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      { classType: 'CheckpointLoaderSimple', inputKey: 'ckpt_name', filename: 'ltx-2.3-22b-dev-fp8.safetensors', targetSubdir: 'checkpoints' },
      { classType: 'LTXVAudioVAELoader', inputKey: 'ckpt_name', filename: 'ltx-2.3-22b-dev-fp8.safetensors', targetSubdir: 'checkpoints' },
      { classType: 'LTXAVTextEncoderLoader', inputKey: 'text_encoder', filename: 'gemma_3_12B_it_fp4_mixed.safetensors', targetSubdir: 'text_encoders' },
      { classType: 'LTXAVTextEncoderLoader', inputKey: 'ckpt_name', filename: 'ltx-2.3-22b-dev-fp8.safetensors', targetSubdir: 'checkpoints' },
      { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: 'ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors', targetSubdir: 'loras' },
      { classType: 'LoraLoader', inputKey: 'lora_name', filename: 'gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors', targetSubdir: 'loras' },
      { classType: 'LatentUpscaleModelLoader', inputKey: 'model_name', filename: 'ltx-2.3-spatial-upscaler-x2-1.1.safetensors', targetSubdir: 'latent_upscale_models' },
    ]),
    docsUrl: 'https://docs.comfy.org/tutorials/video/ltx/ltx-2-3',
  }),

  'ltx23-ia2v': Object.freeze({
    id: 'ltx23-ia2v',
    displayName: 'LTX 2.3 Image + Audio-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'CheckpointLoaderSimple' },
      { classType: 'LTXAVTextEncoderLoader' },
      { classType: 'LTXVAudioVAELoader' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'LoadAudio' },
      { classType: 'TrimAudioDuration' },
      { classType: 'LTXVAudioVAEEncode' },
      { classType: 'ResizeImageMaskNode' },
      { classType: 'ResizeImagesByLongerEdge' },
      { classType: 'LTXVPreprocess' },
      { classType: 'EmptyLTXVLatentVideo' },
      { classType: 'LTXVImgToVideoInplace' },
      { classType: 'LTXVConditioning' },
      { classType: 'LTXVCropGuides' },
      { classType: 'LTXVSeparateAVLatent' },
      { classType: 'LTXVConcatAVLatent' },
      { classType: 'LTXVLatentUpsampler' },
      { classType: 'LatentUpscaleModelLoader' },
      { classType: 'LTXVAudioVAEDecode' },
      { classType: 'VAEDecodeTiled' },
      { classType: 'SetLatentNoiseMask' },
      { classType: 'KSamplerSelect' },
      { classType: 'ManualSigmas' },
      { classType: 'CFGGuider' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'RandomNoise' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'CheckpointLoaderSimple',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LTXVAudioVAELoader',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LTXAVTextEncoderLoader',
        inputKey: 'text_encoder',
        filename: 'gemma_3_12B_it_fp4_mixed.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'LTXAVTextEncoderLoader',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'ltx-2.3-22b-distilled-lora-384.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'LatentUpscaleModelLoader',
        inputKey: 'model_name',
        filename: 'ltx-2.3-spatial-upscaler-x2-1.1.safetensors',
        targetSubdir: 'latent_upscale_models',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'ltx23-t2v': Object.freeze({
    id: 'ltx23-t2v',
    displayName: 'LTX 2.3 Text-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'CheckpointLoaderSimple' },
      { classType: 'LTXAVTextEncoderLoader' },
      { classType: 'LTXVAudioVAELoader' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'ResizeImageMaskNode' },
      { classType: 'ResizeImagesByLongerEdge' },
      { classType: 'LTXVPreprocess' },
      { classType: 'EmptyLTXVLatentVideo' },
      { classType: 'LTXVEmptyLatentAudio' },
      { classType: 'LTXVImgToVideoInplace' },
      { classType: 'LTXVConditioning' },
      { classType: 'LTXVCropGuides' },
      { classType: 'LTXVSeparateAVLatent' },
      { classType: 'LTXVConcatAVLatent' },
      { classType: 'LTXVLatentUpsampler' },
      { classType: 'LatentUpscaleModelLoader' },
      { classType: 'LTXVAudioVAEDecode' },
      { classType: 'VAEDecodeTiled' },
      { classType: 'KSamplerSelect' },
      { classType: 'ManualSigmas' },
      { classType: 'CFGGuider' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'RandomNoise' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'CheckpointLoaderSimple',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LTXVAudioVAELoader',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LTXAVTextEncoderLoader',
        inputKey: 'text_encoder',
        filename: 'gemma_3_12B_it_fp4_mixed.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'LTXAVTextEncoderLoader',
        inputKey: 'ckpt_name',
        filename: 'ltx-2.3-22b-dev-fp8.safetensors',
        targetSubdir: 'checkpoints',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'ltx-2.3-22b-distilled-lora-384.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'LatentUpscaleModelLoader',
        inputKey: 'model_name',
        filename: 'ltx-2.3-spatial-upscaler-x2-1.1.safetensors',
        targetSubdir: 'latent_upscale_models',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'kling-o3-i2v': Object.freeze({
    id: 'kling-o3-i2v',
    displayName: 'Kling O3 Omni Image-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'KlingOmniProImageToVideoNode' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'grok-video-i2v': Object.freeze({
    id: 'grok-video-i2v',
    displayName: 'Grok Imagine Video',
    requiredNodes: Object.freeze([
      { classType: 'GrokVideoNode' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'vidu-q2-i2v': Object.freeze({
    id: 'vidu-q2-i2v',
    displayName: 'Vidu Q2 Image-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'Vidu2ImageToVideoNode' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'seedance2-t2v': Object.freeze({
    id: 'seedance2-t2v',
    displayName: 'Seedance 2.0 Text-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'ByteDance2TextToVideoNode' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'seedance2-mini-t2v': Object.freeze({
    id: 'seedance2-mini-t2v',
    displayName: 'Seedance 2.0 Mini Text-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'ByteDance2TextToVideoNode' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'seedance2-mini-r2v': Object.freeze({
    id: 'seedance2-mini-r2v',
    displayName: 'Seedance 2.0 Mini Reference + Audio Guide',
    requiredNodes: Object.freeze([
      { classType: 'ByteDance2ReferenceNode' },
      { classType: 'LoadImage' },
      { classType: 'LoadVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'seedance2-flf2v': Object.freeze({
    id: 'seedance2-flf2v',
    displayName: 'Seedance 2.0 First/Last Frame-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'ByteDance2FirstLastFrameNode' },
      { classType: 'LoadImage' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'seedance2-r2v': Object.freeze({
    id: 'seedance2-r2v',
    displayName: 'Seedance 2.0 Reference-to-Video',
    requiredNodes: Object.freeze([
      { classType: 'ByteDance2ReferenceNode' },
      { classType: 'LoadImage' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  [TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID]: Object.freeze({
    id: TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID,
    displayName: 'Topaz Video Upscale',
    requiredNodes: Object.freeze([
      { classType: 'LoadVideo' },
      { classType: 'TopazVideoEnhance' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  [MUSIC_VIDEO_SHOT_WORKFLOW_ID]: Object.freeze({
    id: MUSIC_VIDEO_SHOT_WORKFLOW_ID,
    displayName: 'LTX 2.3 Music Video (Image + Audio)',
    requiredNodes: Object.freeze([
      // LTX 2.3 audio-conditioned graph
      { classType: 'UNETLoader' },
      { classType: 'DualCLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'VAELoaderKJ' },
      { classType: 'LTX2AttentionTunerPatch' },
      { classType: 'LTX2SamplingPreviewOverride' },
      { classType: 'LTX2_NAG' },
      { classType: 'LTXVAudioVAEEncode' },
      { classType: 'LTXVChunkFeedForward' },
      { classType: 'LTXVConcatAVLatent' },
      { classType: 'LTXVConditioning' },
      { classType: 'LTXVImgToVideoInplace' },
      { classType: 'LTXVLatentUpsampler' },
      { classType: 'LTXVPreprocess' },
      { classType: 'LTXVSeparateAVLatent' },
      { classType: 'LatentUpscaleModelLoader' },
      { classType: 'TextGenerateLTX2Prompt' },
      // Audio handling + vocal stem fallback
      { classType: 'LoadAudio' },
      { classType: 'TrimAudioDuration' },
      { classType: 'MelBandRoFormerModelLoader' },
      { classType: 'MelBandRoFormerSampler' },
      // KJ Nodes helpers
      { classType: 'ImageResizeKJv2' },
      { classType: 'ResizeImageMaskNode' },
      { classType: 'ResizeImagesByLongerEdge' },
      { classType: 'GetImageSizeAndCount' },
      { classType: 'SimpleCalculatorKJ' },
      { classType: 'LazySwitchKJ' },
      { classType: 'PathchSageAttentionKJ' },
      // rgthree
      { classType: 'Power Lora Loader (rgthree)' },
      // easy-use / comfy switch
      { classType: 'ComfySwitchNode' },
      // Output
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'ltx-2.3-22b-distilled_transformer_only_fp8_scaled.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'LTX23_video_vae_bf16.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'taeltx2_3.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'VAELoaderKJ',
        inputKey: 'vae_name',
        filename: 'LTX23_audio_vae_bf16.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'DualCLIPLoader',
        inputKey: 'clip_name1',
        filename: 'gemma_3_12B_it_fp8_scaled.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'DualCLIPLoader',
        inputKey: 'clip_name2',
        filename: 'ltx-2.3_text_projection_bf16.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'LatentUpscaleModelLoader',
        inputKey: 'model_name',
        filename: 'ltx-2.3-spatial-upscaler-x2-1.1.safetensors',
        targetSubdir: 'latent_upscale_models',
      },
      {
        classType: 'MelBandRoFormerModelLoader',
        inputKey: 'model_name',
        filename: 'MelBandRoformer_fp16.safetensors',
        targetSubdir: 'audio_checkpoints',
      },
      // LoRAs — Power Lora Loader holds them in its lora_1..lora_4 slots.
      // The dep checker scans by basename, so sub-folder prefixes in the
      // workflow (e.g. "LTX\\LTX-2\\ID-Lora\\...") don't affect matching.
      {
        classType: 'Power Lora Loader (rgthree)',
        inputKey: 'lora',
        filename: 'LTX-2.3-22b-AV-LoRA-talking-head-v1.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'Power Lora Loader (rgthree)',
        inputKey: 'lora',
        filename: 'Ltx2.3-Licon-VBVR-I2V-96000-R32.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'Power Lora Loader (rgthree)',
        inputKey: 'lora',
        filename: 'LTX-2-Image2Vid-Adapter.safetensors',
        targetSubdir: 'loras',
      },
      {
        classType: 'Power Lora Loader (rgthree)',
        inputKey: 'lora',
        filename: 'ltx-2-19b-lora-camera-control-dolly-out.safetensors',
        targetSubdir: 'loras',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  [VOCAL_EXTRACT_WORKFLOW_ID]: Object.freeze({
    id: VOCAL_EXTRACT_WORKFLOW_ID,
    displayName: 'Vocal Extract (Mel-Band RoFormer)',
    requiredNodes: Object.freeze([
      { classType: 'LoadAudio' },
      { classType: 'MelBandRoFormerModelLoader' },
      { classType: 'MelBandRoFormerSampler' },
      { classType: 'SaveAudioMP3' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'MelBandRoFormerModelLoader',
        inputKey: 'model_name',
        filename: 'MelBandRoformer_fp16.safetensors',
        targetSubdir: 'audio_checkpoints',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'nano-banana-2': Object.freeze({
    id: 'nano-banana-2',
    displayName: 'Nano Banana 2 Image Edit (Cloud)',
    requiredNodes: Object.freeze([
      { classType: 'GeminiNanoBanana2' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    fallbackEstimatedCredits: NANO_BANANA_2_FALLBACK_ESTIMATED_CREDITS,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'grok-text-to-image': Object.freeze({
    id: 'grok-text-to-image',
    displayName: 'Grok Imagine',
    requiredNodes: Object.freeze([
      { classType: 'GrokImageNode' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'seedream-5-lite-image-edit': Object.freeze({
    id: 'seedream-5-lite-image-edit',
    displayName: 'Seedream 5.0 Lite Image Edit',
    requiredNodes: Object.freeze([
      { classType: 'ByteDanceSeedreamNode' },
      { classType: 'BatchImagesNode' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'gpt-image-2-t2i': Object.freeze({
    id: 'gpt-image-2-t2i',
    displayName: 'GPT Image 2 Text-to-Image',
    requiredNodes: Object.freeze([
      { classType: 'OpenAIGPTImage1' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'gpt-image-2-edit': Object.freeze({
    id: 'gpt-image-2-edit',
    displayName: 'GPT Image 2 Image Edit',
    requiredNodes: Object.freeze([
      { classType: 'OpenAIGPTImage1' },
      { classType: 'LoadImage' },
      { classType: 'StringReplace' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'gpt-image-2-ugc-keyframe': Object.freeze({
    id: 'gpt-image-2-ugc-keyframe',
    displayName: 'GPT Image 2 UGC Keyframes',
    requiredNodes: Object.freeze([
      { classType: 'OpenAIGPTImage1' },
      { classType: 'BatchImagesNode' },
      { classType: 'LoadImage' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'google-gemini-flash-lite': Object.freeze({
    id: 'google-gemini-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite Prompt Helper',
    requiredNodes: Object.freeze([
      { classType: 'GeminiNode' },
      { classType: 'PreviewAny' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'sonilo-v2m': Object.freeze({
    id: 'sonilo-v2m',
    displayName: 'Sonilo Video-to-Music',
    requiredNodes: Object.freeze([
      { classType: 'SoniloVideoToMusic' },
      { classType: 'LoadVideo' },
      { classType: 'SaveAudioMP3' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  [ELEVENLABS_TTS_WORKFLOW_ID]: Object.freeze({
    id: ELEVENLABS_TTS_WORKFLOW_ID,
    displayName: 'ElevenLabs Text to Speech',
    requiredNodes: Object.freeze([
      { classType: 'ElevenLabsTextToSpeech' },
      { classType: 'ElevenLabsVoiceSelector' },
      { classType: 'SaveAudioMP3' },
    ]),
    requiredModels: Object.freeze([]),
    requiresComfyOrgApiKey: true,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  [IRODORI_TTS_WORKFLOW_ID]: Object.freeze({
    id: IRODORI_TTS_WORKFLOW_ID,
    displayName: 'Irodori-TTS v3',
    requiredNodes: Object.freeze([
      { classType: 'jupo.IrodoriTTS.ModelLoader' },
      { classType: 'jupo.IrodoriTTS.Sampler' },
      { classType: 'SaveAudioMP3' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'jupo.IrodoriTTS.ModelLoader',
        inputKey: 'model',
        filename: IRODORI_TTS_MODEL_FILENAME,
        targetSubdir: 'checkpoints',
      },
    ]),
    docsUrl: 'https://github.com/jupo-ai/comfy-Irodori-TTS',
  }),

  [IRODORI_VOICE_CLONE_WORKFLOW_ID]: Object.freeze({
    id: IRODORI_VOICE_CLONE_WORKFLOW_ID,
    displayName: 'Irodori Voice Studio (Clone)',
    requiredNodes: Object.freeze([
      { classType: 'jupo.IrodoriTTS.ModelLoader' },
      { classType: 'jupo.IrodoriTTS.ReferenceAudio' },
      { classType: 'jupo.IrodoriTTS.CFGConfig' },
      { classType: 'jupo.IrodoriTTS.Sampler' },
      { classType: 'SaveAudioAdvanced' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'jupo.IrodoriTTS.ModelLoader',
        inputKey: 'model',
        filename: IRODORI_TTS_MODEL_FILENAME,
        targetSubdir: 'checkpoints',
      },
    ]),
    docsUrl: 'https://github.com/jupo-ai/comfy-Irodori-TTS',
  }),

  [IRODORI_VOICE_DESIGN_DEPENDENCY_ID]: Object.freeze({
    id: IRODORI_VOICE_DESIGN_DEPENDENCY_ID,
    displayName: 'Irodori Voice Design',
    requiredNodes: Object.freeze([
      { classType: 'jupo.IrodoriTTS.ModelLoader' },
      { classType: 'jupo.IrodoriTTS.VoiceDesignConfig' },
      { classType: 'jupo.IrodoriTTS.CFGConfig' },
      { classType: 'jupo.IrodoriTTS.Sampler' },
      { classType: 'SaveAudioAdvanced' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'jupo.IrodoriTTS.ModelLoader',
        inputKey: 'model',
        filename: IRODORI_VOICE_DESIGN_MODEL_FILENAME,
        targetSubdir: 'checkpoints',
      },
    ]),
    docsUrl: 'https://huggingface.co/Aratako/Irodori-TTS-500M-v2-VoiceDesign',
  }),

  [IRODORI_ANIME_DEPENDENCY_ID]: Object.freeze({
    id: IRODORI_ANIME_DEPENDENCY_ID,
    displayName: 'Irodori v4.1 Anime Voice',
    requiredNodes: Object.freeze([
      { classType: 'jupo.IrodoriTTS.ModelLoader' },
      { classType: 'jupo.IrodoriTTS.ReferenceAudio' },
      { classType: 'jupo.IrodoriTTS.CFGConfig' },
      { classType: 'jupo.IrodoriTTS.Sampler' },
      { classType: 'SaveAudioAdvanced' },
    ]),
    requiredModels: Object.freeze([{
      classType: 'jupo.IrodoriTTS.ModelLoader',
      inputKey: 'model',
      filename: IRODORI_ANIME_MODEL_FILENAME,
      targetSubdir: 'checkpoints',
    }]),
    docsUrl: 'https://huggingface.co/phasefield-audio/Irodori-TTS-v4.1-Anime',
  }),

  'z-image-turbo': Object.freeze({
    id: 'z-image-turbo',
    displayName: 'Z Image Turbo',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoaderGGUF' },
      { classType: 'VAELoader' },
      { classType: 'UnetLoaderGGUF' },
      { classType: 'ModelSamplingAuraFlow' },
      { classType: 'KSampler' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'CLIPLoaderGGUF',
        inputKey: 'clip_name',
        filename: 'Qwen3-4B-Q4_K_M.gguf',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'ae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'UnetLoaderGGUF',
        inputKey: 'unet_name',
        filename: 'z_image_turbo-Q4_K_M.gguf',
        targetSubdir: 'diffusion_models',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'image-edit': Object.freeze({
    id: 'image-edit',
    displayName: 'Qwen Image Edit',
    requiredNodes: QWEN_IMAGE_EDIT_REQUIRED_NODES,
    requiredModels: QWEN_IMAGE_EDIT_SHARED_MODELS,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'qwen-image-2-1-heretic': Object.freeze({
    id: 'qwen-image-2-1-heretic',
    displayName: 'Qwen Image 2.1 Heretic GGUF',
    requiredNodes: Object.freeze([...QWEN_IMAGE_21_HERETIC_REQUIRED_NODES, { classType: 'EmptyLatentImage' }]),
    requiredNodePacks: QWEN_IMAGE_21_HERETIC_NODE_PACKS,
    requiredModels: QWEN_IMAGE_21_HERETIC_MODELS,
    docsUrl: 'https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF',
  }),

  'qwen-image-2-1-nsfw-lora': Object.freeze({
    id: 'qwen-image-2-1-nsfw-lora',
    displayName: 'Qwen Image 2.1 NSFW LoRA',
    requiredNodes: Object.freeze([...QWEN_IMAGE_21_HERETIC_REQUIRED_NODES, { classType: 'EmptyLatentImage' }, { classType: 'LoraLoaderModelOnly' }]),
    requiredNodePacks: QWEN_IMAGE_21_HERETIC_NODE_PACKS,
    requiredModels: QWEN_IMAGE_21_NSFW_LORA_MODELS,
    docsUrl: 'https://civitai.red/models/2958918/nsfw-lora-or-qwen-image-21?modelVersionId=3351951',
  }),

  'qwen-image-2-1-heretic-edit': Object.freeze({
    id: 'qwen-image-2-1-heretic-edit',
    displayName: 'Qwen Image 2.1 Heretic Edit',
    requiredNodes: Object.freeze([...QWEN_IMAGE_21_HERETIC_REQUIRED_NODES, { classType: 'LoadImage' }]),
    requiredNodePacks: QWEN_IMAGE_21_HERETIC_NODE_PACKS,
    requiredModels: QWEN_IMAGE_21_HERETIC_MODELS,
    docsUrl: 'https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF',
  }),

  'qwen-image-2-1-character-sheet': Object.freeze({
    id: 'qwen-image-2-1-character-sheet',
    displayName: 'QWENキャラクターシート',
    requiredNodes: Object.freeze([
      ...QWEN_IMAGE_21_HERETIC_REQUIRED_NODES,
      { classType: 'LoadImage' },
      { classType: 'EmptyLatentImage' },
    ]),
    requiredNodePacks: QWEN_IMAGE_21_HERETIC_NODE_PACKS,
    requiredModels: QWEN_IMAGE_21_HERETIC_MODELS,
    docsUrl: 'https://civitai.com/models/2960750/qwen-image-21-character-design-sheet-maker-workflow',
  }),

  'dark-beast-krea2-i2i': Object.freeze({
    id: 'dark-beast-krea2-i2i',
    displayName: 'NSFW T2I / I2I — Dark Beast KREA 2',
    requiredNodes: Object.freeze([
      'UNETLoader', 'CLIPLoader', 'VAELoader', 'LoadImage', 'VAEEncode', 'EmptyLatentImage',
      'CLIPTextEncode', 'ConditioningZeroOut', 'KSampler', 'VAEDecode', 'SaveImage',
    ].map(classType => ({ classType }))),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'darkBeastH3Director_darkBeastKREA2FP8_2958418.safetensors',
        alternateFilenames: Object.freeze([
          'darkBeastH3Director_darkBeastKREA2FP8_fp8.safetensors',
        ]),
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'qwen3vl_4b_fp8_scaled.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'qwen_image_vae.safetensors',
        targetSubdir: 'vae',
      },
    ]),
    docsUrl: 'https://civitai.red/models/2242173/dark-beast-or-h3-director-edition?modelVersionId=3078453',
  }),

  'haruki-mix-krea2-t2i': Object.freeze({
    id: 'haruki-mix-krea2-t2i',
    displayName: 'HARUKI_MIX KR2 V2.0 — NSFW T2I',
    requiredNodes: Object.freeze([
      'UNETLoader', 'CLIPLoader', 'VAELoader', 'CLIPTextEncode',
      'ConditioningZeroOut', 'EmptyLatentImage', 'KSampler', 'VAEDecode', 'SaveImage',
    ].map(classType => ({ classType }))),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'harukiMIX_kr2V20Int8Convrot.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'qwen3vl_4b_fp8_scaled.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'qwen_image_vae.safetensors',
        targetSubdir: 'vae',
      },
    ]),
    docsUrl: 'https://civitai.red/models/856375/harukimix?modelVersionId=3188234',
  }),

  'image-edit-model-product': Object.freeze({
    id: 'image-edit-model-product',
    displayName: 'Qwen Image Edit (Model + Product)',
    requiredNodes: Object.freeze([
      ...QWEN_IMAGE_EDIT_REQUIRED_NODES,
      { classType: 'ImageResizeKJv2' },
    ]),
    requiredModels: QWEN_IMAGE_EDIT_SHARED_MODELS,
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'longcat-image-edit': Object.freeze({
    id: 'longcat-image-edit',
    displayName: 'LongCat Image Edit',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'UNETLoader' },
      { classType: 'TextEncodeQwenImageEdit' },
      { classType: 'FluxKontextMultiReferenceLatentMethod' },
      { classType: 'FluxGuidance' },
      { classType: 'ImageScaleToTotalPixels' },
      { classType: 'KSampler' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'ae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'longcat_image_edit_bf16.safetensors',
        targetSubdir: 'diffusion_models',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'multi-angles': Object.freeze({
    id: 'multi-angles',
    displayName: 'Multiple Angles (Character)',
    requiredNodes: Object.freeze([
      { classType: 'UnetLoaderGGUF' },
      { classType: 'TextEncodeQwenImageEditPlus' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: QWEN_MULTI_ANGLE_2511_MODELS,
    docsUrl: 'https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA',
  }),

  'multi-angles-scene': Object.freeze({
    id: 'multi-angles-scene',
    displayName: 'Multiple Angles (Scene)',
    requiredNodes: Object.freeze([
      { classType: 'UnetLoaderGGUF' },
      { classType: 'TextEncodeQwenImageEditPlus' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: QWEN_MULTI_ANGLE_2511_MODELS,
    docsUrl: 'https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA',
  }),

  'longcat-text-to-image': Object.freeze({
    id: 'longcat-text-to-image',
    displayName: 'LongCat Text-to-Image',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'UNETLoader' },
      { classType: 'CLIPTextEncode' },
      { classType: 'FluxGuidance' },
      { classType: 'CFGNorm' },
      { classType: 'EmptySD3LatentImage' },
      { classType: 'ResolutionSelector' },
      { classType: 'KSampler' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'ae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'longcat_image_bf16.safetensors',
        targetSubdir: 'diffusion_models',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'ernie-image-turbo': Object.freeze({
    id: 'ernie-image-turbo',
    displayName: 'Ernie Image Turbo',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'UNETLoader' },
      { classType: 'CLIPTextEncode' },
      { classType: 'EmptyFlux2LatentImage' },
      { classType: 'ConditioningZeroOut' },
      { classType: 'KSampler' },
      { classType: 'ComfySwitchNode' },
      { classType: 'StringReplace' },
      { classType: 'TextGenerate' },
      { classType: 'PreviewAny' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'ernie-image-turbo.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'ministral-3-3b.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'flux2-vae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'ernie-image-prompt-enhancer.safetensors',
        targetSubdir: 'text_encoders',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'flux2-text-to-image': Object.freeze({
    id: 'flux2-text-to-image',
    displayName: 'Flux 2 Text-to-Image',
    requiredNodes: Object.freeze([
      { classType: 'CLIPLoader' },
      { classType: 'VAELoader' },
      { classType: 'UNETLoader' },
      { classType: 'LoraLoaderModelOnly' },
      { classType: 'CLIPTextEncode' },
      { classType: 'EmptyFlux2LatentImage' },
      { classType: 'FluxGuidance' },
      { classType: 'Flux2Scheduler' },
      { classType: 'BasicGuider' },
      { classType: 'KSamplerSelect' },
      { classType: 'RandomNoise' },
      { classType: 'SamplerCustomAdvanced' },
      { classType: 'ComfySwitchNode' },
      { classType: 'SaveImage' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'flux2_dev_fp8mixed.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'CLIPLoader',
        inputKey: 'clip_name',
        filename: 'mistral_3_small_flux2_bf16.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'full_encoder_small_decoder.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'LoraLoaderModelOnly',
        inputKey: 'lora_name',
        filename: 'Flux_2-Turbo-LoRA_comfyui.safetensors',
        targetSubdir: 'loras',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'frame-interpolation': Object.freeze({
    id: 'frame-interpolation',
    displayName: 'Frame Interpolation',
    requiredNodes: Object.freeze([
      { classType: 'LoadVideo' },
      { classType: 'FrameInterpolationModelLoader' },
      { classType: 'FrameInterpolate' },
      { classType: 'GetVideoComponents' },
      { classType: 'ComfySwitchNode' },
      { classType: 'ComfyMathExpression' },
      { classType: 'CreateVideo' },
      { classType: 'SaveVideo' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'FrameInterpolationModelLoader',
        inputKey: 'model_name',
        filename: 'film_net_fp16.safetensors',
        targetSubdir: 'frame_interpolation',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'music-gen': Object.freeze({
    id: 'music-gen',
    displayName: 'AceStep Music Generation',
    requiredNodes: Object.freeze([
      { classType: 'TextEncodeAceStepAudio1.5' },
      { classType: 'VAEDecodeAudio' },
      { classType: 'SaveAudioMP3' },
    ]),
    requiredModels: Object.freeze([
      {
        classType: 'UNETLoader',
        inputKey: 'unet_name',
        filename: 'acestep_v1.5_turbo.safetensors',
        targetSubdir: 'diffusion_models',
      },
      {
        classType: 'VAELoader',
        inputKey: 'vae_name',
        filename: 'ace_1.5_vae.safetensors',
        targetSubdir: 'vae',
      },
      {
        classType: 'DualCLIPLoader',
        inputKey: 'clip_name1',
        filename: 'qwen_0.6b_ace15.safetensors',
        targetSubdir: 'text_encoders',
      },
      {
        classType: 'DualCLIPLoader',
        inputKey: 'clip_name2',
        filename: 'qwen_1.7b_ace15.safetensors',
        targetSubdir: 'text_encoders',
      },
    ]),
    docsUrl: COMFY_REGISTRY_URL,
  }),

  'caption-qwen-asr': Object.freeze({
    id: 'caption-qwen-asr',
    displayName: 'Caption Transcription (Qwen ASR)',
    requiredNodes: Object.freeze([
      { classType: 'VHS_LoadVideo' },
      { classType: 'VHS_LoadAudioUpload', notes: 'Needed when Music Video sends an audio asset directly to the caption workflow.' },
      { classType: 'Qwen3TTSEngineNode' },
      { classType: 'UnifiedASRTranscribeNode' },
      { classType: 'ASRPunctuationTruecaseNode' },
      { classType: 'SRTAdvancedOptionsNode' },
      { classType: 'TextToSRTBuilderNode' },
      { classType: 'ShowText|pysssss' },
    ]),
    requiredModels: Object.freeze([]),
    docsUrl: 'https://github.com/diodiogod/TTS-Audio-Suite',
  }),

  'mask-gen': Object.freeze({
    id: 'mask-gen',
    displayName: 'Mask Generation',
    requiredNodes: Object.freeze([
      { classType: 'MatAnyoneVideoMatting' },
      { classType: 'MaskToImage' },
      { classType: 'SaveImage' },
      { classType: 'VHS_LoadVideo' },
      { classType: 'SAM3Propagate' },
      { classType: 'LoadSAM3Model' },
      { classType: 'SAM3VideoSegmentation' },
      { classType: 'SAM3VideoOutput' },
      { classType: 'GetImagesFromBatchIndexed' },
      { classType: 'ImageToMask' },
    ]),
    requiredModels: Object.freeze([]),
    docsUrl: COMFY_REGISTRY_URL,
  }),
})

export function getWorkflowDependencyPack(workflowId) {
  const normalized = String(workflowId || '').trim()
  if (normalized === 'minimax-h3-character-actor') {
    const base = WORKFLOW_DEPENDENCY_PACKS['minimax-h3-gguf-r2v']
    return Object.freeze({
      ...base,
      id: normalized,
      displayName: 'H3 Fixed Characte (.char) movie — Lightweight',
      requiredNodes: Object.freeze(base.requiredNodes.filter(node => node.classType !== 'VHS_LoadVideo')),
      docsUrl: 'https://www.omnichar.org/getting-started',
    })
  }
  if (normalized === 'minimax-h3-character-swap') {
    const base = WORKFLOW_DEPENDENCY_PACKS['minimax-h3-pink-reference']
    return Object.freeze({
      ...base,
      id: normalized,
      displayName: 'MiniMax H3 Character Swap',
      docsUrl: 'https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA',
      requiredNodes: Object.freeze(base.requiredNodes.filter(node => node.classType !== 'PathchSageAttentionKJ')),
      requiredModels: Object.freeze(base.requiredModels.map(model => model.targetSubdir === 'loras'
        ? { ...model, filename: 'h3_character_swap_pro4500_1000.safetensors' }
        : model)),
    })
  }
  if (normalized === 'minimax-h3-aftermidnight-r2v' || normalized === 'minimax-h3-aftermidnight-3ref') {
    const base = WORKFLOW_DEPENDENCY_PACKS['minimax-h3-pink-reference']
    return Object.freeze({
      ...base,
      id: normalized,
      displayName: normalized === 'minimax-h3-aftermidnight-3ref'
        ? 'MiniMax H3 NSFW — Scene + Character + Props'
        : 'AfterMidnightR2V',
      docsUrl: 'https://huggingface.co/SexGod1979/AfterMidnight-MiniMax-H3-NSFW',
      requiredModels: Object.freeze(base.requiredModels.map(model => model.targetSubdir === 'loras'
        ? { ...model, filename: 'AfterMidnight_ref2va_h3_sexytime_rank64-v1.2.safetensors' }
        : model)),
    })
  }
  if (normalized === 'minimax-h3-naughty-times') {
    const base = getWorkflowDependencyPack('minimax-h3-nsfw-pink-bunny')
    return Object.freeze({
      ...base, id: 'minimax-h3-naughty-times', displayName: 'MiniMax H3 NaughtyTimes v3', docsUrl: 'https://huggingface.co/SexGod1979/NaughtyTimes-MiniMax-H3',
      requiredNodes: Object.freeze([...base.requiredNodes, { classType: 'LoadImage' }]),
      requiredModels: Object.freeze(base.requiredModels.map(model => model.targetSubdir === 'loras'
        ? { ...model, filename: 'SexGod_NaughtyTimes_v3_rank64_pruned_NOADALN.safetensors' } : model)),
    })
  }
  if (normalized === 'minimax-h3-nsfw-pink-bunny' || normalized === 'minimax-h3-nsfw-motion-8step') {
    const loraFilename = normalized === 'minimax-h3-nsfw-pink-bunny'
      ? 'PinkFluffyBunny-unpruned-v2-rank128.safetensors'
      : 'minimax-h3_fl2v_8Step_motion_enhancer.safetensors'
    return Object.freeze({
      id: normalized,
      displayName: normalized === 'minimax-h3-nsfw-pink-bunny'
        ? 'NSFW MiniMax H3 PinkFluffyBunny'
        : 'NSFW MiniMax H3 Motion Enhancer 8-step',
      requiredNodes: Object.freeze([
        'H3ModelLoaderAny', 'H3ClipLoaderAny', 'UnetLoaderGGUF', 'CLIPLoaderGGUF',
        'MiniMaxH3ImageToVideo', 'MiniMaxH3SigmaShift', 'VAEDecodeAudio', 'VAEDecode',
        'VAELoader', 'LoraLoaderModelOnly', 'BasicScheduler', 'BasicGuider',
        'KSamplerSelect', 'RandomNoise', 'SamplerCustomAdvanced', 'CreateVideo', 'SaveVideo',
      ].map(classType => ({ classType }))),
      requiredModels: Object.freeze([
        { classType: 'H3ModelLoaderAny', inputKey: 'model_name', filename: 'minimax_h3_fl2va_pruned_fp8_Q4_0.gguf', targetSubdir: 'diffusion_models' },
        { classType: 'H3ClipLoaderAny', inputKey: 'clip_name', filename: 'MiniMax-H3-encoder-Q4_K_M.gguf', targetSubdir: 'text_encoders' },
        { classType: 'H3ClipLoaderAny', inputKey: 'mmproj_name', filename: 'MiniMax-H3-encoder-mmproj-F16.gguf', targetSubdir: 'text_encoders' },
        { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_video_vae_fp16.safetensors', targetSubdir: 'vae' },
        { classType: 'VAELoader', inputKey: 'vae_name', filename: 'minimax_h3_audio_vae_fp32.safetensors', targetSubdir: 'vae' },
        { classType: 'LoraLoaderModelOnly', inputKey: 'lora_name', filename: loraFilename, targetSubdir: 'loras' },
      ]),
      docsUrl: normalized === 'minimax-h3-nsfw-pink-bunny'
        ? 'https://huggingface.co/SexGod1979/PinkFluffyBunny-MiniMax-H3'
        : 'https://huggingface.co/rzgar/minimax-h3_fl2v_8Step_motion_enhancer',
    })
  }
  const canonicalId = (
    normalized === 'nano-banana-pro'
      ? 'nano-banana-2'
      : normalized === SHORT_FILM_DIALOGUE_VIDEO_WORKFLOW_ID
        ? 'ltx23-ia2v'
      : normalized
  )
  return WORKFLOW_DEPENDENCY_PACKS[canonicalId] || getImportedDependencyPack(canonicalId)
}
