import test from 'node:test';
import assert from 'node:assert/strict';
import {accountFromUser,accountNavigationState} from './account-navigation.js';

test('la navegación invita a crear cuenta cuando no hay sesión',()=>{
  assert.deepEqual(accountNavigationState(null),{
    authenticated:false,
    label:'Crear cuenta o iniciar sesión',
    ariaLabel:'Crear cuenta o iniciar sesión',
  });
});

test('la navegación muestra el nombre de pila completo de la sesión',()=>{
  const account=accountFromUser({
    id:'user-1',
    email:'cristian@example.cl',
    user_metadata:{full_name:'Cristian Pizarro'},
  });
  assert.equal(account.givenName,'Cristian');
  assert.equal(accountNavigationState(account).label,'Cristian');
});

test('conserva un nombre de pila compuesto cuando Auth lo entrega',()=>{
  const account=accountFromUser({
    id:'user-2',
    email:'maria@example.cl',
    user_metadata:{full_name:'María José Soto',given_name:'María José'},
  });
  assert.equal(accountNavigationState(account).label,'María José');
});
