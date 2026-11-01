export function matchesDesignFilters({ searchable = '', categoryId = '', collectionId = '' }, { query = '', categoryId: selectedCategoryId = '', collectionId: selectedCollectionId = '' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase('es-CL');
  return (!normalizedQuery || String(searchable).toLocaleLowerCase('es-CL').includes(normalizedQuery))
    && (!selectedCategoryId || String(categoryId) === String(selectedCategoryId))
    && (!selectedCollectionId || String(collectionId) === String(selectedCollectionId));
}
