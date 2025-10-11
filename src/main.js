const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

console.log('Main process starting...');
console.log('__dirname:', __dirname);

// Configuration paths
const DOCUMENTS_PATH = path.join(os.homedir(), 'Documents');
const APP_FOLDER = path.join(DOCUMENTS_PATH, 'CommTool');
const CONFIG_FILE = path.join(APP_FOLDER, 'config.json');
const COMMS_FILE = path.join(APP_FOLDER, 'comms.json');
const BACKGROUNDS_FOLDER = path.join(APP_FOLDER, 'backgrounds');
const COMMS_DATA_FOLDER = path.join(APP_FOLDER, 'Comms');

let mainWindow;

function createWindow() {
    console.log('Creating main window...');

    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('Preload path:', preloadPath);
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, '../assets/icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            webSecurity: false
        },
        autoHideMenuBar: true, // Esconde el Menu de la ventana
        show: false,
        title: 'Comm Tool Manager'
    });

    // Ruta del HTML
    const htmlPath = path.join(__dirname, 'renderer', 'index.html');
    console.log('HTML path:' , htmlPath);

    mainWindow.loadFile(htmlPath);

    mainWindow.once('ready-to-show', () => {
        console.log('Window ready to show');
        mainWindow.show();
        //mainWindow.webContents.openDevTools(); // Para debug
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Helper functions
async function ensureAppFolders() {
    try {
        await fs.mkdir(APP_FOLDER, { recursive: true });
        await fs.mkdir(BACKGROUNDS_FOLDER, { recursive: true });
        await fs.mkdir(COMMS_DATA_FOLDER, { recursive: true });
        console.log('App folders created successfully');
        return true;
    } catch (error) {
        console.error('Error creating app folders:', error);
        throw error;
    }
}

// ========== CONFIGURATION HANDLERS ==========
ipcMain.handle('load-config', async () => {
    try {
        await ensureAppFolders();
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        console.log('Config loaded from file:', config);
        return config;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Config file not found, creating default');
            const defaultConfig = {
                username: 'User',
                theme: 'light',
                primaryColor: '#3b82f6',
                language: 'en',
                backgroundImage: null,
                backgroundAllPages: false,
                zoomLevel: '100'
            };
            await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        console.error('Error loading config:', error);
        throw error;
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        await ensureAppFolders();
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log('Config saved to file:', config);
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        throw error;
    }
});

// ========== COMMS HANDLERS ==========
ipcMain.handle('load-comms', async () => {
    try {
        await ensureAppFolders();
        const data = await fs.readFile(COMMS_FILE, 'utf8');
        const comms = JSON.parse(data);
        console.log('Comms loaded from file:', comms.length);
        return comms;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Comms file not found, creating empty');
            await fs.writeFile(COMMS_FILE, '[]');
            return [];
        }
        console.error('Error loading comms:', error);
        throw error;
    }
});

ipcMain.handle('save-comms', async (event, comms) => {
    try {
        await ensureAppFolders();
        await fs.writeFile(COMMS_FILE, JSON.stringify(comms, null, 2));
        console.log('Comms saved to file:', comms.length);
        return true;
    } catch (error) {
        console.error('Error saving comms:', error);
        throw error;
    }
});

// ========== BACKGROUND IMAGE HANDLERS ==========
ipcMain.handle('save-background-image', async (event, imageData, filename) => {
    try {
        await ensureAppFolders();
        const imagePath = path.join(BACKGROUNDS_FOLDER, filename);
        
        console.log('Saving background image:', filename);
        
        // Convert base64 to buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        await fs.writeFile(imagePath, buffer);
        console.log('Background image saved successfully:', filename);
        return filename;
    } catch (error) {
        console.error('Error saving background image:', error);
        throw error;
    }
});

ipcMain.handle('load-background-image', async (event, filename) => {
    try {
        if (!filename) {
            throw new Error('No filename provided');
        }
        
        const imagePath = path.join(BACKGROUNDS_FOLDER, filename);
        console.log('Loading background image from:', imagePath);
        
        const data = await fs.readFile(imagePath);
        const base64 = `data:image/jpeg;base64,${data.toString('base64')}`;
        console.log('Background image loaded successfully:', filename);
        return base64;
    } catch (error) {
        console.error('Error loading background image:', error);
        throw error;
    }
});

ipcMain.handle('delete-background-image', async (event, filename) => {
    try {
        if (!filename) {
            throw new Error('No filename provided');
        }
        
        const imagePath = path.join(BACKGROUNDS_FOLDER, filename);
        await fs.unlink(imagePath);
        console.log('Background image deleted:', filename);
        return true;
    } catch (error) {
        console.error('Error deleting background image:', error);
        throw error;
    }
});

// ========== COMM REFERENCES HANDLERS ==========
ipcMain.handle('save-comm-reference', async (event, commId, fileData, filename, fileType = 'image') => {
    try {
        if (!commId || !filename) {
            throw new Error('Missing commId or filename');
        }
        
        const referencesFolder = path.join(COMMS_DATA_FOLDER, commId, 'references');
        await fs.mkdir(referencesFolder, { recursive: true });

        const filePath = path.join(referencesFolder, filename);
        console.log('Saving reference file:', filePath);

        if (fileType === 'image' && typeof fileData === 'string' && fileData.startsWith('data:')) {
            // Es una imagen en base64
            const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(filePath, buffer);
        } else if (fileData instanceof ArrayBuffer || Buffer.isBuffer(fileData)) {
            // Es un archivo binario (video, pdf, etc.)
            const buffer = Buffer.from(fileData);
            await fs.writeFile(filePath, buffer);
        } else {
            throw new Error('Unsupported file data type');
        }

        console.log('Reference saved successfully:', filename, 'for comm:', commId);
        return filename;
    } catch (error) {
        console.error('Error saving reference:', error);
        throw error;
    }
});

ipcMain.handle('get-comm-references', async (event, commId) => {
    try {
        if (!commId) {
            throw new Error('No commId provided');
        }
        
        const referencesFolder = path.join(COMMS_DATA_FOLDER, commId, 'references');
        console.log('Loading references from:', referencesFolder);
        
        // Verificar si la carpeta existe
        try {
            await fs.access(referencesFolder);
        } catch {
            console.log('References folder does not exist, returning empty array');
            return []; // Si no existe, devolver array vacío
        }

        const files = await fs.readdir(referencesFolder);
        console.log('Found reference files:', files);
        
        const references = [];

        for (const file of files) {
            try {
                const filePath = path.join(referencesFolder, file);
                const stats = await fs.stat(filePath);
                const fileExtension = path.extname(file).toLowerCase().slice(1);

                // Determinar tipo de archivo
                let type = 'file';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExtension)) {
                    type = 'image';
                } else if (['mp4', 'avi', 'mov', 'wmv', 'webm'].includes(fileExtension)) {
                    type = 'video';
                }

                // Para imágenes, leer y convertir a base64 para preview
                let data = null;
                if (type === 'image') {
                    try {
                        const imageData = await fs.readFile(filePath);
                        data = `data:image/${fileExtension};base64,${imageData.toString('base64')}`;
                    } catch (error) {
                        console.error('Error reading image file:', file, error);
                    }
                }

                references.push({
                    name: file,
                    data: data,
                    type: type,
                    size: stats.size,
                    path: filePath,
                    extension: fileExtension
                });
            } catch (fileError) {
                console.error('Error processing file:', file, fileError);
            }
        }

        console.log('Returning references:', references.length);
        return references;
    } catch (error) {
        console.error('Error getting references:', error);
        throw error;
    }
});

