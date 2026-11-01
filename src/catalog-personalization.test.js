import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogDesignAllowsBasePurchase,
  catalogDesignForVariantSelection,
  catalogDesignRequiresCustomerImage,
  normalizeCatalogDesignPurchaseMode,
} from '../supabase/functions/_shared/catalog-personalization.js';

test('personas ofrece diseño base y personalización',()=>{
  const design={acceptsCustomerImage:true,customerPhotoSubject:'people',allowedColors:['#ffffff']};
  assert.equal(catalogDesignAllowsBasePurchase(design),true);
  assert.equal(normalizeCatalogDesignPurchaseMode(design,'base'),'base');
  assert.equal(normalizeCatalogDesignPurchaseMode(design,'personalized'),'personalized');
  assert.equal(catalogDesignRequiresCustomerImage(design,false),false);
  assert.equal(catalogDesignForVariantSelection(design,false).acceptsCustomerImage,false);
});

test('mascotas obliga a personalizar aunque el cliente intente comprar la base',()=>{
  const design={accepts_customer_image:true,customer_photo_subject:'pets'};
  assert.equal(catalogDesignAllowsBasePurchase(design),false);
  assert.equal(normalizeCatalogDesignPurchaseMode(design,'base'),'personalized');
  assert.equal(catalogDesignRequiresCustomerImage(design,false),true);
});

test('un diseño no personalizable mantiene la compra de catálogo',()=>{
  const design={accepts_customer_image:false,customer_photo_subject:'people'};
  assert.equal(catalogDesignAllowsBasePurchase(design),false);
  assert.equal(normalizeCatalogDesignPurchaseMode(design,'personalized'),'base');
  assert.equal(catalogDesignRequiresCustomerImage(design,false),false);
});
