// Type lanes are inscribed rectangles in the paper. They keep glyphs clear
// of the bevels and windows even when the lettering is in motion.
export const CUTOUTS = {
  step: {
    name: 'Step',
    outline: [[.28,.08],[.68,.08],[.81,.15],[.81,.32],[.92,.32],[.95,.37],[.95,.89],[.76,.89],[.69,.94],[.48,.94],[.48,.82],[.13,.82],[.07,.77],[.07,.29],[.28,.29]],
    window: [[.23,.53],[.90,.53],[.90,.79],[.23,.79]],
    lanes: [[.31,.155,.76,.275],[.11,.337,.907,.501]],
    copy: [.525,.834,.27],
    brand: [.748,.835,.171],
    mark: [.844,.812],
  },
  window: {
    name: 'Window',
    outline: [[.09,.10],[.85,.10],[.94,.17],[.94,.90],[.18,.90],[.09,.83]],
    window: [[.15,.345],[.88,.345],[.88,.637],[.15,.637]],
    lanes: [[.145,.148,.865,.307],[.145,.665,.87,.806]],
    copy: [.16,.823,.57],
    brand: [.671,.83,.213],
    mark: [.824,.825],
  },
  ribbon: {
    name: 'Ribbon',
    imageArea: {x:.38,y:.26,w:.52,h:.50},
    outline: [[.07,.10],[.81,.10],[.90,.17],[.90,.32],[.39,.32],[.39,.385],[.95,.385],[.95,.59],[.59,.59],[.59,.662],[.85,.662],[.94,.735],[.94,.91],[.30,.91],[.20,.835],[.20,.652],[.49,.652],[.49,.59],[.19,.59],[.10,.52],[.10,.375],[.29,.375],[.29,.32],[.07,.32]],
    lanes: [[.11,.142,.851,.281],[.15,.421,.906,.549],[.25,.704,.875,.821]],
    copy: [.29,.848,.48],
    brand: [.682,.851,.21],
    mark: [.82,.85],
  },
  split: {
    name: 'Split',
    imageArea: {x:.08,y:.36,w:.84,h:.38},
    outline: [[.07,.102],[.76,.102],[.86,.183],[.86,.401],[.22,.401],[.07,.315]],
    island: [[.18,.48],[.95,.48],[.95,.906],[.32,.906],[.18,.825]],
    lanes: [[.154,.163,.801,.349],[.23,.528,.904,.771]],
    copy: [.315,.807,.44],
    brand: [.684,.819,.216],
    mark: [.83,.816],
  },
  gate: {
    name: 'Gate',
    outline: [[.065,.08],[.82,.08],[.94,.175],[.94,.91],[.065,.91]],
    window: [[.27,.40],[.88,.40],[.88,.785],[.27,.785]],
    lanes: [[.115,.125,.81,.225],[.115,.242,.89,.373]],
    copy: [.107,.817,.51],
    brand: [.662,.822,.227],
    mark: [.685,.813],
  },
  ticket: {
    name: 'Ticket',
    outline: [[.065,.12],[.935,.12],[.935,.36],[.875,.40],[.875,.54],[.935,.58],[.935,.88],[.065,.88],[.065,.58],[.125,.54],[.125,.40],[.065,.36]],
    window: [[.17,.365],[.83,.365],[.83,.682],[.17,.682]],
    lanes: [[.105,.167,.894,.33],[.105,.712,.895,.781]],
    copy: [.105,.795,.53],
    brand: [.665,.797,.224],
    mark: [.68,.793],
  },
  fold: {
    name: 'Fold',
    outline: [[.065,.095],[.80,.095],[.935,.20],[.935,.85],[.84,.935],[.14,.935],[.065,.86]],
    window: [[.10,.40],[.695,.40],[.89,.555],[.89,.768],[.10,.768]],
    lanes: [[.106,.147,.783,.249],[.106,.26,.897,.37]],
    copy: [.145,.817,.5],
    brand: [.665,.82,.224],
    mark: [.68,.814],
  },
  offset: {
    name: 'Offset',
    outline: [[.16,.07],[.945,.07],[.945,.40],[.84,.40],[.84,.84],[.74,.93],[.055,.93],[.055,.34],[.16,.34]],
    window: [[.105,.425],[.782,.425],[.782,.744],[.105,.744]],
    lanes: [[.207,.117,.901,.226],[.207,.24,.90,.377]],
    copy: [.105,.79,.48],
    brand: [.565,.801,.218],
    mark: [.565,.789],
  },
  'wide-window': {
    name: 'Wide Window',
    outline: [[.065,.105],[.79,.105],[.925,.20],[.925,.89],[.17,.89],[.065,.824]],
    window: [[.095,.376],[.905,.376],[.905,.792],[.095,.792]],
    lanes: [[.115,.142,.78,.238],[.115,.25,.88,.35]],
    copy: [.162,.819,.48],
    brand: [.665,.817,.219],
    mark: [.83,.814],
  },
  'wide-fold': {
    name: 'Wide Fold',
    outline: [[.06,.112],[.84,.112],[.947,.20],[.947,.851],[.85,.924],[.065,.924]],
    window: [[.087,.38],[.754,.38],[.928,.486],[.928,.814],[.087,.814]],
    lanes: [[.102,.14,.80,.241],[.102,.25,.90,.357]],
    copy: [.112,.843,.5],
    brand: [.66,.841,.224],
    mark: [.83,.835],
  },
  'wide-offset': {
    name: 'Wide Offset',
    outline: [[.18,.08],[.94,.08],[.94,.347],[.885,.347],[.885,.866],[.79,.926],[.055,.926],[.055,.292],[.18,.292]],
    window: [[.078,.384],[.866,.384],[.866,.811],[.078,.811]],
    lanes: [[.215,.118,.902,.23],[.215,.242,.902,.342]],
    copy: [.112,.834,.46],
    brand: [.585,.835,.22],
    mark: [.74,.83],
  },
  'wide-gate': {
    name: 'Wide Gate',
    outline: [[.07,.128],[.29,.128],[.29,.073],[.78,.073],[.94,.165],[.94,.92],[.36,.92],[.36,.88],[.07,.88]],
    window: [[.102,.374],[.92,.374],[.92,.818],[.102,.818]],
    lanes: [[.12,.152,.84,.245],[.12,.251,.90,.353]],
    copy: [.106,.843,.53],
    brand: [.669,.855,.226],
    mark: [.828,.844],
  },
};

