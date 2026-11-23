import {layoutTreatment, appendTreatmentArtwork} from '../../../src/treatment.js';
import {FLOW_CURVE, FLOW_SECONDS} from '../../../src/flow-motion.js';

const lettering = {style:'original', pressure:.82, contrast:.14};

function shape(words, box, phase, energy, treatment) {
  const layout = layoutTreatment(words, box, treatment, phase, energy, lettering, FLOW_CURVE);
  const scene = {width:1080,height:1920,ops:[]};
  appendTreatmentArtwork(scene, layout, {fg:'#fff', bg:'#ed1c24'}, box);
  return {layout, ops:scene.ops};
}

export function outline(words, box, seconds, energy) {
  const phase = seconds * (2 / 3) / FLOW_SECONDS;
  const {ops} = shape(words, box, phase, energy, 'packed');
  return ops.map(op => ({geometry:new Path2D(op.d),matrix:op.matrix}));
}

// Match the 30 fps Flow poses used by the reference reel.
export function prepareType(words, box, energy, fps, treatment = 'packed') {
  const shapes = [];
  const frames = [];
  const count = energy ? FLOW_SECONDS * fps : 1;
  for (let frame = 0; frame < count; frame++) {
    const {layout, ops} = shape(words, box, frame / (FLOW_SECONDS * fps), energy, treatment);
    if (frame === 0) {
      for (const op of ops) shapes.push({path:op.d, row:layout.cells[op.letterIndex].row});
    }
    if (ops.length !== shapes.length || ops.some((op, i) => op.d !== shapes[i].path)) {
      throw new Error('Flow glyph geometry changed during reel preparation');
    }
    frames.push(ops.map(op => op.matrix.map(value => +value.toFixed(4))));
  }
  return {shapes,frames};
}
