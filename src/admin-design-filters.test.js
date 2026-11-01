import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesDesignFilters } from './admin-design-filters.js';

const design = { searchable: 'La Playera personaliza con tu mascota Verano', categoryId: 2, collectionId: 17 };

test('design filters combine search, collection type and collection', () => {
  assert.equal(matchesDesignFilters(design), true);
  assert.equal(matchesDesignFilters(design, { query: 'PLAYERA', categoryId: '2', collectionId: '17' }), true);
  assert.equal(matchesDesignFilters(design, { query: 'retro', categoryId: '2' }), false);
  assert.equal(matchesDesignFilters(design, { categoryId: '3' }), false);
  assert.equal(matchesDesignFilters(design, { collectionId: '18' }), false);
});
