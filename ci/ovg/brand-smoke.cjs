// Shell test, with the existing WASM artifact. No automation enabled in embedded sessions.
const {chromium}=require(process.env.PLAYWRIGHT_CORE),{spawn}=require("node:child_process"),fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(process.env.OVG_DIST||"dist/verified");
const server=spawn("python3",["ci/ovg/serve-test.py",root,"4281","http://127.0.0.1:4280","--gzip-cache"],{stdio:"ignore"});
async function wait(){for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:4281/app/")).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error("server unavailable")}
(async()=>{await wait();const b=await chromium.launch({headless:true,executablePath:process.env.OVG_BROWSER_EXECUTABLE||undefined,args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-unsafe-webgpu"]});const results=[];
try{for(const saved of [null,"en-US","system"]){
 const ctx=await b.newContext({locale:"en-US"}),p=await ctx.newPage(),outside=[],errors=[];
 p.on("pageerror",e=>errors.push(e.message));p.on("request",r=>{if(new URL(r.url()).hostname!=="127.0.0.1")outside.push(r.url())});
 await p.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
 await p.addInitScript(v=>{if(v)localStorage.setItem("opencadstudio.settings",JSON.stringify({settings:{language:v},theme:{name:"Light"}}))},saved);
 const custom={name:"OVG Fixture",suffix:"CAD",logo:"https://invalid.example/image.png",themeColor:"#123456",accentColor:"#abcdef",defaultLocale:"vi-VN"};
 await p.route("**/ovg-brand.json",r=>r.fulfill({json:custom}));
 await p.goto("http://127.0.0.1:4281/app/?embed=1",{waitUntil:"domcontentloaded"});
 let state;
 for(let i=0;i<100;i++){state=await p.evaluate(()=>({title:document.title,lang:document.documentElement.lang,theme:document.querySelector('meta[name="theme-color"]').content,saved:JSON.parse(localStorage.getItem("opencadstudio.settings")||"null"),logo:document.querySelector("#loading img")?.getAttribute("src")}));if(state.title==="OVG Fixture CAD"&&state.theme==="#123456")break;await p.waitForTimeout(100)}
 assert.equal(state.title,"OVG Fixture CAD");assert.equal(state.theme,"#123456");assert.equal(state.lang,saved?"en-US":"vi-VN");
 if(saved){assert.equal(state.saved.settings.language,saved);assert.equal(state.saved.theme.name,"Light")}
 if(state.logo)assert.equal(state.logo,"ovg-mark.png");assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
 results.push({savedLanguage:saved,lang:state.lang,title:state.title,theme:state.theme,preferencesPreserved:true});console.log(results.at(-1));await ctx.close();
 }}finally{await b.close()}
 fs.writeFileSync(process.env.OVG_BRAND_REPORT||"ovg-brand.json",JSON.stringify({results,environment:"actual shell, loopback, runtime config override; engine UI theme not modified"},null,2)+"\n");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.kill());
