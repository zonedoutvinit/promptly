// main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater"); // Added

app.setPath("userData", path.join(app.getPath("appData"), "promptly"));

// Helper function to dynamically point to the correct icon from your public folder
function getIconPath() {
  if (process.platform === "win32") {
    return path.join(__dirname, "public", "favicon.ico");
  }
  if (process.platform === "darwin") {
    return path.join(__dirname, "public", "icon.icns"); // Generated Apple icon container
  }
  return path.join(__dirname, "public", "android-chrome-512x512.png"); // Linux default
}

function createWindow() {
  // Create the window with your custom OS-specific icon
  const mainWindow = new BrowserWindow({
    show: false, // Keep hidden initially to prevent cross-OS flashing
    autoHideMenuBar: true, // Hides the top file menu bar cleanly
    icon: getIconPath(), // Injects your brand asset into the window/taskbar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Keeps local LLM routing open
    },
  });

  // Dynamically load Dev Server vs Build Output
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));

    // Fix: Route Linux updates cleanly to avoid cross-contamination of packages
    if (process.platform === "linux") {
      const exePath = app.getPath("exe");

      if (
        exePath.includes("/usr/bin") ||
        exePath.includes("/opt/Promptly") ||
        exePath.includes("pacman")
      ) {
        // Explicitly point Arch Linux system installations to the isolated pacman channel
        autoUpdater.channel = "pacman";
      } else if (
        exePath.includes("deb") ||
        fs.existsSync("/etc/debian_version")
      ) {
        autoUpdater.channel = "deb";
      } else {
        autoUpdater.channel = "rpm";
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
