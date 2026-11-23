'use strict';
// Shared by the assistant and operations center. No credentials are persisted here.
globalThis.TrinityAuth=Object.freeze({
  async requestJSON(path,options={}){
    let response,data;
    try{
      response=await fetch(path,{...options,signal:AbortSignal.timeout(10000),credentials:'same-origin'});
      data=await response.json();
    }catch(error){
      if(error.name==='TimeoutError'||error.name==='AbortError')throw new Error('Connection timed out. Please refresh the page.');
      throw new Error('Server did not return a valid response. Check your connection and try again.');
    }
    if(!response.ok)throw Object.assign(new Error(typeof data?.error==='string'?data.error:`Request failed (HTTP ${response.status}).`),{status:response.status});
    return data;
  },
  async config(){
    const config=await this.requestJSON('/api/auth/config');
    if(typeof config?.google_enabled!=='boolean'||typeof config?.google_required!=='boolean')throw new Error('Login configuration is unavailable. Please refresh the page.');
    return config;
  },
  async start({configure,initialize,lock,notice}){
    // Consume the fragment before configuration can change the URL or fail.
    const ticket=location.hash.startsWith('#login=')?location.hash.slice(7):null;
    if(ticket!==null)history.replaceState(null,'',location.pathname+location.search);
    try{
      await configure();
      if(ticket!==null){
        await this.requestJSON('/api/ops/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});
      }else{
        try{await this.requestJSON('/api/ops/dev-login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}
        catch(error){if(![401,403].includes(error.status))throw error;}
      }
      await initialize();
    }catch(error){lock();notice(error.message);}
  }
});
