import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
import * as catalog from '../supabase/functions/_shared/catalog-personalization.js';
import * as products from '../supabase/functions/_shared/catalog-product-artworks.js';
import * as composition from '../supabase/functions/_shared/catalog-polera-prints.js';
import * as variants from '../supabase/functions/_shared/variant-selection.js';
import * as printing from '../supabase/functions/_shared/print-configuration.js';
import { printPrice } from '../supabase/functions/_shared/print-pricing.js';
import { bankTransferDeadline } from '../supabase/functions/_shared/bank-transfer.js';

const source = await readFile(new URL('../supabase/functions/create-payment-preference/index.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*\n/gm, ''), { loader: 'ts' });
const userId = '11111111-1111-4111-8111-111111111111';
const photo = { name: 'mi-mascota.webp', path: `${userId}/reference/22222222-2222-4222-8222-222222222222.webp` };
const petItem = {
  modelCode: 'basic', size: 'M', color: '#ffffff', printSides: 'front', quantity: 1, variantId: 1,
  catalogDesignSlug: 'la-playera', catalogDesignCustomerImage: true, qualityReview: false,
  petPersonalization: { name: 'Nala', notes: 'Conservar sus manchas.', references: [photo] },
};

function checkoutFixture({ fee = 2990, files = [photo.path] } = {}) {
  const rows = {
    orders: [], payments: [], order_items: [], order_status_history: [],
    product_variants: [{ id: 1, sku: 'B-M', size: 'M', color_name: 'Blanco', color_hex: '#ffffff', price_clp: 15990, personalization_base_price_clp: 13990, active: true, product_models: { code: 'basic', name: 'Básica', active: true } }],
    catalog_designs: [{ id: 2, slug: 'la-playera', name: 'La Playera', active: true, accepts_customer_image: true, customer_photo_subject: 'pets', product_artworks: { poleras: 'playera.webp' } }],
    storefront_settings: [{ id: true, quality_review_fee_clp: fee }],
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from(table) {
      const filters = [];
      let operation = 'select';
      let values;
      const selectRows = () => rows[table].filter(row => filters.every(([key, valid]) => valid(key.split('.').reduce((value, field) => value?.[field], row))));
      const run = () => {
        if (operation === 'insert') {
          const inserted = [values].flat().map(value => ({ id: rows[table].length + 1, request_type: 'purchase', updated_at: '2026-11-28T15:00:00Z', ...value }));
          rows[table].push(...inserted);
          return inserted;
        }
        const matches = selectRows();
        if (operation === 'update') matches.forEach(row => Object.assign(row, values));
        if (operation === 'delete') rows[table] = rows[table].filter(row => !matches.includes(row));
        return matches;
      };
      return {
        select() { return this; },
        eq(key, value) { filters.push([key, current => current === value]); return this; },
        neq(key, value) { filters.push([key, current => current !== value]); return this; },
        in(key, options) { filters.push([key, current => options.includes(current)]); return this; },
        insert(data) { operation = 'insert'; values = data; return this; },
        update(data) { operation = 'update'; values = data; return this; },
        delete() { operation = 'delete'; return this; },
        async single() { return { data: run()[0] || null }; },
        async maybeSingle() { return { data: run()[0] || null }; },
        then(resolve) { return Promise.resolve({ data: run() }).then(resolve); },
      };
    },
  };
  const providerRequests = [];
  const sentEmails = [];
  let handler;
  vm.runInNewContext(code, {
    ...catalog, ...products, ...composition, ...variants, ...printing, printPrice, bankTransferDeadline,
    Deno: { serve: callback => { handler = callback; }, env: { get: key => ({ SUPABASE_URL: 'https://db.example.test', SUPABASE_SECRET_KEY: 'test', MERCADOPAGO_ACCESS_TOKEN: 'test', SITE_URL: 'https://shop.example.test', BANK_TRANSFER_HOLDER: 'Taller', BANK_TRANSFER_BANK: 'Banco de pruebas', BANK_TRANSFER_ACCOUNT_NUMBER: '123', BANK_TRANSFER_RUT: '11.111.111-1' })[key] } },
    createClient: () => client,
    headPrivateDesign: async path => files.includes(path) ? { size: 2000 } : null,
    sendAdminOrderNotice: async () => {},
    sendOrderEmail: async (...args) => { sentEmails.push(args[5]); return { sent: true }; },
    fetch: async (_url, options) => {
      providerRequests.push(JSON.parse(options.body));
      return Response.json({ id: 'pref-test', init_point: 'https://pay.example.test/test' });
    },
    Response, console,
  });
  const pay = (paymentMethod, draftOrderId, item = petItem) => handler(new Request('https://db.example.test/checkout', {
    method: 'POST', headers: { Authorization: 'Bearer test' },
    body: JSON.stringify({ paymentMethod, draftOrderId, items: [item], fulfillment: 'pickup', shippingQuoteClp: 0, customer: { firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.test', phone: '+56912345678' } }),
  }));
  return { rows, providerRequests, sentEmails, pay };
}

test('Mercado Pago cobra la variante más la revisión configurada y guarda la foto como referencia', async () => {
  const fixture = checkoutFixture({ fee: 3200 });
  const draft = await fixture.pay('draft');
  assert.equal(draft.status, 201);
  const { orderId } = await draft.json();
  const payment = await fixture.pay('mercado_pago', orderId);
  assert.equal(payment.status, 201);
  assert.equal((await payment.json()).totalClp, 17190);
  assert.equal(fixture.providerRequests[0].items[0].unit_price, 17190);
  assert.equal(fixture.rows.order_items[0].quality_review, true);
  assert.equal(fixture.rows.order_items[0].front_design_path, null);
  assert.equal(fixture.rows.orders[0].request_references[0].path, photo.path);
  assert.match(fixture.rows.orders[0].request_details, /Nala.*Conservar sus manchas/s);
  assert.equal(fixture.rows.orders[0].price_snapshot.flow_type, 'pet_personalization');
});

test('transferencia conserva el costo y el plazo de 60 minutos desde el primer intento', async () => {
  const fixture = checkoutFixture();
  const { orderId } = await (await fixture.pay('draft')).json();
  const transfer = await fixture.pay('transfer', orderId);
  assert.equal(transfer.status, 201);
  const first = await transfer.json();
  const second = await (await fixture.pay('transfer', orderId)).json();
  assert.equal(first.totalClp, 16980);
  assert.equal(Date.parse(first.paymentInstructions.transfer_due_at) - Date.parse(fixture.rows.orders[0].submitted_at), 60 * 60_000);
  assert.deepEqual(second.paymentInstructions, first.paymentInstructions);
  assert.equal(fixture.sentEmails[0].payment_instructions.transfer_due_at, first.paymentInstructions.transfer_due_at);
  assert.equal(fixture.rows.payments.length, 1);
  assert.equal(fixture.providerRequests.length, 0);
});

test('una compra de mascota exige fotos privadas válidas y distintas', async () => {
  const photos = [photo, { ...photo, path: `${userId}/reference/33333333-3333-4333-8333-333333333333.jpg` }, { ...photo, path: `${userId}/reference/44444444-4444-4444-8444-444444444444.png` }];
  const fixture = checkoutFixture({ files: photos.map(({ path }) => path) });
  const item = references => ({ ...petItem, petPersonalization: { references } });
  for (const invalid of [[], [photo, photo], [...photos, photo], [{ ...photo, path: photo.path.replace(userId, '99999999-9999-4999-8999-999999999999') }]]) {
    assert.equal((await fixture.pay('draft', undefined, item(invalid))).status, 400);
  }
  assert.equal(fixture.rows.orders.length, 0);
  assert.equal((await fixture.pay('draft', undefined, item(photos))).status, 201);
  assert.equal(fixture.rows.orders[0].request_references.length, 3);
});
