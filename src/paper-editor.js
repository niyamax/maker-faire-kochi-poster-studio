import {CUTOUTS,paperPath} from './paper-shapes.js';

export function mountPaperEditor({state,onChange}){
  const choices=document.querySelector('#cutout-choices');
  const clear=document.querySelector('#clear-paper');
  const wrap=document.querySelector('#wrap-mode');
  const buttons=Object.entries(CUTOUTS).map(([id,shape])=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.cutout=id;
    button.innerHTML=`<svg viewBox="0 0 52 60" aria-hidden="true"><path d="${paperPath(id,52,60)}" fill-rule="evenodd"/></svg><span>${shape.name}</span>`;
    button.addEventListener('click',()=>{if(state.cutout!==id)onChange({cutout:id});});
    choices.append(button);
    return button;
  });
  clear?.addEventListener('click',()=>onChange({cutout:null}));
  wrap.addEventListener('change',()=>onChange({wrapMode:wrap.value}));
  return {sync(){
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.cutout===state.cutout));
    if(clear)clear.hidden=!state.cutout;
    wrap.closest('label').hidden=!state.cutout;
    wrap.value=state.wrapMode||'words';
  }};
}
