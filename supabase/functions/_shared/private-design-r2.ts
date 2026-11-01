const encoder = new TextEncoder()
const accountId = 'b387a7db8cbfc230f0a9be0a73b83a7c'
const host = `${accountId}.r2.cloudflarestorage.com`

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('')
const sha256 = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
const hmac = async (key: ArrayBuffer | string, value: string) => {
  const cryptoKey = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))
}
const encodeKey = (path: string) => path.split('/').map(encodeURIComponent).join('/')
const awsEncode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
const bucket = () => {
  const value = Deno.env.get('PRIVATE_R2_BUCKET')
  if (!value || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value)) throw new Error('El bucket privado de Cloudflare no está configurado.')
  return value
}
const credentials = () => {
  const accessKeyId = Deno.env.get('PRIVATE_R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('PRIVATE_R2_SECRET_ACCESS_KEY')
  if (!accessKeyId || !secretAccessKey) throw new Error('Faltan las credenciales privadas de Cloudflare R2.')
  return { accessKeyId, secretAccessKey }
}

export const isPrivateDesignPath = (path: string, ownerId?: string) => {
  const match = /^([0-9a-f-]{36})\/(front|back|reference)\/([0-9a-f-]{36})\.(png|jpg|webp)$/i.exec(path)
  return Boolean(match && (!ownerId || match[1].toLowerCase() === ownerId.toLowerCase()))
}

async function signingKey(secret: string, date: string) {
  const dateKey = await hmac(`AWS4${secret}`, date)
  const regionKey = await hmac(dateKey, 'auto')
  const serviceKey = await hmac(regionKey, 's3')
  return hmac(serviceKey, 'aws4_request')
}

function timestamp() {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

export async function presignPrivateDesign(method: 'GET' | 'PUT', path: string, options: { contentType?: string, expiresIn?: number } = {}) {
  if (!isPrivateDesignPath(path)) throw new Error('La ruta privada no es válida.')
  const { accessKeyId, secretAccessKey } = credentials(), { amzDate, dateStamp } = timestamp()
  const expiresIn = Math.max(10, Math.min(options.expiresIn || 60, 7 * 24 * 60 * 60))
  const signedHeaders = options.contentType ? 'content-type;host' : 'host'
  const scope = `${dateStamp}/auto/s3/aws4_request`
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  }
  const canonicalQuery = Object.entries(query).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`).join('&')
  const canonicalHeaders = `${options.contentType ? `content-type:${options.contentType}\n` : ''}host:${host}\n`
  const canonicalRequest = `${method}\n/${bucket()}/${encodeKey(path)}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(canonicalRequest)}`
  const signature = hex(await hmac(await signingKey(secretAccessKey, dateStamp), stringToSign))
  return `https://${host}/${bucket()}/${encodeKey(path)}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

async function signedRequest(method: string, path = '', query = '') {
  const { accessKeyId, secretAccessKey } = credentials(), { amzDate, dateStamp } = timestamp()
  const scope = `${dateStamp}/auto/s3/aws4_request`, canonicalUri = `/${bucket()}${path ? `/${encodeKey(path)}` : ''}`
  const headers = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`, signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = `${method}\n${canonicalUri}\n${query}\n${headers}\n${signedHeaders}\nUNSIGNED-PAYLOAD`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(canonicalRequest)}`
  const signature = hex(await hmac(await signingKey(secretAccessKey, dateStamp), stringToSign))
  return fetch(`https://${host}${canonicalUri}${query ? `?${query}` : ''}`, { method, headers: { Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', 'x-amz-date': amzDate } })
}

export async function headPrivateDesign(path: string) {
  if (!isPrivateDesignPath(path)) return null
  const response = await signedRequest('HEAD', path)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Cloudflare R2 no pudo verificar el archivo (${response.status}).`)
  return { size: Number(response.headers.get('content-length') || 0), contentType: response.headers.get('content-type') || '' }
}

const decodeXml = (value: string) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
export async function listPrivateDesigns(prefix: string) {
  const query = `list-type=2&prefix=${awsEncode(prefix)}`
  const response = await signedRequest('GET', '', query)
  if (!response.ok) throw new Error(`Cloudflare R2 no pudo listar los archivos (${response.status}).`)
  const xml = await response.text(), objects: Array<{ path: string, updatedAt: string }> = []
  for (const match of xml.matchAll(/<Contents>\s*<Key>([^<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>[\s\S]*?<\/Contents>/g)) {
    const path = decodeXml(match[1])
    if (isPrivateDesignPath(path) && path.startsWith(prefix)) objects.push({ path, updatedAt: match[2] })
  }
  return objects
}

export async function deletePrivateDesigns(paths: string[]) {
  for (const path of [...new Set(paths)]) {
    if (!isPrivateDesignPath(path)) throw new Error('La ruta privada no es válida.')
    const response = await signedRequest('DELETE', path)
    if (!response.ok && response.status !== 404) throw new Error(`Cloudflare R2 no pudo eliminar el archivo (${response.status}).`)
  }
}