export const DEFAULT_CUTOUT = 'step';
export const cutoutId = id => Object.hasOwn(CUTOUTS,id) ? id : DEFAULT_CUTOUT;
export const polygonPath = (points, width, height) => points
  .map(([x,y],i) => `${i?'L':'M'}${+(x*width).toFixed(3)} ${+(y*height).toFixed(3)}`).join('')+'Z';

export function paperPath(cutout,width,height){
  const shape=CUTOUTS[cutoutId(cutout)];
  return [shape.outline,shape.window,shape.island].filter(Boolean).map(points=>polygonPath(points,width,height)).join('');
}

export function paperLanes(cutout,width,height){
  return CUTOUTS[cutoutId(cutout)].lanes.map(([left,top,right,bottom])=>({
    x:left*width,y:top*height,w:(right-left)*width,h:(bottom-top)*height,
  }));
}

export function paperSpanAt(outline,y){
  const edges=[];
  for(const [[x1,y1],[x2,y2]] of outline.map((point,index)=>[point,outline[(index+1)%outline.length]])){
    if(y1===y2||y<Math.min(y1,y2)||y>Math.max(y1,y2))continue;
    edges.push(x1+(x2-x1)*(y-y1)/(y2-y1));
  }
  return {left:Math.min(...edges),right:Math.max(...edges)};
}


// Object images sit in the photo opening. Open silhouettes use the space
// between their paper bands for a foreground object.
export function paperImageArea(shape){
  if(shape.imageArea)return shape.imageArea;
  const [left,top]=shape.window[0];
  const right=Math.max(...shape.window.map(([x])=>x));
  const bottom=Math.max(...shape.window.map(([,y])=>y));
  return {x:left,y:top,w:right-left,h:bottom-top};
}
