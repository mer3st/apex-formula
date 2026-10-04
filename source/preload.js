"use strict";
// Marker so the game knows it is running in the offline desktop shell.
const { contextBridge, ipcRenderer } = require("electron");
try {
  contextBridge.exposeInMainWorld("APEX_DESKTOP", true);
  contextBridge.exposeInMainWorld("APEX_RUMBLE", {
    play:(product,strong,weak,duration)=>ipcRenderer.invoke('apex:rumble',{product,strong,weak,duration}),
    stop:()=>ipcRenderer.invoke('apex:rumble-stop')
  });
} catch {}
