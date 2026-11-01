export const INTRO_TURN_DEGREES=12;
// Es deliberadamente más lenta que las transiciones de UI: comunica que el
// visor ya está listo sin sentirse como una interacción que deba perseguirse.
export const INTRO_TURN_DURATION=900;

export function introTurnAngle(elapsed,duration=INTRO_TURN_DURATION,degrees=INTRO_TURN_DEGREES){
 const progress=Math.max(0,Math.min(1,elapsed/duration));
 const eased=progress<.5?4*progress*progress*progress:1-Math.pow(-2*progress+2,3)/2;
 return Math.sin(eased*Math.PI)*degrees*Math.PI/180;
}

export function createIntroTurn({turn,now=()=>performance.now(),request=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id),duration=INTRO_TURN_DURATION,degrees=INTRO_TURN_DEGREES,reducedMotion=()=>false}={}){
 let frame=null,start=null,active=false,cancelled=false;
 const stop=(restore=false)=>{if(frame!==null)cancel(frame);frame=null;active=false;cancelled=true;if(restore)turn(0)};
 const tick=timestamp=>{
  frame=null;if(!active||cancelled)return;
  const elapsed=timestamp-start;
  turn(introTurnAngle(elapsed,duration,degrees));
  if(elapsed<duration){frame=request(tick);return}
  active=false;turn(0);
 };
 return {
  start(){if(active||cancelled||reducedMotion())return false;active=true;cancelled=false;start=now();turn(0);frame=request(tick);return true},
  cancel(){stop(false)},
  reset(){stop(true);cancelled=false},
  get active(){return active},
 };
}
