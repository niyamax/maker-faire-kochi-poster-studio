import {STUDIO_STORAGE_KEY} from './project-state.js';
import {createWorkspace,normalizeWorkspace,normalizeContentItem} from './content-project.js';

export const CONTENT_DB_NAME='maker-faire-content-studio';
export const CONTENT_STORE_NAME='projects';
export const CONTENT_WORKSPACE_KEY='workspace';
export const CONTENT_LOCK_NAME='maker-faire-content-studio:workspace';

function storageError(error,action='save'){
  if(error?.name==='QuotaExceededError')return new Error('Device storage is full. Download a project file to keep your work.',{cause:error});
  return new Error(`Content Studio could not ${action} this project on this device. ${error?.message||'Device storage is unavailable.'}`,{cause:error});
}

/** Serialize complete operations locally and, in the browser, across tabs.
 * Inputs are snapshotted immediately so later form edits cannot change an
 * in-flight save. Full saves use the last acknowledged revision as a lease;
 * item updates intentionally merge into the newest persisted workspace. */
export function createWorkspaceStore({read,write,readLegacy=()=>null,withLock=operation=>operation(),now=Date.now}){
  let pending=Promise.resolve(),lastSeen,lastTimestamp=0;
  const enqueue=operation=>{
    const result=pending.then(()=>withLock(operation));
    pending=result.catch(()=>{});
    return result;
  };
  const nextRevision=previous=>{
    lastTimestamp=Math.max(now(),lastTimestamp+1,(Date.parse(previous)||0)+1);
    return new Date(lastTimestamp).toISOString();
  };
  async function readCurrent(){
    let saved;
    try{saved=await read();}catch(error){throw storageError(error,'open');}
    return saved===undefined||saved===null?null:normalizeWorkspace(saved);
  }
  async function persist(workspace,previous){
    workspace.updatedAt=nextRevision(previous);
    try{await write(workspace);}catch(error){throw storageError(error);}
    lastSeen=workspace.updatedAt;
    return workspace;
  }
  async function load(){
    const saved=await readCurrent();
    if(saved){lastSeen=saved.updatedAt;return saved;}
    let legacy;
    try{legacy=await readLegacy();}catch(error){throw storageError(error,'read your previous Poster Studio project');}
    let workspace;
    if(legacy){
      try{workspace=createWorkspace({legacyPoster:typeof legacy==='string'?JSON.parse(legacy):legacy});}
      catch(error){throw new Error('The saved Poster Studio project could not be read. Your original project data has been kept.',{cause:error});}
    }else workspace=createWorkspace();
    return persist(workspace,workspace.updatedAt);
  }
  return {
    loadWorkspace:()=>enqueue(async()=>structuredClone(await load())),
    saveWorkspace:async value=>{
      // Validation occurs before any storage mutation or acknowledgement.
      const snapshot=normalizeWorkspace(structuredClone(value));
      return enqueue(async()=>{
        const current=await readCurrent();
        if((current&&current.updatedAt!==lastSeen)||(!current&&lastSeen!==undefined)){
          const error=new Error('This library changed in another tab. Download your unsaved project copy, then reload Content Studio before saving again.');
          error.name='WorkspaceConflictError';
          throw error;
        }
        await persist(snapshot,current?.updatedAt);
        return structuredClone(snapshot);
      });
    },
    updateWorkspaceItem:(id,updater)=>enqueue(async()=>{
      if(typeof updater!=='function')throw new TypeError('A content update function is required.');
      const workspace=await load(),previous=workspace.updatedAt,index=workspace.items.findIndex(item=>item.id===id);
      if(index<0)throw new Error('This content item is no longer in the library. Return to Content Studio to choose another item.');
      const changed=await updater(structuredClone(workspace.items[index]));
      if(!changed||changed.id!==id)throw new Error('A content update must preserve its item ID.');
      workspace.items[index]=normalizeContentItem(changed);
      const snapshot=normalizeWorkspace(workspace);
      await persist(snapshot,previous);
      return structuredClone(snapshot);
    }),
  };
}

let databasePromise;
function database(){
  if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('This browser does not support local project storage.'));return;}
    let blocked=false;
    const request=globalThis.indexedDB.open(CONTENT_DB_NAME,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(CONTENT_STORE_NAME))request.result.createObjectStore(CONTENT_STORE_NAME);
    };
    request.onerror=()=>reject(request.error||new Error('The project database could not be opened.'));
    request.onblocked=()=>{blocked=true;reject(new Error('Close other Content Studio tabs and try again.'));};
    request.onsuccess=()=>{
      const db=request.result;
      if(blocked){db.close();return;}
      db.onversionchange=()=>{db.close();databasePromise=undefined;};
      resolve(db);
    };
  }).catch(error=>{databasePromise=undefined;throw error;});
  return databasePromise;
}
async function readWorkspace(){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(CONTENT_STORE_NAME,'readonly');
    const request=transaction.objectStore(CONTENT_STORE_NAME).get(CONTENT_WORKSPACE_KEY);
    transaction.oncomplete=()=>resolve(request.result);
    transaction.onabort=()=>reject(transaction.error||request.error||new Error('The project could not be read.'));
    transaction.onerror=()=>{};
  });
}
async function writeWorkspace(workspace){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(CONTENT_STORE_NAME,'readwrite');
    const request=transaction.objectStore(CONTENT_STORE_NAME).put(workspace,CONTENT_WORKSPACE_KEY);
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(transaction.error||request.error||new Error('The project could not be saved.'));
    transaction.onerror=()=>{};
  });
}
const store=createWorkspaceStore({
  read:readWorkspace,
  write:writeWorkspace,
  readLegacy:()=>globalThis.localStorage?.getItem(STUDIO_STORAGE_KEY)||null,
  withLock:operation=>{
    if(!globalThis.navigator?.locks?.request)throw new Error('This browser cannot coordinate local project saves. Open Content Studio in a current browser using HTTPS or localhost.');
    return globalThis.navigator.locks.request(CONTENT_LOCK_NAME,{mode:'exclusive'},operation);
  },
});
export const loadWorkspace=store.loadWorkspace;
export const saveWorkspace=store.saveWorkspace;
export const updateWorkspaceItem=store.updateWorkspaceItem;
