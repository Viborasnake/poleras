const acceptsCustomerImage=design=>Boolean(design?.accepts_customer_image??design?.acceptsCustomerImage);
const customerPhotoSubject=design=>(design?.customer_photo_subject??design?.customerPhotoSubject)==='people'?'people':'pets';

export function isCatalogPrintIncluded(item={},printSides='front',printCount=1){
  return Boolean(item.catalogDesignSlug)&&!Boolean(item.catalogDesignCustomerImage)&&printSides==='front'&&printCount===1;
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
