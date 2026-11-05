type VerificationResponse = { success?: boolean; hostname?: string }

export async function verifyTurnstile(token: unknown): Promise<boolean> {
 const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
 if (!secret || typeof token !== 'string' || token.length < 10 || token.length > 2048) return false
 const payload = new URLSearchParams({ secret, response: token })
 try {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
   method: 'POST', body: payload, signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return false
  const result = await response.json() as VerificationResponse
  const allowedHostname = new URL(Deno.env.get('SITE_URL') || 'https://droska.frontbook.cl').hostname
  return result.success === true && result.hostname === allowedHostname
 } catch { return false }
}
