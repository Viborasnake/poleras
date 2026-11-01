const ATTEMPT_TTL_MS=15*24*60*60*1000;

export function stableRequestId(storage,key,signature,createId=()=>crypto.randomUUID(),now=Date.now()){
 try{
  const saved=JSON.parse(storage.getItem(key)||'null');
  if(saved?.signature===signature&&typeof saved.id==='string'&&saved.id&&Number(saved.expiresAt)>now)return saved.id;
 }catch{}
 const id=createId();
 try{storage.setItem(key,JSON.stringify({id,signature,expiresAt:now+ATTEMPT_TTL_MS}))}catch{}
 return id;
}
