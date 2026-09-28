import { beginPaintStroke, makePaintCanvas } from '../../src/services/layeredPaint.mjs'
const result = document.getElementById('result')
const checks = []
const near = (n, expected, label) => { if (Math.abs(n - expected) > 1) throw Error(`${label}: ${n} != ${expected}`) }
const alpha = (canvas, x, y) => canvas.getContext('2d').getImageData(x, y, 1, 1).data[3]
const draw = (canvas, points, options = {}) => { const s = beginPaintStroke(canvas, points[0], {size:24,opacity:0.5,color:'#ffffff',...options}); for (const p of points.slice(1)) {s.append(p);s.render()} s.render();return s }
try {
  const c = makePaintCanvas(256, 256)
  draw(c, Array.from({length:101},(_,i)=>({x:20+i*2,y:40})))
  for (let x=20;x<=220;x++) near(alpha(c,x,40),128,'uniform straight stroke')
  checks.push('PASS: 201 samples along stroke retain 50% alpha')
  const sparse = makePaintCanvas(256,256)
  draw(sparse,[{x:20,y:40},{x:220,y:40}])
  for (let x=20;x<=220;x++) near(alpha(sparse,x,40),alpha(c,x,40),'event-density independence')
  checks.push('PASS: sparse and dense pointer samples have identical interior opacity')
  draw(c,[{x:20,y:40},{x:220,y:40}])
  near(alpha(c,100,40),192,'second gesture builds opacity')
  checks.push('PASS: separate strokes accumulate to 75%')
  const crossing = makePaintCanvas(256,256)
  draw(crossing,[{x:30,y:30},{x:220,y:220},{x:220,y:30},{x:30,y:220}])
  near(alpha(crossing,125,125),128,'self crossing')
  checks.push('PASS: self-crossing stays at 50%')
  const eraser = makePaintCanvas(256,256), ctx=eraser.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256)
  const s=draw(eraser,[{x:20,y:40},{x:220,y:40}],{erase:true})
  near(alpha(eraser,100,40),127,'eraser/mask hide');s.cancel();near(alpha(eraser,100,40),255,'cancel restore')
  checks.push('PASS: half-opacity erase/mask hide and cancellation')
  const dot=makePaintCanvas(32,32);draw(dot,[{x:16,y:16}]);near(alpha(dot,16,16),128,'tap')
  checks.push('PASS: single tap round cap at requested opacity')
  const sample=document.getElementById('sample')
  const wave=Array.from({length:90},(_,i)=>({x:45+i*9.7,y:115+Math.sin(i/9)*70}))
  draw(sample,wave,{size:65,color:'#45b8ee'})
  draw(sample,Array.from({length:120},(_,i)=>({x:80+i*6.7,y:290+Math.sin(i/7)*45})),{size:8,color:'#45b8ee'})
  result.textContent=checks.join('\n'); result.style.whiteSpace='pre-wrap'
} catch(e) { result.textContent=checks.join('\n')+'\nFAIL: '+e.message }
