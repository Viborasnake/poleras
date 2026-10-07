export const collections = [
  {id:'papa',label:'Para Papá'},
  {id:'mama',label:'Para Mamá'},
  {id:'bebe',label:'Para el bebé'},
  {id:'juegos',label:'Juegos'},
  {id:'peliculas',label:'Películas'},
];

export const sampleShirtColors = [
  {value:'#ffffff',label:'Blanco'},
  {value:'#202124',label:'Negro'},
  {value:'#e8e0cf',label:'Blanco vintage'},
  {value:'#8daec3',label:'Azul zen'},
];

export const normalizeSampleColor=value=>sampleShirtColors.some(color=>color.value===String(value).toLowerCase())
  ?String(value).toLowerCase()
  :'#ffffff';

export const catalogDesigns = [
  {id:'papa-leyenda',collection:'papa',name:'Modo leyenda',caption:'Para el papá que siempre está.',lines:['PAPÁ','MODO LEYENDA'],motif:'rays',accent:'#f957a4',surface:'pink'},
  {id:'papa-ruta',collection:'papa',name:'Nuestra ruta',caption:'Todas las aventuras empiezan juntos.',lines:['MI MEJOR','AVENTURA'],motif:'mountain',accent:'#6652c5',surface:'lilac'},
  {id:'mama-lugar',collection:'mama',name:'Mi lugar favorito',caption:'Un abrazo para llevar puesto.',lines:['MAMÁ','MI LUGAR FAVORITO'],motif:'flower',accent:'#f957a4',surface:'pink'},
  {id:'mama-universo',collection:'mama',name:'Mi universo',caption:'Para quien ilumina todo.',lines:['MAMÁ','MI UNIVERSO'],motif:'stars',accent:'#6652c5',surface:'lilac'},
  {id:'bebe-hola',collection:'bebe',name:'Hola, mundo',caption:'Una bienvenida llena de cariño.',lines:['HOLA','MUNDO'],motif:'moon',accent:'#6652c5',surface:'lilac'},
  {id:'bebe-amor',collection:'bebe',name:'Pequeño gran amor',caption:'Para celebrar a quien llegó a cambiarlo todo.',lines:['PEQUEÑO','GRAN AMOR'],motif:'cloud',accent:'#f957a4',surface:'pink'},
  {id:'juegos-player',collection:'juegos',name:'Player one',caption:'Para quien nunca suelta el control.',lines:['PLAYER','ONE'],motif:'controller',accent:'#6652c5',surface:'lilac'},
  {id:'juegos-pausa',collection:'juegos',name:'Pausa breve',caption:'Una partida más y vamos.',lines:['EN PAUSA','NUNCA'],motif:'pixels',accent:'#f957a4',surface:'lime'},
  {id:'peliculas-escena',collection:'peliculas',name:'Nuestra escena',caption:'Para historias que quieres repetir.',lines:['MI ESCENA','FAVORITA'],motif:'frame',accent:'#f957a4',surface:'pink'},
  {id:'peliculas-creditos',collection:'peliculas',name:'Aún no termina',caption:'Todavía quedan escenas por vivir.',lines:['CONTINUARÁ','...'],motif:'ticket',accent:'#6652c5',surface:'lilac'},
];

// Algunas piezas cuentan con una foto editorial además de su archivo de
// estampado. La foto se usa únicamente como portada del catálogo: el arte que
// llega al estudio sigue siendo `artworkPath`.
const featuredCatalogPhotos={
  'cliff-unger':'/death-stranding-main.webp',
  'guardiana-celestial':'/sailor-moon-guardiana.webp',
  'guerrera-del-fuego':'/sailor-moon-fire-main.webp',
  'meryl-cyberpunk':'/resident-evil-claire.webp',
  'jill-valentine-comisaria-racoon-city':'/resident-evil-jill.webp',
  'solid-snake-shadow-moses':'/metal-gear-solid-snake.webp',
};
const featuredCatalogHoverPhotos={
  'guardiana-celestial':'/sailor-moon-guerrera.webp',
  'guerrera-del-fuego':'/sailor-moon-fire-hover.webp',
  'cliff-unger':'/death-stranding-hover.webp',
  'meryl-cyberpunk':'/resident-evil-claire-hover.webp',
  'jill-valentine-comisaria-racoon-city':'/resident-evil-jill-hover.webp',
  'solid-snake-shadow-moses':'/metal-gear-solid-snake-hover.webp',
};

