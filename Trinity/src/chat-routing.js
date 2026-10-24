import {planTask} from './planner.js';
// Automatic PC requests stay in the cloud planner; only explicit local mode uses local inference.
export function selectChatProvider(engine,message){
 if(engine!=='auto')return engine==='cloud'?'workers-ai':engine;
 return planTask(message).intent==='conversation'?'fast':'workers-ai';
}
