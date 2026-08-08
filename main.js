const { app, BrowserWindow, ipcMain, net, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

app.setPath("userData", path.join(app.getPath("appData"), "promptly"));

// Helper function to dynamically point to the correct icon from your public folder
function getIconPath() {
  if (process.platform === "win32") {
    return path.join(__dirname, "public", "favicon.ico");
  }
  if (process.platform === "darwin") {
    return path.join(__dirname, "public", "icon.icns");
  }
  return path.join(__dirname, "public", "android-chrome-512x512.png");
}

// Ensure proper runtime execution environment when running as an AppImage on Linux
function setupLinuxAppImageEnvironment() {
  if (process.platform !== "linux") return;

  // Verify whether APPIMAGE runtime env variable exists
  if (!process.env.APPIMAGE) {
    console.warn(
      "APPIMAGE environment path not detected. Fallback hook check...",
    );

    // If launched directly without environment context, point to current executable path
    const currentExec = process.execPath;
    if (currentExec.endsWith(".AppImage")) {
      process.env.APPIMAGE = currentExec;
    } else {
      // Create a temporary execution context indicator in /tmp for updater validation
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

function setupAutoUpdater(mainWindow) {
  if (process.env.NODE_ENV === "development") return;

  // Configure autoUpdater for background silent downloads
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

  // Prompt user cleanly when the update has finished downloading in background
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

  // Initiate update check
  autoUpdater.checkForUpdatesAndNotify();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
    setupAutoUpdater(mainWindow);
  }

  // Window Presentation and Zoom Lifecycle Management
  mainWindow.once("ready-to-show", () => {
    mainWindow.webContents.setZoomLevel(0);
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  // Custom keyboard zoom controls
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

// IPC Handler to perform search
ipcMain.handle("perform-search", async (event, query) => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await net.fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return await response.text();
  } catch (error) {
    console.error("Search failed:", error);
    return "";
  }
});

app.whenReady().then(() => {
  setupLinuxAppImageEnvironment();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
