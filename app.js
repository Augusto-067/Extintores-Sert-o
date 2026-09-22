const ENTITY_ID=1130;
const CATEGORY_ID=75;
const F={
  filial:"ufCrm45_1789664364",
  modelo:"ufCrm45_1789994407",
  quantidade:"ufCrm45_1789994716",
  vencimento:"ufCrm45_1789995511",
  localizacao:"ufCrm45_1789999303",
  hidro:"ufCrm45_1789999332",
  orcamento:"ufCrm45_1790001112"
};
let items=[],enums={},editingId=null;
const $=s=>document.querySelector(s);
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function arr(v){if(v==null)return[];return Array.isArray(v)?v:(typeof v==="object"&&v.value?arr(v.value):[v])}
function rawVal(v){
 if(v==null)return "";
 if(Array.isArray(v))return v.length?rawVal(v[0]):"";
 if(typeof v==="object")return v.value!=null?rawVal(v.value):(v.ID??v.id??v.VALUE_ID??v.value_id??v.VALUE??v.NAME??v.name??"");
 return v;
}
function vals(v){return arr(v).map(x=>typeof x==="object"?(x.VALUE??x.value??x.NAME??x.name??x.ID??x.id??""):x).filter(x=>x!==""&&x!=null)}
function escAttr(s){return esc(String(s??""))}
function date(v){let s=String(rawVal(v)||"");if(!s)return null;let m=s.match(/(\d{4})-(\d\d)-(\d\d)/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);m=s.match(/(\d\d)\/(\d\d)\/(\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1]):null}
function dateInputValue(v){const s=String(rawVal(v)||"");return s?s.slice(0,10):""}
function fmt(v){const x=date(v);return x?x.toLocaleDateString("pt-BR"):"—"}
function days(v){const x=date(v);if(!x)return Infinity;const n=new Date();n.setHours(0,0,0,0);return Math.ceil((x-n)/86400000)}
function status(v){const n=days(v);return n<0?["Vencido","danger"]:n<=30?["Até 30 dias","warn"]:["Normal","ok"]}
function toast(s){const t=$("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
async function bx(method,params={}){return new Promise((res,rej)=>BX24.callMethod(method,params,r=>r.error()?rej(r.error()):res(r.data())))}
function enumInfo(meta){
 const byId={},byName={},raw=[];
 function walk(x){
  if(x==null)return;
  if(Array.isArray(x)){x.forEach(walk);return}
  if(typeof x!=="object")return;
  const id=x.ID??x.id??x.VALUE_ID??x.value_id;
  const name=x.VALUE??x.value??x.NAME??x.name;
  if(id!=null&&name!=null){const sid=String(id),sn=String(name).trim();byId[sid]=sn;byName[sn.toLowerCase()]=sid;raw.push({id:sid,name:sn})}
  for(const [k,v] of Object.entries(x))if(["fields","items","values","variants","enum","options"].includes(k))walk(v);
 }
 walk(meta);return{byId,byName,raw};
}
function fieldEnum(meta,key){
 const legacy={
  ufCrm45_1789664364:"UF_CRM_45_1789664364",
  ufCrm45_1789994407:"UF_CRM_45_1789994407"
 };
 const lk=legacy[key];return enumInfo(meta.fields?.[key]||meta.fields?.[lk]||meta[key]||meta[lk]||{});
}
function label(info,v){const raw=String(rawVal(v));return raw?info?.byId?.[raw]??raw:""}

async function load(){
 $("#content").innerHTML='<div class="loading">Carregando registros do Bitrix24…</div>';
 try{
  const meta=await bx("crm.item.fields",{entityTypeId:ENTITY_ID});
  enums={filial:fieldEnum(meta,F.filial),modelo:fieldEnum(meta,F.modelo)};
  console.log("Metadados das listas:",enums);

  let ids=[],start=-1;
  do{
   const params={entityTypeId:ENTITY_ID,select:["id"],order:{id:"DESC"},filter:{categoryId:CATEGORY_ID}};
   if(start>=0)params.start=start;
   const r=await bx("crm.item.list",params);
   ids.push(...(r.items||[]).map(x=>x.id));
   start=r.next??-1;
  }while(start>=0);

  const full=[];
  for(const id of ids){
   const r=await bx("crm.item.get",{entityTypeId:ENTITY_ID,id});
   if(r.item)full.push(r.item);
  }
  console.log("Registros encontrados na categoria",CATEGORY_ID,full.length,full[0]);

  items=full.map(x=>({
   id:x.id,title:x.title||(`#${x.id}`),filial:label(enums.filial,x[F.filial])||"Sem filial",modelo:label(enums.modelo,x[F.modelo])||"Modelo não informado",
   venc:x[F.vencimento],locs:vals(x[F.localizacao]),hidro:x[F.hidro],orc:x[F.orcamento],raw:x
  }));
  render();
 }catch(e){
  console.error(e);
  $("#content").innerHTML='<div class="empty">Erro ao carregar registros.<br><small>'+esc(e.error_description||e.message||e)+'</small></div>';
 }
}
function render(){
 const q=$("#search").value.trim().toLowerCase();
 const filtered=items.filter(r=>[r.id,r.title,r.filial,r.modelo,...r.locs].join(" ").toLowerCase().includes(q));
 const filials={};
 for(const r of filtered)(filials[r.filial]??=[]).push(r);
 let html="",models=0;
 for(const [filial,rs] of Object.entries(filials).sort((a,b)=>a[0].localeCompare(b[0]))){
  const groups={};for(const r of rs)(groups[r.modelo]??=[]).push(r);models+=Object.keys(groups).length;
  html+=`<section class="branch-group"><div class="branch-head-main" onclick="toggleBranch(this.parentElement)"><span class="arrow">▼</span><b>${esc(filial)}</b><span class="count">${rs.length} extintor(es) · ${Object.keys(groups).length} modelo(s)</span></div><div class="branch-main-body">`;
  for(const [modelo,group] of Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0]))){
   const anchor=group[0];
   html+=`<div class="model" id="m${anchor.id}"><div class="model-head" onclick="toggleModel(${anchor.id})"><span class="arrow">▶</span><span class="title">${esc(modelo)}</span><span class="model-meta"><span class="tag">${group.length} extintor(es)</span></span><button class="btn primary generate" onclick="event.stopPropagation();openNew(${JSON.stringify(filial)},${JSON.stringify(modelo)})">+ Extintor</button></div><div class="model-body"><div class="table-wrap"><table class="grid"><thead><tr><th>Extintor</th><th>Localização</th><th>Vencimento</th><th>Teste hidrostático</th><th>Status</th><th>Orçamento</th><th></th></tr></thead><tbody>${group.map(itemRow).join("")}</tbody></table></div></div></div>`;
  }
  html+=`</div></section>`;
 }
 $("#total").textContent=filtered.length;
 $("#d30").textContent=items.filter(r=>days(r.venc)<=30).length;
 $("#hydro").textContent=items.filter(r=>days(r.hidro)<=30).length;
 $("#models").textContent=models;
 $("#content").innerHTML=html||'<div class="empty">Nenhum registro encontrado nesta categoria.</div>';
}
function itemRow(r){
 const st=status(r.venc);
 return `<tr><td><a href="#" onclick="return openItem(${r.id})">${esc(r.title)} <span class="muted">#${r.id}</span></a></td><td>${esc(r.locs.join(", ")||"—")}</td><td>${fmt(r.venc)}</td><td>${fmt(r.hidro)}</td><td><span class="status ${st[1]}">${st[0]}</span></td><td>${r.orc?"Anexado":"—"}</td><td><button class="btn secondary" onclick="openEditor(${r.id})">Editar</button></td></tr>`;
}
function toggleBranch(e){e.classList.toggle("closed");const a=e.querySelector(".branch-head-main .arrow");if(a)a.textContent=e.classList.contains("closed")?"▶":"▼"}
function toggleModel(id){const e=$("#m"+id);e.classList.toggle("open");e.querySelector(".arrow").textContent=e.classList.contains("open")?"▼":"▶"}
function openItem(id){BX24.openPath(`/page/uso_e_consumo/rtqioc/type/${ENTITY_ID}/details/${id}/`);return false}
function optionHtml(info,value){const selected=String(rawVal(value));return info.raw.map(o=>`<option value="${escAttr(o.id)}" ${String(o.id)===selected?"selected":""}>${esc(o.name)}</option>`).join("")}
function editorHtml(r){
 const isNew=!r,id=r?.id||0;
 return `<div class="modal-backdrop" id="editModal"><div class="modal"><div class="modal-head"><b>${isNew?"Novo extintor":"Editar extintor"}</b><button class="close" onclick="closeEditor()">×</button></div><div class="modal-body"><div class="edit-grid">
 <label class="edit-field"><span>Título</span><input data-key="title" value="${escAttr(r?.title||"")}" placeholder="Ex.: Extintor 001"></label>
 <label class="edit-field"><span>Filial</span><select data-key="filial">${optionHtml(enums.filial,r?.raw?.[F.filial])}</select></label>
 <label class="edit-field"><span>Modelo</span><select data-key="modelo">${optionHtml(enums.modelo,r?.raw?.[F.modelo])}</select></label>
 <label class="edit-field"><span>Quantidade</span><input data-key="quantidade" type="number" value="1" min="1" max="1" disabled></label>
 <label class="edit-field"><span>Vencimento</span><input data-key="vencimento" type="date" value="${dateInputValue(r?.vencimento)}"></label>
 <label class="edit-field"><span>Teste hidrostático</span><input data-key="hidro" type="date" value="${dateInputValue(r?.hidro)}"></label>
 <label class="edit-field full"><span>Localização</span><input data-key="localizacao" value="${escAttr(r?.locs?.join(", ")||"")}" placeholder="Ex.: Loja 01 - corredor"></label>
 <label class="edit-field full"><span>Orçamento / Anexo</span><input data-key="orcamentoFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"></label>
 </div><div class="hint">Cada registro representa <b>um único extintor físico</b>. A quantidade fica sempre em 1.</div></div><div class="modal-foot"><button class="btn secondary" onclick="closeEditor()">Cancelar</button><button class="btn primary" onclick="saveItem(${id})">Salvar</button></div></div></div>`;
}
function openEditor(id){const r=items.find(x=>x.id==id);if(!r)return;document.body.insertAdjacentHTML("beforeend",editorHtml(r))}
function openNew(filial,modelo){const r={title:"",filial,modelo,locs:[],venc:"",hidro:"",orc:null,raw:{[F.filial]:enums.filial.byName[String(filial).toLowerCase()]||"",[F.modelo]:enums.modelo.byName[String(modelo).toLowerCase()]||""}};document.body.insertAdjacentHTML("beforeend",editorHtml(r))}
function closeEditor(){const m=$("#editModal");if(m)m.remove()}
function modalFields(){const m=$("#editModal"),out={};m.querySelectorAll("[data-key]").forEach(el=>out[el.dataset.key]=el.value);return out}
async function readFile(){const f=$("#editModal")?.querySelector('[data-key="orcamentoFile"]')?.files?.[0];if(!f)return null;const b=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(",")[1]);fr.onerror=rej;fr.readAsDataURL(f)});return[{fileData:[f.name,b]}]}
async function saveItem(id){
 const v=modalFields();
 if(!v.filial||!v.modelo){toast("Selecione a filial e o modelo.");return}
 try{
  const file=await readFile();
  const fields={title:v.title||"Extintor",categoryId:CATEGORY_ID,[F.filial]:v.filial,[F.modelo]:v.modelo,[F.quantidade]:1,[F.vencimento]:v.vencimento||"",[F.hidro]:v.hidro||"",[F.localizacao]:v.localizacao||""};
  if(file)fields[F.orcamento]=file;
  if(id)await bx("crm.item.update",{entityTypeId:ENTITY_ID,id,fields});
  else await bx("crm.item.add",{entityTypeId:ENTITY_ID,fields});
  closeEditor();toast(id?"Extintor atualizado.":"Extintor criado.");await load();
 }catch(e){console.error(e);toast("Erro ao salvar: "+(e.error_description||e.message||e))}
}
$("#reload").onclick=load;$("#search").oninput=render;BX24.init(load);
