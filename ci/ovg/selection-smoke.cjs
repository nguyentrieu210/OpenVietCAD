const {chromium}=require(process.env.PLAYWRIGHT_CORE),{spawn}=require("node:child_process"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(process.env.OVG_DIST||"dist/verified"),tmp=fs.mkdtempSync(path.join(os.tmpdir(),"ovg-select-")),children=[];
function start(args){children.push(spawn("python3",args,{stdio:"ignore"}))}
async function wait(url){for(let i=0;i<60;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error("server not ready")}
(async()=>{
 fs.copyFileSync("ci/ovg/selection.html",path.join(tmp,"index.html"));
 fs.writeFileSync(path.join(tmp,"selection.dxf"),fs.readFileSync("ci/ovg/fixture.dxf","utf8").replace("0\nLINE\n","0\nLINE\n5\n2A\n"));
 start(["-m","http.server","4280","--bind","127.0.0.1","--directory",tmp]);start(["ci/ovg/serve-test.py",root,"4281","http://127.0.0.1:4280","--gzip-cache"]);
 await Promise.all([wait("http://127.0.0.1:4280/index.html"),wait("http://127.0.0.1:4281/relay.html")]);
 const b=await chromium.launch({headless:true,executablePath:process.env.OVG_BROWSER_EXECUTABLE||undefined,args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-unsafe-webgpu"]});
 const results=[];
 try{for(const readonly of [false,true]){
 const p=await b.newPage({viewport:{width:1440,height:950}}),errors=[],outside=[];
 p.on("pageerror",e=>errors.push(e.message));p.on("request",r=>{if(new URL(r.url()).hostname!=="127.0.0.1")outside.push(r.url())});
 await p.goto("http://127.0.0.1:4280/index.html"+(readonly?"?readonly":""));
 await p.waitForFunction(()=>window.messages.some(m=>m.type==="loaded"),{},{timeout:120000});
 assert.ok((await p.evaluate(()=>window.messages.find(m=>m.type==="ready").capabilities)).includes("selection"));
 await p.evaluate(()=>window.send("select",{handle:"2a"}));
 await p.waitForFunction(()=>window.messages.some(m=>m.type==="selection"&&m.handle==="2A"),{},{timeout:15000});
 await p.evaluate(()=>window.send("select",{handle:"FFFFFFFFFFFFFFFF"}));
 await p.waitForFunction(()=>window.messages.some(m=>m.type==="error"&&m.code==="selection_unavailable"),{},{timeout:15000});
 await p.evaluate(()=>window.send("request-save",{format:"dxf"}));
 if(readonly){await p.waitForTimeout(1500);assert.equal(await p.evaluate(()=>window.saveBytes||0),0)}
 else await p.waitForFunction(()=>window.saveBytes>0,{},{timeout:30000});
 const messages=await p.evaluate(()=>window.messages);
 assert.ok(!messages.some(m=>m.type==="dirty"&&m.dirty));assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
 results.push({readonly,messages,saveBytes:await p.evaluate(()=>window.saveBytes||0)});console.log(JSON.stringify(results.at(-1)));await p.close();
 }}finally{await b.close()}
 fs.writeFileSync(process.env.OVG_SELECTION_REPORT||"ovg-selection.json",JSON.stringify({results,environment:"real two-origin loopback WASM relay; selection command and acknowledgement, no GIS/PostGIS linkage"},null,2)+"\n");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{children.forEach(p=>p.kill());fs.rmSync(tmp,{recursive:true,force:true})});
