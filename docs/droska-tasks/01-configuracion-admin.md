# I01 · Configuración común de diseños y colecciones

Modelo: **gpt-6.1-sol · High**. Fase 1. T1/T2/T3/T11 (base). Dependencias: ninguna.

## 1. Objetivo específico

Permitir que administración configure personalización por imagen, destacados y múltiples colores usando las entidades existentes, con un contrato que las siguientes unidades puedan consumir sin rediseño.

## 2. Contexto técnico mínimo

Lee las reglas del [índice](README.md) y §1/C1 del [plan](../../PLAN_DROSKA.md). Hoy `catalog_designs` tiene `sample_color` y `product_artworks`; no se encontraron campos para estos tres conceptos nuevos. `featuredPhoto` es foto editorial, no prioridad. `product_variants` ya contiene colores y precios. Las consultas enumeran columnas, por lo que guardar un campo no basta para propagarlo.

## 3. Archivos involucrados

- `src/admin.js`: carga de datos, `designsView`, `openDesignDialog`, `submitDesign`, `wireDesigns`, `collectionsView`, `wireCollections`. Verificar nombres vigentes con `rg`; no depender de números de línea.
- `src/catalog.js`: `catalogFromRows`, `loadCatalog`; `src/catalog.test.js`.
- `scripts/generate-catalog-pages.mjs`: selección/serialización de metadata, sin cambiar todavía prioridad/CTA.
- `src/admin.css` solo para reutilizar layout de campos; `docs/design-system.md` si cambia una regla.
- Referencias de esquema: `supabase/commerce-setup.sql`, `supabase/catalog-sample-color.sql`, `supabase/admin-setup.sql`, migración `20261013111501_catalog_product_artworks.sql`.
- Crear una migración aditiva en `supabase/migrations/` durante ejecución; su nombre lo genera la herramienta, no existe aún.

## 4. Instrucciones de implementación

1. Registrar cambios previos y revisar columnas/políticas relevantes. Definir los mínimos campos nuevos en diseños/colecciones para los conceptos de C1. Registrar nombres y shape final en C1; preferir campos sencillos, sin tabla paralela de colores.
2. Separar lista permitida de `sample_color`. Tomar colores/nombres de variantes existentes y conservar productos vinculados. Distinguir sin configuración histórica de lista explícita vacía; impedir guardar una configuración sin colores elegibles y explicar el caso.
3. Añadir controles etiquetados en formularios existentes: casillas de personalización/destacado y multiselección de colores; colección destacada en su formulario. Guardar, editar y recargar sin borrar artwork, mockups, colección ni estado de publicación.
4. Preparar migración compatible con registros anteriores y RLS administrativa; comprobar lectura pública limitada a metadata de catálogo, nunca costos o archivos privados. No activar restricciones que invaliden colores históricos sin identificar sus variantes reales.
5. Propagar metadata en loader, normalización y datos SEO. Mantener comportamiento comercial actual hasta I02/I03. Reutilizar la regeneración de catálogo existente en guardados pertinentes.

## 5. Restricciones

No crear modales, catálogo de colores, prioridades por foto ni precios nuevos. No modificar checkout o visor en esta unidad. No reescribir migraciones antiguas ni aplicar la nueva en producción. Sin revisión visual: aplica las reglas del índice.

## 6. Pruebas

Fixtures antiguos/nuevos en normalización; uno/varios colores, hex normalizado, vacíos y datos inválidos; serialización SEO sin pérdida de campos. En entorno aislado probar migración con datos anteriores, lectura pública y rechazo de escritura no administradora; indicar si el entorno no está disponible. Ejecutar `npm test` y `npm run build`; auditoría si cambian colores UI.

## 7. Criterios de aceptación / Definition of Done

Admin puede guardar y recuperar los tres conceptos; catálogo recibe metadata; comportamiento anterior sigue funcionando. C1 documenta nombres, defaults y transición histórica con evidencia. No afirmar completadas T1/T2/T3/T11: faltan consumidores. Entregar al usuario checklist de campos/foco; siguiente **I02**.

## 8. Resultado de ejecución · 14 de octubre de 2026

Estado: **implementación técnica lista; migración remota y revisión visual pendientes**.

- Contrato SQL: `catalog_collections.is_featured`; `catalog_designs.accepts_customer_image`, `catalog_designs.is_featured` y `catalog_designs.allowed_colors`.
- Migración aditiva: `supabase/migrations/20261014025405_catalog_design_configuration.sql`. No fue aplicada a producción.
- Compatibilidad: `allowed_colors IS NULL` identifica configuración histórica pendiente. Una configuración explícita requiere uno o más hex minúsculos `#rrggbb`; Administración normaliza, elimina duplicados y rechaza una selección vacía.
- Propagación: `featured`, `acceptsCustomerImage` y `allowedColors` llegan al modelo público y al JSON de páginas SEO. I01 no activa orden, CTA, disponibilidad, checkout ni visor.
- RLS: la migración no altera permisos. Continúan la lectura pública de filas activas y la escritura administrativa definida por las políticas existentes.
- Evidencia: `npm test` pasó 85/85; `npm run build` pasó y generó 16 páginas con respaldo local, verificando la metadata en el JSON; `npm run audit:a11y-colors` pasó 12/12; `git diff --check` pasó.
- Limitación de entorno: `npx supabase db lint --local` no respondió porque no había una instancia local disponible. Falta aplicar y probar la migración en un entorno aislado con datos históricos, lectura anónima y rechazo de escritura no administradora.
- Revisión visual del usuario: comprobar foco y etiquetas de las casillas, selección múltiple de colores, mensaje de configuración histórica y persistencia al reabrir colección/diseño.

Siguiente intervención: **I02**, usando `gpt-6-luna` con razonamiento Medium y este contrato sin renombrar campos.
