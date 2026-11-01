import {searchCatalog} from './catalog-search.js';
const RECENT_KEY='droska-recent-designs';
export function readRecentDesigns(storage){
  try{const value=JSON.parse((storage??globalThis.localStorage).getItem(RECENT_KEY)||'[]');return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&id.length<=160))].slice(0,12):[]}catch{return []}
}
export function rememberRecentDesign(previous,id,storage){
  const next=[String(id),...previous.filter(value=>value!==String(id))].slice(0,12);
  try{(storage??globalThis.localStorage).setItem(RECENT_KEY,JSON.stringify(next))}catch{}
  return next;
}
export function selectSearchEntries(entries,{query='',product='all',topic='all',view='all',recentIds=[]}={}){
  let matches=searchCatalog(entries,query).filter(entry=>(product==='all'||entry.productSlugs?.includes(product))&&(topic==='all'||entry.collection.category===topic));
  if(view==='featured')matches=matches.filter(entry=>entry.design.featured||entry.collection.featured);
  if(view==='custom')matches=matches.filter(entry=>entry.design.acceptsCustomerImage);
  if(view==='new')matches=matches.filter(entry=>Number.isFinite(Date.parse(entry.design.createdAt))).sort((a,b)=>Date.parse(b.design.createdAt)-Date.parse(a.design.createdAt));
  if(view==='recent')matches=matches.filter(entry=>recentIds.includes(String(entry.design.id))).sort((a,b)=>recentIds.indexOf(String(a.design.id))-recentIds.indexOf(String(b.design.id)));
  return matches;
}
