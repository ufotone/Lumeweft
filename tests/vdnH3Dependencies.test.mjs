import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { checkWorkflowBundleFile } from '../electron/workflowBundleFiles.js'
import { VDN_H3_STAGE_FILES } from '../src/config/vdnH3Config.js'
import { getWorkflowDependencyPack } from '../src/config/workflowDependencyPacks.js'

const servicesDir = fileURLToPath(new URL('../src/services/', import.meta.url))
const bundle = await build({
  stdin: {contents: 'export {checkWorkflowDependencies, buildMissingDependencyClipboardText} from "./workflowDependencies"', resolveDir: servicesDir},
  bundle: true, write: false, format: 'esm', platform: 'node',
  define: {'import.meta.env.BASE_URL': '"/"'},
  plugins: [{name:'no-comfy-io', setup(builder) {
    builder.onResolve({filter:/^\.\/comfyui$/},()=>({path:'comfyui',namespace:'mock'}))
    builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const comfyui = {}',loader:'js'}))
  }}],
})
const dependencies = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

test('VDN checks exact bundle members, catches a partial install and repairs the missing adapter only', async t => {
  const tempParent = path.resolve(os.tmpdir())
  const modelsPath = await fs.mkdtemp(path.join(tempParent,'lumeweft-vdn-test-'))
  t.after(async()=>{
    delete globalThis.window
    assert.equal(path.dirname(modelsPath),tempParent)
    assert.ok(path.basename(modelsPath).startsWith('lumeweft-vdn-test-'))
    await fs.rm(modelsPath,{recursive:true,force:true})
  })
  t.mock.method(globalThis,'fetch', async()=>new Response('{}',{headers:{'Content-Type':'application/json'}}))
  const pack = getWorkflowDependencyPack('vdn-h3-t2va')
  const objectInfo = Object.fromEntries(pack.requiredNodes.map(n=>[n.classType,{input:{required:{}}}]))
  for (const model of pack.requiredModels.filter(m=>!m.exactPath)) {
    const inputs=objectInfo[model.classType].input.required
    inputs[model.inputKey] ||= [[]]
    inputs[model.inputKey][0].push('MiniMaxH3\\'+model.filename)
  }
  objectInfo.ApplyVDNH3.input.required.vdn_checkpoint=[['stage-dmd-step-250']]
  const missing = VDN_H3_STAGE_FILES.find(f=>f.targetSubdir.endsWith('/turbo') && f.filename.endsWith('.safetensors'))
  for (const file of VDN_H3_STAGE_FILES.filter(f=>f!==missing)) {
    const dest=path.join(modelsPath,file.targetSubdir,file.filename)
    await fs.mkdir(path.dirname(dest),{recursive:true})
    await fs.writeFile(dest,'test fixture')
  }
  globalThis.window={electronAPI:{checkWorkflowSetupFiles: async({files})=>({success:true,results:await Promise.all(files.map(async file=>{
    assert.equal(file.exactPath,true)
    return checkWorkflowBundleFile(modelsPath,file)
  }))})}}
  const options={objectInfo,comfyRootPath:modelsPath}
  let result=await dependencies.checkWorkflowDependencies('vdn-h3-t2va',options)
  assert.equal(result.hasBlockingIssues,true)
  assert.equal(result.missingModels.length,1)
  assert.equal(result.missingModels[0].targetSubdir,missing.targetSubdir)
  assert.equal(result.missingModels[0].filename,missing.filename)
  await fs.writeFile(path.join(modelsPath,missing.targetSubdir,missing.filename),'test fixture')
  result=await dependencies.checkWorkflowDependencies('vdn-h3-t2va',options)
  assert.equal(result.status,'ready')
  assert.equal(result.hasBlockingIssues,false)
  delete globalThis.window
  result=await dependencies.checkWorkflowDependencies('vdn-h3-t2va',options)
  assert.equal(result.hasBlockingIssues,true,'unverified bundle must not run silently')
  assert.match(dependencies.buildMissingDependencyClipboardText(result),/Could not verify the complete model bundle/)
  assert.doesNotMatch(dependencies.buildMissingDependencyClipboardText(result),/No blocking/)
  assert.deepEqual(await checkWorkflowBundleFile(modelsPath,{filename:'adapter_model.safetensors',targetSubdir:'../outside'}),{exists:false,resolvedPath:''})
  assert.deepEqual(await checkWorkflowBundleFile(modelsPath,{filename:'../adapter_model.safetensors',targetSubdir:'vdn'}),{exists:false,resolvedPath:''})
  // The exact same bundle can live in a configured external VDN root.
  const external=await checkWorkflowBundleFile(path.join(modelsPath,'other'),missing,[path.join(modelsPath,'vdn')])
  assert.equal(external.exists,true)
})
