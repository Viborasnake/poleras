#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const required = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const sourceUrl = process.env.SUPABASE_URL ?? 'https://dgndcklmmnnxyqfmnckh.supabase.co';
const sourceBucket = process.env.SUPABASE_BUCKET ?? 'catalog-designs';
const destinationBucket = process.env.R2_BUCKET ?? 'droska-catalog';
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encodePath = (name) => name.split('/').map(encodeURIComponent).join('/');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function awsDate() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: stamp, dateStamp: stamp.slice(0, 8) };
}

function signedHeaders(method, url, headers, body = Buffer.alloc(0)) {
  const { amzDate, dateStamp } = awsDate();
  const payloadHash = sha256(body);
  const host = new URL(url).host;
  const normalized = {
    ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value).trim()])),
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const keys = Object.keys(normalized).sort();
  const canonicalHeaders = keys.map((key) => `${key}:${normalized[key]}\n`).join('');
  const signedHeaderNames = keys.join(';');
  const parsed = new URL(url);
  const canonicalQuery = [...parsed.searchParams.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalRequest = [
    method,
    parsed.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return {
    ...normalized,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  };
}

async function fetchWithRetries(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`${label}: HTTP ${response.status} ${await response.text()}`);
    } catch (error) {
      lastError = error;
    }
    await wait(600 * attempt);
  }
  throw lastError;
}

async function uploadOne(file) {
  const sourceObjectUrl = `${sourceUrl}/storage/v1/object/public/${sourceBucket}/${encodePath(file.name)}`;
  const source = await fetchWithRetries(sourceObjectUrl, {}, `Download ${file.name}`);
  const body = Buffer.from(await source.arrayBuffer());
  const contentType = file.metadata.mimetype || source.headers.get('content-type') || 'application/octet-stream';
  const cacheControl = file.metadata.cacheControl || source.headers.get('cache-control') || 'public, max-age=31536000, immutable';
  const destinationUrl = `${endpoint}/${destinationBucket}/${encodePath(file.name)}`;
  const headers = signedHeaders('PUT', destinationUrl, {
    'content-type': contentType,
    'cache-control': cacheControl,
    'x-amz-meta-source-size': String(body.length),
    'x-amz-meta-source-sha256': sha256(body),
  }, body);
  await fetchWithRetries(destinationUrl, { method: 'PUT', headers, body }, `Upload ${file.name}`);
  return body.length;
}

async function listDestination() {
  const url = `${endpoint}/${destinationBucket}?list-type=2`;
  const headers = signedHeaders('GET', url, {});
  const response = await fetchWithRetries(url, { headers }, 'Verify destination inventory');
  const xml = await response.text();
  const objects = [...xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)];
  return {
    count: objects.length,
    bytes: objects.reduce((sum, match) => sum + Number(match[2]), 0),
    keys: new Set(objects.map((match) => match[1])),
  };
}

const manifestUrl = new URL('./catalog-designs-manifest.json', import.meta.url);
const files = JSON.parse(await readFile(manifestUrl, 'utf8'));
const sourceBytes = files.reduce((sum, file) => sum + Number(file.metadata.size ?? file.metadata.contentLength ?? 0), 0);
console.log(`Found ${files.length} public catalog objects (${sourceBytes} bytes).`);

const beforeCopy = await listDestination();
const filesToCopy = files.filter((file) => !beforeCopy.keys.has(file.name));
let completed = files.length - filesToCopy.length;
let uploadedBytes = sourceBytes - filesToCopy.reduce((sum, file) => sum + Number(file.metadata.size ?? file.metadata.contentLength ?? 0), 0);
const concurrency = 3;
if (process.env.VERIFY_ONLY !== '1') {
  console.log(`R2 already contains ${completed}/${files.length} objects; copying ${filesToCopy.length} missing objects.`);
  for (let index = 0; index < filesToCopy.length; index += concurrency) {
    const batch = filesToCopy.slice(index, index + concurrency);
    const sizes = await Promise.all(batch.map(uploadOne));
    completed += batch.length;
    uploadedBytes += sizes.reduce((sum, size) => sum + size, 0);
    console.log(`Copied ${completed}/${files.length} objects (${uploadedBytes} bytes).`);
  }
}

const destination = await listDestination();
const expectedBytes = process.env.VERIFY_ONLY === '1' ? sourceBytes : uploadedBytes;
if (destination.count !== files.length || destination.bytes !== expectedBytes) {
  throw new Error(`Verification failed: expected ${files.length} objects/${expectedBytes} bytes; R2 lists ${destination.count} objects/${destination.bytes} bytes.`);
}
console.log(`Verified R2: ${destination.count} objects and ${destination.bytes} bytes.`);
