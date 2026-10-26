import {build} from 'esbuild';
import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {assertProductionSources,assertProductionInputs,assertProductionOutput,prepareProductionBuild} from './production-scope.mjs';

export const root=fileURLToPath(new URL('../',import.meta.url));
export async function copyPublic(){
  await mkdir(resolve(root,'dist/assets'),{recursive:true});
  await Promise.all([
    copyFile(resolve(root,'public/index.html'),resolve(root,'dist/index.html')),
    copyFile(resolve(root,'assets/MF_Kochi_Logo_long.png'),resolve(root,'dist/assets/MF_Kochi_Logo_long.png')),
    copyFile(resolve(root,'LICENSE'),resolve(root,'dist/LICENSE')),
    copyFile(resolve(root,'NOTICE.md'),resolve(root,'dist/NOTICE.md')),
    cp(resolve(root,'licenses'),resolve(root,'dist/licenses'),{recursive:true}),
    cp(resolve(root,'assets/samples'),resolve(root,'dist/assets/samples'),{recursive:true}),
  ]);
}
export const buildOptions={
  absWorkingDir:root,
  entryPoints:{studio:'src/app.js'},
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
