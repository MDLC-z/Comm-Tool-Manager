const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");

console.log("Main process starting...");
console.log("__dirname:", __dirname);

// Configuration paths
const DOCUMENTS_PATH = path.join(os.homedir(), "Documents");
const APP_FOLDER = path.join(DOCUMENTS_PATH, "CommTool");
const CONFIG_FILE = path.join(APP_FOLDER, "config.json");
const COMMS_FILE = path.join(APP_FOLDER, "comms.json");
const BACKGROUNDS_FOLDER = path.join(APP_FOLDER, "backgrounds");
const COMMS_DATA_FOLDER = path.join(APP_FOLDER, "Comms");
const TEMP_FOLDER = path.join(APP_FOLDER, "temp");

let mainWindow;

function createWindow() {
  console.log("Creating main window...");

  const preloadPath = path.join(__dirname, "preload.js");
  console.log("Preload path:", preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "../assets/icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false,
    },
    autoHideMenuBar: true,
    show: false,
    title: "Comm Tool Manager",
  });

  const htmlPath = path.join(__dirname, "renderer", "index.html");
  console.log("HTML path:", htmlPath);

  mainWindow.loadFile(htmlPath);

  mainWindow.once("ready-to-show", () => {
    console.log("Window ready to show");
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Helper functions
async function ensureAppFolders() {
  try {
    await fs.mkdir(APP_FOLDER, { recursive: true });
    await fs.mkdir(BACKGROUNDS_FOLDER, { recursive: true });
    await fs.mkdir(COMMS_DATA_FOLDER, { recursive: true });
    await fs.mkdir(TEMP_FOLDER, { recursive: true });
    console.log("App folders created successfully");
    return true;
  } catch (error) {
    console.error("Error creating app folders:", error);
    throw error;
  }
}

// ========== CONFIGURATION HANDLERS ==========
ipcMain.handle("load-config", async () => {
  try {
    await ensureAppFolders();
    const data = await fs.readFile(CONFIG_FILE, "utf8");
    const config = JSON.parse(data);
    console.log("Config loaded from file:", config);
    return config;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Config file not found, creating default");
      const defaultConfig = {
        username: "User",
        theme: "light",
        primaryColor: "#3b82f6",
        language: "en",
        backgroundImage: null,
        backgroundAllPages: false,
        zoomLevel: "100",
      };
      await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    console.error("Error loading config:", error);
    throw error;
  }
});

ipcMain.handle("save-config", async (event, config) => {
  try {
    await ensureAppFolders();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log("Config saved to file:", config);
    return true;
  } catch (error) {
    console.error("Error saving config:", error);
    throw error;
  }
});

// ========== COMMS HANDLERS ==========
ipcMain.handle("load-comms", async () => {
  try {
    await ensureAppFolders();
    const data = await fs.readFile(COMMS_FILE, "utf8");
    const comms = JSON.parse(data);
    console.log("Comms loaded from file:", comms.length);
    return comms;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Comms file not found, creating empty");
      await fs.writeFile(COMMS_FILE, "[]");
      return [];
    }
    console.error("Error loading comms:", error);
    throw error;
  }
});

ipcMain.handle("save-comms", async (event, comms) => {
  try {
    await ensureAppFolders();
    await fs.writeFile(COMMS_FILE, JSON.stringify(comms, null, 2));
    console.log("Comms saved to file:", comms.length);
    return true;
  } catch (error) {
    console.error("Error saving comms:", error);
    throw error;
  }
});

// ========== BACKGROUND IMAGE HANDLERS ==========
ipcMain.handle("save-background-image", async (event, imageData, filename) => {
  try {
    await ensureAppFolders();
    const imagePath = path.join(BACKGROUNDS_FOLDER, filename);

    console.log("Saving background image:", filename);

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    await fs.writeFile(imagePath, buffer);
    console.log("Background image saved successfully:", filename);
    return filename;
  } catch (error) {
    console.error("Error saving background image:", error);
    throw error;
  }
});

ipcMain.handle("load-background-image", async (event, filename) => {
  try {
    if (!filename) {
      throw new Error("No filename provided");
    }

    const imagePath = path.join(BACKGROUNDS_FOLDER, filename);
    console.log("Loading background image from:", imagePath);

    const data = await fs.readFile(imagePath);
    const base64 = `data:image/jpeg;base64,${data.toString("base64")}`;
    console.log("Background image loaded successfully:", filename);
    return base64;
  } catch (error) {
    console.error("Error loading background image:", error);
    throw error;
  }
});

ipcMain.handle("delete-background-image", async (event, filename) => {
  try {
    if (!filename) {
      throw new Error("No filename provided");
    }

    const imagePath = path.join(BACKGROUNDS_FOLDER, filename);
    await fs.unlink(imagePath);
    console.log("Background image deleted:", filename);
    return true;
  } catch (error) {
    console.error("Error deleting background image:", error);
    throw error;
  }
});

// ========== COMM REFERENCES HANDLERS ==========
ipcMain.handle(
  "save-comm-reference",
  async (event, commId, fileData, filename, fileType = "image") => {
    try {
      if (!commId || !filename) {
        throw new Error("Missing commId or filename");
      }

      const referencesFolder = path.join(
        COMMS_DATA_FOLDER,
        commId,
        "references"
      );
      await fs.mkdir(referencesFolder, { recursive: true });

      const filePath = path.join(referencesFolder, filename);
      console.log("Saving reference file:", filePath);

      if (
        fileType === "image" &&
        typeof fileData === "string" &&
        fileData.startsWith("data:")
      ) {
        const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        await fs.writeFile(filePath, buffer);
      } else if (fileData instanceof ArrayBuffer || Buffer.isBuffer(fileData)) {
        const buffer = Buffer.from(fileData);
        await fs.writeFile(filePath, buffer);
      } else {
        throw new Error("Unsupported file data type");
      }

      console.log(
        "Reference saved successfully:",
        filename,
        "for comm:",
        commId
      );
      return filename;
    } catch (error) {
      console.error("Error saving reference:", error);
      throw error;
    }
  }
);

ipcMain.handle("get-comm-references", async (event, commId) => {
  try {
    if (!commId) {
      throw new Error("No commId provided");
    }

    const referencesFolder = path.join(COMMS_DATA_FOLDER, commId, "references");
    console.log("Loading references from:", referencesFolder);

    try {
      await fs.access(referencesFolder);
    } catch {
      console.log("References folder does not exist, returning empty array");
      return [];
    }

    const files = await fs.readdir(referencesFolder);
    console.log("Found reference files:", files);

    const references = [];

    for (const file of files) {
      try {
        const filePath = path.join(referencesFolder, file);
        const stats = await fs.stat(filePath);
        const fileExtension = path.extname(file).toLowerCase().slice(1);

        let type = "file";
        if (
          ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(fileExtension)
        ) {
          type = "image";
        } else if (
          ["mp4", "avi", "mov", "wmv", "webm"].includes(fileExtension)
        ) {
          type = "video";
        }

        let data = null;
        if (type === "image") {
          try {
            const imageData = await fs.readFile(filePath);
            data = `data:image/${fileExtension};base64,${imageData.toString(
              "base64"
            )}`;
          } catch (error) {
            console.error("Error reading image file:", file, error);
          }
        }

        references.push({
          name: file,
          data: data,
          type: type,
          size: stats.size,
          path: filePath,
          extension: fileExtension,
        });
      } catch (fileError) {
        console.error("Error processing file:", file, fileError);
      }
    }

    console.log("Returning references:", references.length);
    return references;
  } catch (error) {
    console.error("Error getting references:", error);
    throw error;
  }
});

ipcMain.handle("delete-comm-reference", async (event, commId, filename) => {
  try {
    if (!commId || !filename) {
      throw new Error("Missing commId or filename");
    }

    const filePath = path.join(
      COMMS_DATA_FOLDER,
      commId,
      "references",
      filename
    );
    console.log("Deleting reference file:", filePath);

    await fs.unlink(filePath);
    console.log(
      "Reference deleted successfully:",
      filename,
      "from comm:",
      commId
    );
    return true;
  } catch (error) {
    console.error("Error deleting reference:", error);
    throw error;
  }
});

ipcMain.handle("get-reference-file-path", async (event, commId, filename) => {
  try {
    if (!commId || !filename) {
      throw new Error("Missing commId or filename");
    }

    const filePath = path.join(
      COMMS_DATA_FOLDER,
      commId,
      "references",
      filename
    );
    console.log("Getting file path:", filePath);
    return filePath;
  } catch (error) {
    console.error("Error getting file path:", error);
    throw error;
  }
});

ipcMain.handle("open-file", async (event, filePath) => {
  try {
    if (!filePath) {
      throw new Error("No file path provided");
    }

    console.log("Opening file:", filePath);
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    console.error("Error opening file:", error);
    throw error;
  }
});

// ========== REFERENCE FOLDER HANDLER ==========
ipcMain.handle("get-reference-folder-path", async (event, commId) => {
  try {
    if (!commId) {
      throw new Error("No commId provided");
    }

    const referencesFolder = path.join(COMMS_DATA_FOLDER, commId, "references");

    await fs.mkdir(referencesFolder, { recursive: true });

    console.log("References folder path:", referencesFolder);
    return referencesFolder;
  } catch (error) {
    console.error("Error getting references folder path:", error);
    throw error;
  }
});

// ========== DELETE COMM FOLDER HANDLER ==========
ipcMain.handle("delete-comm-folder", async (event, commId) => {
  try {
    if (!commId) {
      throw new Error("No commId provided");
    }

    const commFolder = path.join(COMMS_DATA_FOLDER, commId);
    console.log("Deleting comm folder:", commFolder);

    try {
      await fs.access(commFolder);
    } catch {
      console.log("Comm folder does not exist, nothing to delete");
      return true;
    }

    await fs.rm(commFolder, { recursive: true, force: true });
    console.log("Comm folder deleted successfully:", commId);
    return true;
  } catch (error) {
    console.error("Error deleting comm folder:", error);
    throw error;
  }
});

// ========== NEW COMM SYSTEM HANDLERS ==========
ipcMain.handle("create-temp-comm", async (event) => {
  try {
    await ensureAppFolders();
    const tempId =
      "temp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const tempFolder = path.join(TEMP_FOLDER, tempId);
    await fs.mkdir(tempFolder, { recursive: true });

    console.log("Temp comm folder created:", tempId);
    return tempId;
  } catch (error) {
    console.error("Error creating temp comm:", error);
    throw error;
  }
});

ipcMain.handle(
  "save-temp-reference",
  async (event, tempId, fileData, filename, fileType = "image") => {
    try {
      if (!tempId || !filename) {
        throw new Error("Missing tempId or filename");
      }

      const tempFolder = path.join(TEMP_FOLDER, tempId, "references");
      await fs.mkdir(tempFolder, { recursive: true });

      const filePath = path.join(tempFolder, filename);
      console.log("Saving temp reference:", filePath);

      if (
        fileType === "image" &&
        typeof fileData === "string" &&
        fileData.startsWith("data:")
      ) {
        const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        await fs.writeFile(filePath, buffer);
      } else if (fileData instanceof ArrayBuffer || Buffer.isBuffer(fileData)) {
        const buffer = Buffer.from(fileData);
        await fs.writeFile(filePath, buffer);
      } else {
        throw new Error("Unsupported file data type");
      }

      console.log("Temp reference saved:", filename);
      return filename;
    } catch (error) {
      console.error("Error saving temp reference:", error);
      throw error;
    }
  }
);

ipcMain.handle("get-temp-references", async (event, tempId) => {
  try {
    if (!tempId) {
      throw new Error("No tempId provided");
    }

    const tempReferencesFolder = path.join(TEMP_FOLDER, tempId, "references");

    try {
      await fs.access(tempReferencesFolder);
    } catch {
      return [];
    }

    const files = await fs.readdir(tempReferencesFolder);
    const references = [];

    for (const file of files) {
      try {
        const filePath = path.join(tempReferencesFolder, file);
        const stats = await fs.stat(filePath);
        const fileExtension = path.extname(file).toLowerCase().slice(1);

        let type = "file";
        if (
          ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(fileExtension)
        ) {
          type = "image";
        } else if (
          ["mp4", "avi", "mov", "wmv", "webm"].includes(fileExtension)
        ) {
          type = "video";
        }

        let data = null;
        if (type === "image") {
          try {
            const imageData = await fs.readFile(filePath);
            data = `data:image/${fileExtension};base64,${imageData.toString(
              "base64"
            )}`;
          } catch (error) {
            console.error("Error reading temp image:", file, error);
          }
        }

        references.push({
          name: file,
          data: data,
          type: type,
          size: stats.size,
          path: filePath,
        });
      } catch (fileError) {
        console.error("Error processing temp file:", file, fileError);
      }
    }

    return references;
  } catch (error) {
    console.error("Error getting temp references:", error);
    throw error;
  }
});

ipcMain.handle("save-individual-comm", async (event, commData) => {
  try {
    if (!commData.id) {
      throw new Error("Comm ID is required");
    }

    const commFolder = path.join(COMMS_DATA_FOLDER, commData.id);
    await fs.mkdir(commFolder, { recursive: true });

    const commFile = path.join(commFolder, "comm.json");
    await fs.writeFile(commFile, JSON.stringify(commData, null, 2));

    console.log("Individual comm saved:", commData.id);
    return true;
  } catch (error) {
    console.error("Error saving individual comm:", error);
    throw error;
  }
});

ipcMain.handle("load-all-individual-comms", async () => {
  try {
    await ensureAppFolders();

    const comms = [];

    try {
      const folders = await fs.readdir(COMMS_DATA_FOLDER);

      for (const folder of folders) {
        if (folder.startsWith("comm_") || folder.startsWith("temp_")) {
          try {
            const commFile = path.join(COMMS_DATA_FOLDER, folder, "comm.json");
            const data = await fs.readFile(commFile, "utf8");
            const commData = JSON.parse(data);
            comms.push(commData);
          } catch (error) {
            console.error("Error loading comm from folder:", folder, error);
          }
        }
      }
    } catch (error) {
      console.log("No comms folder or error reading:", error);
    }

    console.log("Loaded individual comms:", comms.length);
    return comms;
  } catch (error) {
    console.error("Error loading individual comms:", error);
    throw error;
  }
});

ipcMain.handle("move-temp-to-comm", async (event, tempId, commId) => {
  try {
    if (!tempId || !commId) {
      throw new Error("Missing tempId or commId");
    }

    const tempFolder = path.join(TEMP_FOLDER, tempId);
    const commFolder = path.join(COMMS_DATA_FOLDER, commId);

    try {
      await fs.access(tempFolder);
    } catch {
      console.log("Temp folder does not exist, nothing to move");
      return true;
    }

    const tempReferences = path.join(tempFolder, "references");
    const commReferences = path.join(commFolder, "references");

    try {
      await fs.access(tempReferences);
      await fs.mkdir(commReferences, { recursive: true });

      const files = await fs.readdir(tempReferences);
      for (const file of files) {
        const source = path.join(tempReferences, file);
        const destination = path.join(commReferences, file);
        await fs.rename(source, destination);
      }

      console.log("Moved references from temp to comm:", files.length);
    } catch (error) {
      console.log("No references to move or error moving:", error);
    }

    await fs.rm(tempFolder, { recursive: true, force: true });
    console.log("Temp folder cleaned up:", tempId);

    return true;
  } catch (error) {
    console.error("Error moving temp to comm:", error);
    throw error;
  }
});

ipcMain.handle("cancel-temp-comm", async (event, tempId) => {
  try {
    if (!tempId) {
      throw new Error("No tempId provided");
    }

    const tempFolder = path.join(TEMP_FOLDER, tempId);
    await fs.rm(tempFolder, { recursive: true, force: true });

    console.log("Temp comm cancelled and cleaned up:", tempId);
    return true;
  } catch (error) {
    console.error("Error cancelling temp comm:", error);
    throw error;
  }
});

// ========== MIGRATION HANDLER ==========
ipcMain.handle("migrate-to-individual-comms", async () => {
  try {
    console.log("Starting migration to individual comms...");

    let oldComms = [];
    try {
      const data = await fs.readFile(COMMS_FILE, "utf8");
      oldComms = JSON.parse(data);
    } catch (error) {
      console.log("No old comms file found or error reading:", error);
      return { migrated: 0, total: 0 };
    }

    let migratedCount = 0;

    for (const comm of oldComms) {
      try {
        const commFolder = path.join(COMMS_DATA_FOLDER, comm.id);
        await fs.mkdir(commFolder, { recursive: true });

        const commFile = path.join(commFolder, "comm.json");
        await fs.writeFile(commFile, JSON.stringify(comm, null, 2));

        migratedCount++;
        console.log("Migrated comm:", comm.id);
      } catch (error) {
        console.error("Error migrating comm:", comm.id, error);
      }
    }

    try {
      const backupFile = path.join(APP_FOLDER, "comms_backup.json");
      await fs.copyFile(COMMS_FILE, backupFile);
    } catch (error) {
      console.log("Could not create backup:", error);
    }

    console.log(
      `Migration completed: ${migratedCount}/${oldComms.length} comms migrated`
    );
    return { migrated: migratedCount, total: oldComms.length };
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
});

// ========== UTILITY HANDLERS ==========
ipcMain.handle("open-save-folder", async () => {
  try {
    await ensureAppFolders();
    console.log("Opening save folder:", APP_FOLDER);
    await shell.openPath(APP_FOLDER);
    return true;
  } catch (error) {
    console.error("Error opening folder:", error);
    throw error;
  }
});

ipcMain.handle("delete-all-data", async () => {
  try {
    console.log("Deleting all data...");

    try {
      await fs.unlink(CONFIG_FILE);
      console.log("Config file deleted");
    } catch (e) {
      console.log("Config file not found or already deleted");
    }

    try {
      await fs.unlink(COMMS_FILE);
      console.log("Comms file deleted");
    } catch (e) {
      console.log("Comms file not found or already deleted");
    }

    try {
      await fs.rm(BACKGROUNDS_FOLDER, { recursive: true, force: true });
      console.log("Backgrounds folder deleted");
    } catch (e) {
      console.log("Backgrounds folder not found or already deleted");
    }

    try {
      await fs.rm(COMMS_DATA_FOLDER, { recursive: true, force: true });
      console.log("Comms data folder deleted");
    } catch (e) {
      console.log("Comms data folder not found or already deleted");
    }

    try {
      await fs.rm(TEMP_FOLDER, { recursive: true, force: true });
      console.log("Temp folder deleted");
    } catch (e) {
      console.log("Temp folder not found or already deleted");
    }

    try {
      const files = await fs.readdir(APP_FOLDER);
      if (files.length === 0) {
        await fs.rmdir(APP_FOLDER);
        console.log("App folder deleted (was empty)");
      }
    } catch (e) {
      console.log("Could not delete app folder or not empty");
    }

    console.log("All data deleted successfully");
    return true;
  } catch (error) {
    console.error("Error deleting all data:", error);
    throw error;
  }
});

// ========== CLEANUP ORPHANED COMMS HANDLER ==========
ipcMain.handle("cleanup-orphaned-comms", async () => {
  try {
    console.log("Cleaning up orphaned comms...");

    const commsData = await fs.readFile(COMMS_FILE, "utf8").catch(() => "[]");
    const comms = JSON.parse(commsData);
    const validCommIds = comms.map((comm) => comm.id);

    const folders = await fs.readdir(COMMS_DATA_FOLDER).catch(() => []);

    let deletedCount = 0;

    for (const folder of folders) {
      if (!validCommIds.includes(folder)) {
        const folderPath = path.join(COMMS_DATA_FOLDER, folder);
        await fs.rm(folderPath, { recursive: true, force: true });
        console.log("Deleted orphaned comm folder:", folder);
        deletedCount++;
      }
    }

    console.log(`Cleanup completed: ${deletedCount} orphaned folders deleted`);
    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up orphaned comms:", error);
    throw error;
  }
});

// ========== APP LIFECYCLE ==========
app.whenReady().then(() => {
  console.log("App ready, creating window...");
  createWindow();
});

app.on("window-all-closed", () => {
  console.log("All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  console.log("App activated");
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("ready", () => {
  console.log("App is ready");
});

app.on("before-quit", () => {
  console.log("App is about to quit");
});
