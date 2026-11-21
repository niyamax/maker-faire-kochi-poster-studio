import './styles/studio.css';
import {mountPaperEditor} from './paper-editor.js';
import {mountPosterTemplates} from './poster-templates.js';
import {VISIBLE_FONT_IDS,VISIBLE_PALETTE_IDS} from './editor-config.js';
import {PAPER_CUTOUTS_ENABLED,STANDARD_POSTER_SAMPLES} from './studio-features.js';
import {MAKER_FOOTER_DEFAULTS} from './footer-layout.js';
export {treatmentSettings as letteringDefaults} from './treatment.js';
export * from './project-state.js';
export * from './scene.js';

const samples=Object.fromEntries(STANDARD_POSTER_SAMPLES.map(([id,layout])=>[id,{path:`assets/samples/${id}.png`,name:`${id}-sample.png`,type:'image/png',layout}]));

if(PAPER_CUTOUTS_ENABLED)Object.assign(samples,{
  coir:{path:'assets/samples/coir.jpg',name:'Coir weaving.jpg',type:'image/jpeg',layout:'window'},
  print:{path:'assets/samples/print.jpg',name:'Screen printing.jpg',type:'image/jpeg',layout:'window'},
  'cardboard-automaton':{path:'assets/samples/cardboard-automaton.jpg',name:'Cardboard automaton.jpg',type:'image/jpeg',layout:'window'},
  'drawing-robot':{path:'assets/samples/drawing-robot.jpg',name:'Drawing robot.jpg',type:'image/jpeg',layout:'window'},
  'woven-lamp':{path:'assets/samples/woven-lamp.jpg',name:'Woven lamp.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-video-editor':{path:'assets/samples/volunteer-video-editor.jpg',name:'Volunteer video editor.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-videographer':{path:'assets/samples/volunteer-videographer.jpg',name:'Volunteer videographer.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-designer':{path:'assets/samples/volunteer-designer.jpg',name:'Volunteer designer.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-event-crew':{path:'assets/samples/volunteer-event-crew.jpg',name:'Volunteer event crew.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-video-editor-window':{path:'assets/samples/volunteer-video-editor-window.jpg',name:'Video editor wide framing.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-videographer-window':{path:'assets/samples/volunteer-videographer-window.jpg',name:'Videographer wide framing.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-designer-window':{path:'assets/samples/volunteer-designer-window.jpg',name:'Designer wide framing.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-event-crew-window':{path:'assets/samples/volunteer-event-crew-window.jpg',name:'Event crew wide framing.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-editor-console':{path:'assets/samples/volunteer-editor-console.jpg',name:'Editing console.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-video-camera':{path:'assets/samples/volunteer-video-camera.jpg',name:'Video camera.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-designer-tools':{path:'assets/samples/volunteer-designer-tools.jpg',name:'Designer tools.jpg',type:'image/jpeg',layout:'window'},
  'volunteer-crew-megaphone':{path:'assets/samples/volunteer-crew-megaphone.jpg',name:'Crew megaphone.jpg',type:'image/jpeg',layout:'window'},
  'faire-editing-console':{path:'assets/samples/faire-editing-console.jpg',name:'Editing console outdoors.jpg',type:'image/jpeg',layout:'window'},
  'faire-cinema-camera':{path:'assets/samples/faire-cinema-camera.jpg',name:'Cinema camera outdoors.jpg',type:'image/jpeg',layout:'window'},
  'faire-megaphone':{path:'assets/samples/faire-megaphone.jpg',name:'Megaphone outdoors.jpg',type:'image/jpeg',layout:'window'},
  'faire-handmade-kite':{path:'assets/samples/faire-handmade-kite.jpg',name:'Handmade kite.jpg',type:'image/jpeg',layout:'window'},
  'faire-bottle-catamaran':{path:'assets/samples/faire-bottle-catamaran.jpg',name:'Bottle catamaran.jpg',type:'image/jpeg',layout:'window'},
  'faire-paper-lantern':{path:'assets/samples/faire-paper-lantern.jpg',name:'Paper lantern.jpg',type:'image/jpeg',layout:'window'},
  'maker-floor-rover':{path:'assets/samples/maker-floor-rover.jpg',name:'Obstacle-course rover.jpg',type:'image/jpeg',layout:'window'},
  'maker-motion-sculpture':{path:'assets/samples/maker-motion-sculpture.jpg',name:'Mechanical bird.jpg',type:'image/jpeg',layout:'window'},
  'maker-light-matrix':{path:'assets/samples/maker-light-matrix.jpg',name:'LED pixel display.jpg',type:'image/jpeg',layout:'window'},
});

export const edition={
  title:'Poster Studio',
  headlineHint:'Press Enter for a new line. Add spaces to control gaps and indentation.',
  mount(options){
    if(!PAPER_CUTOUTS_ENABLED)return null;
    const paper=mountPaperEditor(options);
    mountPosterTemplates({...options,samples});
    return paper;
  },
  slug:'maker-faire-kochi',
  initialLayer:'letters',
  fixedFont:'original',
  fontIds:VISIBLE_FONT_IDS,
  paletteIds:VISIBLE_PALETTE_IDS,
  footerLabels:{text:'Supporting text',logo:'Logo'},
  footerDefaults:MAKER_FOOTER_DEFAULTS,
  backgroundLabel:'Paper',
  samples,
  defaultSample:samples['studio-robot'],
};