export function filterCatalog(collection='all',designs=catalogDesigns){
  const visible=designs.filter(design=>design.active!==false);
  return collection==='all'?visible:visible.filter(design=>design.collection===collection);
}

export function catalogFromRows(collectionRows=[],designRows=[]){
  const remoteCollections=collectionRows.map(collection=>({
    id:collection.slug,
    databaseId:collection.id,
    label:collection.name,
    active:collection.active,
    sortOrder:collection.sort_order,
  })).sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999)||a.label.localeCompare(b.label,'es'));
  const collectionIds=new Map(collectionRows.map(collection=>[collection.id,collection.slug]));
  const localDesigns=new Map(catalogDesigns.map(design=>[design.id,design]));
  const remoteDesigns=[...designRows].sort((a,b)=>{
    const newest=new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime();
    return Number.isFinite(newest)?newest:0;
  }).flatMap(row=>{
    const local=localDesigns.get(row.slug)||{};
    const collection=collectionIds.get(row.collection_id)||local.collection;
    if(!collection)return [];
    return [{
      ...local,
      id:row.slug,
      databaseId:row.id,
      collection,
      name:row.name,
      caption:row.caption||'',
      artworkPath:row.artwork_path,
      featuredPhoto:featuredCatalogPhotos[row.slug]||'',
      featuredPhotoHover:featuredCatalogHoverPhotos[row.slug]||'',
      active:row.active,
      surface:local.surface||'pink',
      sampleColor:normalizeSampleColor(row.sample_color||local.sampleColor),
    }];
  });
  return {
    collections:remoteCollections,
    designs:remoteDesigns,
  };
}

export async function loadCatalog(client){
  try{
    const [collectionResult,designResult]=await Promise.all([
      client.from('catalog_collections').select('id,slug,name,active,sort_order,catalog_product_types!inner(slug)').eq('active',true).eq('catalog_product_types.slug','poleras').order('sort_order').order('name'),
      // La pieza más reciente abre cada colección: además de respetar el orden
      // editorial, permite que la portada refleje la última polera publicada.
      client.from('catalog_designs').select('id,collection_id,slug,name,caption,artwork_path,sample_color,active,created_at').eq('active',true).order('created_at',{ascending:false}),
    ]);
    if(collectionResult.error)throw collectionResult.error;
    if(designResult.error)throw designResult.error;
    return {...catalogFromRows(collectionResult.data||[],designResult.data||[]),source:'remote'};
  }catch(error){
    return {collections:[...collections],designs:[...catalogDesigns],source:'fallback',error};
  }
}

export const designCountLabel=count=>`${count} ${count===1?'diseño':'diseños'}`;

