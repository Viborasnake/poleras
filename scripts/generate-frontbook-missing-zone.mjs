import fs from 'node:fs';

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error('Usage: node scripts/generate-frontbook-missing-zone.mjs <cpanel-export.txt>');
}

const source = fs.readFileSync(sourcePath, 'utf8');
const recordStart = /(^[^\n\t]+\t(\d+)\t(A|CNAME|MX|SRV|TXT)\t\n)/gm;
const starts = [...source.matchAll(recordStart)];
const records = starts.map((match, index) => {
  const end = starts[index + 1]?.index ?? source.length;
  const name = match[0].split('\t')[0].trim();
  const body = source.slice((match.index ?? 0) + match[0].length, end).trim();
  return { name, ttl: match[2], type: match[3], body };
});

records.push(
  {
    name: '_acme-challenge.www.benjamin.frontbook.cl.',
    ttl: '14400',
    type: 'TXT',
    body: 'xx7GoDGscFhIxY_nHud5ZHVISynUGZWAalNkBRHzGt8',
  },
  {
    name: '_acme-challenge.www.finanzas.frontbook.cl.',
    ttl: '14400',
    type: 'TXT',
    body: 'gdvfLCztLgCSYEhv6TjJu0LD3iKjoQ9PNlpbXNYcDsM',
  },
);

const existing = new Set([
  'A|autoconfig.frontbook.cl.', 'A|autodiscover.frontbook.cl.',
  'A|cpanel.frontbook.cl.', 'A|cpcalendars.frontbook.cl.',
  'A|cpcontacts.frontbook.cl.', 'A|frontbook.cl.', 'A|ftp.frontbook.cl.',
  'A|webdisk.frontbook.cl.', 'A|webmail.frontbook.cl.', 'A|whm.frontbook.cl.',
  'CNAME|droska.frontbook.cl.', 'CNAME|mail.frontbook.cl.',
  'CNAME|rsend.droska.frontbook.cl.', 'CNAME|send.droska.frontbook.cl.',
  'CNAME|www.frontbook.cl.', 'MX|frontbook.cl.',
  'SRV|_caldav._tcp.frontbook.cl.', 'SRV|_carddav._tcp.frontbook.cl.',
  'TXT|_acme-challenge.frontbook.cl.', 'TXT|_acme-challenge.www.frontbook.cl.',
  'TXT|_caldavs._tcp.frontbook.cl.', 'TXT|_caldav._tcp.frontbook.cl.',
  'TXT|_carddavs._tcp.frontbook.cl.', 'TXT|_carddav._tcp.frontbook.cl.',
  'TXT|_cpanel-dcv-test-record.frontbook.cl.',
  'TXT|default._domainkey.frontbook.cl.', 'TXT|_dmarc.frontbook.cl.',
  'TXT|frontbook.cl.', 'TXT|resend._domainkey.droska.frontbook.cl.',
]);

function relativeName(name) {
  const suffix = '.frontbook.cl.';
  if (name === 'frontbook.cl.') return '@';
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

function quotedTxt(body) {
  const value = body.replace(/\n/g, '').replace(/^\s+|\s+$/g, '');
  const chunks = value.match(/.{1,255}/g) ?? [''];
  return chunks.map((chunk) => `"${chunk.replaceAll('"', '\\"')}"`).join(' ');
}

function rdata(record) {
  if (record.type === 'TXT') return quotedTxt(record.body);
  if (record.type === 'A') return record.body.trim();
  if (record.type === 'CNAME') return `${record.body.trim().replace(/\.$/, '')}.`;
  if (record.type === 'MX') {
    const priority = record.body.match(/Prioridad:\s*(\d+)/)?.[1];
    const destination = record.body.match(/Destino:\s*([^\n]+)/)?.[1]?.trim();
    return `${priority} ${destination?.replace(/\.$/, '')}.`;
  }
  const priority = record.body.match(/Prioridad:\s*(\d+)/)?.[1];
  const weight = record.body.match(/Peso:\s*(\d+)/)?.[1];
  const port = record.body.match(/Puerto:\s*(\d+)/)?.[1];
  const target = record.body.match(/Objetivo:\s*([^\n]+)/)?.[1]?.trim();
  return `${priority} ${weight} ${port} ${target?.replace(/\.$/, '')}.`;
}

const missing = records.filter((record) => !existing.has(`${record.type}|${record.name}`));
const lines = [
  '$ORIGIN frontbook.cl.',
  '$TTL 14400',
  '; Generated from the cPanel zone inventory. Import only while the 29 existing Cloudflare records remain unchanged.',
  ...missing.map((record) => `${relativeName(record.name)} ${record.ttl} IN ${record.type} ${rdata(record)}`),
];

process.stdout.write(`${lines.join('\n')}\n`);
process.stderr.write(`Source records: ${records.length}; records to import: ${missing.length}\n`);
