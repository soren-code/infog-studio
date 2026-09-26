const RATIO_CONFIG = {
  "1:1": {width:1080,height:1080,aspect:"1 / 1"},
  "4:5": {width:1080,height:1350,aspect:"4 / 5"},
  "9:16": {width:1080,height:1920,aspect:"9 / 16"}
};

const THEMES = {
  modern:{bg:"#0b1220",surface:"#111827",text:"#f8fafc",muted:"#94a3b8",accent:"#38bdf8",accent2:"#a3e635"},
  corporate:{bg:"#f8fafc",surface:"#ffffff",text:"#0f172a",muted:"#64748b",accent:"#2563eb",accent2:"#16a34a"},
  editorial:{bg:"#f5f0e7",surface:"#fffdf8",text:"#1f2937",muted:"#6b6258",accent:"#c2410c",accent2:"#ca8a04"},
  minimal:{bg:"#ffffff",surface:"#f5f5f5",text:"#111111",muted:"#666666",accent:"#111111",accent2:"#666666"}
};

const DEMO = {
  projectName:"excel-relative-references",
  topic:"Excel Relative References",
  ratio:"4:5",
  theme:"modern",
  slides:[
    {type:"hook",layout:"hero",kicker:"EXCEL • WORK SMARTER",title:"Tired of manually updating cell references?",subtitle:"Relative references adjust automatically when you copy a formula.",swipe:"SWIPE →"},
    {type:"context",layout:"two-col",kicker:"THE PROBLEM",title:"Copying formulas can get repetitive.",subtitle:"When the same calculation is needed across rows or columns, manual edits create unnecessary work.",cards:[
      ["Manual edits","Changing every cell reference wastes time and can introduce mistakes."],
      ["Repeated work","The same calculation often needs to move with the data."]
    ]},
    {type:"concept",layout:"cards",kicker:"THE CONCEPT",title:"Relative references move with the formula.",subtitle:"A reference such as A2 changes position when the formula is copied.",cards:[
      ["Original","=B2*C2"],
      ["Copied down","=B3*C3"],
      ["Copied again","=B4*C4"],
      ["Key idea","The reference changes relative to its new position."]
    ]},
    {type:"data",layout:"chart",kicker:"SEE IT IN ACTION",title:"One formula. Multiple rows.",subtitle:"The formula pattern stays consistent while the references adjust.",chart:[["Row 2",100],["Row 3",75],["Row 4",88],["Row 5",64]]},
    {type:"steps",layout:"cards",kicker:"HOW TO USE IT",title:"Build once, then copy.",subtitle:"Use this simple workflow when calculations repeat.",cards:[
      ["01","Write the formula in the first row."],
      ["02","Check that the reference is relative."],
      ["03","Drag or copy the formula."],
      ["04","Verify the adjusted references."]
    ]},
    {type:"takeaway",layout:"two-col",kicker:"QUICK TAKEAWAY",title:"Let Excel handle the repetition.",subtitle:"Relative references are useful whenever a formula should change position as it is copied.",cards:[
      ["Use when","The calculation pattern repeats."],
      ["Watch for","Cases where a reference must stay fixed."]
    ]},
    {type:"cta",layout:"cta",kicker:"SAVE THIS GUIDE",title:"Which Excel technique will you use first?",subtitle:"Save this carousel for your next spreadsheet project.",cta:"SAVE • SHARE • FOLLOW"}
  ]
};

