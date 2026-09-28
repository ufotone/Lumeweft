const test = require('node:test')
const assert = require('node:assert/strict')
const { CLOUD_RUNTIME_PROVIDERS, CloudRuntimeError, createCloudRuntimeClient } = require('../electron/cloudRuntimes')

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

test('provider registry exposes Floyo without credentials', () => {
  const floyo = CLOUD_RUNTIME_PROVIDERS.find((provider) => provider.id === 'floyo')
  assert.equal(floyo.name, 'Floyo')
  assert.equal(floyo.environmentKey, 'FLOYO_API_KEY')
})

test('provider registry exposes the official Google Gemini media API', () => {
  const google = CLOUD_RUNTIME_PROVIDERS.find((provider) => provider.id === 'google-gemini')
  assert.equal(google.name, 'Google Gemini API')
  assert.equal(google.environmentKey, 'GEMINI_API_KEY')
  assert.deepEqual(google.capabilities, ['image-generation', 'video-generation'])
})

test('Google image generation uses the Interactions API and returns inline media', async () => {
  let request
  const client = createCloudRuntimeClient('google-gemini', { apiKey: 'google-key', fetchImpl: async (url, options) => {
    request = { url, options }
    return jsonResponse({ output_image: { mime_type: 'image/png', data: 'aW1hZ2U=' } })
  } })
  const media = await client.generateImage({ prompt: 'A moonlit harbor', aspectRatio: '16:9' })
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
  assert.equal(request.options.headers['x-goog-api-key'], 'google-key')
  const body = JSON.parse(request.options.body)
  assert.equal(body.model, 'gemini-3.1-flash-lite-image')
  assert.equal(body.response_format.aspect_ratio, '16:9')
  assert.equal(body.response_format.mime_type, 'image/jpeg')
  assert.equal(media.data, 'aW1hZ2U=')
})

test('Google image generation reads image content from raw Interaction steps', async () => {
  const client = createCloudRuntimeClient('google-gemini', { apiKey: 'google-key', fetchImpl: async () => jsonResponse({
    status: 'completed',
    steps: [{
      type: 'model_output',
      content: [
        { type: 'text', text: 'Here is the generated reference.' },
        { type: 'image', mime_type: 'image/jpeg', data: 'cmF3LWltYWdl' },
      ],
    }],
  }) })

  const media = await client.generateImage({ prompt: 'A clean product reference' })
  assert.equal(media.mimeType, 'image/jpeg')
  assert.equal(media.data, 'cmF3LWltYWdl')
})

test('Google image generation reports text returned without an image', async () => {
  const client = createCloudRuntimeClient('google-gemini', { apiKey: 'google-key', fetchImpl: async () => jsonResponse({
    status: 'completed',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'The request could not be rendered.' }] }],
  }) })

  await assert.rejects(
    () => client.generateImage({ prompt: 'A product reference' }),
    (error) => error instanceof CloudRuntimeError
      && error.code === 'missing_output'
      && /could not be rendered/.test(error.message)
  )
})

test('Google image generation sends multiple reference images', async () => {
  let request
  const client = createCloudRuntimeClient('google-gemini', { apiKey: 'google-key', fetchImpl: async (url, options) => {
    request = { url, options }
    return jsonResponse({ output_image: { mime_type: 'image/png', data: 'aW1hZ2U=' } })
  } })
  await client.generateImage({
    prompt: 'Keep the talent and product consistent',
    images: [
      { bytes: new Uint8Array([1, 2]), mimeType: 'image/png' },
      { bytes: new Uint8Array([3, 4]), mimeType: 'image/jpeg' },
    ],
  })
  const body = JSON.parse(request.options.body)
  assert.equal(Array.isArray(body.input), true)
  assert.equal(body.input.filter((part) => part.type === 'image').length, 2)
  assert.equal(body.input[1].data, 'AQI=')
  assert.equal(body.input[2].mime_type, 'image/jpeg')
})

test('Google Veo generation creates a long-running operation with an inline start frame', async () => {
  let request
  const client = createCloudRuntimeClient('google-gemini', { apiKey: 'google-key', fetchImpl: async (url, options) => {
    request = { url, options }
    return jsonResponse({ name: 'operations/video-1' })
  } })
  const operation = await client.createVideo({
    prompt: 'Slow dolly in', durationSeconds: 6,
    image: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' },
  })
  assert.match(request.url, /veo-3\.1-lite-generate-preview:predictLongRunning$/)
  const body = JSON.parse(request.options.body)
  assert.equal(body.instances[0].image.inlineData.data, 'AQID')
  assert.equal(body.parameters.durationSeconds, 6)
  assert.equal(operation.name, 'operations/video-1')
})

