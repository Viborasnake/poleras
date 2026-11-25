import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogPoleraComposition,catalogChargeablePrints,catalogOrderConfiguration,normalizePoleraPrints} from '../supabase/functions/_shared/catalog-polera-prints.js';
import {printPrice} from '../supabase/functions/_shared/print-pricing.js';
import {cartPriceBreakdown} from './cart-pricing.js';
import {orderPrintPlan} from './admin-order-print-plan.js';

const design={product_artworks:{poleras:'primary.webp',totebags:'tote.webp'}};
const rates={front_large_clp:5500,front_pocket_clp:2300,back_large_clp:4600,arm_clp:1800};

test('un diseño anterior conserva su frente incluido y la tote usa su propio archivo',()=>{
 const composition=catalogPoleraComposition(design,'basic');
 assert.equal(composition.printSides,'front');
 assert.equal(composition.configuration.prints[0].catalogArtworkPath,'primary.webp');
 assert.equal(printPrice(catalogChargeablePrints(composition.configuration),'front',rates),0);
 assert.equal(catalogPoleraComposition(design,'tote'),null);
});

test('el carro y la planimetría conservan todas las ubicaciones y archivos publicados',()=>{
 const composition=catalogPoleraComposition({...design,polera_prints:{primary:'back',additional:{
  front:'front.webp','pocket-left':'left.webp','pocket-right':'right.webp','arm-left':'sleeve-l.webp','arm-right':'sleeve-r.webp',
 }}},'over');
 assert.equal(composition.printSides,'both');
 assert.equal(composition.configuration.prints.length,6);
 const result=cartPriceBreakdown({catalogDesignSlug:'prueba',modelCode:'over',price:15000,quantity:2},15000,0,rates,composition);
 assert.equal(result.print,5500+2300*2+1800*2);
 assert.equal(result.line,2*(15000+result.print));
 const snapshot=catalogOrderConfiguration(composition,false);
 const plan=orderPrintPlan({print_sides:'both',print_configuration:snapshot});
 assert.deepEqual(plan.map(print=>[print.label,print.catalogPath]),[
  ['Espalda completa','primary.webp'],['Frente completo','front.webp'],['Bolsillo izquierdo','left.webp'],
  ['Bolsillo derecho','right.webp'],['Brazo izquierdo','sleeve-l.webp'],['Brazo derecho','sleeve-r.webp'],
 ]);
 assert.equal(catalogOrderConfiguration(composition,true).prints[0].catalogArtworkPath,undefined);
 assert.equal(catalogOrderConfiguration(composition,true).prints[1].catalogArtworkPath,'front.webp');
});

test('ambos brazos usan un archivo en dos marcas y una tarifa por cada aplicación',()=>{
 const composition=catalogPoleraComposition({...design,polera_prints:{primary:'pocket-right',additional:{arms:'sleeves.webp'}}},'woman');
 assert.equal(printPrice(catalogChargeablePrints(composition.configuration),'front',rates),3600);
 const [,sleeves]=orderPrintPlan({print_sides:'front',print_configuration:composition.configuration});
 assert.equal(sleeves.markers.length,2);
 assert.equal(sleeves.catalogPath,'sleeves.webp');
 const primary=catalogPoleraComposition({...design,polera_prints:{primary:'arms'}},'woman');
 assert.equal(printPrice(catalogChargeablePrints(primary.configuration),'front',rates),1800);
});

test('las fotos de detalle se limitan a las ubicaciones activas',()=>{
 assert.deepEqual(normalizePoleraPrints({primary:'arm-left',additional:{arms:'duplicate.webp',back:'back.webp'},mockups:{
  back:'back-photo.webp',arms:'duplicate-photo.webp','arm-left':'sleeve-photo.webp',
 }}),{primary:'arm-left',additional:{back:'back.webp'},mockups:{'arm-left':'sleeve-photo.webp',back:'back-photo.webp'}});
});
