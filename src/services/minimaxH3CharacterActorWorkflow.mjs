import { modifyMinimaxH3GGUFReferenceWorkflow } from './minimaxH3ReferenceWorkflow.mjs'

/** Image-only fixed-character generation on Lumeweft's lightweight Q4 Ref2VA + PDD path. */
export function modifyMinimaxH3CharacterActorWorkflow(workflow, options = {}) {
  const refs = Array.isArray(options.referenceImages) ? options.referenceImages.filter(Boolean) : []
  if (refs.length < 1) throw new Error('キャラクター参照画像がありません。 / The character has no reference images.')
  if (refs.length > 9) throw new Error('キャラクター参照画像は9枚までです。 / H3 accepts at most nine character references.')
  const modified = modifyMinimaxH3GGUFReferenceWorkflow(workflow, {
    ...options,
    referenceVideo: '__lumeweft_character_image_only__.mp4',
    referenceImages: refs.slice(0, 8),
    useReferenceAudio: false,
  })
  const conditioning = modified['6']?.inputs
  if (!conditioning) throw new Error('MiniMax H3 character graph is incomplete.')
  delete modified['1']
  delete conditioning['ref_videos.ref_video_0']
  delete conditioning['ref_video_audios.ref_video_audio_0']
  if (refs[8]) {
    modified.h3_ref_8 = {
      class_type: 'LoadImage',
      inputs: { image: refs[8] },
      _meta: { title: 'Character Reference <Picture 9>' },
    }
    conditioning['ref_images.ref_image_8'] = ['h3_ref_8', 0]
  }
  return modified
}
