#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const required = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}.`);

const sharpRoot = process.env.SHARP_NODE_MODULES;
if (!sharpRoot) throw new Error('Set SHARP_NODE_MODULES to the temporary sharp node_modules directory.');
const sharp = createRequire(join(sharpRoot, 'package.json'))('sharp');
const accountId = process.env.R2_ACCOUNT_ID || 'b387a7db8cbfc230f0a9be0a73b83a7c';
const bucket = process.env.R2_BUCKET || 'droska-catalog';
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const publicOrigin = process.env.R2_PUBLIC_ORIGIN || 'https://images.frontbook.cl';
const sourceOrigin = process.env.SUPABASE_URL || 'https://dgndcklmmnnxyqfmnckh.supabase.co';
const sourceBucket = process.env.SUPABASE_BUCKET || 'catalog-designs';
const maxBytes = Number(process.env.CATALOG_MAX_BYTES || 900 * 1024);
const maxDimension = Number(process.env.CATALOG_MAX_DIMENSION || 2400);
const reportPath = process.env.OPTIMIZATION_REPORT || '/private/tmp/droska-catalog-optimization.json';
const sqlPath = process.env.OPTIMIZATION_SQL || '/private/tmp/droska-catalog-optimization.sql';
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encodePath = (name) => name.split('/').map(encodeURIComponent).join('/');
const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function awsDate() {
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
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
  const canonicalRequest = [method, parsed.pathname, canonicalQuery, canonicalHeaders, signedHeaderNames, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return { ...normalized, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}` };
}

async function fetchWithRetries(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await wait(attempt * 500);
  }
  throw lastError;
}

async function optimize(input) {
  let width = maxDimension;
  for (let pass = 0; pass < 5; pass += 1) {
    for (const quality of [90, 82, 74, 66]) {
      const output = await sharp(input, { animated: false, limitInputPixels: 64_000_000 })
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 5, smartSubsample: true })
        .toBuffer();
      if (output.length <= maxBytes) return output;
    }
    width = Math.round(width * 0.82);
  }
  throw new Error(`Could not optimize image below ${maxBytes} bytes.`);
}

function optimizedPath(path) {
  return `optimized/v1/${path.replace(/\.[^.]+$/, '')}.webp`;
}

async function putObject(path, body) {
  const url = `${endpoint}/${bucket}/${encodePath(path)}`;
  const headers = signedHeaders('PUT', url, {
    'content-type': 'image/webp',
    'cache-control': 'public, max-age=31536000, immutable',
    'x-amz-meta-source-size': String(body.sourceSize),
    'x-amz-meta-optimized-at': new Date().toISOString(),
  }, body.content);
  await fetchWithRetries(url, { method: 'PUT', headers, body: body.content }, `Upload ${path}`);
  const verify = await fetchWithRetries(url, { method: 'HEAD', headers: signedHeaders('HEAD', url, {}) }, `Verify ${path}`);
  const size = Number(verify.headers.get('content-length') || 0);
  if (size !== body.content.length || verify.headers.get('content-type') !== 'image/webp') throw new Error(`Verification mismatch for ${path}.`);
}

function buildSql(entries) {
  const urls = entries.map(({ sourcePath, targetPath }) => {
    const oldUrl = `${sourceOrigin}/storage/v1/object/public/${sourceBucket}/${encodePath(sourcePath)}`;
    const newUrl = `${publicOrigin}/${encodePath(targetPath)}`;
    return `(${sqlLiteral(oldUrl)}, ${sqlLiteral(newUrl)})`;
  }).join(',\n    ');
  return `begin;\n\nwith mapping(old_url, new_url) as (values\n    ${urls}\n), changed as (\n  update public.catalog_designs d\n  set\n    artwork_path = coalesce((select new_url from mapping where old_url = d.artwork_path), d.artwork_path),\n    mockup_path = coalesce((select new_url from mapping where old_url = d.mockup_path), d.mockup_path),\n    mockup_hover_path = coalesce((select new_url from mapping where old_url = d.mockup_hover_path), d.mockup_hover_path),\n    product_artworks = case\n      when d.product_artworks is null then null\n      else (\n        select jsonb_object_agg(entry.key, coalesce(mapping.new_url, entry.value))\n        from jsonb_each_text(d.product_artworks) as entry\n        left join mapping on mapping.old_url = entry.value\n      )\n    end\n  where d.artwork_path in (select old_url from mapping)\n     or d.mockup_path in (select old_url from mapping)\n     or d.mockup_hover_path in (select old_url from mapping)\n     or exists (select 1 from jsonb_each_text(coalesce(d.product_artworks, '{}'::jsonb)) entry join mapping on mapping.old_url = entry.value)\n  returning d.id\n)\nselect count(*) as updated_catalog_designs from changed;\n\ncommit;\n`;
}

const manifest = JSON.parse(await readFile(new URL('./catalog-designs-manifest.json', import.meta.url), 'utf8'));
const entries = [];
let sourceBytes = 0;
let optimizedBytes = 0;
for (let index = 0; index < manifest.length; index += 1) {
  const sourcePath = manifest[index].name;
  const sourceUrl = `${publicOrigin}/${encodePath(sourcePath)}`;
  const source = await fetchWithRetries(sourceUrl, {}, `Download ${sourcePath}`);
  const original = Buffer.from(await source.arrayBuffer());
  const content = await optimize(original);
  const targetPath = optimizedPath(sourcePath);
  await putObject(targetPath, { content, sourceSize: original.length });
  sourceBytes += original.length;
  optimizedBytes += content.length;
  entries.push({ sourcePath, targetPath, sourceBytes: original.length, optimizedBytes: content.length });
  console.log(`Optimized ${index + 1}/${manifest.length}: ${sourcePath} (${original.length} -> ${content.length} bytes)`);
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), sourceBytes, optimizedBytes, savedBytes: sourceBytes - optimizedBytes, entries }, null, 2));
await writeFile(sqlPath, buildSql(entries));
console.log(JSON.stringify({ files: entries.length, sourceBytes, optimizedBytes, savedBytes: sourceBytes - optimizedBytes, reportPath, sqlPath }));
