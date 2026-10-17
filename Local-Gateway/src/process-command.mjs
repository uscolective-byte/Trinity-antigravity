import path from 'node:path';

// npm.cmd cannot be spawned with shell:false on Windows. Invoke npm's JS
// entrypoint with Node, preserving argument boundaries and shell isolation.
export function processCommand(command,args,platform=process.platform,execPath=process.execPath){
  if(command==='npm'&&platform==='win32')return {
    command:execPath,args:[path.win32.join(path.win32.dirname(execPath),'node_modules','npm','bin','npm-cli.js'),...args]
  };
  return {command,args};
}
