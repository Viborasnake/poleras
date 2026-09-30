export function authErrorMessage(error) {
  const message = String(error?.message || error || '').toLowerCase();

  if (message.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (message.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.';
  if (message.includes('otp_expired') || message.includes('email link is invalid or has expired') || message.includes('link is invalid or has expired')) {
    return 'El enlace de confirmación venció. Solicita uno nuevo para activar tu cuenta.';
  }
  if (message.includes('user already registered')) return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
  if (message.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (message.includes('rate limit')) return 'Hiciste demasiados intentos. Espera un momento y vuelve a probar.';
  if (message.includes('redirect') && (message.includes('not allowed') || message.includes('invalid'))) {
    return 'La dirección de confirmación no está habilitada todavía. Avísanos para revisar la configuración de la cuenta.';
  }
  if (message.includes('database error saving new user') || message.includes('error creating new user')) {
    return 'No pudimos crear tu perfil en este momento. Intenta nuevamente más tarde.';
  }

  return 'No pudimos completar esta acción. Revisa tus datos e inténtalo nuevamente.';
}