let state = {ratio:"4:5",currentSlide:0,slides:[],theme:"modern",projectName:"social-infographic",topic:"Social Infographic"};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function escapeHTML(value=""){
  return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function slugify(s){return String(s||"project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"project";}
function pad(n){return String(n).padStart(2,"0");}
function setCSS(name,value){document.documentElement.style.setProperty(name,value);}

function applyTheme(){
  const t=THEMES[state.theme]||THEMES.modern;
  setCSS("--canvas-bg",t.bg); setCSS("--canvas-surface",t.surface); setCSS("--canvas-text",t.text);
  setCSS("--canvas-muted",t.muted); setCSS("--canvas-accent",t.accent); setCSS("--canvas-accent2",t.accent2);
}

function slideNumber(i){return `${pad(i+1)} / ${pad(state.slides.length)}`;}

function renderSlide(slide,i,mode="preview"){
  const type=slide.type||"content";
  const layout=slide.layout||"cards";
  let body="";
  if(layout==="hero"){
    body=`<div class="hero"><div class="kicker">${escapeHTML(slide.kicker||"")}</div><div class="title">${escapeHTML(slide.title||"")}</div><div class="subtitle">${escapeHTML(slide.subtitle||"")}</div>${slide.swipe?`<div class="swipe">${escapeHTML(slide.swipe)}</div>`:""}</div>`;
  } else if(layout==="cta"){
    body=`<div class="hero"><div class="kicker">${escapeHTML(slide.kicker||"")}</div><div class="title">${escapeHTML(slide.title||"")}</div><div class="subtitle">${escapeHTML(slide.subtitle||"")}</div><div class="cta-box"><strong>${escapeHTML(slide.cta||"SAVE THIS FOR LATER")}</strong></div></div>`;
  } else if(layout==="chart"){
    const max=Math.max(...(slide.chart||[]).map(x=>x[1]),1);
    const rows=(slide.chart||[]).map(x=>`<div class="bar-row"><span>${escapeHTML(x[0])}</span><span class="bar"><i style="width:${(x[1]/max)*100}%"></i></span><b>${escapeHTML(x[1])}</b></div>`).join("");
    body=`<div><div class="kicker">${escapeHTML(slide.kicker||"")}</div><div class="title">${escapeHTML(slide.title||"")}</div><div class="subtitle">${escapeHTML(slide.subtitle||"")}</div><div class="content chart-wrap">${rows}</div></div>`;
  } else {
    const cards=(slide.cards||[]).map(c=>`<article class="card">${c[0].length<=3&&/^\\d+$/.test(c[0])?`<div class="stat">${escapeHTML(c[0])}</div>`:`<h3>${escapeHTML(c[0])}</h3>`}<p>${escapeHTML(c[1])}</p></article>`).join("");
    body=`<div><div class="kicker">${escapeHTML(slide.kicker||"")}</div><div class="title">${escapeHTML(slide.title||"")}</div><div class="subtitle">${escapeHTML(slide.subtitle||"")}</div><div class="content ${layout==="two-col"?"two-col":"cards"}">${cards}</div></div>`;
  }
  return `<article class="infographic-canvas" data-slide-index="${i}" data-export-name="${escapeHTML(slide.type||"slide")}" aria-label="Slide ${i+1} of ${state.slides.length}">
    <div class="canvas-inner">
      <header class="canvas-header"><span>${escapeHTML(state.topic)}</span><span>${slideNumber(i)}</span></header>
      <main class="slide-main">${body}</main>
      <footer class="canvas-footer"><span>${escapeHTML(state.projectName)}</span><span>${type==="hook"?"Swipe →":type==="cta"?"Thank you":"Continue →"}</span></footer>
    </div>
  </article>`;
}

function renderPreview(){
  applyTheme();
  const slide=state.slides[state.currentSlide];
  $("#preview").innerHTML=slide?renderSlide(slide,state.currentSlide):"";
  const canvas=$("#preview .infographic-canvas");
  if(canvas) canvas.style.aspectRatio=RATIO_CONFIG[state.ratio].aspect;
  $("#counter").textContent=slideNumber(state.currentSlide);
  $("#slideCount").textContent=`${state.slides.length} slides`;
  renderThumbnails();
}

async function renderThumbsCanvas(slide,index){
  const holder=document.querySelector(`[data-thumb="${index}"]`);
  if(!holder)return;
  const source=document.createElement("div");
  source.style.cssText=`position:fixed;left:-10000px;top:0;width:320px;pointer-events:none`;
  source.innerHTML=renderSlide(slide,index);
  document.body.appendChild(source);
  const c=source.firstElementChild;c.style.aspectRatio=RATIO_CONFIG[state.ratio].aspect;
  try{
    await document.fonts.ready;
    const canvas=await html2canvas(c,{backgroundColor:null,scale:0.5,useCORS:true,allowTaint:false});
    holder.querySelector("canvas")?.remove();
    holder.appendChild(canvas);
  }catch(e){}
  source.remove();
}
function renderThumbnails(){
  const wrap=$("#thumbnails");wrap.innerHTML="";
  state.slides.forEach((slide,i)=>{
    const b=document.createElement("button");b.className="thumb"+(i===state.currentSlide?" active":"");b.dataset.thumb=i;
    b.innerHTML=`<span>${pad(i+1)}</span>`;
    b.onclick=()=>{state.currentSlide=i;renderPreview()};
    wrap.appendChild(b);
    renderThumbsCanvas(slide,i);
  });
}

function setRatio(r){
  state.ratio=r;
  $$("#ratioControls button").forEach(b=>b.classList.toggle("active",b.dataset.ratio===r));
  renderPreview();
}
function nextSlide(){state.currentSlide=Math.min(state.currentSlide+1,state.slides.length-1);renderPreview()}
function previousSlide(){state.currentSlide=Math.max(state.currentSlide-1,0);renderPreview()}

function setStatus(msg){$("#exportStatus").textContent=msg;}

async function waitForImages(){await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r})));await document.fonts.ready;}
async function renderSlideToCanvas(index){
  const cfg=RATIO_CONFIG[state.ratio];
  const mount=document.createElement("div");
  mount.style.cssText=`position:fixed;left:-20000px;top:0;width:${cfg.width}px;height:${cfg.height}px;overflow:hidden;background:transparent`;
  mount.innerHTML=renderSlide(state.slides[index],index,"export");
  document.body.appendChild(mount);
  const el=mount.firstElementChild;
  el.style.width=cfg.width+"px";el.style.height=cfg.height+"px";el.style.aspectRatio=cfg.aspect;borderRadius="0";
  await waitForImages();
  await new Promise(requestAnimationFrame);
  const canvas=await html2canvas(el,{width:cfg.width,height:cfg.height,scale:1,useCORS:true,allowTaint:false,backgroundColor:null,logging:false});
  mount.remove();
  return canvas;
}
function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG conversion failed")),"image/png",1));}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

