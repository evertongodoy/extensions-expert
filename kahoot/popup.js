const statusEl=document.getElementById('status'), fileInfo=document.getElementById('fileInfo');
const fileInput=document.getElementById('docx'), startEl=document.getElementById('start'), delayEl=document.getElementById('delay');
const oneBtn=document.getElementById('one'), allBtn=document.getElementById('all'), stopBtn=document.getElementById('stop');
let questions=[];
function status(s){statusEl.textContent=s}
fileInput.addEventListener('change',async()=>{
  oneBtn.disabled=allBtn.disabled=true; questions=[];
  const f=fileInput.files[0]; if(!f){status('Selecione primeiro um DOCX.');return}
  try{status('Lendo DOCX...'); questions=await readDocxQuestions(f); fileInfo.innerHTML=`<small class="ok">${f.name}<br>${questions.length} questões válidas encontradas.</small>`; startEl.max=questions.length; oneBtn.disabled=allBtn.disabled=false; status(`DOCX carregado. Questões 1 a ${questions.length} prontas.`)}
  catch(e){fileInfo.innerHTML='<small>Falha ao carregar o arquivo.</small>';status('ERRO: '+e.message)}
});

async function activeKahootTab(){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  const tab=tabs[0];
  if(!tab?.id) throw new Error('Aba ativa não encontrada.');
  if(!/^https:\/\/create\.kahoot\.it\//i.test(tab.url||'')) throw new Error('Abra o editor em create.kahoot.it antes de executar.');
  return tab;
}
function sendMessage(tabId,payload){
  return new Promise((resolve,reject)=>chrome.tabs.sendMessage(tabId,payload,r=>{
    if(chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(r);
  }));
}
async function ensureContentScript(tabId){
  try { return await sendMessage(tabId,{action:'ping'}); }
  catch(e){
    status('Conectando a extensão ao editor do Kahoot...');
    await chrome.scripting.executeScript({target:{tabId},files:['content.js']});
    await new Promise(r=>setTimeout(r,250));
    return await sendMessage(tabId,{action:'ping'});
  }
}
async function send(action){
  try{
    const tab=await activeKahootTab();
    await ensureContentScript(tab.id);
    const payload={action,start:+startEl.value,delay:+delayEl.value,questions};
    const r=await sendMessage(tab.id,payload);
    if(r?.status) status(r.status);
  }catch(e){status('ERRO: '+e.message)}
}
oneBtn.onclick=()=>send('one'); allBtn.onclick=()=>send('all'); stopBtn.onclick=()=>send('stop');
chrome.runtime.onMessage.addListener(m=>{if(m.type==='status')status(m.text)});
