import {hash} from './security.js';

// A completed queue entry alone does not prove that a file was read.
export async function sourceFileResult(action,path){
  const receipt=action?.receipt;
  if(action?.status!=='completed'||typeof receipt?.content!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256||''))
    throw new Error('File read receipt is missing verified content and SHA-256 digest.');
  if(receipt.path!==undefined&&receipt.path!==path)throw new Error('File read receipt belongs to a different file.');
  const bytes=new TextEncoder().encode(receipt.content).byteLength;
  if((receipt.bytes!==undefined&&receipt.bytes!==bytes)||await hash(receipt.content)!==receipt.sha256)
    throw new Error('File content does not match the read receipt.');
  return {id:action.id,status:'completed',path,content:receipt.content,sha256:receipt.sha256,bytes};
}
