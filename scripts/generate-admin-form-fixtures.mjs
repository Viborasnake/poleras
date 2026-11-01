import {productMockupFields} from '../src/admin-product-mockups.js';
import {PRODUCT_COLORS} from '../src/product-colors.js';
// Render the actual form templates with synthetic catalog data, without loading
// admin.js, authentication, storage or database clients in the evaluation page.
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const productTypes=[{id:1,slug:'poleras',name:'Poleras',active:true},{id:2,slug:'totebags',name:'Totebags',active:true},{id:3,slug:'bodys',name:'Bodys',active:true},{id:4,slug:'vasos-termicos',name:'Vasos térmicos',active:false}];
const safe=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const colorActions='<div class="admin-color-actions"><button type="button" class="admin-secondary admin-apply-global-colors" data-apply-global-colors>Aplicar configuración global</button><button type="button" class="admin-color-action" data-select-all-colors>Seleccionar todo</button><button type="button" class="admin-color-action" data-deselect-all-colors>Deseleccionar todo</button></div>';
const context={safe,productMockupFields,PRODUCT_COLORS,colorActions,adminData:{productTypes},options:'<option value="1">Colección de prueba</option>',productOptions:'<option value="1">Poleras</option><option value="2">Totebags</option>',categoryOptions:'<option value="1">Animales</option>',colorOptions:'<label class="admin-color-option"><input name="sample_color" type="radio" value="beige" required checked><span>Beige</span></label><label class="admin-color-option"><input name="sample_color" type="radio" value="black" required><span>Negro</span></label>',allowedColorOptions:'<label class="admin-color-option"><input name="allowed_colors" type="checkbox" value="beige"><span>Beige</span></label><label class="admin-color-option"><input name="allowed_colors" type="checkbox" value="black"><span>Negro</span></label>'};
const fixtures={};
for(const [kind,id] of [['product','product-form'],['collection','collection-form'],['design','design-form']]){
 const index=source.indexOf(`id="${id}"`),start=source.lastIndexOf('<form',index),end=source.indexOf('</form>',index)+7;
 if(index<0||start<0||end<7)throw new Error(`No se encontró ${id}`);
 fixtures[kind]=vm.runInNewContext('`'+source.slice(start,end)+'`',context);
}
// Evaluate only repository-owned, pure markup helpers with synthetic inputs.
const sandbox=vm.createContext({...context,orderCustomer:order=>order.shipping_address?.customer||{}});
for(const name of ['manualProductOptions','manualColorOptions']){const start=source.indexOf('const '+name+'='),end=source.indexOf(';',start)+1;vm.runInContext(source.slice(start,end),sandbox)}
for(const name of ['regionFilterHtml']){const start=source.indexOf('const '+name+'='),end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),sandbox)}
for(const name of ['manualItemMarkup','editOrderItemMarkup','manualOrderDialog','editOrderDialogMarkup']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),sandbox)}
sandbox.order={id:'DEMO-1',shipping_address:{fulfillment:'pickup',customer:{first_name:'Usuario QA',last_name:'Prueba',email:'qa@example.com',phone:'+56 9 0000 0000'},region:'Metropolitana de Santiago',commune:'Providencia',address:'Calle de Prueba 123'},order_items:[{id:'item-demo',name_snapshot:'Polera de prueba',quantity:1,unit_price_clp:15990,print_sides:'front'}]};
for(const [kind,expression] of [['manual','manualOrderDialog()'],['edit','editOrderDialogMarkup(order)']]){const html=vm.runInContext(expression,sandbox);fixtures[kind]=html.slice(html.indexOf('<form'),html.indexOf('</form>')+7)}
fixtures.manualItem=vm.runInContext('manualItemMarkup(99)',sandbox);fixtures.editItem=vm.runInContext('editOrderItemMarkup({},99)',sandbox);
await writeFile(new URL('../samples/admin-form-fixtures.js',import.meta.url),'// Generated from the actual admin form templates. Synthetic data only.\nexport const fixtures='+JSON.stringify(fixtures,null,2)+';\n');
console.log('Fixtures de producto, colección y diseño generados desde admin.js.');
