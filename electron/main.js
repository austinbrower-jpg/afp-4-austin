const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const http = require("node:http");

const PORT = process.env.PORT || 3000;
const APP_URL = `http://localhost:${PORT}`;
const isDev = !app.isPackaged;

let mainWindow;

function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.destroy();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}`));
            return;
          }
          setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "AFP Workspace",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Next.js server-side API routes (SQLite cache, Notion sync) require a
  // running Node server - the app is loaded over HTTP rather than as static
  // files. In dev, `next dev` is expected to already be running (see the
  // `electron:dev` script). In a packaged build, this same window would
  // point at a `next start` process spawned from `app.getAppPath()`; wiring
  // that spawn + packaging (electron-builder `extraResources`, code signing)
  // is the next step before shipping a distributable - see README.
  await waitForServer(APP_URL);
  await mainWindow.loadURL(APP_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Open external links (e.g. GitHub links from Work Done entries) in the
  // system browser instead of inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
