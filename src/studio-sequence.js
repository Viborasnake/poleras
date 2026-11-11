export const DETAIL_BLOCK_ORDER=['product-family-block','model-block','size-block','color-block','print-placement-block'];

// Published catalog artwork keeps its configured placement.
export const studioDetailIncludesPrintPlacement=catalogDesignSlug=>!catalogDesignSlug;

// Keep a replaced control in the same visible position, even when an earlier
// accordion collapses and changes the amount of content above it.
export function replaceStudioControl({control,scroller,update,findReplacement,focus=element=>element.focus({preventScroll:true})}){
 const top=control.getBoundingClientRect().top;
 update();
 const replacement=findReplacement();
 if(!replacement)return;
 if(scroller)scroller.scrollTop+=replacement.getBoundingClientRect().top-top;
 focus(replacement);
}

export function preserveStudioView({scrollTop=0,activeKey=null,find=()=>null,focus=element=>element?.focus({preventScroll:true}),setScroll=value=>{}}={}){
 setScroll(Math.max(0,scrollTop));
 if(activeKey){const element=find(activeKey);if(element)focus(element)}
 return {scrollTop:Math.max(0,scrollTop),activeKey};
}
