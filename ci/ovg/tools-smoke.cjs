// Loopback-only qualification. Never expose standalone automation through production relay.
const {chromium}=require(process.env.PLAYWRIGHT_CORE);
const {spawn}=require("node:child_process");
const fs=require("node:fs"), path=require("node:path"), assert=require("node:assert/strict");
const root=path.resolve(process.env.OVG_DIST||"dist/verified");
const server=spawn("python3",["ci/ovg/serve-test.py",root,"4281","http://127.0.0.1:4280","--gzip-cache"],{stdio:"ignore"});
const result=[];
async function wait(){for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:4281/app/")).ok)return}catch{} await new Promise(r=>setTimeout(r,250))}throw Error("server not ready")}
function entities(buf){
 const lines=buf.toString("utf8").split(/\r?\n/), out=[];let active=false,current=null;
 for(let i=0;i+1<lines.length;i+=2){const c=Number(lines[i].trim()),v=lines[i+1].trim();
 if(c===2&&v==="ENTITIES"){active=true;continue}
 if(!active)continue;
 if(c===0){if(current)out.push(current);current=null;if(v==="ENDSEC")break;current={type:v,fields:{}}}
 else if(current){(current.fields[c]??=[]).push(v)}
 }return out;
}
(async()=>{await wait();const b=await chromium.launch({headless:true,executablePath:process.env.OVG_BROWSER_EXECUTABLE||undefined,args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-unsafe-webgpu"]});
try{const p=await b.newPage({viewport:{width:1280,height:900}}), errors=[],outside=[];
p.on("pageerror",e=>errors.push(e.message));
p.on("request",r=>{if(new URL(r.url()).hostname!=="127.0.0.1")outside.push(r.url())});
await p.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
await p.addInitScript(()=>{localStorage.setItem("opencadstudio.automation","1");localStorage.setItem("opencadstudio.settings",JSON.stringify({settings:{language:"en-US",savetime_min:0}}))});
await p.goto("http://127.0.0.1:4281/app/",{waitUntil:"domcontentloaded"});
for(let i=0;i<240;i++){if(await p.evaluate(()=>!!window.wasmBindings?.ocs_control_submit))break;if(i===239)throw Error("WASM not ready");await p.waitForTimeout(500)}
const raw=req=>p.evaluate(async request=>{const api=window.wasmBindings,ticket=api.ocs_control_submit(JSON.stringify(request));for(let i=0;i<600;i++){const r=api.ocs_control_take(ticket);if(r)return JSON.parse(r);await new Promise(x=>setTimeout(x,50))}throw Error("control timeout")},req);
let seq=0;
async function act(req){const s=await raw({op:"state"}), id="r048-"+ ++seq;let r=await raw({...req,request_id:id,document_id:s.document_id,revision:s.revision});for(let i=0;["accepted","running"].includes(r.status)&&i<600;i++){await p.waitForTimeout(50);r=await raw({op:"operation",request_id:id})}assert.ok(r.ok,JSON.stringify(r).slice(0,2000));assert.ok(!["accepted","running","failed"].includes(r.status));return r;}
async function count(n){const r=await raw({op:"entities"});assert.equal(r.total,n,JSON.stringify(r).slice(0,800));}
async function run(cmd){const r=await act({op:"run",cmd});assert.ok(!r.blocked_by,JSON.stringify(r).slice(0,1000));result.push({cmd,status:r.status});}
let s=await raw({op:"state"});if(s.modal)await act({op:"action",name:"close_modal"});await act({op:"new"});
await run("LINE 0,0 10,0");await count(1);
await run("CIRCLE 5,5 2");await count(2);
await run("PLINE 0,0 10,0 10,10 0,10 C");await count(3);
await act({op:"undo",protocol:1});await count(2);result.push({check:"structured undo"});
await act({op:"redo",protocol:1});await count(3);result.push({check:"structured redo"});
await act({op:"select",clear:true,type:"Circle",protocol:1});
await run("MOVE 0,0 100,0");await count(3);
const moved=await raw({op:"query",type:"Circle"});assert.equal(moved.entities[0].center[0],105);
await act({op:"select",clear:true,protocol:1});
await act({op:"action",name:"zoom_extents"});
const saved=await act({op:"save",name:"r048-fixture.dxf",target_format:"dxf",target_version:"AC1032"});
const payload=saved.data_base64||saved.result?.data_base64;assert.ok(payload,"missing saved bytes");
const buf=Buffer.from(payload,"base64"), es=entities(buf);console.log("DXF entities",JSON.stringify(es).slice(0,1500));
for(const type of ["LINE","CIRCLE","LWPOLYLINE"])assert.equal(es.filter(e=>e.type===type).length,1,type);
const l=es.find(e=>e.type==="LINE").fields,c=es.find(e=>e.type==="CIRCLE").fields,poly=es.find(e=>e.type==="LWPOLYLINE").fields;
const near=(actual,expected)=>assert.ok(Math.abs(Number(actual)-expected)<1e-8,actual+" != "+expected);
near(l[10][0],0);near(l[20][0],0);near(l[11][0],10);near(l[21][0],0);
near(c[10][0],105);near(c[20][0],5);near(c[40][0],2);
assert.equal(Number(poly[70][0])&1,1);assert.equal(poly[10].length,4);assert.deepEqual(poly[10].map(Number),[0,10,10,0]);assert.deepEqual(poly[20].map(Number),[0,0,10,10]);
result.push({check:"DXF independent group-code comparison",bytes:buf.length,types:es.map(e=>e.type)});
await run("BOX 20,30,40 26,35,40 4");await count(4);
const solid=await raw({op:"entities"});console.log("3D summary",JSON.stringify(solid));assert.ok(Object.keys(solid.by_type).some(k=>/solid/i.test(k)),JSON.stringify(solid));
result.push({check:"3D BOX entity created",summary:solid.by_type});
const queried=await raw({op:"query",type:"3DSOLID"});assert.equal(queried.entities.length,1);
const measured=await raw({op:"measure",handles:[queried.entities[0].handle]});
const bounds=measured.measurements[0].bounds;
for(let i=0;i<3;i++){near(bounds.min[i],[20,30,40][i]);near(bounds.max[i],[26,35,44][i]);}
result.push({check:"3D solid bounds",bounds});
const savedSolid=await act({op:"save",name:"r048-solid.dwg",target_format:"dwg",target_version:"AC1032"});
const solidData=savedSolid.data_base64||savedSolid.result?.data_base64;assert.ok(solidData);assert.equal(Buffer.from(solidData,"base64").subarray(0,6).toString(),"AC1032");
await act({op:"open",name:"r048-solid-reopen.dwg",data_base64:solidData});await count(4);
const again=await raw({op:"query",type:"3DSOLID"});assert.equal(again.entities.length,1);
const remeasure=await raw({op:"measure",handles:[again.entities[0].handle]});
for(let i=0;i<3;i++){near(remeasure.measurements[0].bounds.min[i],[20,30,40][i]);near(remeasure.measurements[0].bounds.max[i],[26,35,44][i]);}
result.push({check:"DWG solid save/reopen bounds",bytes:Buffer.from(solidData,"base64").length});
await act({op:"new"});await run("LINE 0,0 10,0");await count(1);
await act({op:"select",clear:true,type:"Line",protocol:1});await run("ROTATE 0,0 90");
let line=(await raw({op:"query",type:"Line"})).entities[0];near(line.end[0],0);near(line.end[1],10);
await act({op:"select",clear:true,type:"Line",protocol:1});await run("SCALE 0,0 2");
line=(await raw({op:"query",type:"Line"})).entities[0];near(line.end[0],0);near(line.end[1],20);
await act({op:"select",clear:true,protocol:1});await act({op:"action",name:"zoom_extents"});await p.waitForTimeout(500);
const snap=await raw({op:"snap",point:[0,20,0]});console.log("SNAP",JSON.stringify(snap));assert.ok(snap.snap,JSON.stringify(snap));near(snap.world[0],0);near(snap.world[1],20);result.push({check:"endpoint snap query",snap});
await act({op:"click",point:[0,10,0],protocol:1});const sel=await raw({op:"get_selection"});console.log("PICK",JSON.stringify(sel));assert.ok(JSON.stringify(sel).includes(line.handle));result.push({check:"viewport world-point pick",handle:line.handle});
await act({op:"select",clear:true,protocol:1});await run(`OFFSET 2 ${line.handle} 5,10 ENTER`);await count(2);
let lines=(await raw({op:"query",type:"Line"})).entities;const offset=lines.find(x=>x.handle!==line.handle);near(offset.start[0],2);near(offset.end[0],2);near(offset.end[1],20);result.push({check:"offset distance 2",handle:offset.handle});
await act({op:"new"});await run("LINE 0,0 10,0");await run("LINE 5,-5 5,5");
lines=(await raw({op:"query",type:"Line"})).entities;let horizontal=lines.find(x=>Math.abs(x.end[0]-x.start[0])>1);
await act({op:"start",cmd:"TRIM",protocol:1});await act({op:"input",kind:"entity",handle:horizontal.handle,point:[8,0,0],protocol:1});await act({op:"input",kind:"enter",protocol:1});
lines=(await raw({op:"query",type:"Line"})).entities;horizontal=lines.find(x=>Math.abs(x.end[0]-x.start[0])>1);near(Math.max(horizontal.start[0],horizontal.end[0]),5);near(Math.min(horizontal.start[0],horizontal.end[0]),0);result.push({check:"trim at intersection x=5"});
await act({op:"new"});await run("LINE 0,0 3,0");await run("LINE 5,-5 5,5");
lines=(await raw({op:"query",type:"Line"})).entities;horizontal=lines.find(x=>Math.abs(x.end[0]-x.start[0])>1);
await act({op:"start",cmd:"EXTEND",protocol:1});await act({op:"input",kind:"entity",handle:horizontal.handle,point:[2.9,0,0],protocol:1});await act({op:"input",kind:"enter",protocol:1});
lines=(await raw({op:"query",type:"Line"})).entities;horizontal=lines.find(x=>Math.abs(x.end[0]-x.start[0])>1);near(Math.max(horizontal.start[0],horizontal.end[0]),5);result.push({check:"extend to boundary x=5"});


assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
fs.writeFileSync(process.env.OVG_TOOLS_REPORT||"ovg-tools.json",JSON.stringify({result,environment:"isolated standalone actual WASM; not production embed UI"},null,2)+"\n");console.log("PASS",JSON.stringify(result));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.kill());
