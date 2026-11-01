import {LOGO_ARTWORK} from './data/logo.js';

export const DEFAULT_LOGO_VARIANT='long-colour';
export const LOGO_LAYOUTS=Object.freeze([
  {id:'long',label:'Long'},
  {id:'border',label:'Bordered'},
  {id:'square',label:'Square'},
]);
export const LOGO_COLOURS=Object.freeze([
  {id:'colour',label:'Original'},
  {id:'black',label:'Black'},
  {id:'white',label:'White'},
]);
export const LOGO_VARIANTS=Object.freeze(LOGO_LAYOUTS.flatMap(layout=>LOGO_COLOURS.map(colour=>{
  const id=`${layout.id}-${colour.id}`,artwork=LOGO_ARTWORK[id];
  return Object.freeze({id,layout:layout.id,colour:colour.id,width:artwork.width,height:artwork.height,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artwork.svg)});
})));
const byId=new Map(LOGO_VARIANTS.map(variant=>[variant.id,variant]));
export const getLogoVariant=id=>byId.get(id)||byId.get(DEFAULT_LOGO_VARIANT);
