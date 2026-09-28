import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createPaintHistory, isPaintSidecarPath, paintDimensions, validatePaintDocument } from '../src/services/layeredPaint.mjs'
const document = () => ({ kind:'lumeweft-paint', version:1, width:512, height:512, name:'Test', layers:[{ id:'one',name:'Layer',pixels:'data:image/png;base64,YQ==',mask:null,opacity:1,blend:'source-over' }] })
test('document rejects invalid dimensions, duplicate IDs and excess memory', () => {
  assert.throws(() => paintDimensions(0,512)); assert.throws(() => paintDimensions(4097,512))
  const value = document(); value.layers.push({...value.layers[0]}); assert.throws(() => validatePaintDocument(value))
  value.layers = Array.from({length:5},(_,i) => ({...value.layers[0],id:String(i)})); value.width=value.height=4096
  assert.throws(() => validatePaintDocument(value))
  assert.equal(validatePaintDocument(document()).layers[0].mask,null)
})
test('sidecars cannot reference files outside project paint directory', () => {
  assert.equal(isPaintSidecarPath('assets/paint/paint_123.lumeweft-paint.json'),true)
  for (const value of ['../secret','assets/paint/../../secret','C:/secret','https://example.com/x','assets/paint/x.png']) assert.equal(isPaintSidecarPath(value),false)
})
test('undo/redo drops abandoned branches and obeys memory cap', () => {
  const h=createPaintHistory({v:1}); h.push({v:2}); h.push({v:3}); assert.deepEqual(h.undo(),{v:2}); assert.deepEqual(h.redo(),{v:3}); h.undo(); h.push({v:4}); assert.equal(h.canRedo,false); assert.deepEqual(h.undo(),{v:2})
  const small=createPaintHistory({v:1},30); small.push({v:'long enough to replace all history'}); assert.equal(small.canUndo,false)
})
const bundle = await build({ entryPoints:['src/services/paintProjectAssets.js'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'filesystem-stub',setup(b){ b.onResolve({filter:/^\.\/fileSystem$/},()=>({path:'filesystem',namespace:'mock'})); b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const importAsset = () => {throw new Error("Unexpected write")}; export const readProjectFile = () => {}; export const getProjectFileUrl = () => {}; export const getAbsoluteFileUrl = () => {};'})) }}] })
const {savePaintAsset} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
test('save produces immutable PNG and portable editable sidecar', async () => {
  const calls=[]
  const asset=await savePaintAsset({projectHandle:{},document:document(),png:new Blob(['png']),name:'Artwork',sourceAssetId:'original'}, {importAsset:async(handle,file,category)=>{calls.push({file,category});return {path:`assets/${category}/${file.name}`,absolutePath:`/test/${file.name}`,settings:{}}},getAbsoluteFileUrl:async()=> 'test-url'})
  assert.deepEqual(calls.map(c=>c.category),['paint','images']); assert.equal(asset.type,'image'); assert.equal(asset.settings.paintSourceAssetId,'original'); assert.ok(isPaintSidecarPath(asset.settings.paintDocument.path)); assert.equal(JSON.parse(await calls[0].file.text()).layers.length,1)
})
test('sidecar failure aborts before writing flattened image', async () => {
  let calls=0
  await assert.rejects(savePaintAsset({projectHandle:{},document:document(),png:new Blob()}, {importAsset:async()=>{calls++;throw new Error('disk full')}}), /disk full/)
  assert.equal(calls,1)
})
