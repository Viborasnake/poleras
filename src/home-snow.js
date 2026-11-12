import './home-snow.css';

// Decorative snow uses compositor animations, without a canvas or frame loop.
export function mountHomeSnow(){
  if(document.querySelector('.home-snow'))return;
  const layer=document.createElement('div');
  layer.className='home-snow';
  layer.setAttribute('aria-hidden','true');
  for(let index=0;index<32;index++){
    const flake=document.createElement('i');
    flake.className=`home-snow-flake${index%5===0?' home-snow-flake--crystal':''}`;
    flake.style.cssText=`--snow-x:${(index*37.3)%100}%;--snow-size:${index%5===0?9:2+index%4}px;--snow-duration:${14+index%13}s;--snow-delay:-${(index*7.7)%27}s;--snow-drift:${-35+(index*19)%90}px;--snow-opacity:${.22+(index%5)*.09}`;
    layer.append(flake);
  }
  const sync=()=>{
    layer.dataset.paused=String(document.hidden);
  };
  document.addEventListener('visibilitychange',sync);
  sync();
  document.body.append(layer);
}
