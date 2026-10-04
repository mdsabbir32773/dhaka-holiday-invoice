const CONFIG = window.INVOICE_CONFIG || {};
let sb = null, receipts = [], editingId = null, settings = null;
const defaultSettings = {
  company: "Dhaka Holiday",
  phone: "01901168410 | 01847801410",
  address: "Dhaka Holiday, 68-69 Concept Tower, Lift 3 (4th Floor), Panthapath Signal, Green Road, Dhaka-1205",
  footer: "Thank you for choosing Dhaka Holiday. We wish you a pleasant journey."
};
const $ = id => document.getElementById(id);
const configured = () => Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_URL.includes("PASTE_YOUR"));
function today(){ return new Date().toISOString().slice(0,10); }
function money(n){ return "BDT " + Number(n||0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function words(n){
  n=Number(n||0); if(!n)return "Zero Taka Only";
  const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function x(v){if(v<20)return a[v];if(v<100)return b[Math.floor(v/10)]+(v%10?" "+a[v%10]:"");if(v<1000)return a[Math.floor(v/100)]+" Hundred"+(v%100?" "+x(v%100):"");if(v<100000)return x(Math.floor(v/1000))+" Thousand"+(v%1000?" "+x(v%1000):"");if(v<10000000)return x(Math.floor(v/100000))+" Lakh"+(v%100000?" "+x(v%100000):"");return x(Math.floor(v/10000000))+" Crore"+(v%10000000?" "+x(v%10000000):"");}
  return x(Math.floor(n))+" Taka Only";
}
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}

async function initSupabase(){
  if(!configured()) return false;
  sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return true;
}
async function loadOnline(){
  const [r,s] = await Promise.all([
    sb.from("receipts").select("*").order("created_at",{ascending:false}),
    sb.from("company_settings").select("*").eq("id",1).single()
  ]);
  if(r.error) throw r.error;
  if(s.error) throw s.error;
  receipts = r.data || [];
  settings = s.data || defaultSettings;
}
async function getNextNo(){
  const {data,error}=await sb.rpc("next_receipt_no");
  if(error) throw error;
  return data;
}
async function dbSave(r){
  const payload={...r,created_by:undefined};
  delete payload.created_by;
  if(editingId){
    const {data,error}=await sb.from("receipts").update(payload).eq("id",r.id).select().single();
    if(error) throw error;
    const i=receipts.findIndex(x=>x.id===r.id); if(i>=0) receipts[i]=data; else receipts.unshift(data);
    return data;
  }
  const {data,error}=await sb.from("receipts").insert(payload).select().single();
  if(error) throw error;
  receipts.unshift(data); return data;
}
function formData(){
  const items=[...document.querySelectorAll(".item")].map(x=>({particular:x.querySelector(".particular").value.trim(),amount:Number(x.querySelector(".itemAmount").value||0)}));
  const total=items.reduce((a,b)=>a+b.amount,0);
  return {id:editingId||crypto.randomUUID(),receipt_no:$("receiptNo").value,date:$("receiptDate").value,customer_name:$("customerName").value.trim(),customer_phone:$("customerPhone").value.trim(),customer_address:$("customerAddress").value.trim(),items,total,amount_words:$("amountWords").value.trim()||words(total),payment_modes:[...document.querySelectorAll('input[name="pay"]:checked')].map(x=>x.value),created_at:new Date().toISOString()};
}
function initItems(items=[{particular:"",amount:""}]){$("items").innerHTML="";items.forEach(addItem);}
function addItem(v={particular:"",amount:""}){
  const row=document.createElement("div"); row.className="item";
  row.innerHTML=`<span class="sl"></span><input class="particular" placeholder="Service / Particulars" value="${esc(v.particular)}"><input class="itemAmount" type="number" min="0" step="0.01" placeholder="Amount" value="${v.amount??""}"><button type="button" class="remove">×</button>`;
  $("items").appendChild(row); renumber(); row.querySelectorAll("input").forEach(x=>x.addEventListener("input",preview)); row.querySelector(".remove").onclick=()=>{row.remove();if(!document.querySelector(".item"))addItem();renumber();preview();};
}
function renumber(){[...document.querySelectorAll(".item")].forEach((x,i)=>x.querySelector(".sl").textContent=i+1);}
function preview(){
  if(!settings) settings=defaultSettings;
  const d=formData();
  $("receiptPreview").innerHTML=`<div class="r-head"><div class="r-logo">DHAKA<span>HOLIDAY</span></div><div class="r-contact">☎ ${esc(settings.phone)}<br>⌖ ${esc(settings.address)}</div></div><div class="r-title">MONEY RECEIPT</div><div class="r-meta"><span>Receipt No: <b>${esc(d.receipt_no)}</b></span><span>Date: <b>${esc(d.date)}</b></span></div><div class="r-section">Received From</div><div class="r-line"><b>Name</b> : ${esc(d.customer_name)}</div><div class="r-line"><b>Contact No</b> : ${esc(d.customer_phone)}</div><div class="r-line"><b>Address</b> : ${esc(d.customer_address)}</div><table class="r-table"><thead><tr><th>SL</th><th>Particulars</th><th>Amount (BDT)</th></tr></thead><tbody>${d.items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.particular)}</td><td>${x.amount?Number(x.amount).toLocaleString("en-BD",{minimumFractionDigits:2}):""}</td></tr>`).join("")}${Array.from({length:Math.max(0,5-d.items.length)},()=>`<tr><td></td><td></td><td></td></tr>`).join("")}</tbody></table><div class="r-total">Total Amount: ${money(d.total)}</div><div class="r-bottom"><b>Amount in Words:</b><br>${esc(d.amount_words)}</div><div class="r-payment"><b>Payment Mode:</b> ${["Cash","Bank Transfer","Card","Others"].map(x=>`☐ ${x}${d.payment_modes.includes(x)?" ✓":""}`).join(" &nbsp; ")}</div><div class="r-bottom">${esc(settings.footer)}</div><div class="r-sign">________________________<br><b>Authorized Signature</b><br>${esc(settings.company)}</div>`;
}
function renderTable(target,list){
  target.innerHTML=list.length?`<table class="table"><thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Action</th></tr></thead><tbody>${list.map(r=>`<tr><td>${esc(r.receipt_no)}</td><td>${esc(r.date)}</td><td>${esc(r.customer_name)}</td><td>${money(r.total)}</td><td>${esc((r.payment_modes||[]).join(", "))}</td><td><button class="ghost" onclick="editReceipt('${r.id}')">Edit</button><button class="ghost" onclick="printReceipt('${r.id}')">Print</button></td></tr>`).join("")}</tbody></table>`:"<p style='color:#888'>No receipts yet.</p>";
}
function render(){
  renderTable($("recentTable"),receipts.slice(0,8)); renderTable($("historyTable"),receipts);
  $("statCount").textContent=receipts.length; $("statTotal").textContent=money(receipts.reduce((a,r)=>a+Number(r.total||0),0));
  const m=today().slice(0,7); $("statMonth").textContent=money(receipts.filter(r=>String(r.date).startsWith(m)).reduce((a,r)=>a+Number(r.total||0),0));
}
function show(v){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));$(v).classList.remove("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("pageTitle").textContent=v==="create"?"Create Receipt":v==="history"?"Receipt History":v==="settings"?"Company Settings":"Dashboard";if(v==="history")render();}
async function resetForm(){
  editingId=null; $("formHeading").textContent="Create Money Receipt"; $("receiptDate").value=today(); $("customerName").value=""; $("customerPhone").value=""; $("customerAddress").value=""; $("amountWords").value=""; document.querySelectorAll('input[name="pay"]').forEach(x=>x.checked=false); initItems();
  try{$("receiptNo").value=await getNextNo();}catch(e){$("receiptNo").value="DH-PENDING";console.error(e);alert("Could not get the next receipt number. Check Supabase setup.");}
  preview();
}
async function fillForm(r){editingId=r.id;$("formHeading").textContent="Edit Money Receipt";$("receiptNo").value=r.receipt_no;$("receiptDate").value=r.date;$("customerName").value=r.customer_name;$("customerPhone").value=r.customer_phone||"";$("customerAddress").value=r.customer_address||"";$("amountWords").value=r.amount_words||words(r.total);document.querySelectorAll('input[name="pay"]').forEach(x=>x.checked=(r.payment_modes||[]).includes(x.value));initItems(r.items||[]);preview();show("create");}
window.editReceipt=id=>{const r=receipts.find(x=>x.id===id);if(r)fillForm(r)};
window.printReceipt=id=>{const r=receipts.find(x=>x.id===id);if(r){fillForm(r);setTimeout(()=>window.print(),150)}};
async function showApp(){
  $("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");
  try{await loadOnline();$("statusDot").textContent="● Online database";}catch(e){console.error(e);$("statusDot").textContent="● Database error";alert("Could not load online data: "+e.message);}
  await resetForm(); render();
  $("setCompany").value=settings.company;$("setPhone").value=settings.phone;$("setAddress").value=settings.address;$("setFooter").value=settings.footer;preview();
}
async function boot(){
  if(!configured()){
    $("loginMsg").textContent="First setup: open config.js and add your Supabase URL + anon/publishable key."; return;
  }
  await initSupabase();
  try{const {data:{session}}=await sb.auth.getSession();if(session)await showApp();}catch(e){$("loginMsg").textContent=e.message;}
}
$("loginForm").onsubmit=async e=>{e.preventDefault();if(!sb){$("loginMsg").textContent="Supabase is not configured. Edit config.js first.";return;}const {error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){$("loginMsg").textContent=error.message;return;}await showApp();};
$("logoutBtn").onclick=async()=>{if(sb)await sb.auth.signOut();location.reload();};
document.querySelectorAll(".nav[data-view]").forEach(x=>x.onclick=()=>show(x.dataset.view));
$("quickCreate").onclick=async()=>{await resetForm();show("create")}; $("dashboardHistory").onclick=()=>show("history"); $("resetForm").onclick=resetForm; $("addItem").onclick=()=>addItem(); $("printBtn").onclick=()=>window.print(); $("printPreview").onclick=()=>window.print();
$("receiptForm").onsubmit=async e=>{e.preventDefault();if(!$("customerName").value.trim()){alert("Customer name is required.");return;}const r=formData();try{await dbSave(r);render();alert("Receipt saved successfully online.");await resetForm();show("history");}catch(err){alert("Could not save: "+err.message);}};
$("receiptForm").oninput=preview;
$("search").oninput=e=>{const q=e.target.value.toLowerCase();renderTable($("historyTable"),receipts.filter(r=>`${r.receipt_no} ${r.customer_name} ${r.customer_phone}`.toLowerCase().includes(q)));};
$("settingsForm").onsubmit=async e=>{e.preventDefault();const next={id:1,company:$("setCompany").value.trim(),phone:$("setPhone").value.trim(),address:$("setAddress").value.trim(),footer:$("setFooter").value.trim()};try{const {data,error}=await sb.from("company_settings").update({...next,updated_by:(await sb.auth.getUser()).data.user.id}).eq("id",1).select().single();if(error)throw error;settings=data;preview();alert("Company settings saved online.");}catch(err){alert("Could not save settings: "+err.message);}};
boot();