async function exportCurrent(){
  setStatus("Preparing current slide…");
  try{
    const c=await renderSlideToCanvas(state.currentSlide);
    const blob=await canvasBlob(c);
    downloadBlob(blob,`${slugify(state.projectName)}-${pad(state.currentSlide+1)}-${slugify(state.slides[state.currentSlide].type)}.png`);
    setStatus("✓ Current slide exported.");
  }catch(e){setStatus("Export failed: "+e.message)}
}

async function exportAll(){
  state.exporting=true;
  try{
    for(let i=0;i<state.slides.length;i++){
      setStatus(`Rendering slide ${pad(i+1)} / ${pad(state.slides.length)}…`);
      const c=await renderSlideToCanvas(i);const blob=await canvasBlob(c);
      downloadBlob(blob,`${slugify(state.projectName)}-${pad(i+1)}-${slugify(state.slides[i].type)}.png`);
      await new Promise(r=>setTimeout(r,120));
    }
    setStatus(`✓ ${state.slides.length} PNGs exported.`);
  }catch(e){setStatus("Batch export failed: "+e.message)}
  finally{state.exporting=false}
}

function generatedCSS(){
  return `/* Generated from Responsive Social Infographic Studio */\n${document.querySelector('style')?.textContent||"See styles.css in the project package."}`;
}
function generatedHTML(){
  return document.documentElement.outerHTML.replace(/<script src="script\.js"><\/script>/,"<script src=\"script.js\"></script>");
}
function generatedJS(){return "// Generated project runtime. See the bundled studio source."; }

