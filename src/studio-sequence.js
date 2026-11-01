export const DETAIL_BLOCK_ORDER=['product-family-block','model-block','size-block','color-block','print-placement-block'];

export function preserveStudioView({scrollTop=0,activeKey=null,find=()=>null,focus=element=>element?.focus({preventScroll:true}),setScroll=value=>{}}={}){
 setScroll(Math.max(0,scrollTop));
 if(activeKey){const element=find(activeKey);if(element)focus(element)}
 return {scrollTop:Math.max(0,scrollTop),activeKey};
}
