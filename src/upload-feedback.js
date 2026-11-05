let nextId=0;
const tasks=new Map();

function render(){
  if(typeof document==='undefined'||typeof document.querySelector!=='function'||typeof document.createElement!=='function'||!document.body)return;
  let panel=document.querySelector('#upload-feedback');
  if(!tasks.size){panel?.remove();return}
  if(!panel){panel=document.createElement('aside');panel.id='upload-feedback';panel.className='upload-feedback';panel.setAttribute('aria-label','Carga de archivos');document.body.append(panel)}
  panel.replaceChildren();
  for(const task of tasks.values()){
    const row=document.createElement('div');row.className='upload-feedback-row';
    const label=document.createElement('span');label.setAttribute('role','status');label.setAttribute('aria-live','polite');label.textContent=`${task.name}: ${task.phase}${task.percent==null?'':` · ${task.percent}%`}`;
    const bar=document.createElement('progress');bar.setAttribute('aria-label',`${task.phase}: ${task.name}`);bar.max=100;if(task.percent!=null)bar.value=task.percent;
    row.append(label,bar);panel.append(row);
  }
}

export function beginUploadFeedback(name,phase='Leyendo archivo'){
  const id=++nextId;tasks.set(id,{name:String(name||'Archivo'),phase,percent:null});render();
  return {
    update(nextPhase,percent=null){if(!tasks.has(id))return;tasks.set(id,{name:String(name||'Archivo'),phase:nextPhase,percent:Number.isFinite(percent)?Math.max(0,Math.min(100,Math.round(percent))):null});render()},
    done(){tasks.delete(id);render()},
  };
}
