const test = require('node:test')
const assert = require('node:assert/strict')
const workflow = require('../public/workflows/video_ltx2_3_t2v.json')

test('LTX 2.3 T2V does not require a user-supplied placeholder image', () => {
  const nodes = Object.values(workflow)
  assert.equal(nodes.some((node) => node?.class_type === 'LoadImage'), false)

  const guide = workflow['267:276']
  assert.equal(guide.class_type, 'EmptyImage')
  assert.deepEqual(guide.inputs.width, ['267:257', 0])
  assert.deepEqual(guide.inputs.height, ['267:258', 0])
  assert.equal(guide.inputs.batch_size, 1)
})
