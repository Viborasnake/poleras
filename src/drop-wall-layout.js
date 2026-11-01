// Explicit, order-preserving placement: the promotional tile fills only unused cells.
export function planDropWall(count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Invalid card count');
  const cards = [], rows = [];
  const fullGroups = Math.floor(count / 4), remainder = count % 4;
  for (let group = 0; group < fullGroups; group++) {
    const row = group * 2 + 1;
    cards.push(
      { column: 1, columns: 6, row, rows: 2 },
      { column: 7, columns: 3, row, rows: 2 },
      { column: 10, columns: 3, row, rows: 1 },
      { column: 10, columns: 3, row: row + 1, rows: 1 },
    );
    rows.push(300, 300);
  }
  let filler = null;
  const row = fullGroups * 2 + 1;
  if (remainder === 1) {
    const columns = count === 1 ? 6 : 3;
    cards.push({ column: 1, columns, row, rows: 2 });
    // Tras un grupo completo, el comodín no se estira por las nueve columnas
    // libres: seis columnas le dan presencia sin competir con las cards.
    filler = { column: columns + 1, columns: 6, row, rows: 2 };
    rows.push(...(count === 1 ? [300, 300] : [253.35, 253.35]));
  } else if (remainder >= 2) {
    cards.push({ column: 1, columns: 6, row, rows: 2 }, { column: 7, columns: 3, row, rows: 2 });
    if (remainder === 3) cards.push({ column: 10, columns: 3, row, rows: 1 });
    filler = { column: 10, columns: 3, row: row + (remainder === 3 ? 1 : 0), rows: remainder === 3 ? 1 : 2 };
    rows.push(300, 300);
  }
  // Desktop consumes these tracks; grow only cards that start in the first row.
  if (rows.length) rows[0] += 100;
  return { cards, filler, rowHeights: rows, tabletNeedsFiller: count % 2 === 1 };
}
