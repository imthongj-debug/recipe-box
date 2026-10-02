const API_URL = "/api/recipes";
const $ = id => document.getElementById(id);
let allสูตรอาหารs = [];
let showingAll = false;

const recipeGrid = $("recipeGrid"), emptyState = $("emptyState"), categoryFilter = $("categoryFilter"), searchInput = $("searchInput");
const modal = $("modal"), detailModal = $("detailModal"), form = $("recipeForm");

window.addEventListener("DOMContentLoaded", () => {
  loadสูตรอาหารs();
  $("navAddBtn").onclick = openAddModal; $("heroAddBtn").onclick = openAddModal; $("ctaAddBtn").onclick = openAddModal;
  $("closeModal").onclick = closeModal; $("cancelBtn").onclick = closeModal; $("closeDetail").onclick = () => detailModal.classList.add("hidden");
  $("menuBtn").onclick = () => $("mobileNav").classList.toggle("open");
  $("searchInput").addEventListener("input", debounce(loadสูตรอาหารs, 250));
  categoryFilter.onchange = loadสูตรอาหารs; $("clearBtn").onclick = () => { searchInput.value=""; categoryFilter.value=""; showingAll=false; loadสูตรอาหารs(); };
  $("showAllBtn").onclick = () => { showingAll=true; loadสูตรอาหารs(); document.querySelector('#recipes').scrollIntoView({behavior:'smooth'}); };
  $("allCategoriesBtn").onclick = () => document.querySelector('#recipes').scrollIntoView({behavior:'smooth'});
  form.onsubmit = saveสูตรอาหาร;
  setupImageUpload();
  [modal,detailModal].forEach(m => m.addEventListener("click", e => { if(e.target===m)m.classList.add("hidden"); }));
showToast("ขอบคุณ! ไอเดียเมนูใหม่ ๆ กำลังส่งไปให้คุณ ✨"); e.target.reset(); };
});

