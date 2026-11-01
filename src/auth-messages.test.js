import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage } from './auth-messages.js';

test('traduce errores de redirección de confirmación', () => {
  assert.equal(
    authErrorMessage({ message: 'Invalid email_redirect_to: URL is not allowed' }),
    'La dirección de confirmación no está habilitada todavía. Avísanos para revisar la configuración de la cuenta.'
  );
});

test('traduce fallos del trigger que crea el perfil', () => {
  assert.equal(
    authErrorMessage({ message: 'Database error saving new user' }),
    'No pudimos crear tu perfil en este momento. Intenta nuevamente más tarde.'
  );
});

test('mantiene el mensaje específico para correo ya registrado', () => {
  assert.equal(
    authErrorMessage({ message: 'User already registered' }),
    'Ya existe una cuenta con este correo. Intenta iniciar sesión.'
  );
});

test('traduce la configuración que impide iniciar una solicitud como invitado', () => {
  assert.equal(
    authErrorMessage({ message: 'Anonymous sign-ins are disabled' }),
    'El envío de ideas no está disponible en este momento. Escríbenos por WhatsApp para continuar.'
  );
});

test('orienta al visitante cuando no puede comenzar el checkout como invitado', () => {
  assert.equal(
    authErrorMessage('No pudimos iniciar la compra como invitado. Intenta nuevamente.'),
    'La compra como invitado no está disponible ahora. Crea una cuenta o inicia sesión para continuar.'
  );
});

test('explica cómo recuperar un enlace de confirmación vencido', () => {
  assert.equal(
    authErrorMessage({ message: 'Email link is invalid or has expired (otp_expired)' }),
    'El enlace de confirmación venció. Solicita uno nuevo para activar tu cuenta.'
  );
});
