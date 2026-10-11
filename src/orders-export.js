import { orderStatusLabel } from './order-status.js';
import { orderPaymentState, paymentStateLabels } from './payment-state.js';

const encoder = new TextEncoder();
const chileDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const excelEpoch = Date.UTC(1899, 11, 30);
const cleanText = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
const xmlText = value => cleanText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xmlAttr = value => xmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const cellName = (column, row) => { let name = ''; for (let n = column + 1; n; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name; return `${name}${row}`; };
const dateCell = value => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  const parts = Object.fromEntries(chileDate.formatToParts(new Date(value)).map(part => [part.type, Number(part.value)]));
  return { value: (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - excelEpoch) / 86400000, style: 2 };
};
const numberCell = value => ({ value: Number(value) || 0, style: 3 });
const customerName = customer => [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Cliente sin nombre';
const referencePaths = references => Array.isArray(references) ? references.map(reference => typeof reference === 'string' ? reference : reference?.path || reference?.storage_path || '').filter(Boolean).join(' | ') : '';

export function ordersExportSheets(orders) {
  const main = {
    name: 'Pedidos',
    columns: [['N° pedido', 13], ['Creado', 21], ['Archivado', 21], ['Estado', 25], ['Estado previo', 24], ['Pago', 24], ['Origen', 18], ['Canal', 20], ['Solicitud', 18], ['Cliente', 25], ['RUT', 16], ['Correo', 31], ['Teléfono', 18], ['Entrega', 16], ['Región', 23], ['Comuna', 21], ['Dirección', 34], ['Notas entrega', 34], ['Unidades', 11], ['Productos', 40], ['Subtotal CLP', 17], ['Despacho CLP', 17], ['Descuento CLP', 18], ['Total CLP', 17], ['Cupón', 16], ['Detalle solicitud', 45], ['Referencias', 45], ['Pagos proveedor', 29], ['Pago confirmado', 21]],
    rows: orders.map(order => {
      const address = order.shipping_address || {}, customer = address.customer || {}, items = order.order_items || [];
      const channel = address.channel || String(address.notes || '').match(/^Canal de origen:\s*(.+)$/m)?.[1]?.trim() || '';
      return [String(order.id), dateCell(order.created_at), dateCell(order.archived_at), order.archived_at ? 'Archivado' : orderStatusLabel(order.status, order), order.archived_from_status ? orderStatusLabel(order.archived_from_status, order) : '', paymentStateLabels[orderPaymentState(order)], order.source || '', channel, order.request_type || '', customerName(customer), customer.rut || customer.tax_id || address.rut || '', customer.email || '', customer.phone || '', address.fulfillment === 'pickup' ? 'Retiro' : address.fulfillment === 'delivery' ? 'Despacho' : address.fulfillment || '', address.region || '', address.commune || '', [address.address, address.address_extra].filter(Boolean).join(', '), address.delivery_notes || '', items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0), items.map(item => item.name_snapshot).filter(Boolean).join(' | '), numberCell(order.subtotal_clp), numberCell(order.shipping_clp), numberCell(order.discount_clp), numberCell(order.total_clp), order.coupon_code || '', order.request_details || '', referencePaths(order.request_references), (order.payments || []).map(payment => `${payment.provider || 'Pago'}: ${payment.status || 'Sin estado'}`).join(' | '), dateCell(order.payment_confirmed_at)];
    }),
  };
  const products = {
    name: 'Productos',
    columns: [['N° pedido', 13], ['Producto', 45], ['SKU', 27], ['Impresión', 16], ['Cantidad', 13], ['Precio unitario CLP', 21], ['Total línea CLP', 19], ['Archivo frente', 48], ['Archivo espalda', 48]],
    rows: orders.flatMap(order => (order.order_items || []).map(item => [String(order.id), item.name_snapshot || '', item.sku_snapshot || '', item.print_sides || '', Number(item.quantity) || 0, numberCell(item.unit_price_clp), numberCell(item.line_total_clp), item.front_design_path || '', item.back_design_path || ''])),
  };
  const history = {
    name: 'Historial',
    columns: [['N° pedido', 13], ['Fecha', 21], ['Estado', 25], ['Nota', 70]],
    rows: orders.flatMap(order => (order.order_status_history || []).map(entry => [String(order.id), dateCell(entry.created_at), orderStatusLabel(entry.status, order), entry.note || ''])),
  };
  return [main, products, history];
}

function sheetXml(sheet) {
  const header = sheet.columns.map(([name], column) => `<c r="${cellName(column, 1)}" s="1" t="inlineStr"><is><t>${xmlText(name)}</t></is></c>`).join('');
  const rows = sheet.rows.map((values, index) => `<row r="${index + 2}">${values.map((entry, column) => {
    if (entry === '' || entry == null) return '';
    const address = cellName(column, index + 2);
    if (typeof entry === 'number') return `<c r="${address}"><v>${Number.isFinite(entry) ? entry : 0}</v></c>`;
    if (typeof entry === 'object' && 'value' in entry) return `<c r="${address}" s="${entry.style || 0}"><v>${Number.isFinite(entry.value) ? entry.value : 0}</v></c>`;
    return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xmlText(entry)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const lastColumn = cellName(sheet.columns.length - 1, 1).replace(/\d+$/, '');
  const columns = sheet.columns.map(([, width], index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${sheet.rows.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData><row r="1">${header}</row>${rows}</sheetData><autoFilter ref="A1:${lastColumn}${sheet.rows.length + 1}"/></worksheet>`;
}

const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF262920"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function zipFiles(files) {
  const crcTable = Array.from({ length: 256 }, (_, index) => { let crc = index; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0; });
  const crc32 = data => { let crc = 0xFFFFFFFF; for (const byte of data) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; };
  const local = [], central = [];
  let offset = 0;
  const u16 = (view, position, value) => view.setUint16(position, value, true);
  const u32 = (view, position, value) => view.setUint32(position, value, true);
  for (const [name, content] of files) {
    const filename = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
    const entry = new Uint8Array(30 + filename.length + data.length), view = new DataView(entry.buffer);
    u32(view, 0, 0x04034B50); u16(view, 4, 20); u16(view, 8, 0); u32(view, 14, crc); u32(view, 18, data.length); u32(view, 22, data.length); u16(view, 26, filename.length);
    entry.set(filename, 30); entry.set(data, 30 + filename.length); local.push(entry);
    const record = new Uint8Array(46 + filename.length), recordView = new DataView(record.buffer);
    u32(recordView, 0, 0x02014B50); u16(recordView, 4, 20); u16(recordView, 6, 20); u32(recordView, 16, crc); u32(recordView, 20, data.length); u32(recordView, 24, data.length); u16(recordView, 28, filename.length); u32(recordView, 42, offset); record.set(filename, 46); central.push(record);
    offset += entry.length;
  }
  const centralSize = central.reduce((size, entry) => size + entry.length, 0);
  const end = new Uint8Array(22), endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054B50); u16(endView, 8, files.length); u16(endView, 10, files.length); u32(endView, 12, centralSize); u32(endView, 16, offset);
  const output = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const entry of [...local, ...central, end]) { output.set(entry, position); position += entry.length; }
  return output;
}

export function buildOrdersWorkbook(orders) {
  const sheets = ordersExportSheets(orders);
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xmlAttr(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zipFiles([['[Content_Types].xml', contentTypes], ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'], ['xl/workbook.xml', workbook], ['xl/_rels/workbook.xml.rels', workbookRels], ['xl/styles.xml', stylesXml], ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)])]);
}
