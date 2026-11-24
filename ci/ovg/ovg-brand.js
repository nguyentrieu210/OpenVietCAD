/* Downstream shell branding only. No engine settings or credentials are written. */
(() => {
  "use strict";
  const defaults = {name:"OpenVietGIS",suffix:"CAD",logo:"ovg-mark.png",themeColor:"#132d3a",accentColor:"#2b78b9",defaultLocale:"vi-VN"};
  const splash = document.getElementById("loading");
  const done = () => { if(splash){splash.classList.add("hide");setTimeout(()=>splash.remove(),450)} };
  if(document.querySelector("canvas"))done();
  else {
    const observer=new MutationObserver(()=>{if(document.querySelector("canvas")){observer.disconnect();done()}});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  const localJson = async name => {const r=await fetch(name,{credentials:"same-origin"});if(!r.ok)throw Error(name);return r.json()};
  const str=(v,d)=>typeof v==="string"&&v.trim()&&v.length<=80?v:d;
  const color=(v,d)=>typeof v==="string"&&/^#[0-9a-fA-F]{6}$/.test(v)?v:d;
  const logo=(v,d)=>typeof v==="string"&&/^[A-Za-z0-9_-]+\.(png|svg|webp)$/.test(v)?v:d;
  Promise.all([localJson("ovg-brand.json").catch(()=>({})),localJson("locale-labels.json").catch(()=>({}))]).then(([raw,labels])=>{
    const b=raw&&typeof raw==="object"?raw:{};
    const name=str(b.name,defaults.name),suffix=str(b.suffix,defaults.suffix),title=name+" "+suffix;
    const accent=color(b.accentColor,defaults.accentColor), theme=color(b.themeColor,defaults.themeColor);
    document.title=title;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme);
    const img=splash?.querySelector("img");if(img){img.src=logo(b.logo,defaults.logo);img.alt=name}
    const head=splash?.querySelector(".title");if(head){const span=document.createElement("span");span.textContent=suffix;span.style.color=accent;head.replaceChildren(document.createTextNode(name+" "),span)}
    const spinner=splash?.querySelector(".spinner");if(spinner)spinner.style.borderTopColor=accent;
    let saved;try{saved=JSON.parse(localStorage.getItem("opencadstudio.settings"))?.settings?.language}catch{}
    const preferred=navigator.languages?.length?navigator.languages:[navigator.language];
    const requested=saved==="system"?preferred:typeof saved==="string"?[saved,...preferred]:[str(b.defaultLocale,defaults.defaultLocale),...preferred];
    const available=Object.keys(labels||{});let locale="vi-VN";
    for(const candidate of requested){
      try{const l=new Intl.Locale(candidate);
        const match=available.find(v=>v.toLowerCase()===l.baseName.toLowerCase())||(l.language==="zh"?(l.maximize().script==="Hant"?"zh-TW":"zh-CN"):available.find(v=>v.startsWith(l.language+"-")));
        if(match&&available.includes(match)){locale=match;break}
      }catch{}
    }
    document.documentElement.lang=locale;document.documentElement.dir=locale==="ar-SA"?"rtl":"ltr";
    const caption=splash?.querySelector(".sub");if(caption&&typeof labels?.[locale]?.loading==="string")caption.textContent=labels[locale].loading;
  }).catch(()=>{});
})();
