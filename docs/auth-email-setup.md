# Correos de autenticación

Droska usa Supabase Auth para registrar cuentas, confirmar correos y recuperar contraseñas. El envío predeterminado de Supabase sirve para pruebas, pero está limitado y no está pensado para producción. Para enviar a clientes reales se debe configurar un SMTP propio. [Documentación de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Proveedor recomendado

Usaremos Resend, igual que para los correos de estado de pedidos. Su plan gratuito es suficiente para el prototipo y permite usar un dominio verificado. Los límites y condiciones pueden cambiar; revisa el [plan actual de Resend](https://resend.com/pricing).

## Configuración única

1. En Resend, crea una API key y verifica un dominio de envío. Usa un remitente separado para autenticación, por ejemplo `no-reply@auth.tudominio.cl`.
2. En Supabase abre `Authentication → SMTP Settings` y activa el SMTP personalizado.
3. Completa estos valores:

   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: la API key de Resend
   - Sender email: el remitente del dominio verificado
   - Sender name: `Droska`

   Resend documenta estos valores en su [configuración SMTP](https://resend.com/changelog/smtp-service).
4. En `Authentication → URL Configuration`, confirma el Site URL de producción y agrega la URL local y la URL pública en Redirect URLs. La app ya envía `emailRedirectTo` usando `VITE_SITE_URL` cuando está configurada.
5. En `Authentication → Email Templates → Confirm signup`, pega el contenido de [`supabase/email-templates/confirm-signup.html`](../supabase/email-templates/confirm-signup.html).
6. Prueba un registro, confirma el correo y luego prueba `Reenviar enlace`. No uses tracking de enlaces en Resend para estos mensajes, porque puede modificar el enlace de confirmación.

La API key no debe ir en el frontend, en `.env` con prefijo `VITE_`, ni en el repositorio. Supabase la guarda en la configuración SMTP; los correos de pedidos siguen usando los secretos de Edge Functions documentados en el README.

