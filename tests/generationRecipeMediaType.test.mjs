import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const source = await fs.readFile(
  new URL('../src/components/generate/PromptLibrary.jsx', import.meta.url),
  'utf8',
)

test('Generation Recipes support audio and music as a saved and filterable use', () => {
  assert.match(source, /const \[forAudio, setForAudio\] = useState\(false\)/)
  assert.match(source, /filter === 'audio' && !entry\.forAudio/)
  assert.match(source, /\['all', 'image', 'video', 'audio'\]/)
  assert.match(source, /entry\.forAudio && <span/)
})

test('Audio recipes without a custom thumbnail use the shared eighth-note art', async () => {
  const thumbnail = await fs.stat(new URL('../public/generated-thumbnails/audio-eighth-note.webp', import.meta.url))
  assert.ok(thumbnail.size > 0)
  assert.match(source, /AUDIO_RECIPE_THUMBNAIL_URL = '\/generated-thumbnails\/audio-eighth-note\.webp'/)
  assert.match(source, /src=\{entry\.thumbnail \|\| AUDIO_RECIPE_THUMBNAIL_URL\}/)
  assert.match(source, /entry\.thumbnail \? 'object-cover' : 'object-contain'/)
})
