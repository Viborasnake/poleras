import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {priceGuideMarkup,priceServicesMarkup,priceTableToolsMarkup} from '../src/admin-prices-panel.js';

// Run only the real price view with synthetic records and inert integrations.
// The browser fixture never imports authentication or a database client.
const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const categories=[{id:1,name:'Poleras'},{id:2,name:'Unisex',parent_category_id:1},{id:3,name:'Oversize',parent_category_id:1},{id:4,name:'Accesorios'},{id:5,name:'Totebags',parent_category_id:4}];
const products=[
 {id:1,name:'Polera básica · S',category_id:2,confirmed_price_clp:15990,personalization_base_price_clp:9990,base:4800},
 {id:2,name:'Polera básica · M',category_id:2,confirmed_price_clp:15990,base:4800},
 {id:3,name:'Polera básica · L',category_id:2,confirmed_price_clp:15990,base:4800},
 {id:4,name:'Polera oversize · M',category_id:3,base:6900},
 {id:5,name:'Polera oversize · L',category_id:3,confirmed_price_clp:19990,personalization_base_price_clp:14990,base:6900},
 {id:6,name:'Totebag · M',category_id:5,confirmed_price_clp:12990,base:3900},
].map(product=>({...product,kind:'garment',vat_percent:19}));
const variantFor=product=>[{id:`variant-${product.id}`,size:product.id===3?'L':'M',price_clp:product.confirmed_price_clp||0}];
let markup='';
const sandbox=vm.createContext({safe,priceGuideMarkup,priceServicesMarkup,priceTableToolsMarkup,
 adminData:{supplierProducts:products,supplierCategories:categories},
 supplierProductCalculation:product=>({base:product.base,suggested:Math.ceil(product.base*2.4/10)*10}),
 supplierProductVariants:variantFor,priceCreatesVariants:()=>true,
 supplierProductDisplayName:product=>product.name,
 supplierProductTypeLabel:product=>categories.find(category=>category.id===product.category_id).name,
 variantSummary:variants=>`${variants.length} variante · tallas S, M, L`,
 minimumPriceWithVat:(base,vat)=>Math.ceil(base*(1+vat/100)),
 money:value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value),
 shell:content=>{markup=content},root:{querySelectorAll:()=>[],querySelector:()=>({remove(){}})},
 wireReviewPrice(){},wirePrintPrices(){},wirePriceTable(){},
});
for(const name of ['pageHeading','priceMetrics','priceWorkflowState','pricesView']){
 const start=source.indexOf(`function ${name}(`),next=source.indexOf('\nfunction ',start+1);
 vm.runInContext(source.slice(start,next<0?undefined:next),sandbox);
}
vm.runInContext('pricesView()',sandbox);
await writeFile(new URL('../samples/price-fixture.js',import.meta.url),`// Generated from pricesView in admin.js. Synthetic data only.\nexport const markup=${JSON.stringify(markup)};\nexport const prepared=${JSON.stringify(products.map(product=>({product})))};\nexport const children=${JSON.stringify(categories.filter(category=>category.parent_category_id))};\n`);
console.log('Vista real de precios generada con seis productos ficticios.');
