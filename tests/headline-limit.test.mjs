import test from 'node:test';
import assert from 'node:assert/strict';
import {HEADLINE_MAX_LENGTH} from '../src/content-limits.js';
import {cleanHeadline,createPosterScene,posterSVG} from '../src/scene.js';
import {normalizeLetterOffsets} from '../src/letter-drag.js';
import {STUDIO_DEFAULTS,defaultStudioDrafts,studioProject,normalizeStudioProject,switchStudioTreatment} from '../src/project-state.js';

test('headlines retain long lines and explicit line breaks up to the shared total limit',()=>{
  const headline='A CELEBRATION OF CURIOSITY\nMAKERS AND INVENTORS\nBUILD SOMETHING TOGETHER\nIN KOCHI\nBRING YOUR IDEAS';
  assert.equal(cleanHeadline(headline.toLowerCase()),headline);
  assert.equal(cleanHeadline('A'.repeat(HEADLINE_MAX_LENGTH+20)),'A'.repeat(HEADLINE_MAX_LENGTH));
  assert.equal(cleanHeadline('MAKER\r\nFAIRE'),'MAKER\nFAIRE');
});

test('long headlines and the final letter’s placement survive switching, saving and export',()=>{
  const state={...STUDIO_DEFAULTS,format:'banner'},drafts=defaultStudioDrafts();
  drafts.air.headline='MAKER'.repeat(24);
  drafts.air.offsets=Array(HEADLINE_MAX_LENGTH).fill(null);
  drafts.air.offsets[119]={x:-.01,y:.01,w:.9,h:.95};
  assert.equal(normalizeLetterOffsets(drafts.air.offsets).length,HEADLINE_MAX_LENGTH);
  switchStudioTreatment(state,drafts,'flex');
  const project=normalizeStudioProject(JSON.parse(JSON.stringify(studioProject(state,drafts))));
  assert.equal(project.drafts.flex.headline,drafts.air.headline);
  assert.deepEqual(project.drafts.flex.offsets[119],drafts.air.offsets[119]);
  const scene=createPosterScene({...project.state,...project.drafts.flex});
  assert.equal(scene.cells.length,120);
  assert.ok(!/NaN|Infinity|undefined/.test(posterSVG(scene)));
});

test('full-length headlines render safely as a single line or many rows in every treatment and format',()=>{
  for(const headline of ['A'.repeat(120),Array(60).fill('A').join('\n')])for(const direction of ['air','flex','packed'])for(const format of ['banner','poster','story','square']){
    const scene=createPosterScene({direction,format,headline,phase:.37});
    assert.equal(scene.cells.length,headline.replace(/\s/g,'').length);
    const b=scene.regions.type;
    for(const c of scene.cells)assert.ok([c.x,c.y,c.w,c.h].every(Number.isFinite)&&c.w>0&&c.h>0&&c.x>=b.x-.001&&c.y>=b.y-.001&&c.x+c.w<=b.x+b.w+.001&&c.y+c.h<=b.y+b.h+.001);
    assert.ok(!/NaN|Infinity|undefined/.test(posterSVG(scene)));
  }
});
