import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {build} from 'esbuild';
import {addText} from '../../src/scene-renderer.js';
import {prepareType} from './awareness/studio-type.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reel = fileURLToPath(new URL('./awareness/', import.meta.url));
const {values} = parseArgs({options:{out:{type:'string'}}});
const output = resolve(values.out ?? resolve(root,'output/reels/what-is-a-maker-faire.html'));
const fps = 30;

function dateDetails() {
  const scene = {ops:[]};
  const lines = [
    {text:'The Grounds @ Chakola Mill', y:1260, size:48},
    {text:'makerfaire.in', y:1335, size:48},
    {text:'Free entry', y:1410, size:43},
  ];
  for (const {text,y,size} of lines) {
    const start = scene.ops.length;
    const box = addText(scene, text, 0, y, size, '#fff', 840);
    const shift = (1080 - box.w) / 2 - box.x;
    for (const op of scene.ops.slice(start)) op.matrix[4] += shift;
  }
  return scene.ops;
}

const data = {
  fps,
  date:prepareType('5-6',{x:140,y:614,w:800,h:391},0,fps),
  month:prepareType('FEBRUARY 2027',{x:219,y:1027,w:642,h:79},0,fps,'air'),
  details:dateDetails(),
  programme:prepareType('SEE A PROTOTYPE\nMEET THE MAKER\nASK HOW IT WORKS',
    {x:77,y:612,w:926,h:556},.84,fps),
};

const sources = {
  prototype:resolve(reel,'assets/arduino-day-robots.jpg'),
  maker:resolve(reel,'assets/maker-thursday.jpg'),
  ask:resolve(reel,'assets/space-carnival-soldering.jpg'),
  hall:resolve(reel,'assets/tinkerspace-hall.jpg'),
  monochromeHall:resolve(reel,'assets/tinkerspace-hall-mono.jpg'),
  logo:resolve(root,'assets/logos/MF_Kochi_Logo_long_white.svg'),
};

const [template, bundle, assetEntries, notice, appLicense, fonts] = await Promise.all([
  readFile(resolve(reel,'preview.html'),'utf8'),
  build({entryPoints:[resolve(reel,'reel.js')],bundle:true,minify:true,write:false,format:'iife'}),
  Promise.all(Object.entries(sources).map(async ([name,path]) => {
    const mime = path.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
    return [name, `data:${mime};base64,${(await readFile(path)).toString('base64')}`];
  })),
  readFile(resolve(root,'NOTICE.md'),'utf8'),
  readFile(resolve(root,'LICENSE'),'utf8'),
  readdir(resolve(root,'licenses')),
]);

const fontNotices = await Promise.all(fonts.filter(name=>name.endsWith('-OFL.txt'))
  .map(async name=>name + '\n' + await readFile(resolve(root,'licenses',name),'utf8')));
const notices = [notice, appLicense, ...fontNotices].join('\n\n').replaceAll('-->','--&gt;');
const payload = JSON.stringify({data,assets:Object.fromEntries(assetEntries)}).replaceAll('<','\\u003c');
const html = template
  .replace('<!-- REEL_NOTICES -->',()=>`<!--\n${notices}\n-->`)
  .replace('/* REEL_DATA */',()=>`globalThis.awarenessReel = ${payload};`)
  .replace('/* REEL_SCRIPT */',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html);
console.log(output);
