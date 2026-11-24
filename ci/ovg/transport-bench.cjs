const { chromium } = require(process.env.PLAYWRIGHT_CORE);
const { spawn } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const root = path.resolve(process.env.OVG_DIST || "dist/verified");
const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), "ovg-bench-"));
const children = [];
function start(args) { const p = spawn("python3", args, {stdio:"ignore"}); children.push(p); return p; }
async function waitServer(url) {
  for (let i=0;i<60;i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error("fixture server not ready: "+url);
}
(async()=>{
  for (const f of ["index.html","dwg.html","fixture.dxf"]) fs.copyFileSync("ci/ovg/"+f,path.join(fixtures,f));
  fs.copyFileSync("tests/fixtures/plot/page-setups-metric.dwg",path.join(fixtures,"fixture.dwg"));
  start(["-m","http.server","4280","--bind","127.0.0.1","--directory",fixtures]);
  start(["ci/ovg/serve-test.py",root,"4281","http://127.0.0.1:4280","--gzip-cache"]);
  await Promise.all([waitServer("http://127.0.0.1:4280/index.html"),waitServer("http://127.0.0.1:4281/relay.html")]);
  const profile=path.join(fixtures,"profile");
  const ctx=await chromium.launchPersistentContext(profile,{viewport:{width:1440,height:950},headless:true,executablePath:process.env.OVG_BROWSER_EXECUTABLE||undefined,args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-unsafe-webgpu","--disk-cache-size=1073741824"]});
  try {
    const agentPage=await ctx.newPage();
    const userAgent=await agentPage.evaluate(()=>navigator.userAgent);
    await agentPage.close();
    const results=[];
    for(const [label,format] of [["cold","dxf"],["warm","dxf"],["warm-dwg","dwg"]]){
      const p=await ctx.newPage(), errors=[],outside=[],failed=[],wasmResponses=[];
      p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push(r.url()));
      p.on("request",r=>{if(new URL(r.url()).hostname!=="127.0.0.1")outside.push(r.url())});
      p.on("response",r=>{if(new URL(r.url()).pathname.endsWith(".wasm"))wasmResponses.push(r)});
      const t=performance.now();
      await p.goto("http://127.0.0.1:4280/"+(format==="dwg"?"dwg.html":"index.html"),{waitUntil:"domcontentloaded"});
      await p.waitForFunction(()=>window.events?.includes("ready:"),{},{timeout:180000});
      const readyMs=Math.round(performance.now()-t);
      await p.waitForFunction(()=>window.saveBytes>0||window.events?.some(x=>x.startsWith("error:")),{},{timeout:180000});
      const state=await p.evaluate(()=>({bytes:window.saveBytes,format:window.savedFormat,events:window.events}));
      assert.ok(state.bytes>0);assert.equal(state.format,format);
      assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.deepEqual(failed,[]);
      const assets=[];
      for(const r of wasmResponses){const h=await r.allHeaders();assets.push({url:new URL(r.url()).pathname,encoding:h["content-encoding"],contentLength:Number(h["content-length"]||0)});assert.equal(h["content-encoding"],"gzip");}
      const timings=(await Promise.all(p.frames().map(f=>f.evaluate(()=>performance.getEntriesByType("resource").filter(x=>new URL(x.name).pathname.endsWith(".wasm")).map(x=>({asset:new URL(x.name).pathname,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize,decodedBodySize:x.decodedBodySize})))))).flat();
      assert.ok(timings.some(x=>x.asset.includes("OpenCADStudio")));
      const result={label,format,readyMs,roundTripMs:Math.round(performance.now()-t),state,assets,timings};
      if(label==="cold") assert.ok(timings.some(x=>x.transferSize>0));
      if(label==="warm") result.mainWasmCached=timings.some(x=>x.asset.includes("OpenCADStudio")&&x.transferSize===0);
      results.push(result);console.log(JSON.stringify(result));await p.close();
    }
    fs.writeFileSync(process.env.OVG_BENCH_REPORT||"ovg-transport-bench.json",JSON.stringify({browser:userAgent,environment:"loopback headless chromium software GPU; persistent browser context, 1 GiB cache budget; not production network",results},null,2)+"\n");
  } finally { await ctx.close(); }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{children.forEach(p=>p.kill());fs.rmSync(fixtures,{recursive:true,force:true})});
