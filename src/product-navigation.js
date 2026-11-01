export const fallbackCatalogProducts=[
  {slug:'poleras',name:'Poleras',menu_description:'Diseños listos y personalizados',active:true,sort_order:10},
  {slug:'imanes',name:'Imanes',menu_description:'Para pegar tus mejores ideas',active:true,sort_order:20},
  {slug:'afiches',name:'Afiches',menu_description:'Arte para tus espacios',active:true,sort_order:30},
  {slug:'totebags',name:'Totebags',menu_description:'Tu idea para llevar',active:true,sort_order:40},
  {slug:'vasos-termicos',name:'Vasos térmicos',menu_description:'Para acompañarte todo el día',active:true,sort_order:50},
];

// Poleras y tote bags comparten el catálogo de diseños y el checkout.
// Los demás productos se habilitan para exploración al publicar un diseño.
const purchasableSlugs=new Set(['poleras','totebags','bodys']);

export function storefrontProductItems(productTypes,publishedProductSlugs=new Set()){
  return [...productTypes]
    .filter(product=>product.active!==false)
    .sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)||a.name.localeCompare(b.name,'es'))
    .map(product=>({
      slug:product.slug,
      name:product.name,
      description:product.menu_description||'',
      purchasable:purchasableSlugs.has(product.slug),
      explorable:purchasableSlugs.has(product.slug)||publishedProductSlugs.has(product.slug),
    }));
}
