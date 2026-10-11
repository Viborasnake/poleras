import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrdersWorkbook, ordersExportSheets } from './orders-export.js';

const order = {
  id: 42, source: 'manual', status: 'delivered', archived_at: '2026-10-11T02:30:00Z', archived_from_status: 'delivered',
  created_at: '2026-10-10T18:00:00Z', subtotal_clp: 20000, shipping_clp: 4990, discount_clp: 1000, total_clp: 23990,
  shipping_address: { fulfillment: 'delivery', region: 'Metropolitana', commune: 'Santiago', customer: { first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.cl', rut: '12.345.678-9' } },
  payment_confirmed_at: '2026-10-10T20:00:00Z', payment_confirmed_by: 'admin',
  order_items: [{ name_snapshot: '=HYPERLINK("bad")', sku_snapshot: 'SKU-1', print_sides: 'front', quantity: 2, unit_price_clp: 10000, line_total_clp: 20000, front_design_path: 'customer-designs/42/front.png' }],
  order_status_history: [{ status: 'delivered', note: 'Entregado', created_at: '2026-10-11T02:30:00Z' }],
  payments: [{ provider: 'mercado_pago', status: 'approved' }],
};

function zipEntries(bytes) {
  const entries = new Map(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder();
  for (let offset = 0; view.getUint32(offset, true) === 0x04034B50;) {
    const size = view.getUint32(offset + 18, true), nameSize = view.getUint16(offset + 26, true), extraSize = view.getUint16(offset + 28, true);
    const nameStart = offset + 30, contentStart = nameStart + nameSize + extraSize;
    entries.set(decoder.decode(bytes.subarray(nameStart, nameStart + nameSize)), decoder.decode(bytes.subarray(contentStart, contentStart + size)));
    offset = contentStart + size;
  }
  return entries;
}

test('exporta todos los pedidos y preserva detalle, productos e historial en hojas separadas', () => {
  const sheets = ordersExportSheets([order]);
  assert.deepEqual(sheets.map(sheet => sheet.name), ['Pedidos', 'Productos', 'Historial']);
  assert.equal(sheets[0].rows.length, 1);
  assert.equal(sheets[0].rows[0][9], 'Ana Pérez');
  assert.equal(sheets[0].rows[0][10], '12.345.678-9');
  assert.equal(sheets[0].rows[0][5], 'Pagado');
  assert.equal(sheets[0].rows[0][23].value, 23990);
  assert.equal(sheets[1].rows[0][7], 'customer-designs/42/front.png');
  assert.equal(sheets[2].rows[0][3], 'Entregado');
});

test('genera XLSX con hojas, filtros y texto seguro para Excel', () => {
  const bytes = buildOrdersWorkbook([order]);
  const files = zipEntries(bytes);
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034B50);
  assert.match(files.get('xl/workbook.xml'), /Pedidos.*Productos.*Historial/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /autoFilter ref="A1:AC2"/);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /s="3"><v>23990<\/v>/);
  assert.match(files.get('xl/worksheets/sheet2.xml'), /<t xml:space="preserve">=HYPERLINK\(&quot;bad&quot;\)<\/t>|<t xml:space="preserve">=HYPERLINK\("bad"\)<\/t>/);
  assert.doesNotMatch(files.get('xl/worksheets/sheet2.xml'), /<f>/);
  assert.match(files.get('xl/worksheets/sheet3.xml'), /Entregado/);
});
