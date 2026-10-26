import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
let custom='';
try{custom=execFileSync('git',['config','--get','core.hooksPath'],{cwd:root,encoding:'utf8'}).trim();}catch{}
if(custom)throw new Error('An existing core.hooksPath is configured. Add scripts/pre-push to that hook instead of replacing it.');
const common=execFileSync('git',['rev-parse','--path-format=absolute','--git-common-dir'],{cwd:root,encoding:'utf8'}).trim();
const target=resolve(common,'hooks/pre-push'),source=await readFile(new URL('./pre-push',import.meta.url),'utf8');
let previous=null;try{previous=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(previous!==null&&previous!==source)throw new Error('An existing pre-push hook was preserved. Integrate the production guard with it manually.');
await mkdir(resolve(common,'hooks'),{recursive:true});await writeFile(target,source);await chmod(target,0o755);
console.log('Installed the shared production push guard for this repository and its worktrees.');