test('Google media download never sends the API key to an untrusted host', async () => {
  let requested = false
  const client = createCloudRuntimeClient('google-gemini', { apiKey: 'google-key', fetchImpl: async () => {
    requested = true
    return jsonResponse({})
  } })
  await assert.rejects(() => client.downloadMedia('https://example.com/steal-key.mp4'), (error) => error instanceof CloudRuntimeError && error.code === 'invalid_media_url')
  assert.equal(requested, false)
})

test('Floyo createRun sends bearer auth and workflow JSON', async () => {
  let request
  const client = createCloudRuntimeClient('floyo', { apiKey: 'secret-key', fetchImpl: async (url, options) => {
    request = { url, options }
    return jsonResponse({ id: 'run_123' })
  } })
  const result = await client.createRun({ 1: { class_type: 'SaveImage', inputs: {} } }, { name: 'Lumeweft test' })
  assert.equal(result.id, 'run_123')
  assert.equal(request.url, 'https://api.floyo.ai/runs')
  assert.equal(request.options.headers.Authorization, 'Bearer secret-key')
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Lumeweft test', workflow: { 1: { class_type: 'SaveImage', inputs: {} } } })
})

test('Floyo getRun requests presigned output URLs', async () => {
  let url
  const client = createCloudRuntimeClient('floyo', { apiKey: 'key', fetchImpl: async (value) => { url = value; return jsonResponse({ id: 'run' }) } })
  await client.getRun('run 1', { presignedUrlExpiresIn: 600 })
  assert.equal(url, 'https://api.floyo.ai/runs/run%201?expand=outputs.presigned_url&presigned_url_expires_in=600')
})

test('Floyo balance uses the team balance endpoint', async () => {
  let url
  const client = createCloudRuntimeClient('floyo', { apiKey: 'key', fetchImpl: async (value) => {
    url = value
    return jsonResponse({ available_flotime_ms: 4080000, partner_nodes_usd: 25.5 })
  } })
  const balance = await client.getBalance()
  assert.equal(url, 'https://api.floyo.ai/team/balance')
  assert.equal(balance.availableFloTimeMs, 4080000)
  assert.equal(balance.partnerNodesUsd, 25.5)
})

test('structured provider errors retain metadata', async () => {
  const client = createCloudRuntimeClient('floyo', { apiKey: 'key', fetchImpl: async () => jsonResponse({ error: { type: 'validation', code: 'missing_node', message: 'Unavailable.', details: { node_id: '8' } } }, 400) })
  await assert.rejects(() => client.createRun({ 8: {} }), (error) => error instanceof CloudRuntimeError && error.providerId === 'floyo' && error.status === 400 && error.details.node_id === '8')
})

test('Floyo connection check validates team context through the balance endpoint', async () => {
  let url
  const client = createCloudRuntimeClient('floyo', { apiKey: 'key', fetchImpl: async (value) => {
    url = value
    return jsonResponse({ available_flotime_ms: 0, partner_nodes_usd: 0 })
  } })
  assert.deepEqual(await client.testConnection(), { success: true })
  assert.equal(url, 'https://api.floyo.ai/team/balance')
})

test('unknown providers are rejected before a network request', () => {
  assert.throws(() => createCloudRuntimeClient('unknown', { apiKey: 'key' }), (error) => error instanceof CloudRuntimeError && error.code === 'unknown_provider')
})

test('Floyo upload posts multipart data to the CDN', async () => {
  let request
  const client = createCloudRuntimeClient('floyo', { apiKey: 'key', fetchImpl: async (url, options) => { request = { url, options }; return jsonResponse({ input_path: '#inputs/input.png' }) } })
  await client.uploadFile({ bytes: new Uint8Array([1, 2]), filename: 'input.png', mimeType: 'image/png' })
  assert.equal(request.url, 'https://cdn.floyo.ai/upload')
  assert.equal(request.options.body.get('filename'), 'input.png')
  assert.equal(request.options.body.get('on_conflict'), 'rename')
})
