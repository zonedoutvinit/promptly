// main.js
const { app, BrowserWindow, ipcMain, net } = require("electron");
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
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"), // Add this
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));

    if (process.platform === "linux") {
      let channel = "latest";
      // Determine the channel based on the OS
      if (fs.existsSync("/etc/arch-release")) {
        channel = "pacman";
      } else if (fs.existsSync("/etc/debian_version")) {
        channel = "deb";
      } else if (
        fs.existsSync("/etc/redhat-release") ||
        fs.existsSync("/etc/fedora-release")
      ) {
        channel = "rpm";
      }
      autoUpdater.channel = channel;
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

// IPC Handler to perform the search
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
    return ""; // Return empty string so your UI doesn't crash
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
