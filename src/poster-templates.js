export const POSTER_TEMPLATES=[
  {
    id:'robots-on-a-roll',name:'Robots on a Roll',headline:'ROBOTS\nON A ROLL',
    detail:'Build a rover. Put it to the test.',
    cutout:'wide-gate',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'maker-floor-rover',media:{zoom:1.06,focusY:1},
  },
  {
    id:'make-it-flap',name:'Make It Flap',headline:'MAKE IT\nFLAP',
    detail:'A motor and a crank give this bird its wings.',
    cutout:'wide-fold',palette:'maker',direction:'packed',
    lettering:{style:'original',pressure:.79,contrast:.10},
    image:'maker-motion-sculpture',media:{zoom:1.22,focusY:.45},
    story:{media:{zoom:1.12,focusY:.37}},
  },
  {
    id:'code-in-colour',name:'Code in Colour',headline:'CODE IN\nCOLOUR',
    detail:'Turn a grid of LEDs into a pixel display.',
    cutout:'wide-offset',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'maker-light-matrix',media:{zoom:1.1,focusY:1},
  },
  {
    id:'catch-the-wind',name:'Catch the Wind',headline:'CATCH\nTHE WIND',
    detail:'Bamboo, paper and a gust of wind.',
    cutout:'wide-gate',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'faire-handmade-kite',media:{zoom:1.08,focusY:1},
    story:{media:{zoom:1.12}},
  },
  {
    id:'will-it-float',name:'Will It Float?',headline:'WILL IT\nFLOAT?',
    detail:'Turn two used bottles into a boat.',
    cutout:'wide-fold',palette:'maker',direction:'packed',
    lettering:{style:'original',pressure:.79,contrast:.10},
    image:'faire-bottle-catamaran',media:{zoom:1.04,focusY:.12},
  },
  {
    id:'make-light',name:'Make Light',headline:'MAKE\nLIGHT',
    detail:'Fold a sheet of paper into a lantern.',
    cutout:'wide-offset',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.78,contrast:.12},
    image:'faire-paper-lantern',media:{zoom:1.10,focusY:1},
    story:{media:{focusX:.56}},
  },
  {
    id:'make-the-cut',name:'Make the Cut',headline:'MAKE\nTHE CUT',
    detail:'From raw footage to a finished story.',
    cutout:'wide-window',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.82,contrast:.08},
    image:'faire-editing-console',media:{focusX:.5},
  },
  {
    id:'frame-the-world',name:'Frame the World',headline:'FRAME\nTHE WORLD',
    detail:'Find a new angle. Make it a film.',
    cutout:'wide-fold',palette:'maker',direction:'packed',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'faire-cinema-camera',media:{focusX:.5},
  },
  {
    id:'sound-it-out',name:'Sound It Out',headline:'SOUND IT\nOUT',
    detail:'Experiment with sound, from a whisper to a roar.',
    cutout:'wide-gate',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'faire-megaphone',media:{focusX:.5},
  },
  {
    id:'volunteer-video-editors',name:'Volunteer Video Editors',headline:'EDIT\nWITH US',
    detail:'Video editors wanted.\nSign up to volunteer.',
    cutout:'wide-window',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.82,contrast:.08},
    image:'volunteer-editor-console',media:{focusY:.49},
  },
  {
    id:'volunteer-videographers',name:'Volunteer Videographers',headline:'FILM\nWITH US',
    detail:'Videographers wanted.\nSign up to volunteer.',
    cutout:'wide-fold',palette:'maker',direction:'packed',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'volunteer-video-camera',media:{focusY:.48},
  },
  {
    id:'volunteer-designers',name:'Volunteer Designers',headline:'DESIGN\nWITH US',
    detail:'Graphic designers wanted.\nSign up to volunteer.',
    cutout:'wide-offset',palette:'maker',direction:'packed',
    lettering:{style:'original',pressure:.82,contrast:.08},
    image:'volunteer-designer-tools',media:{focusY:.52},
  },
  {
    id:'volunteer-event-crew',name:'Volunteer Event Crew',headline:'EVENT\nCREW',
    detail:'Welcome visitors. Run activities.\nSign up to volunteer.',
    cutout:'wide-gate',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.8,contrast:.10},
    image:'volunteer-crew-megaphone',media:{focusY:.48},
  },
  {
    id:'make-some-noise',name:'Make Some Noise',headline:'MAKE SOME\nNOISE!',detail:'Robots, circuits & things that move.\nTry a hands-on build.',
    cutout:'gate',palette:'maker-red',direction:'air',
    lettering:{style:'original',pressure:.78,contrast:.15},
    image:'studio-robot',media:{reaction:0},
    story:{headline:'MAKE\nSOME\nNOISE!'},
  },
  {
    id:'take-it-apart',name:'Take It Apart',headline:'TAKE\nIT APART',detail:'Take a closer look.\nRepair, reuse, rebuild.',
    cutout:'step',palette:'maker',direction:'packed',
    lettering:{style:'original',pressure:.82,contrast:.14},
    image:'workshop',media:{zoom:1.16,focusX:.51,focusY:.47},
    story:{media:{zoom:1,focusX:.48,focusY:.47}},
  },
  {
    id:'threads-of-kochi',name:'Threads of Kochi',headline:'THREADS OF\nKOCHI',detail:'From coconut fibre to rope.\nExplore the craft of coir weaving.',
    cutout:'fold',palette:'maker',direction:'air',
    lettering:{style:'original',pressure:.74,contrast:.11},
    image:'coir',media:{focusX:.52,focusY:.48},
    story:{headline:'THREADS\nOF KOCHI',media:{focusX:.48,focusY:.48}},
  },
  {
    id:'pull-a-print',name:'Pull a Print',headline:'PULL A PRINT',detail:'Ink, screens and experiments on paper.\nExplore the process of screen printing.',
    cutout:'ticket',palette:'maker-red',direction:'packed',
    lettering:{style:'original',pressure:.81,contrast:.14},
    image:'print',media:{focusX:.51,focusY:.5},
  },
];

