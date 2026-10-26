const TAU=Math.PI*2;
export const POSTER_LOOP_SECONDS=20;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const unitPhase=value=>Number.isFinite(value)?((value%1)+1)%1:0;
const amount=value=>Number.isFinite(value)?clamp(value,0,1.5):1;

/**
 * Every curve advances throughout the loop. These are periodic speed profiles,
 * rather than entrance/exit easing, so the last frame never decelerates to rest.
 */
export const LOOP_CURVES=Object.freeze([
  Object.freeze({id:'smooth',label:'Smooth'}),
  Object.freeze({id:'steady',label:'Steady'}),
  Object.freeze({id:'punchy',label:'Punchy'}),
  Object.freeze({id:'elastic',label:'Elastic'}),
]);
export const LOOP_CURVE_IDS=Object.freeze(LOOP_CURVES.map(curve=>curve.id));

const PROFILES=Object.freeze({
  smooth:{warp:[.12,-.045,0],harmonics:[.11,0]},
  steady:{warp:[0,0,0],harmonics:[0,0]},
  punchy:{warp:[.45,.12,0],harmonics:[.17,0]},
  elastic:{warp:[.09,-.16,.09],harmonics:[.12,.13]},
});

function timing(phase,curve){
  const id=Object.hasOwn(PROFILES,curve)?curve:'smooth';
  const profile=PROFILES[id],p=unitPhase(phase),theta=p*TAU;
  // 1 - |a| - 2|b| - 3|c| stays positive for every profile. The
  // unwrapped phase therefore moves forward continuously with no quiet hold.
  const [a,b,c]=profile.warp;
  return {id,p,theta:theta+a*Math.sin(theta)+b*Math.sin(theta*2)+c*Math.sin(theta*3),profile};
}

/**
 * Subtract the initial value to keep the authored pose at phase zero. Integer
 * harmonics make both values and derivatives repeat at the 0/1 seam. Dividing
 * each sine difference by two keeps the result within -1…1 for all curves.
 */
function wave(theta,offset,profile){
  const [second,third]=profile.harmonics;
  return (
    (1-second-third)*(Math.sin(theta+offset)-Math.sin(offset))+
    second*(Math.sin(theta*2+offset*.67+.4)-Math.sin(offset*.67+.4))+
    third*(Math.sin(theta*3-offset*.43+.9)-Math.sin(-offset*.43+.9))
  )*.5;
}

/**
 * Local proportions shared by layout, Canvas and SVG. Neighbours respond at
 * once with differing phases; no letter is assigned a scheduled turn.
 */
export function continuousLetterResponse(phase,{row=0,col=0}={},energy=1,curve='smooth'){
  const strength=amount(energy);
  if(strength===0)return {width:1,height:1,x:0,y:0,angle:0,bend:0,activity:0};
  const {theta,profile}=timing(phase,curve);
  const offset=(Number.isFinite(col)?col:0)*1.23+(Number.isFinite(row)?row:0)*1.71;
  const strain=wave(theta,offset,profile)*strength;
  return {
    width:1+strain*.19,
    height:1-strain*.065,
    x:wave(theta,offset*.81+.35,profile)*strength*.012,
    y:wave(theta,offset+1.2,profile)*strength*.025,
    angle:wave(theta,offset*.73+.55,profile)*strength*.034,
    bend:wave(theta,offset*.86+.9,profile)*strength*.035,
    activity:strength,
  };
}

export function continuousCompositionFrame(phase,energy=1,curve='smooth'){
  const strength=amount(energy),{id,p,theta,profile}=timing(phase,curve);
  return {
    focus:{rowFraction:0,colFraction:0,amount:0},
    spreadOffset:strength?wave(theta,.7,profile)*strength*.012:0,
    pressureOffset:strength?wave(theta,-.85,profile)*strength*.018:0,
    rowBias:[0,1,2,3].map(row=>1+wave(theta,row*1.9,profile)*strength*.025),
    activity:strength,
    gesture:{kind:'continuous',phase:p,strength,curve:id},
  };
}

/** A row has one pressure source. Its nearest neighbours answer the same
 * signal with a small phase lag, while distant letters stay quiet. */
export function connectedRowResponses(phase,cells,heroIndex,energy=1,curve='smooth',material=1){
  const strength=amount(energy)*material,{theta,profile}=timing(phase,curve);
  const offset=(cells[0]?.row||0)*1.73+.35;
  const lead=wave(theta,offset,profile)*strength;
  const follow=wave(theta,offset-.18,profile)*strength;
  return cells.map((cell,index)=>{
    const distance=Math.abs(index-heroIndex),hero=distance===0,near=Math.exp(-Math.max(0,distance-1)*1.3);
    const ambient=wave(theta,offset+index*.32+.7,profile)*strength*.002;
    return {
      width:1+(hero?lead*.38:-follow*.08*near),
      height:1+(hero?-lead*.055:follow*.012*near),
      x:0,
      y:hero?-lead*.008:follow*.005*near+ambient,
      angle:hero?lead*.022:-follow*.008*near,
      bend:hero?lead*.022:follow*.006*near,
      activity:strength,
    };
  });
}
