import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the production templates with different drafts and purchase channels.
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8');
function fixture(overrides={}){
 const config={placement:'center',offsetX:0,offsetY:0};
 const state={kind:'basic',printSides:[],additionalPrints:[],printConfigurations:{front:{...config},back:{...config}},files:{},images:{},assessments:{},...overrides};
 const context=vm.createContext({state,sideNames:{front:'Frente',back:'Espalda'},PRINT_PRICES:{front_large_clp:5990,back_large_clp:5990,arm_clp:2990,front_pocket_clp:2990},PRINT_MAX_LAYERS:4,PRINT_PLACEMENT_LABEL:{sleeve_both:'Ambos brazos',chest_right:'Bolsillo derecho'},money:value=>String(value),escapeText:value=>String(value??''),movementDescription:()=> 'Sin desplazamiento',includedSides:()=>state.printSides,printCount:()=>state.printSides.length+state.additionalPrints.length,currentPurchaseMethod:()=>overrides.channel||'web'});
 vm.runInContext(source.slice(source.indexOf('function printLayerSettingsHtml'),source.indexOf('function fulfillmentPickerHtml')),context);
 return {state,html:()=>vm.runInContext('printSidesHtml()',context)};
}
test('starts with four optional locations and no upload',()=>{
 const html=fixture().html();assert.equal((html.match(/class="add-print-layer"/g)||[]).length,4);assert.doesNotMatch(html,/type="file"/);
});
test('adding front replaces its action with one upload inside its accordion',()=>{
 const html=fixture({printSides:['front']}).html();assert.equal((html.match(/data-file-side="front"/g)||[]).length,1);assert.doesNotMatch(html,/data-add-primary-print="front"/);assert.match(html,/<details[^>]*data-print-layer-panel="primary-front"/);assert.match(html,/Falta adjuntar imagen/);
});
test('both arms work without front and show twice the unit price',()=>{
 const html=fixture({additionalPrints:[{id:'arm',side:'front',configuration:{placement:'sleeve_both'},image:'',fileName:''}]}).html();assert.match(html,/<strong>\+5980<\/strong>/);assert.match(html,/data-extra-file="arm"/);assert.doesNotMatch(html,/data-file-side=/);assert.match(html,/aria-pressed="true"><strong>Ambos/);
});
test('WhatsApp and catalog locations do not ask for duplicate uploads',()=>{
 assert.doesNotMatch(fixture({printSides:['front'],channel:'whatsapp'}).html(),/type="file"/);
 assert.match(fixture({printSides:['front'],channel:'whatsapp'}).html(),/chat de WhatsApp/);
 assert.doesNotMatch(fixture({printSides:['front'],catalogDesign:true}).html(),/type="file"/);
});
test('tote keeps its single upload and processing replaces the file input',()=>{
 assert.equal((fixture({kind:'tote',printSides:['front']}).html().match(/type="file"/g)||[]).length,1);
 const html=fixture({printSides:['front'],checking:true,checkingSide:'front'}).html();assert.match(html,/role="status" aria-live="polite"/);assert.match(html,/Optimizando tu archivo/);assert.doesNotMatch(html,/type="file"/);
});