export function templateForFormat(template,format){
  const story=format==='story';
  const override=story?template.story:undefined;
  return {...template,...override,media:{...template.media,...override?.media},format:story?'story':'poster'};
}

export function mountPosterTemplates({samples,onTemplate}){
  const dialog=document.querySelector('#template-dialog');
  const open=document.querySelector('#open-templates');
  const status=document.querySelector('#template-status');
  const grid=document.querySelector('#template-grid');
  const format=document.querySelector('#template-format');
  let busy=false;
  const close=document.querySelector('#close-templates');
  const buttons=POSTER_TEMPLATES.map(template=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='template-card';
    button.innerHTML=`<img alt="" loading="lazy"><span>${template.name}</span>`;
    button.dataset.template=template.id;
    button.addEventListener('click',async()=>{
      if(busy)return;
      busy=true;
      format.disabled=true;
      for(const card of buttons)card.disabled=true;
      status.hidden=false;
      status.textContent='Opening poster…';
      try{
        await onTemplate({...templateForFormat(template,format.value),sample:samples[template.image]});
        dialog.close();
      }catch(error){
        status.textContent=error.message;
      }finally{
        busy=false;
        format.disabled=false;
        for(const card of buttons)card.disabled=false;
      }
    });
    grid.append(button);
    return button;
  });
  function syncPreviews(){
    const story=format.value==='story';
    for(const button of buttons){
      const preview=button.querySelector('img');
      preview.width=story?432:480;
      preview.height=story?768:600;
      preview.src=`assets/templates/${button.dataset.template}${story?'-story':''}.jpg`;
    }
  }
  format.addEventListener('change',syncPreviews);
  open.addEventListener('click',()=>{
    syncPreviews();
    status.hidden=true;
    status.textContent='';
    dialog.showModal();
  });
  close.addEventListener('click',()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
}