const motifs={
  rays:`<circle cx="300" cy="275" r="88" fill="none" stroke="currentColor" stroke-width="14"/><path d="M300 115v42m0 236v42M140 275h42m236 0h42M187 162l30 30m166 166 30 30m0-226-30 30M217 358l-30 30" stroke="currentColor" stroke-width="14" stroke-linecap="round"/><path d="m259 276 27 27 57-62" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
  mountain:`<circle cx="425" cy="197" r="34" fill="none" stroke="currentColor" stroke-width="12"/><path d="m100 365 132-178 78 100 58-74 132 152H100Zm147-161 35 47 28-13" fill="none" stroke="currentColor" stroke-width="14" stroke-linejoin="round"/><path d="M135 397h330" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
  flower:`<circle cx="300" cy="275" r="43" fill="currentColor"/><ellipse cx="300" cy="180" rx="37" ry="66" fill="none" stroke="currentColor" stroke-width="12"/><ellipse cx="300" cy="370" rx="37" ry="66" fill="none" stroke="currentColor" stroke-width="12"/><ellipse cx="205" cy="275" rx="66" ry="37" fill="none" stroke="currentColor" stroke-width="12"/><ellipse cx="395" cy="275" rx="66" ry="37" fill="none" stroke="currentColor" stroke-width="12"/><path d="m155 130 22 22m248 248 22 22" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
  stars:`<path d="m300 128 28 104 104 28-104 28-28 104-28-104-104-28 104-28 28-104Zm-126 174 10 36 36 10-36 10-10 36-10-36-36-10 36-10 10-36Zm252-179 12 42 42 12-42 12-12 42-12-42-42-12 42-12 12-42Z" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/>`,
  moon:`<path d="M376 135a145 145 0 1 0 77 251c-123 4-188-125-77-251Z" fill="none" stroke="currentColor" stroke-width="14" stroke-linejoin="round"/><path d="m166 156 10 28 28 10-28 10-10 28-10-28-28-10 28-10 10-28Zm250 155 8 22 22 8-22 8-8 22-8-22-22-8 22-8 8-22Z" fill="none" stroke="currentColor" stroke-width="11" stroke-linejoin="round"/>`,
  cloud:`<path d="M176 356c-42 0-66-28-66-61 0-31 23-56 55-60 13-66 70-105 131-89 38-31 104-17 127 40 46 1 77 34 77 76 0 51-36 94-91 94H176Z" fill="none" stroke="currentColor" stroke-width="14" stroke-linejoin="round"/><path d="m275 249 25 21 25-21c31-26 67 12 40 42l-65 63-65-63c-27-30 9-68 40-42Z" fill="currentColor"/>`,
  controller:`<path d="M188 224h224c42 0 56 31 70 99 8 39-11 64-43 60-24-3-52-34-77-49H238c-25 15-53 46-77 49-32 4-51-21-43-60 14-68 28-99 70-99Z" fill="none" stroke="currentColor" stroke-width="14" stroke-linejoin="round"/><path d="M213 270v70m-35-35h70" stroke="currentColor" stroke-width="14" stroke-linecap="round"/><circle cx="373" cy="287" r="12" fill="currentColor"/><circle cx="416" cy="320" r="12" fill="currentColor"/>`,
  pixels:`<path d="M178 162h65v38h38v38h38v-38h38v-38h65v38h38v112h-38v38h-38v38h-38v38h-92v-38h-38v-38h-38v-38h-38V200h38v-38Z" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/><path d="M214 267h42m-21-21v42m122-17h15m31 30h15" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
  frame:`<rect x="133" y="171" width="334" height="220" rx="12" fill="none" stroke="currentColor" stroke-width="14"/><path d="M133 218h334M133 344h334M191 171v47m74-47v47m74-47v47m74-47v47m-222 126v47m74-47v47m74-47v47m74-47v47" stroke="currentColor" stroke-width="11"/><path d="m270 258 84 47-84 47v-94Z" fill="currentColor"/>`,
  ticket:`<path d="M144 189h312v60c-21 0-38 17-38 38s17 38 38 38v60H144v-60c21 0 38-17 38-38s-17-38-38-38v-60Z" fill="none" stroke="currentColor" stroke-width="14" stroke-linejoin="round"/><path d="M225 189v196" stroke="currentColor" stroke-width="11" stroke-dasharray="15 13"/><path d="m328 228 13 43 44 13-44 13-13 43-13-43-44-13 44-13 13-43Z" fill="currentColor"/>`,
};

export function artworkSvg(design){
  const [first,second]=design.lines;
  const secondSize=second.length>14?39:second.length>10?46:59;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" role="img" aria-label="Diseño ${design.name}"><g color="${design.accent}">${motifs[design.motif]}</g><text x="300" y="506" text-anchor="middle" fill="#262920" font-family="Arial,sans-serif" font-weight="900" font-size="72" letter-spacing="-3">${first}</text><text x="300" y="572" text-anchor="middle" fill="#262920" font-family="Arial,sans-serif" font-weight="900" font-size="${secondSize}" letter-spacing="-2">${second}</text><path d="M173 601h254" stroke="${design.accent}" stroke-width="12" stroke-linecap="round"/></svg>`;
}

export const artworkUrl=design=>design.artworkPath&&!design.artworkPath.startsWith('local:')
  ?design.artworkPath
  :`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artworkSvg(design))}`;