ipcMain.handle('delete-comm-reference', async (event, commId, filename) => {
    try {
        if (!commId || !filename) {
            throw new Error('Missing commId or filename');
        }
        
        const filePath = path.join(COMMS_DATA_FOLDER, commId, 'references', filename);
        console.log('Deleting reference file:', filePath);
        
        await fs.unlink(filePath);
        console.log('Reference deleted successfully:', filename, 'from comm:', commId);
        return true;
    } catch (error) {
        console.error('Error deleting reference:', error);
        throw error;
    }
});

ipcMain.handle('get-reference-file-path', async (event, commId, filename) => {
    try {
        if (!commId || !filename) {
            throw new Error('Missing commId or filename');
        }
        
        const filePath = path.join(COMMS_DATA_FOLDER, commId, 'references', filename);
        console.log('Getting file path:', filePath);
        return filePath;
    } catch (error) {
        console.error('Error getting file path:', error);
        throw error;
    }
});

ipcMain.handle('open-file', async (event, filePath) => {
    try {
        if (!filePath) {
            throw new Error('No file path provided');
        }
        
        console.log('Opening file:', filePath);
        await shell.openPath(filePath);
        return true;
    } catch (error) {
        console.error('Error opening file:', error);
        throw error;
    }
});

// ========== REFERENCE FOLDER HANDLER ==========
ipcMain.handle('get-reference-folder-path', async (event, commId) => {
    try {
        if (!commId) {
            throw new Error('No commId provided');
        }
        
        const referencesFolder = path.join(COMMS_DATA_FOLDER, commId, 'references');
        
        // Asegurar que la carpeta existe
        await fs.mkdir(referencesFolder, { recursive: true });
        
        console.log('References folder path:', referencesFolder);
        return referencesFolder;
    } catch (error) {
        console.error('Error getting references folder path:', error);
        throw error;
    }
});