async function loadสูตรอาหารs(){
  try{
    const p = new URLSearchParams(); const q=searchInput.value.trim(); const c=categoryFilter.value;
    if(q)p.set("search",q); if(c)p.set("category",c);
    const res=await fetch(`${API_URL}${p.toString()?`?${p}`:""}`); if(!res.ok)throw Error("ไม่สามารถโหลดสูตรอาหารได้");
    allสูตรอาหารs=await res.json(); renderสูตรอาหารs(showingAll ? allสูตรอาหารs : allสูตรอาหารs.slice(0,4));
    await loadCategories(); renderCategories();
  }catch(e){showToast(e.message)}
}
async function loadCategories(){
  try{const res=await fetch(API_URL);const data=await res.json();const cats=[...new Set(data.map(r=>r.category))].sort();const current=categoryFilter.value;categoryFilter.innerHTML='<option value="">All categories</option>';cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;categoryFilter.appendChild(o)});categoryFilter.value=current}catch(e){}
}
function renderสูตรอาหารs(recipes){
  recipeGrid.innerHTML=""; emptyState.classList.toggle("hidden",recipes.length>0);
  recipes.forEach(r=>{const card=document.createElement('article');card.className='recipe-card';card.innerHTML=`<div class="recipe-image" style="background:${recipeBg(r.category)}">${r.image?`<img src="${esc(r.image)}" alt="${esc(r.name)}" loading="lazy">`:`<span>${emoji(r.category)}</span>`}<button class="fav" onclick="viewสูตรอาหาร(${r.id})">♡</button></div><div class="recipe-info"><span class="tag">${esc(r.category)}</span><h3>${esc(r.name)}</h3><div class="recipe-meta"><span>⏱ ${r.time} min</span><span>🥣 ${r.ingredients.length} items</span></div><button class="btn btn-light" onclick="viewสูตรอาหาร(${r.id})">ดูสูตรอาหาร <span>→</span></button></div>`;recipeGrid.appendChild(card)});
}
function renderCategories(){
  const grid=$("categoryGrid");grid.innerHTML="";const cats=[...new Set(allสูตรอาหารs.map(r=>r.category))].slice(0,6);const fallback=["อาหารจานเดียว","เส้น","ต้ม","ผัด","ของหวาน","ทอด"];(cats.length?cats:fallback).forEach(c=>{const el=document.createElement('button');el.className='category-card';el.style.border='0';el.style.textAlign='left';el.innerHTML=`<span class="cat-emoji">${emoji(c)}</span><strong>${esc(c)}</strong>`;el.onclick=()=>{categoryFilter.value=c;showingAll=true;loadสูตรอาหารs();document.querySelector('#recipes').scrollIntoView({behavior:'smooth'})};grid.appendChild(el)});
}
async function viewสูตรอาหาร(id){
  try{const res=await fetch(`${API_URL}/${id}`);const r=await res.json();if(!res.ok)throw Error(r.message);$("detailContent").innerHTML=`<span class="kicker">RECIPE</span><h2 class="detail-title">${esc(r.name)}</h2>${r.image?`<img class="detail-image" src="${esc(r.image)}" alt="${esc(r.name)}">`:""}<span class="tag">${esc(r.category)} · ⏱ ${r.time} min</span><div class="detail-section"><h3>วัตถุดิบ</h3><ul>${r.ingredients.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div><div class="detail-section"><h3>วิธีทำ</h3><div class="steps">${esc(r.steps)}</div></div><div class="form-actions"><button class="btn btn-light" onclick="editสูตรอาหาร(${r.id})">Edit สูตรอาหาร</button><button class="btn btn-dark" onclick="deleteสูตรอาหาร(${r.id})">ลบสูตรอาหาร</button></div>`;detailModal.classList.remove('hidden')}catch(e){showToast(e.message)}
}
async function editสูตรอาหาร(id){
  const res=await fetch(`${API_URL}/${id}`);const r=await res.json();if(!res.ok)return showToast(r.message);$("recipeId").value=r.id;$("name").value=r.name;$("category").value=r.category;$("time").value=r.time;$("ingredients").value=r.ingredients.join('\n');$("steps").value=r.steps;setImagePreview(r.image||"");$("modalTitle").textContent='แก้ไขสูตรอาหาร';$("formError").classList.add('hidden');detailModal.classList.add('hidden');modal.classList.remove('hidden');
}
function openAddModal(){form.reset();setImagePreview("");$("recipeId").value="";$("time").value=20;$("modalTitle").textContent='เพิ่มสูตรอาหาร';$("formError").classList.add('hidden');modal.classList.remove('hidden');$("name").focus()}
async function saveสูตรอาหาร(e){e.preventDefault();const ingredients=$("ingredients").value.split('\n').map(x=>x.trim()).filter(Boolean);const data={name:$("name").value.trim(),category:$("category").value.trim(),ingredients,steps:$("steps").value.trim(),time:Number($("time").value),image:$("imageData").value};if(!data.name||!data.category||!ingredients.length||!data.steps)return formError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');try{const id=$("recipeId").value;const res=await fetch(id?`${API_URL}/${id}`:API_URL,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw Error(result.message);closeModal();showingAll=true;await loadสูตรอาหารs();showToast(id?'สูตรอาหาร updated ✓':'สูตรอาหาร added ✓')}catch(err){formError(err.message)}}
async function deleteสูตรอาหาร(id){if(!confirm('ลบสูตรอาหาร this recipe?'))return;const res=await fetch(`${API_URL}/${id}`,{method:'DELETE'});if(!res.ok){const r=await res.json();return showToast(r.message)}detailModal.classList.add('hidden');showingAll=true;await loadสูตรอาหารs();showToast('สูตรอาหาร deleted')}
function closeModal() {modal.classList.add('hidden')}
function formError(msg){$("formError").textContent=msg;$("formError").classList.remove('hidden')}
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function emoji(c){return ({'อาหารจานเดียว':'🍛','ต้ม':'🍲','ผัด':'🥘','ทอด':'🍗','เส้น':'🍜','ยำ':'🥗','ของหวาน':'🍰','เครื่องดื่ม':'🥤'})[c]||'🍽️'}
function recipeBg(c){return ({'อาหารจานเดียว':'#f2dfbf','ต้ม':'#dfe8d7','ผัด':'#f1dfb0','ทอด':'#ead0c1','เส้น':'#ded9e8','ยำ':'#d7e7dc','ของหวาน':'#f0d9df'})[c]||'#e8e5dc'}
function esc(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

/* ===== อัปโหลดรูปจากเครื่อง ===== */
const MAX_IMAGE_SIDE = 1200;          // ย่อรูปให้ด้านยาวสุดไม่เกินนี้ (px)
const MAX_FILE_MB = 10;               // ขนาดไฟล์ต้นฉบับสูงสุด

function setupImageUpload(){
  const input=$("imageInput"), box=$("uploadBox");
  const pick=()=>input.click();
  box.addEventListener("click",e=>{ if(e.target.closest(".upload-actions"))return; if(!$("uploadPreview").classList.contains("hidden"))return; pick(); });
  box.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&$("uploadPreview").classList.contains("hidden")){e.preventDefault();pick()} });
  $("changeImageBtn").onclick=pick;
  $("removeImageBtn").onclick=()=>setImagePreview("");
  input.addEventListener("change",()=>{ if(input.files[0])handleImageFile(input.files[0]); input.value=""; });
  ["dragenter","dragover"].forEach(ev=>box.addEventListener(ev,e=>{e.preventDefault();box.classList.add("dragover")}));
  ["dragleave","drop"].forEach(ev=>box.addEventListener(ev,e=>{e.preventDefault();box.classList.remove("dragover")}));
  box.addEventListener("drop",e=>{ const f=e.dataTransfer.files[0]; if(f)handleImageFile(f); });
}

function setImagePreview(src){
  $("imageData").value=src||"";
  $("previewImg").src=src||"";
  $("uploadPreview").classList.toggle("hidden",!src);
  $("uploadEmpty").classList.toggle("hidden",!!src);
}

async function handleImageFile(file){
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return formError("รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF");
  if(file.size>MAX_FILE_MB*1024*1024) return formError(`ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_FILE_MB} MB)`);
  try{
    setImagePreview(await resizeImage(file));
    $("formError").classList.add("hidden");
  }catch(e){ formError("ไม่สามารถอ่านไฟล์รูปนี้ได้ ลองเลือกรูปอื่น"); }
}

// ย่อรูปในเบราว์เซอร์ก่อนส่ง เพื่อให้อัปโหลดเร็วและไม่กินพื้นที่
function resizeImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const scale=Math.min(1,MAX_IMAGE_SIDE/Math.max(img.width,img.height));
      const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
      const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);   // กัน PNG โปร่งใสกลายเป็นพื้นดำ
      ctx.drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL("image/jpeg",0.85));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("load"))};
    img.src=url;
  });
}
