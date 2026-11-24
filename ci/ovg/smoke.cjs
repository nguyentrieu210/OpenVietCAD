const {chromium}=require(process.env.PLAYWRIGHT_CORE);
const {spawn}=require("node:child_process");
const fs=require("node:fs"),assert=require("node:assert/strict");
const processes=[];
function start(args){const p=spawn("python3",args,{stdio:"inherit"});processes.push(p)}
(async()=>{
 fs.copyFileSync("tests/fixtures/plot/page-setups-metric.dwg","ci/ovg/fixture.dwg");
 start(["ci/ovg/serve-test.py","dist/verified","4281","http://127.0.0.1:4280"]);
 start(["-m","http.server","4280","--bind","127.0.0.1","--directory","ci/ovg"]);
 await new Promise(r=>setTimeout(r,1500));
 const b=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-unsafe-webgpu"]});
 try{
  for(const format of ["dwg","dxf"]){
   const p=await b.newPage({viewport:{width:1440,height:950}}),errors=[],outside=[];
   p.on("pageerror",e=>errors.push(e.message));
   await p.route("**/*",r=>{const u=new URL(r.request().url());if(u.hostname!=="127.0.0.1"){outside.push(u.hostname);return r.abort()}return r.continue()});
   await p.goto("http://127.0.0.1:4280/"+(format==="dwg"?"dwg.html":"index.html"));
   await p.waitForFunction(()=>window.saveBytes>0||window.events?.some(x=>x.startsWith("error:")),{},{timeout:180000});
   const state=await p.evaluate(()=>({events:window.events,bytes:window.saveBytes,format:window.savedFormat}));
   console.log(format,state,errors,outside);assert.ok(state.bytes>0);assert.equal(state.format,format);assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
   await p.close();
  }
 }finally{await b.close()}
 console.log("PASS real WASM DWG/DXF open-save");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>processes.forEach(p=>p.kill()));
