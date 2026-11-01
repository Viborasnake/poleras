export const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const ignored=new Set(['para','un','una','el','la','los','las','de','del','con','que','le','a','y','me','quiero','busco','alguien','diseno','disenos','tema','temas','idea','ideas','algo','ama','amante']);
const giftWords=new Set(['regalo','regalos','cumpleanos','fecha','fechas']);
const canonical=word=>({gato:'mascota',gatos:'mascota',perro:'mascota',perros:'mascota',mascotas:'mascota',personalizable:'personalizado',personalizables:'personalizado',personalizados:'personalizado',tote:'totebags',totes:'totebags',bolsa:'totebags',body:'bodys',bebe:'bodys',polera:'poleras',camiseta:'poleras',videojuego:'juegos',videojuegos:'juegos',gaming:'juegos',bootlegs:'bootleg'})[word]||word;
function nearby(a,b){
  if(a.length<4||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++}
  return edits+(a.length-i)+(b.length-j)<=1;
}

/** Ranked local catalogue search: names first, then collections, topics and product terms. */
export function searchCatalog(entries,query=''){
  const normalized=normalizeSearch(query),rawWords=normalized.split(' ').filter(Boolean);
  const terms=rawWords.filter(word=>!ignored.has(word)&&!giftWords.has(word)).map(canonical);
  return entries.map((entry,index)=>{
    const {design,collection}=entry;
    const name=normalizeSearch(design.name),group=normalizeSearch(collection.label);
    const context=normalizeSearch([entry.category,design.caption,...(entry.products||[]),design.acceptsCustomerImage?'personalizado':''].join(' '));
    const words=normalizeSearch(`${name} ${group} ${context}`).split(' ').map(canonical);
    let score=design.featured?2:0,matched=0;
    for(const term of terms){
      if(name.split(' ').map(canonical).some(word=>word.startsWith(term))){score+=12;matched++}
      else if(group.split(' ').map(canonical).some(word=>word.startsWith(term))){score+=8;matched++}
      else if(words.some(word=>word.startsWith(term))){score+=4;matched++}
      else if(words.some(word=>nearby(term,word))){score+=1;matched++}
    }
    if(normalized&&name===normalized)score+=40;
    return {entry,index,score,matched};
  }).filter(result=>!terms.length||result.matched===terms.length)
    .sort((a,b)=>b.score-a.score||a.index-b.index).map(result=>result.entry);
}
