const { contextBridge } = require("electron");

// No privileged APIs are exposed yet - the renderer talks to the app's own
// Next.js API routes over HTTP like a normal browser tab. This bridge exists
// so future desktop-only features (native file dialogs for attachments,
// OS notifications for sync conflicts, a system tray timer) have a place to
// land without relaxing contextIsolation/nodeIntegration.
contextBridge.exposeInMainWorld("afpDesktop", {
  isElectron: true,
});
