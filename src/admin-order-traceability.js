const itemPaths = item => [item?.front_design_path,item?.back_design_path].filter(Boolean);

export function orderTraceability(order={}) {
  const snapshot=order.price_snapshot||{};
  const references=Array.isArray(order.request_references)?order.request_references.filter(item=>item?.path):[];
  const productionFiles=(order.order_items||[]).flatMap(itemPaths);
  const attachmentCount=references.length+productionFiles.length;
  const recovered=snapshot.recovered_intake===true;
  const attachmentPending=snapshot.attachment_pending===true;
  const personalized=recovered||attachmentPending||snapshot.purchase_type==='personalized'||order.request_type==='creative'||attachmentCount>0;
  const channel=order.shipping_address?.channel==='whatsapp'||order.source==='whatsapp'?'WhatsApp':'Web';
  const requestId=order.creative_request_id||order.whatsapp_request_id||'';
  let state='standard',title='Pedido registrado',message='El pedido fue registrado con sus datos comerciales.';
  if(recovered){
    state='recovered';title='Recepción recuperada tras un fallo';
    message='La confirmación normal falló, pero el contacto, la selección y las referencias disponibles quedaron guardados para revisión manual.';
  }else if(personalized&&attachmentPending&&attachmentCount===0){
    state='pending';title='Personalización pendiente de archivos';
    message='El pedido se registró antes de abrir WhatsApp. Aún no hay archivos vinculados en la plataforma; confirma su recepción en el chat antes de producir.';
  }else if(personalized&&attachmentCount>0){
    state='attached';title='Personalización con archivos recibidos';
    message=`Hay ${attachmentCount} ${attachmentCount===1?'archivo vinculado':'archivos vinculados'} a esta solicitud.`;
  }else if(personalized){
    state='missing';title='Personalización sin archivo vinculado';
    message='La solicitud es personalizada, pero no tiene archivos vinculados en la plataforma. Contacta al cliente antes de producir.';
  }
  return {state,title,message,channel,requestId,personalized,attachmentCount,recoveryReason:String(snapshot.recovery_reason||'').trim()};
}
