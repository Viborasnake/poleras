export function absoluteShareUrl(url,origin=globalThis.location?.origin||''){
  if(/^[a-z][a-z\d+.-]*:/i.test(String(url)))return String(url);
  return new URL(url,origin).href;
}

export async function shareLink({url,title,text,origin=globalThis.location?.origin,navigatorObject=globalThis.navigator,clipboard=navigatorObject?.clipboard}){
  const absoluteUrl=absoluteShareUrl(url,origin);
  if(clipboard?.writeText){
    try{
      await clipboard.writeText(absoluteUrl);
      return 'copied';
    }catch{}
  }
  if(navigatorObject?.share){
    try{
      await navigatorObject.share({title,text,url:absoluteUrl});
      return 'shared';
    }catch(error){
      if(error?.name==='AbortError')return 'cancelled';
    }
  }
  return 'failed';
}
