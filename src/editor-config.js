/**
 * The poster workspace's curated choices. These lists control the interface,
 * not the saved-project schema: a valid older choice must survive a redesign.
 * Keep the full catalogues and the existing scene validators as the source of
 * truth for loading, rendering and export.
 */
export const VISIBLE_DIRECTION_IDS=Object.freeze(['air','flex','packed']);
export const VISIBLE_FONT_IDS=Object.freeze(['original']);
export const VISIBLE_LAYOUT_IDS=Object.freeze(['stack','centered','offset']);
export const VISIBLE_STYLE_IDS=Object.freeze(['original','jostle']);
export const VISIBLE_PALETTE_IDS=Object.freeze(['maker-red','maker','maker-cyan','noise']);
export const VISIBLE_FORMAT_IDS=Object.freeze(['poster','story','square','banner']);

export const EDITOR_PRESETS=Object.freeze([
  Object.freeze({id:'air',label:'Air',description:'Inflated letters that share space.'}),
  Object.freeze({id:'flex',label:'Flex',description:'Open strokes and elastic proportions.'}),
  Object.freeze({id:'packed',label:'Packed',description:'Dense, playful poster lettering.'}),
]);

export const EDITOR_PALETTE_LABELS=Object.freeze({
  'maker-red':'Maker red',
  maker:'Maker white',
  'maker-cyan':'Maker cyan',
  noise:'Yellow / blue',
});

/**
 * Preserve the familiar 0–100 controls and every valid current value. Character
 * is already softened in the geometry code; an arbitrary new slider cap would
 * overwrite the user's saved design without fixing the underlying outline.
 */
export const TYPE_CONTROL_RANGES=Object.freeze({
  contrast:Object.freeze({min:0,max:100,step:1,label:'Contrast'}),
  pressure:Object.freeze({min:0,max:100,step:1,label:'Inflation'}),
  variation:Object.freeze({min:0,max:100,step:1,label:'Character'}),
});

/**
 * A short menu should not silently replace a font, layout, palette or style
 * already in a saved poster. Append the valid current item when it falls
 * outside the curated set. Catalog objects and their IDs remain untouched.
 */
export function retainCurrentOption(catalog,visibleIds,currentId){
  const byId=new Map(catalog.map(item=>[item.id,item]));
  const choices=visibleIds.flatMap(id=>byId.has(id)?[byId.get(id)]:[]);
  if(currentId&&!visibleIds.includes(currentId)&&byId.has(currentId)){
    const current=byId.get(currentId);
    const text=current.name??current.label??current.id;
    choices.push({...current,name:current.name?`${text} · current`:current.name,label:current.label?`${text} · current`:current.label,preserved:true});
  }
  return choices;
}

/** UI guardrails. Geometry modules retain their own authoritative limits. */
export const EDITOR_BEHAVIOUR=Object.freeze({
  snapByDefault:true,
  snapBypassKey:'Alt',
  scaleLogoUniformly:true,
  supportingTextAlignments:['left','center','right'],
  supportingTextFont:'Inter',
  supportingTextLines:2,
  letterBodyAction:'move',
  letterHandleAction:'reshape',
});
