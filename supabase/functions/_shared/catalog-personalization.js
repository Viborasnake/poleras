const acceptsCustomerImage=design=>Boolean(design?.accepts_customer_image??design?.acceptsCustomerImage);
const customerPhotoSubject=design=>(design?.customer_photo_subject??design?.customerPhotoSubject)==='people'?'people':'pets';

export function isUnmodifiedCatalogItem(item={}){
  return Boolean(item.catalogDesignSlug)&&!Boolean(item.catalogDesignCustomerImage);
}

export function isCatalogPrintIncluded(item={},printSides='front',printCount=1){
  // El estampado principal forma parte del precio del diseño de catálogo,
  // también cuando el cliente reemplaza la foto. Solo las ubicaciones
  // adicionales deben conservar un recargo propio.
  return Boolean(item.catalogDesignSlug)&&printCount===1;
}

export function catalogDesignAllowsBasePurchase(design){
  return acceptsCustomerImage(design)&&customerPhotoSubject(design)==='people';
}

export function normalizeCatalogDesignPurchaseMode(design,mode){
  if(!acceptsCustomerImage(design))return 'base';
  if(!catalogDesignAllowsBasePurchase(design))return 'personalized';
  return mode==='base'?'base':'personalized';
}

export function catalogDesignRequiresCustomerImage(design,customerImage){
  return Boolean(design&&!customerImage&&acceptsCustomerImage(design)&&!catalogDesignAllowsBasePurchase(design));
}

export function catalogDesignForVariantSelection(design,customerImage){
  if(!design||customerImage)return design;
  return {...design,accepts_customer_image:false,acceptsCustomerImage:false};
}
