export const PRODUCT_COLOR_GROUPS=[
 {id:'neutral',label:'Neutros'},
 {id:'blue',label:'Azules'},
 {id:'green',label:'Verdes'},
 {id:'purple',label:'Morados'},
 {id:'red',label:'Rojos'},
 {id:'warm',label:'Amarillos y naranjas'},
 {id:'brown',label:'Cafés'},
];

export const PRODUCT_COLORS=[
 {code:'white',name:'Blanco',hex:'#ffffff',group:'neutral',shade:'Claro'},
 {code:'natural',name:'Natural',hex:'#e8e0cf',group:'neutral',shade:'Claro'},
 {code:'gray',name:'Gris',hex:'#85878a',group:'neutral',shade:'Normal'},
 {code:'black',name:'Negro',hex:'#202124',group:'neutral',shade:'Oscuro'},
 {code:'sky',name:'Celeste',hex:'#9bd7f0',group:'blue',shade:'Claro'},
 {code:'royal_blue',name:'Azul rey',hex:'#2b50a2',group:'blue',shade:'Normal'},
 {code:'navy',name:'Azul marino',hex:'#1d3557',group:'blue',shade:'Oscuro'},
 {code:'dark_blue',name:'Azul oscuro',hex:'#17243d',group:'blue',shade:'Oscuro'},
 {code:'mint',name:'Verde menta',hex:'#b7e4c7',group:'green',shade:'Claro'},
 {code:'green',name:'Verde',hex:'#3f8f5f',group:'green',shade:'Normal'},
 {code:'bottle_green',name:'Verde botella',hex:'#1f5132',group:'green',shade:'Oscuro'},
 {code:'olive',name:'Verde olivo',hex:'#707a3c',group:'green',shade:'Normal'},
 {code:'military',name:'Verde militar',hex:'#4b5320',group:'green',shade:'Oscuro'},
 {code:'dark_green',name:'Verde oscuro',hex:'#24452f',group:'green',shade:'Oscuro'},
 {code:'lavender',name:'Lavanda',hex:'#c8b6e2',group:'purple',shade:'Claro'},
 {code:'purple',name:'Morado',hex:'#7046a3',group:'purple',shade:'Normal'},
 {code:'dark_purple',name:'Morado oscuro',hex:'#3f275a',group:'purple',shade:'Oscuro'},
 {code:'pink',name:'Rosado',hex:'#e89ab7',group:'red',shade:'Claro'},
 {code:'red',name:'Rojo',hex:'#c73532',group:'red',shade:'Normal'},
 {code:'dark_red',name:'Rojo oscuro',hex:'#7e2728',group:'red',shade:'Oscuro'},
 {code:'yellow',name:'Amarillo',hex:'#f4d35e',group:'warm',shade:'Claro'},
 {code:'mustard',name:'Mostaza',hex:'#c79a2b',group:'warm',shade:'Normal'},
 {code:'orange',name:'Naranjo',hex:'#d86b2a',group:'warm',shade:'Oscuro'},
 {code:'beige',name:'Beige',hex:'#d9c7a4',group:'brown',shade:'Claro'},
 {code:'coffee',name:'Café',hex:'#755139',group:'brown',shade:'Normal'},
 {code:'dark_coffee',name:'Café oscuro',hex:'#4a2c25',group:'brown',shade:'Oscuro'},
];

export const COLOR_PRODUCT_FAMILIES=[
 {slug:'poleras',name:'Poleras',modelCodes:['basic','woman','over','kid']},
 {slug:'bodys',name:'Bodys',modelCodes:['body']},
 {slug:'totebags',name:'Totebags',modelCodes:['tote']},
];

export const DEFAULT_PRODUCT_COLOR_CODES={
 poleras:['white','black','beige','dark_blue','dark_green','dark_coffee','red'],
 bodys:['white','black','dark_blue','dark_coffee','red'],
 totebags:['beige'],
};

const colorByHex=new Map(PRODUCT_COLORS.map(color=>[color.hex,color]));

export function productColorGroups(colors=PRODUCT_COLORS){
 return PRODUCT_COLOR_GROUPS.map(group=>({...group,colors:colors.filter(color=>color.group===group.id)})).filter(group=>group.colors.length);
}

export function activeProductColorCodes(variants=[],productSlug){
 const family=COLOR_PRODUCT_FAMILIES.find(item=>item.slug===productSlug);
 if(!family)return [];
 const activeHexes=new Set(variants.flatMap(variant=>{
  const model=Array.isArray(variant.product_models)?variant.product_models[0]:variant.product_models;
  const hex=String(variant.color_hex||'').toLowerCase();
  return variant.active!==false&&model?.active!==false&&family.modelCodes.includes(model?.code)&&colorByHex.has(hex)?[hex]:[];
 }));
 return PRODUCT_COLORS.filter(color=>activeHexes.has(color.hex)).map(color=>color.code);
}

export function activeProductColorHexes(variants=[],productSlugs=[]){
 const slugs=Array.isArray(productSlugs)?productSlugs:[productSlugs];
 const activeCodes=new Set(slugs.flatMap(slug=>activeProductColorCodes(variants,slug)));
 return PRODUCT_COLORS.filter(color=>activeCodes.has(color.code)).map(color=>color.hex);
}

export function productColorAvailability(variants=[],productSlug){
 const active=new Set(activeProductColorCodes(variants,productSlug));
 return PRODUCT_COLORS.filter(color=>active.has(color.code));
}

export function invalidDesignProductColors(variants=[],allowedProductColors={},productSlugs=[]){
 return productSlugs.flatMap(slug=>{
  const available=new Set(productColorAvailability(variants,slug).map(color=>color.hex));
  const selected=Array.isArray(allowedProductColors?.[slug])?allowedProductColors[slug]:[];
  return !available.size||!selected.some(color=>available.has(String(color).toLowerCase()))?[slug]:[];
 });
}

// Totebags use their own commercial palette in variant selection. Poleras and
// bodys, however, must keep at least one published color in common with the
// explicit color list of an active catalog design.
const DESIGN_COLOR_RESTRICTED_PRODUCTS=new Set(['poleras','bodys']);
export function incompatibleDesignColorProducts(variants=[],productSlugs=[],allowedColors=null){
 if(!Array.isArray(allowedColors))return [];
 const allowed=new Set(allowedColors.map(color=>String(color).toLowerCase()).filter(color=>/^#[0-9a-f]{6}$/.test(color)));
 const slugs=[...new Set(Array.isArray(productSlugs)?productSlugs:[productSlugs])];
 return slugs.filter(slug=>DESIGN_COLOR_RESTRICTED_PRODUCTS.has(slug)&&!activeProductColorHexes(variants,slug).some(color=>allowed.has(color)));
}
