import test from 'node:test';
import assert from 'node:assert/strict';
import { planDropWall } from './drop-wall-layout.js';

test('every catalog size from 0 to 100 keeps visual order without overlaps', () => {
  for (let count = 0; count <= 100; count++) {
    const plan = planDropWall(count), occupied = new Set();
    assert.equal(plan.cards.length, count);
    let previousStart = -1;
    for (const card of plan.cards) {
      const start = (card.row - 1) * 12 + card.column;
      assert.ok(start > previousStart, `visual order at ${count}`);
      previousStart = start;
    }
    for (const item of [...plan.cards, ...(plan.filler ? [plan.filler] : [])]) {
      assert.ok(item.column >= 1 && item.column + item.columns <= 13);
      for (let y = item.row; y < item.row + item.rows; y++) {
        for (let x = item.column; x < item.column + item.columns; x++) {
          const key = `${x}:${y}`;
          assert.ok(!occupied.has(key), `overlap for ${count} cards at ${key}`);
          occupied.add(key);
        }
      }
    }
    assert.ok(occupied.size <= plan.rowHeights.length * 12, `overflow for ${count}`);
    assert.equal(plan.tabletNeedsFiller, count % 2 === 1);
  }
});
test('approved five-card composition keeps Retro Games narrow and its row compact', () => {
  const plan = planDropWall(5);
  assert.equal(plan.cards[4].columns, plan.cards[1].columns);
  assert.deepEqual(plan.filler, { column: 4, columns: 6, row: 3, rows: 2 });
  assert.deepEqual(plan.rowHeights, [400, 300, 253.35, 253.35]);
});
test('six and seven cards shrink the wildcard to the remaining right-hand cells', () => {
  assert.deepEqual(planDropWall(6).filler, { column: 10, columns: 3, row: 3, rows: 2 });
  assert.deepEqual(planDropWall(7).filler, { column: 10, columns: 3, row: 4, rows: 1 });
  assert.equal(planDropWall(8).filler, null);
});
test('a single filtered collection remains large and has an adjacent wildcard', () => {
  assert.equal(planDropWall(1).cards[0].columns, 6);
  assert.equal(planDropWall(1).filler.columns, 6);
});