async function exportZip(){
  if(typeof JSZip==="undefined"){setStatus("JSZip could not load. Check network access and retry.");return}
  try{
    const zip=new JSZip(), folder=zip.folder(slugify(state.projectName)), slidesFolder=folder.folder("slides");
    const manifest={project:state.projectName,topic:state.topic,ratio:state.ratio,width:RATIO_CONFIG[state.ratio].width,height:RATIO_CONFIG[state.ratio].height,slides:state.slides.length,theme:state.theme,exportedAt:new Date().toISOString()};
    for(let i=0;i<state.slides.length;i++){
      setStatus(`Packaging slide ${pad(i+1)} / ${pad(state.slides.length)}…`);
      const c=await renderSlideToCanvas(i);const blob=await canvasBlob(c);
      slidesFolder.file(`${pad(i+1)}-${slugify(state.slides[i].type)}.png`,blob);
    }
    folder.file("manifest.json",JSON.stringify(manifest,null,2));
    folder.file("README.txt",`RESPONSIVE SOCIAL INFOGRAPHIC PROJECT\n\nProject: ${state.projectName}\nTopic: ${state.topic}\nRatio: ${state.ratio}\nCanvas: ${RATIO_CONFIG[state.ratio].width} x ${RATIO_CONFIG[state.ratio].height}\nSlides: ${state.slides.length}\nTheme: ${state.theme}\n\nContents:\n- slides/*.png\n- manifest.json\n- README.txt\n- source-reference.txt\n`);
    folder.file("source-reference.txt",`Topic: ${state.topic}\nProject: ${state.projectName}\nGenerated by Responsive Social Infographic Studio.\n`);
    folder.file("index.html",generatedHTML());
    folder.file("styles.css",document.querySelector("link[rel=stylesheet]")?"/* Copy styles.css from the studio project. */":"");
    folder.file("script.js",generatedJS());
    setStatus("Building ZIP…");
    const blob=await zip.generateAsync({type:"blob"});
    downloadBlob(blob,`${slugify(state.projectName)}-${state.ratio.replace(":","x")}.zip`);
    setStatus("✓ ZIP downloaded.");
  }catch(e){setStatus("ZIP export failed: "+e.message)}
}

function loadProject(data){
  state.projectName=data.projectName||slugify(data.topic||"social-infographic");
  state.topic=data.topic||"Social Infographic";
  state.ratio=RATIO_CONFIG[data.ratio]?data.ratio:"4:5";
  state.theme=THEMES[data.theme]?data.theme:"modern";
  state.slides=Array.isArray(data.slides)&&data.slides.length?data.slides:DEMO.slides;
  state.currentSlide=0;
  $("#themeSelect").value=state.theme;
  setRatio(state.ratio);
}

function init(){
  loadProject(DEMO);
  $$("#ratioControls button").forEach(b=>b.onclick=()=>setRatio(b.dataset.ratio));
  $("#prev").onclick=previousSlide;$("#next").onclick=nextSlide;
  $("#exportCurrent").onclick=exportCurrent;$("#exportAll").onclick=exportAll;$("#exportZip").onclick=exportZip;
  $("#themeSelect").onchange=e=>{state.theme=e.target.value;renderPreview()};
  $("#loadDemo").onclick=()=>loadProject(DEMO);
  $("#jsonInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{loadProject(JSON.parse(await f.text()));setStatus("✓ Project loaded.")}catch(err){setStatus("Invalid JSON project.")}};
  $("#presentation").onclick=()=>{const layer=$("#presentationLayer");layer.hidden=false;layer.querySelector("#presentationCanvas").innerHTML=renderSlide(state.slides[state.currentSlide],state.currentSlide);layer.querySelector(".infographic-canvas").style.aspectRatio=RATIO_CONFIG[state.ratio].aspect};
  $("#closePresentation").onclick=()=>$("#presentationLayer").hidden=true;
  document.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName))return;
    if(e.key==="ArrowRight")nextSlide();if(e.key==="ArrowLeft")previousSlide();if(e.key==="Home"){state.currentSlide=0;renderPreview()}if(e.key==="End"){state.currentSlide=state.slides.length-1;renderPreview()}if(e.key==="Escape")$("#presentationLayer").hidden=true;
  });
}
init();
