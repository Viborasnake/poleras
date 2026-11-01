import test from 'node:test';
import assert from 'node:assert/strict';
import {stableRequestId} from './request-attempt.js';

function memoryStorage(){
 const values=new Map();
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}

test('reutiliza el identificador de una solicitud equivalente',()=>{
 const storage=memoryStorage();let sequence=0;
 const first=stableRequestId(storage,'wa','same',()=>`id-${++sequence}`,100);
 const retry=stableRequestId(storage,'wa','same',()=>`id-${++sequence}`,200);
 assert.equal(first,'id-1');
 assert.equal(retry,'id-1');
});

test('crea otro identificador cuando cambia la solicitud',()=>{
 const storage=memoryStorage();let sequence=0;
 stableRequestId(storage,'wa','first',()=>`id-${++sequence}`,100);
 assert.equal(stableRequestId(storage,'wa','second',()=>`id-${++sequence}`,200),'id-2');
});
