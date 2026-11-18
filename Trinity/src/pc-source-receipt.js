import {hash} from './security.js';

// A completed queue entry alone does not prove that a file was read.
export async function sourceFileResult(action,path){
  const receipt=action?.receipt;
  if(action?.status!=='completed'||typeof receipt?.content!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256||''))
    throw new Error('Čítanie súboru nemá overený obsah a SHA-256.');
  if(receipt.path!==undefined&&receipt.path!==path)throw new Error('Doklad čítania patrí inému súboru.');
  const bytes=new TextEncoder().encode(receipt.content).byteLength;
  if((receipt.bytes!==undefined&&receipt.bytes!==bytes)||await hash(receipt.content)!==receipt.sha256)
    throw new Error('Obsah súboru nesúhlasí s dokladom čítania.');
  return {id:action.id,status:'completed',path,content:receipt.content,sha256:receipt.sha256,bytes};
}
