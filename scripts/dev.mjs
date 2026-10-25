import {context} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {root,buildOptions} from './build.mjs';

const preview=process.argv.includes('--preview');
const port=Number(process.env.PORT||8800);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535.');
let builder;
if(!preview){builder=await context(buildOptions);await builder.rebuild();await builder.watch();}
const directory=resolve(root,'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const relative=pathname==='/'?'index.html':pathname.slice(1);
    const path=resolve(directory,relative);
    if(path!==directory&&!path.startsWith(directory+sep)){res.writeHead(403);res.end('Forbidden');return;}
    if(!(await stat(path)).isFile())throw Error('Not a file');
    const bytes=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
server.on('error',async error=>{console.error(error.message);await builder?.dispose();process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Poster Studio: http://127.0.0.1:${port}/`));
async function close(){server.close();await builder?.dispose();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
