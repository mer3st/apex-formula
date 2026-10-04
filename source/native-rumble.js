'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
function createNativeRumble(app){
  let child,sequence=0,buffer='';const pending=new Map();
  function finish(id,result){const item=pending.get(id);if(item){clearTimeout(item.timer);pending.delete(id);item.resolve(result);}}
  function launch(){
    if(child)return;
    const file=path.join(app.isPackaged?process.resourcesPath:__dirname,'native','RumbleHelper.exe');
    const processChild=spawn(file,[],{windowsHide:true,stdio:['pipe','pipe','ignore']});child=processChild;
    const failed=()=>{if(child===processChild){child=null;buffer='';for(const id of pending.keys())finish(id,{ok:false,message:'Windows vibratsiya xizmati to‘xtadi.'});}};
    processChild.on('error',failed);processChild.on('exit',failed);processChild.stdin.on('error',failed);
    processChild.stdout.on('data',chunk=>{buffer+=chunk;let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);const [id,status]=line.split(' ');finish(Number(id),{ok:status==='OK',message:status==='OK'?'Windows orqali vibratsiya yuborildi.':'Windows vibratsiya xatosi: '+status});}});
  }
  function send(pid,strong,weak,duration){
    if(![2508,1476].includes(pid)||![strong,weak,duration].every(Number.isFinite))return Promise.resolve({ok:false,message:'INVALID_REQUEST'});
    launch();const id=++sequence;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>finish(id,{ok:false,message:'Vibratsiya xizmati javob bermadi.'}),2500);
      pending.set(id,{resolve,timer});
      child.stdin.write(`${id} ${pid} ${Math.round(Math.max(0,Math.min(1,strong))*255)} ${Math.round(Math.max(0,Math.min(1,weak))*255)} ${Math.round(Math.max(0,Math.min(2000,duration)))}\n`);
    });
  }
  function stop(){if(child)return send(2508,0,0,0);return Promise.resolve({ok:true});}
  function close(){if(child){child.stdin.end();child=null;}}
  return {send,stop,close};
}
module.exports={createNativeRumble};
