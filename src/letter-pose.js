import {displaceLetters,hasLetterEdits} from './letter-drag.js';

const cache=new Map();
const copyCell=cell=>({...cell,response:cell.response?{...cell.response}:undefined,craft:cell.craft?{...cell.craft}:undefined});

/** The key deliberately excludes animation phase. Manual edits and neighbour
 * clearance resolve against one authored pose, shared by playback and export.
 * Old saved offsets still use their original unrefined reference geometry.
 */
export function stableLetterPose(key,createReference,createLegacy,offsets,bounds,{byRow=false}={}){
  if(cache.has(key))return cache.get(key);
  const reference=createReference(),referenceCells=reference.cells.map(copyCell),hasEdits=hasLetterEdits(offsets);
  let restCells=referenceCells;
  if(hasEdits){
    const needsLegacy=offsets.some(entry=>hasLetterEdits([entry])&&entry.basis!=='rest');
    const legacy=needsLegacy?createLegacy():null;
    const legacyCells=new Map((legacy?.unrefinedCells||legacy?.cells||[]).map(cell=>[cell.index,cell]));
    const placed=referenceCells.map(cell=>{
      const edit=offsets[cell.index];
      return hasLetterEdits([edit])&&edit.basis!=='rest'?{...(legacyCells.get(cell.index)||cell),response:cell.response,craft:cell.craft}:cell;
    });
    if(byRow){
      const rows=[...new Set(placed.map(cell=>cell.row))];
      restCells=rows.flatMap(row=>displaceLetters(placed.filter(cell=>cell.row===row),offsets,bounds)).sort((a,b)=>a.index-b.index);
    }else restCells=displaceLetters(placed,offsets,bounds);
  }
  const value={hasEdits,referenceCells,restCells:restCells.map(copyCell)};
  if(cache.size>=12)cache.delete(cache.keys().next().value);
  cache.set(key,value);return value;
}
