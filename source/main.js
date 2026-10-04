"use strict";
// APEX FORMULA — offline desktop shell.
// Serves the game over a private app:// scheme so ES modules, WebGL and
// localStorage all work exactly like on the web, with zero network access.

const { app, BrowserWindow, protocol, Menu, shell, ipcMain } = require("electron");
const nativeRumble=require('./native-rumble').createNativeRumble(app);
const path = require("node:path");
const fs = require("node:fs/promises");

const ROOT = path.join(__dirname, "app");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);

  // WebGL over swiftshader-free native GPU path; keep GPU acceleration on
  // for the 3D scene, and allow audio without a prior user gesture.
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("ignore-gpu-blocklist");

  let win = null;
  const allowed=event=>win&&event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url.startsWith('app://apex/');
  ipcMain.handle('apex:rumble',(event,args)=>{
    if(!allowed(event)||!win.isFocused()||!args||typeof args!=='object')return {ok:false,message:'O‘yin oynasini faol tuting.'};
    return nativeRumble.send(args.product,args.strong,args.weak,args.duration);
  });
  ipcMain.handle('apex:rumble-stop',event=>allowed(event)?nativeRumble.stop():{ok:false});
  app.on('before-quit',()=>nativeRumble.close());

  function resolveFile(urlString) {
    const url = new URL(urlString);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === "/") pathname = "/index.html";
    const file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT)) return null;
    return file;
  }

  function createWindow() {
    win = new BrowserWindow({
      width: 1440,
      height: 860,
      minWidth: 960,
      minHeight: 600,
      backgroundColor: "#122824",
      title: "APEX FORMULA",
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
        backgroundThrottling: false,
        devTools: false,
      },
    });

    Menu.setApplicationMenu(null);
    win.on('blur',()=>nativeRumble.stop());
    win.on('closed',()=>nativeRumble.close());
    win.once("ready-to-show", () => win.show());
    win.loadURL("app://apex/index.html");

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("app://")) event.preventDefault();
    });

    win.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if (input.key === "F11") {
        event.preventDefault();
        win.setFullScreen(!win.isFullScreen());
      }
      if (input.control && input.key.toLowerCase() === "q") {
        event.preventDefault();
        app.quit();
      }
    });
  }

  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle("app", async (request) => {
      const file = resolveFile(request.url);
      if (!file) return new Response("Forbidden", { status: 403 });
      try {
        const body = await fs.readFile(file);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
            "cache-control": "no-cache",
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}
