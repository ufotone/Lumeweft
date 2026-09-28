import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { build } from 'esbuild'
import { buildJpTagIndexFromTexts, searchJpTagIndex } from '../src/services/jpTagAssistant.mjs'

const repoUrl = new URL('../', import.meta.url)

async function read(path) {
  return fs.readFile(new URL(path, repoUrl), 'utf8')
}

function fixtureIndex() {
  return buildJpTagIndexFromTexts({
    tagsText: [
      '1girl,0,7641780,"sole_female,1girls"',
      'long_hair,0,5624146,"/lh,longhair"',
      'from_below,0,500000,"low_angle"',
      'hakurei_reimu,4,900000,"reimu"',
    ].join('\n'),
    manualLabelsText: 'long_hair,ロングヘア\nfrom_below,下から',
    machineLabelsText: '1girl,一人の女の子',
    dictionaryText: 'ja,tag,aliases\n下から,from_below,あおり|ローアングル',
  })
}

test('native JP tag lookup searches manual, machine, alias, and dictionary terms', () => {
  const index = fixtureIndex()
  assert.equal(searchJpTagIndex(index, 'ロングヘア').tags, 'long_hair')
  assert.equal(searchJpTagIndex(index, 'あおり').tags, 'from_below')
  assert.equal(searchJpTagIndex(index, 'longhair').tags, 'long_hair')
  assert.equal(searchJpTagIndex(index, '一人の女の子').tags, '1girl')
  assert.equal(searchJpTagIndex(index, '一人の女の子', { useMachineLabels: false }).tags, '')
})

test('native JP tag lookup applies category filtering, limits, and spacing', () => {
  const index = fixtureIndex()
  assert.equal(searchJpTagIndex(index, 'reimu').tags, '')
  assert.equal(searchJpTagIndex(index, 'reimu', { excludeLicensed: false }).tags, 'hakurei_reimu')
  assert.equal(searchJpTagIndex(index, 'ロングヘア', { insertSpaces: true }).tags, 'long hair')
  assert.equal(searchJpTagIndex(index, 'girl hair', { limit: 1 }).candidates.length, 1)
})

test('CANVAS template uses native lookup and bundles only the four required CSV files', async () => {
  const bundled = await build({
    entryPoints: [new URL('src/services/flowAiSchema.js', repoUrl).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  })
  const schema = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  const document = schema.createFlowDocument({ templateId: 'jp-tag-search' })
  const assistant = document.nodes.find(node => node.data?.workflowId === 'jp-tag-assistant')
  assert.ok(assistant)
  assert.equal(assistant.data.jpTagUseMachineLabels, true)
  assert.equal(assistant.data.jpTagExcludeLicensed, true)
  assert.equal(document.edges.length, 2)

  const files = (await fs.readdir(new URL('public/data/jp-tag-assistant/', repoUrl))).sort()
  assert.deepEqual(files, [
    'NOTICE.md',
    'danbooru-jp.csv',
    'danbooru-machine-jp.csv',
    'danbooru.csv',
    'jp_tag_dictionary.csv',
  ])
  assert.ok(!files.some(file => file.includes('cooccurrence')))
})

test('runtime and documentation keep upstream code outside Lumeweft', async () => {
  const [runtime, dependencies, catalog, docs] = await Promise.all([
    read('src/services/flowAiRuntime.js'),
    read('src/config/workflowDependencyPacks.js'),
    read('src/config/workflowInstallCatalog.js'),
    read('docs/JP_TAG_ASSISTANT_INTEGRATION.md'),
  ])
  assert.match(runtime, /searchBundledJpTags/)
  assert.doesNotMatch(dependencies, /JPTagAssistantSearch/)
  assert.doesNotMatch(catalog, /a1111-sd-webui-jp-tag-assistant/)
  assert.match(docs, /does not copy or adapt the upstream Python or JavaScript implementation/)
  assert.match(docs, /30\.5 MB/)
})
