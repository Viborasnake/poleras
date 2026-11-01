import {designProductArtworks} from './catalog-product-artworks.js';

const coordinate=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value))):50;
const normalize=entry=>({
 path:typeof entry?.path==='string'?entry.path:'',
 focusX:coordinate(entry?.focusX??50),focusY:coordinate(entry?.focusY??50),
 hoverPath:typeof entry?.hoverPath==='string'?entry.hoverPath:'',
 hoverFocusX:coordinate(entry?.hoverFocusX??50),hoverFocusY:coordinate(entry?.hoverFocusY??50),
});

// Historical upload order: first photo = shirt; second photo = tote bag.
// An explicit map is authoritative, including products without a photo yet.
export function designProductMockups(design={}){
 const map=design.productMockups??design.product_mockups;
 if(map&&typeof map==='object'&&!Array.isArray(map))return Object.fromEntries(Object.entries(map).map(([slug,entry])=>[slug,normalize(entry)]));
 const first=design.mockup_path||design.featuredPhoto||'',second=design.mockup_hover_path||design.featuredPhotoHover||'';
 const result={};
 if(first)result.poleras=normalize({path:first,focusX:design.mockup_focus_x??design.mockupFocus?.x,focusY:design.mockup_focus_y??design.mockupFocus?.y});
 if(second)result.totebags=normalize({path:second,focusX:design.mockup_hover_focus_x??design.mockupHoverFocus?.x,focusY:design.mockup_hover_focus_y??design.mockupHoverFocus?.y});
 return result;
}
export function designAppliesToProduct(design,slug){
 return slug==='all'||Boolean(designProductArtworks(design)[slug]);
}
export function catalogProductDesigns(designs,slug='all'){
 return designs.filter(design=>design.active!==false&&designAppliesToProduct(design,slug));
}
export function designWithProductMockup(design,slug='all',defaultSlug='poleras',activeProducts=null){
 const mockups=designProductMockups(design);
 const allowed=key=>!activeProducts||activeProducts.includes(key);
 const product=slug==='all'
  ? ['poleras',defaultSlug,...Object.keys(mockups),...Object.keys(designProductArtworks(design))].find(key=>allowed(key)&&designAppliesToProduct(design,key)&&mockups[key]?.path)
    ||[defaultSlug,...Object.keys(designProductArtworks(design)),...(activeProducts||[])].find(key=>allowed(key)&&designAppliesToProduct(design,key))||''
  :slug;
 const photo=mockups[product]||normalize({});
 return {...design,productMockups:mockups,previewProductSlug:product,
  artworkPath:designProductArtworks(design)[product]||design.artworkPath,
  featuredPhoto:photo.path,featuredPhotoHover:photo.hoverPath,
  mockupFocus:{x:photo.focusX,y:photo.focusY},mockupHoverFocus:{x:photo.hoverFocusX,y:photo.hoverFocusY},
 };
}
export function catalogProductOptions(products,designs){
 return products.filter(product=>product.active!==false&&designs.some(design=>design.active!==false&&designAppliesToProduct(design,product.slug)));
}
