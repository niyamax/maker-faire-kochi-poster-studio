import test from 'node:test';
import assert from 'node:assert/strict';
import {LOOP_CURVES,continuousCompositionFrame,continuousLetterResponse} from '../src/loop-motion.js';

const cells=Array.from({length:18},(_,index)=>({row:Math.floor(index/6),col:index%6}));
const responseKeys=['width','height','x','y','angle','bend'];
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);
const vector=frame=>[frame.spreadOffset,frame.pressureOffset,...frame.rowBias];
const speed=(phase,cell,curve)=>{
  const epsilon=1e-5,a=continuousLetterResponse(phase-epsilon,cell,1,curve),b=continuousLetterResponse(phase+epsilon,cell,1,curve);
  return Math.hypot(...responseKeys.map(key=>(b[key]-a[key])/(epsilon*2)));
};

test('every motion curve repeats the exact authored pose at the loop seam',()=>{
  for(const {id} of LOOP_CURVES){
    assert.deepEqual(continuousCompositionFrame(0,1,id),continuousCompositionFrame(1,1,id));
    for(const cell of cells){
      const start=continuousLetterResponse(0,cell,1,id);
      assert.deepEqual(start,continuousLetterResponse(1,cell,1,id));
      assert.deepEqual(start,{width:1,height:1,x:0,y:0,angle:0,bend:0,activity:1});
    }
  }
});

test('letter and composition velocities match across the seam without stopping',()=>{
  const epsilon=1e-6;
  for(const {id} of LOOP_CURVES){
    for(const cell of cells){
      const rest=continuousLetterResponse(0,cell,1,id),left=continuousLetterResponse(1-epsilon,cell,1,id),right=continuousLetterResponse(epsilon,cell,1,id);
      for(const key of responseKeys)near((rest[key]-left[key])/epsilon,(right[key]-rest[key])/epsilon,5e-5);
      assert.ok(speed(0,cell,id)>.025,`${id}: each letter crosses the seam in motion`);
      for(const phase of [.96,.98,1,1.02,1.04])assert.ok(speed(phase,cell,id)>.018,`${id}: no endpoint quiet interval`);
    }
    const rest=vector(continuousCompositionFrame(0,1,id)),left=vector(continuousCompositionFrame(1-epsilon,1,id)),right=vector(continuousCompositionFrame(epsilon,1,id));
    rest.forEach((value,index)=>near((value-left[index])/epsilon,(right[index]-value)/epsilon,5e-5));
  }
});

test('continuous motion is bounded and responds independently throughout the loop',()=>{
  for(const {id} of LOOP_CURVES){
    for(let step=0;step<=200;step++){
      const phase=step/200,frame=continuousCompositionFrame(phase,1.5,id);
      assert.ok(Math.abs(frame.spreadOffset)<=.018000001);
      assert.ok(Math.abs(frame.pressureOffset)<=.027000001);
      assert.ok(frame.rowBias.every(value=>value>=.9625&&value<=1.0375));
      for(const cell of cells){
        const value=continuousLetterResponse(phase,cell,1.5,id);
        assert.ok(value.width>=.715&&value.width<=1.285);
        assert.ok(value.height>=.9025&&value.height<=1.0975);
        assert.ok(Math.abs(value.x)<=.018000001&&Math.abs(value.y)<=.037500001);
        assert.ok(Math.abs(value.angle)<=.051000001&&Math.abs(value.bend)<=.052500001);
        assert.equal(value.activity,1.5);
      }
    }
    for(const phase of [.12,.36,.68,.92]){
      const values=cells.map(cell=>continuousLetterResponse(phase,cell,1,id));
      assert.ok(values.filter(value=>Math.abs(value.width-1)>.01).length>=10,'many letters reshape together');
      assert.ok(new Set(values.map(value=>value.width.toFixed(4))).size>=15,'letter responses differ');
      assert.ok(values.some(value=>value.width>1)&&values.some(value=>value.width<1),'letters give and take space');
    }
  }
});

test('the four curves have distinct timing and all retain an exact zero-energy rest',()=>{
  const samples=LOOP_CURVES.map(({id})=>[.13,.29,.47,.71,.89].flatMap(phase=>responseKeys.map(key=>continuousLetterResponse(phase,cells[4],1,id)[key])));
  for(let a=0;a<samples.length;a++)for(let b=a+1;b<samples.length;b++)assert.ok(Math.hypot(...samples[a].map((value,index)=>value-samples[b][index]))>.02);
  for(const {id} of LOOP_CURVES)for(const phase of [0,.12,.5,.91,1]){
    assert.deepEqual(continuousLetterResponse(phase,cells[0],0,id),{width:1,height:1,x:0,y:0,angle:0,bend:0,activity:0});
    const frame=continuousCompositionFrame(phase,0,id);
    assert.equal(frame.spreadOffset,0);assert.equal(frame.pressureOffset,0);assert.ok(frame.rowBias.every(value=>value===1));
  }
});

test('invalid curve and phase values use safe continuous defaults',()=>{
  assert.deepEqual(continuousLetterResponse(.24,cells[2],1,'unknown'),continuousLetterResponse(.24,cells[2],1,'smooth'));
  assert.deepEqual(continuousLetterResponse(NaN,cells[2]),continuousLetterResponse(0,cells[2]));
  assert.deepEqual(continuousLetterResponse(.2,cells[2],100),continuousLetterResponse(.2,cells[2],1.5));
  for(const phase of [-1.2,.2,2.2]){
    const a=continuousLetterResponse(phase,cells[2]),b=continuousLetterResponse(phase+1,cells[2]);
    responseKeys.forEach(key=>near(a[key],b[key]));
  }
});