// ========== DELETE COMM FOLDER HANDLER ==========
ipcMain.handle('delete-comm-folder', async (event, commId) => {
    try {
        if (!commId) {
            throw new Error('No commId provided');
        }
        
        const commFolder = path.join(COMMS_DATA_FOLDER, commId);
        console.log('Deleting comm folder:', commFolder);
        
        // Verificar si la carpeta existe antes de intentar borrarla
        try {
            await fs.access(commFolder);
        } catch {
            console.log('Comm folder does not exist, nothing to delete');
            return true; // Si no existe, consideramos éxito
        }
        
        // Eliminar la carpeta y todo su contenido recursivamente
        await fs.rm(commFolder, { recursive: true, force: true });
        console.log('Comm folder deleted successfully:', commId);
        return true;
    } catch (error) {
        console.error('Error deleting comm folder:', error);
        throw error;
    }
});

// ========== UTILITY HANDLERS ==========
ipcMain.handle('open-save-folder', async () => {
    try {
        await ensureAppFolders();
        console.log('Opening save folder:', APP_FOLDER);
        await shell.openPath(APP_FOLDER);
        return true;
    } catch (error) {
        console.error('Error opening folder:', error);
        throw error;
    }
});

ipcMain.handle('delete-all-data', async () => {
    try {
        console.log('Deleting all data...');
        
        // Delete configuration files
        try { 
            await fs.unlink(CONFIG_FILE); 
            console.log('Config file deleted');
        } catch (e) {
            console.log('Config file not found or already deleted');
        }
        
        try { 
            await fs.unlink(COMMS_FILE); 
            console.log('Comms file deleted');
        } catch (e) {
            console.log('Comms file not found or already deleted');
        }
        
        // Delete ALL folders recursively
        try { 
            await fs.rm(BACKGROUNDS_FOLDER, { recursive: true, force: true }); 
            console.log('Backgrounds folder deleted');
        } catch (e) {
            console.log('Backgrounds folder not found or already deleted');
        }
        
        try { 
            await fs.rm(COMMS_DATA_FOLDER, { recursive: true, force: true }); 
            console.log('Comms data folder deleted');
        } catch (e) {
            console.log('Comms data folder not found or already deleted');
        }
        
        // También eliminar la carpeta principal de la app si está vacía
        try {
            const files = await fs.readdir(APP_FOLDER);
            if (files.length === 0) {
                await fs.rmdir(APP_FOLDER);
                console.log('App folder deleted (was empty)');
            }
        } catch (e) {
            console.log('Could not delete app folder or not empty');
        }
        
        console.log('All data deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting all data:', error);
        throw error;
    }
});

// ========== CLEANUP ORPHANED COMMS HANDLER ==========
ipcMain.handle('cleanup-orphaned-comms', async () => {
    try {
        console.log('Cleaning up orphaned comms...');
        
        // Cargar comms del JSON
        const commsData = await fs.readFile(COMMS_FILE, 'utf8').catch(() => '[]');
        const comms = JSON.parse(commsData);
        const validCommIds = comms.map(comm => comm.id);
        
        // Obtener todas las carpetas en COMMS_DATA_FOLDER
        const folders = await fs.readdir(COMMS_DATA_FOLDER).catch(() => []);
        
        let deletedCount = 0;
        
        for (const folder of folders) {
            // Si la carpeta no corresponde a una comm válida en el JSON, eliminarla
            if (!validCommIds.includes(folder)) {
                const folderPath = path.join(COMMS_DATA_FOLDER, folder);
                await fs.rm(folderPath, { recursive: true, force: true });
                console.log('Deleted orphaned comm folder:', folder);
                deletedCount++;
            }
        }
        
        console.log(`Cleanup completed: ${deletedCount} orphaned folders deleted`);
        return deletedCount;
    } catch (error) {
        console.error('Error cleaning up orphaned comms:', error);
        throw error;
    }
});

// ========== APP LIFECYCLE ==========
app.whenReady().then(() => {
    console.log('App ready, creating window...');
    createWindow();
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    console.log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('ready', () => {
    console.log('App is ready');
});

app.on('before-quit', () => {
    console.log('App is about to quit');
});