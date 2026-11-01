import test from 'node:test';
import assert from 'node:assert/strict';
import {mercadoPaymentStatus} from '../supabase/functions/_shared/mercado-payment-status.js';

test('normaliza estados de cobro y reversa de Mercado Pago',()=>{
 assert.equal(mercadoPaymentStatus({status:'approved',transaction_amount:10000}),'approved');
 assert.equal(mercadoPaymentStatus({status:'approved',transaction_amount:10000,transaction_amount_refunded:3000}),'partially_refunded');
 assert.equal(mercadoPaymentStatus({status:'refunded',transaction_amount:10000,transaction_amount_refunded:10000}),'refunded');
 assert.equal(mercadoPaymentStatus({status:'charged_back'}),'charged_back');
 assert.equal(mercadoPaymentStatus({status:'in_mediation'}),'in_mediation');
});
