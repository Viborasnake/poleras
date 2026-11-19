import '../src/design-system.css';
import '../src/admin.css';
import '../src/admin-dark.css';
import {renderInventory} from '../src/admin-inventory.js';
const root=document.querySelector('#fixture');
let saved=JSON.stringify([{id:'sample-a',name:'Polera básica',brand:'Gildan',color:'Negro',size:'M',price:4500,quantity:12,date:'2026-01-01',location:'Estante A · Caja 2',notes:'Algodón. Lote para estampado.',updated_at:''},{id:'sample-b',name:'Polera oversize',brand:'Otra marca',color:'Blanco',size:'L',price:6000,quantity:0,date:'2026-02-01',location:'Estante B',notes:'Pendiente de reposición.',updated_at:''}]);
const context={root,products:[{id:'p-shirts',slug:'poleras',name:'Poleras',active:true},{id:'p-totes',slug:'totebags',name:'Totebags',active:true},{id:'p-magnets',slug:'imanes',name:'Imanes',active:true},{id:'p-custom',slug:'tazones',name:'Tazones de prueba',active:false}],storage:{getItem:()=>saved,setItem:(_,value)=>{saved=value}},shell:content=>{
 root.innerHTML=`<header class="admin-topbar"><div><strong>REVISIÓN LOCAL · DATOS FICTICIOS</strong><p>Los registros de esta muestra se mantienen en memoria.</p></div><button id="theme" class="admin-secondary">Cambiar tema</button></header><main class="admin-main"><label class="admin-search">Buscar en inventario<input id="admin-search-input" type="search"></label><output id="admin-search-count"></output>${content}</main><p id="outcome" role="status"></p>`;
 root.querySelector('#theme').onclick=()=>document.documentElement.classList.toggle('admin-theme-dark');
},toast:message=>{root.querySelector('#outcome').textContent=message}};
const fixture=JSON.parse(saved);fixture[0].model_code='basic';fixture[1].model_code='over';fixture.push({...fixture[0],id:'sample-legacy',model_code:'',name:'Dogo Premium',quantity:3});saved=JSON.stringify(fixture);
renderInventory(context);
