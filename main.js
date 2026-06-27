// main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs"); // Required for bulletproof Linux detection
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

function createWindow() {
  const mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));

    // Robust OS detection for auto-updater channels
    if (process.platform === "linux") {
      if (fs.existsSync("/etc/arch-release")) {
        autoUpdater.channel = "pacman"; // Looks for pacman-linux.yml
      } else if (fs.existsSync("/etc/debian_version")) {
        autoUpdater.channel = "deb"; // Looks for deb-linux.yml
      } else if (
        fs.existsSync("/etc/redhat-release") ||
        fs.existsSync("/etc/fedora-release")
      ) {
        autoUpdater.channel = "rpm"; // Looks for rpm-linux.yml
      } else {
        autoUpdater.channel = "latest"; // Fallback
      }
    }

    // Auto-updater check (Only in production)
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Window Presentation and Zoom Lifecycle Management
  mainWindow.once("ready-to-show", () => {
    // Clear out Chromium's persistent zoom memory cache and reset cleanly to 100%
    mainWindow.webContents.setZoomLevel(0);

    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  // Explicit, robust custom keyboard zoom controls
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control) {
      const currentZoom = mainWindow.webContents.getZoomLevel();

      // Zoom In (Ctrl and + or =)
      if (input.key === "+" || input.key === "=") {
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
        event.preventDefault();
      }
      // Zoom Out (Ctrl and -)
      else if (input.key === "-") {
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
        event.preventDefault();
      }
      // Reset Zoom to default (Ctrl and 0)
      else if (input.key === "0") {
        mainWindow.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
