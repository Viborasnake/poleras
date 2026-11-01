export const PURCHASE_METHODS=Object.freeze({inherit:'inherit',cart:'cart',whatsapp:'whatsapp'});
export const PURCHASE_TYPES=Object.freeze({catalog:'catalog',personalized:'personalized'});

export function normalizePurchaseMethod(value,{allowInherit=false}={}){
  const method=String(value||'').toLowerCase();
  if(method===PURCHASE_METHODS.whatsapp)return method;
  if(allowInherit&&(method===PURCHASE_METHODS.inherit||!method))return PURCHASE_METHODS.inherit;
  return PURCHASE_METHODS.cart;
}

export function purchaseTypeFor(selection={}){
  return selection.mode==='custom'||selection.catalogDesignCustomerImage||!selection.catalogDesignSlug
    ?PURCHASE_TYPES.personalized
    :PURCHASE_TYPES.catalog;
}

export function effectivePurchaseMethod({product,settings={},purchaseType=PURCHASE_TYPES.catalog}={}){
  const override=normalizePurchaseMethod(product?.purchase_method,{allowInherit:true});
  if(override!==PURCHASE_METHODS.inherit)return override;
  const globalMethod=purchaseType===PURCHASE_TYPES.personalized
    ?settings.personalized_purchase_method
    :settings.catalog_purchase_method;
  return normalizePurchaseMethod(globalMethod);
}

export function hasCartPurchase(products=[],settings={}){
  return products.filter(product=>product.active!==false).some(product=>
    [PURCHASE_TYPES.catalog,PURCHASE_TYPES.personalized].some(purchaseType=>
      effectivePurchaseMethod({product,settings,purchaseType})===PURCHASE_METHODS.cart));
}

export function purchaseMethodLabel(method,{purchaseType=PURCHASE_TYPES.catalog}={}){
  if(method===PURCHASE_METHODS.whatsapp)return purchaseType===PURCHASE_TYPES.personalized?'Solicitar por WhatsApp':'Comprar por WhatsApp';
  return 'Carrito de compras';
}

const line=value=>String(value??'').trim();
export function buildWhatsAppPurchaseMessage({purchaseType=PURCHASE_TYPES.catalog,productName,designName,model,size,color,sides,quantity=1,personalization='',customer={},imageUrls=[]}={}){
  const title=purchaseType===PURCHASE_TYPES.personalized?'Solicitud personalizada Droska':'Compra de catálogo Droska';
  const details=[
    `Hola, quiero gestionar una ${title.toLowerCase()}.`,
    '',
    `Producto: ${line(productName)||'Por confirmar'}`,
    designName&&`Diseño: ${line(designName)}`,
    model&&`Modelo: ${line(model)}`,
    size&&`Talla: ${line(size)}`,
    color&&`Color: ${line(color)}`,
    sides&&`Estampado: ${line(sides)}`,
    `Cantidad: ${Math.max(1,Number(quantity)||1)}`,
    personalization&&`Personalización: ${line(personalization)}`,
    '',
    `Cliente: ${line(customer.name)||'Por confirmar'}`,
    customer.email&&`Email: ${line(customer.email)}`,
    customer.phone&&`Teléfono: ${line(customer.phone)}`,
  ].filter(Boolean);
  if(imageUrls.length){details.push('','Archivos (enlaces privados temporales):',...imageUrls.map((url,index)=>`${index+1}. ${url}`))}
  details.push('','¿Me ayudan a continuar con esta solicitud?');
  return details.join('\n');
}

export const whatsappPurchaseUrl=(number,message)=>`https://wa.me/${String(number||'').replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
