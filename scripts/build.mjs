import {build} from 'esbuild';
import {mkdir,copyFile,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {assertProductionSources,assertProductionInputs,assertProductionOutput,prepareProductionBuild} from './production-scope.mjs';

import {PAPER_CUTOUTS_ENABLED,STANDARD_POSTER_SAMPLES} from '../src/studio-features.js';

export const root=fileURLToPath(new URL('../',import.meta.url));
export async function copyPublic(){
  const sampleDestination=resolve(root,'dist/assets/samples');
  await mkdir(sampleDestination,{recursive:true});
  const source=await readFile(resolve(root,'public/index.html'),'utf8');
  const poster=source.replace(/<!-- paper-cutouts:start -->([\s\S]*?)<!-- paper-cutouts:end -->/g,
    (section,markup)=>PAPER_CUTOUTS_ENABLED?markup:'');
  const sampleCopies=PAPER_CUTOUTS_ENABLED
    ? [cp(resolve(root,'assets/samples'),sampleDestination,{recursive:true}),
       cp(resolve(root,'assets/templates'),resolve(root,'dist/assets/templates'),{recursive:true})]
    : STANDARD_POSTER_SAMPLES.map(([id])=>copyFile(
       resolve(root,'assets/samples',id+'.png'),resolve(sampleDestination,id+'.png')));
  await Promise.all([
    writeFile(resolve(root,'dist/index.html'),poster),
    writeFile(resolve(root,'dist/poster.html'),poster),
    copyFile(resolve(root,'public/content.html'),resolve(root,'dist/content.html')),
    copyFile(resolve(root,'assets/MF_Kochi_Logo_long.png'),resolve(root,'dist/assets/MF_Kochi_Logo_long.png')),
    copyFile(resolve(root,'LICENSE'),resolve(root,'dist/LICENSE')),
    copyFile(resolve(root,'NOTICE.md'),resolve(root,'dist/NOTICE.md')),
    cp(resolve(root,'licenses'),resolve(root,'dist/licenses'),{recursive:true}),
    ...sampleCopies,
    cp(resolve(root,'assets/logos'),resolve(root,'dist/assets/logos'),{recursive:true}),
  ]);
}
export const buildOptions={
  absWorkingDir:root,
  entryPoints:{studio:'src/content-app.js',poster:'src/app.js'},
  outdir:'dist',
  assetNames:'assets/[name]-[hash]',
  bundle:true,
  metafile:true,
  format:'iife',
  target:'es2020',
  minify:true,
  legalComments:'none',
  loader:{'.woff2':'file'},
  logLevel:'info',
  plugins:[{name:'production-scope',setup(builder){
    builder.onStart(()=>assertProductionSources(root));
    builder.onEnd(async result=>{
      if(result.errors.length)return;
      try{assertProductionInputs(result.metafile);await copyPublic();await assertProductionOutput(root);}
      catch(error){await rm(resolve(root,'dist'),{recursive:true,force:true});throw error;}
    });
  }}],
};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){await prepareProductionBuild(root);await build(buildOptions);}
