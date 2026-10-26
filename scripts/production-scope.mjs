import {access,readdir,rm,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const EXPERIMENT_PATHS=Object.freeze([
  'src/constructed',
  'src/poster-series',
  'src/export-artwork.js',
  'public/constructed.html',
  'public/posters.html',
  'licenses/THREE-MIT.txt',
]);
const normalized=value=>String(value).replaceAll('\\','/').replace(/^\.\//,'');
export function experimentalPath(value){
  const path=normalized(value);
  return EXPERIMENT_PATHS.some(item=>path===item||path.startsWith(item+'/')||path.includes('/'+item+'/')||path.endsWith('/'+item))
    ||/(^|\/)node_modules\/three(\/|$)/.test(path)
    ||/(^|\/)three\.(core|module)\.js$/.test(path);
}
function reject(paths,context){
  if(paths.length)throw new Error(`${context} contains held experimental files:\n${paths.map(p=>'  '+p).join('\n')}\nUse the separate codex/3d-poster-experiments checkout.`);
}
export async function assertProductionSources(root){
  const found=[];
  for(const name of EXPERIMENT_PATHS){
    try{await access(resolve(root,name));found.push(name);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  reject(found,'Production source');
}
export async function prepareProductionBuild(root){
  await assertProductionSources(root);
  await rm(resolve(root,'dist'),{recursive:true,force:true});
  await mkdir(resolve(root,'dist'),{recursive:true});
}
export function assertProductionInputs(metafile){
  if(!metafile?.inputs)throw new Error('Production build metadata is required.');
  reject(Object.keys(metafile.inputs).filter(experimentalPath),'Production bundle');
}
export async function assertProductionOutput(root){
  const directory=resolve(root,'dist'),allowed=new Set(['index.html','studio.js','studio.css','assets','licenses','LICENSE','NOTICE.md']);
  const unexpected=[];
  async function walk(path){
    for(const entry of await readdir(path,{withFileTypes:true})){
      const absolute=resolve(path,entry.name),name=relative(directory,absolute).split(sep).join('/');
      if(entry.isSymbolicLink())unexpected.push(name+' (symlink)');
      else if(path===directory&&!allowed.has(entry.name))unexpected.push(name);
      else if(/(^|\/)(?:constructed|posters)(?:[.-]|$)/i.test(name)||/(^|\/)THREE-MIT\.txt$/.test(name))unexpected.push(name);
      else if(entry.isDirectory())await walk(absolute);
    }
  }
  await walk(directory);reject(unexpected,'Production output');
}
export function assertProductionGitTree(ref,root){
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref||''))throw new Error('Choose an existing branch or commit.');
  const files=execFileSync('git',['ls-tree','-r','--name-only',ref,'--'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  reject(files.filter(experimentalPath),`Git tree ${ref}`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
  try{
    if(args[0]==='--git-ref')assertProductionGitTree(args[1],root);
    else if(args[0]==='--output')await assertProductionOutput(root);
    else await assertProductionSources(root);
    console.log('Production scope is clean.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
