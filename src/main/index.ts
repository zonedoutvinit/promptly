import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import { autoUpdater } from "electron-updater";

app.setPath("userData", path.join(app.getPath("appData"), "promptly"));

function getIconPath(): string {
  const publicDir = path.join(app.getAppPath(), "public");
  if (process.platform === "win32") {
    return path.join(publicDir, "favicon.ico");
  }
  if (process.platform === "darwin") {
    return path.join(publicDir, "icon.icns");
  }
  return path.join(publicDir, "android-chrome-512x512.png");
}

function setupLinuxAppImageEnvironment(): void {
  if (process.platform !== "linux") return;

  if (!process.env.APPIMAGE) {
    console.warn(
      "APPIMAGE environment path not detected. Fallback hook check...",
    );
    const currentExec = process.execPath;

    if (currentExec.endsWith(".AppImage")) {
      process.env.APPIMAGE = currentExec;
    } else {
      const tmpAppImagePath = path.join(
        "/tmp",
        `promptly-${app.getVersion()}.AppImage`,
      );
      if (!fs.existsSync(tmpAppImagePath) && fs.existsSync(currentExec)) {
        try {
          fs.symlinkSync(currentExec, tmpAppImagePath);
          process.env.APPIMAGE = tmpAppImagePath;
        } catch (err) {
          console.error(
            "Failed to create temporary AppImage symlink hook:",
            err,
          );
        }
      }
    }
  }
}

function setupAutoUpdater(mainWindow: BrowserWindow): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error);
  });

  autoUpdater.on("update-available", (info) => {
    console.log(
      `Update available: ${info.version}. Downloading in background...`,
    );
  });

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update Ready",
        message: `Version ${info.version} has been downloaded and is ready to install.`,
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });

  if (!app.isPackaged) {
    //electron-vite dev provides this URL automatically, with a reliable port fallback
    const rendererUrl =
      process.env["ELECTRON_RENDERER_URL"] || "http://localhost:5173";
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    setupAutoUpdater(mainWindow);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.webContents.setZoomLevel(0);
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control) {
      const currentZoom = mainWindow.webContents.getZoomLevel();

      if (input.key === "+" || input.key === "=") {
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
        event.preventDefault();
      } else if (input.key === "-") {
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
        event.preventDefault();
      } else if (input.key === "0") {
        mainWindow.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  });
}

ipcMain.handle(
  "perform-search",
  async (_event, query: unknown): Promise<string> => {
    if (!query || typeof query !== "string" || !query.trim()) {
      return "";
    }

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Search request failed with status: ${response.status}`,
        );
      }

      return await response.text();
    } catch (error) {
      console.error("Search failed with error:", error);
      return "";
    }
  },
);

// Example IPC handler for encryption
ipcMain.handle("crypto:encrypt", async (_, plainText: string) => {
  try {
    // 1. Check if safeStorage encryption is available on the current OS system
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(plainText).toString("base64");
    } else {
      console.warn(
        "OS encryption is not available on this system. Falling back to unencrypted storage.",
      );

      // 2. Fallback behavior: Return text or handle it safely depending on your requirements.
      // Option A: If you want to permit storing it unencrypted with a flag:
      return Buffer.from(plainText).toString("base64"); // Or handle plaintext

      // Option B: If you prefer throwing a clean handled warning instead of breaking the app
      // throw new Error('OS encryption is not available. Please configure a secret service provider.');
    }
  } catch (error: any) {
    console.error("Encryption pipeline failure:", error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
});

ipcMain.handle("crypto:decrypt", async (_, encryptedBase64: string) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedBase64, "base64");
      return safeStorage.decryptString(buffer);
    } else {
      // Fallback decryption if it was stored via fallback
      const buffer = Buffer.from(encryptedBase64, "base64");
      return buffer.toString("utf8");
    }
  } catch (error: any) {
    console.error("Decryption pipeline failure:", error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
});

app.whenReady().then(() => {
  setupLinuxAppImageEnvironment();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
