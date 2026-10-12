export const fallbackCatalogProducts=[
  {slug:'poleras',name:'Poleras',menu_description:'Diseños listos y personalizados',active:true,sort_order:10},
  {slug:'imanes',name:'Imanes',menu_description:'Para pegar tus mejores ideas',active:true,sort_order:20},
  {slug:'afiches',name:'Afiches',menu_description:'Arte para tus espacios',active:true,sort_order:30},
  {slug:'totebags',name:'Totebags',menu_description:'Tu idea para llevar',active:true,sort_order:40},
  {slug:'vasos-termicos',name:'Vasos térmicos',menu_description:'Para acompañarte todo el día',active:true,sort_order:50},
];

// El estudio y el checkout público actualmente venden poleras.
const purchasableSlugs=new Set(['poleras']);

export function storefrontProductItems(productTypes){
  return [...productTypes]
    .filter(product=>product.active!==false)
    .sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)||a.name.localeCompare(b.name,'es'))
    .map(product=>({
      slug:product.slug,
      name:product.name,
      description:product.menu_description||'',
      purchasable:purchasableSlugs.has(product.slug),
    }));
}
