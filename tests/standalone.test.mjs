import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {TREATMENTS,FORMATS,PALETTES} from '../src/scene.js';
import {FONT_CATALOG} from '../src/font-library.js';
import {LAYOUT_IDS} from '../src/composition.js';
import {STYLE_IDS} from '../src/style-system.js';
import {LOGO_DATA} from '../src/data/logo.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=data=>createHash('sha256').update(data).digest('hex');

test('the standalone product exposes exactly its supported editing choices',()=>{
  assert.deepEqual(TREATMENTS.map(item=>item.id),['air','flex','packed']);
  assert.equal(FONT_CATALOG.length,7);
  assert.deepEqual(LAYOUT_IDS,['stack','offset','centered']);
  assert.deepEqual(STYLE_IDS,['original','jostle']);
  assert.equal(PALETTES.length,4);assert.equal(Object.keys(FORMATS).length,4);
});

test('every runtime source module is reachable from the app and resolves inside the repository',async()=>{
  const seen=new Set();
  async function visit(path){
    assert.ok(path.startsWith(root),'imports stay inside the project');
    if(seen.has(path))return;seen.add(path);assert.ok((await stat(path)).isFile());
    const source=await readFile(path,'utf8');
    if(!path.endsWith('.js'))return;
    for(const match of source.matchAll(/(?:import\s+(?:[^;]*?\sfrom\s*)?|export\s+[^;]*?\sfrom\s*)['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('.'),'browser code uses local modules');
      await visit(resolve(dirname(path),match[1]));
    }
  }
  await visit(resolve(root,'src/app.js'));
  async function check(path){for(const item of await readdir(path,{withFileTypes:true})){const name=resolve(path,item.name);if(item.isDirectory())await check(name);else if(name.endsWith('.js'))assert.ok(seen.has(name),`${name.split(sep).at(-1)} is used by the editor`);}}
  await check(resolve(root,'src'));
});

test('font sources, licence files and embedded logo match the shipped asset manifest',async()=>{
  const manifest=JSON.parse(await readFile(resolve(root,'assets/font-manifest.json'),'utf8'));
  for(const font of manifest.fonts){
    assert.equal(sha(await readFile(resolve(root,'assets/fonts',font.filename))),font.sha256);
    assert.match(await readFile(resolve(root,'licenses',font.license),'utf8'),/SIL OPEN FONT LICENSE/i);
  }
  for(const font of FONT_CATALOG)if(font.file)assert.ok((await stat(resolve(root,font.file))).isFile());
  const logo=await readFile(resolve(root,'assets/MF_Kochi_Logo_long.png'));
  const info=JSON.parse(await readFile(resolve(root,'assets/logo.json'),'utf8'));
  assert.equal(sha(logo),info.sha256);
  assert.deepEqual(Buffer.from(LOGO_DATA.split(',')[1],'base64'),logo);
});
