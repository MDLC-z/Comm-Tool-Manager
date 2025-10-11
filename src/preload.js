console.log('Preload script starting...');

const { contextBridge, ipcRenderer } = require('electron');

// API que usa IPC para comunicación con el main process
const electronAPI = {
    // ========== CONFIGURATION ==========
    async loadConfig() {
        console.log('loadConfig called from preload');
        try {
            const config = await ipcRenderer.invoke('load-config');
            console.log('Config loaded successfully via IPC:', config);
            return config;
        } catch (error) {
            console.error('Error loading config via IPC:', error);
            // Fallback to default config
            const defaultConfig = {
                username: 'User',
                theme: 'light',
                primaryColor: '#3b82f6',
                language: 'en',
                backgroundImage: null,
                backgroundAllPages: false,
                zoomLevel: '100'
            };
            console.log('Using default config due to error');
            return defaultConfig;
        }
    },

    async saveConfig(config) {
        console.log('saveConfig called with:', config);
        try {
            const result = await ipcRenderer.invoke('save-config', config);
            console.log('Config saved successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error saving config via IPC:', error);
            throw error;
        }
    },

    // ========== CUSTOM BACKGROUNDS ==========
    async saveBackgroundImage(imageData, filename) {
        console.log('saveBackgroundImage called:', filename);
        try {
            const result = await ipcRenderer.invoke('save-background-image', imageData, filename);
            console.log('Background image saved successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error saving background image via IPC:', error);
            throw error;
        }
    },

    async loadBackgroundImage(filename) {
        console.log('loadBackgroundImage called:', filename);
        try {
            const imageData = await ipcRenderer.invoke('load-background-image', filename);
            console.log('Background image loaded successfully via IPC');
            return imageData;
        } catch (error) {
            console.error('Error loading background image via IPC:', error);
            // Fallback to placeholder
            const placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzNiODJmNiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QmFja2dyb3VuZDwvdGV4dD48L3N2Zz4=';
            console.log('Using placeholder due to error');
            return placeholder;
        }
    },

    async deleteBackgroundImage(filename) {
        console.log('deleteBackgroundImage called:', filename);
        try {
            const result = await ipcRenderer.invoke('delete-background-image', filename);
            console.log('Background image deleted successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error deleting background image via IPC:', error);
            throw error;
        }
    },

    // ========== COMMS ==========
    async loadComms() {
        console.log('loadComms called from preload');
        try {
            const comms = await ipcRenderer.invoke('load-comms');
            console.log('Comms loaded successfully via IPC:', comms.length);
            return comms;
        } catch (error) {
            console.error('Error loading comms via IPC:', error);
            console.log('Returning empty array due to error');
            return [];
        }
    },

    async saveComms(comms) {
        console.log('saveComms called with', comms.length, 'comms');
        try {
            const result = await ipcRenderer.invoke('save-comms', comms);
            console.log('Comms saved successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error saving comms via IPC:', error);
            throw error;
        }
    },

    // ========== REFERENCE FOLDER ==========
    async getReferenceFolderPath(commId) {
        console.log('getReferenceFolderPath called:', commId);
        try {
            const folderPath = await ipcRenderer.invoke('get-reference-folder-path', commId);
            console.log('References folder path retrieved via IPC:', folderPath);
            return folderPath;
        } catch (error) {
            console.error('Error getting references folder path via IPC:', error);
            throw error;
        }
    },

    // ========== COMM REFERENCES ==========
    async saveCommReference(commId, fileData, filename, fileType = 'image') {
        console.log('saveCommReference called:', { commId, filename, fileType });
        try {
            const result = await ipcRenderer.invoke('save-comm-reference', commId, fileData, filename, fileType);
            console.log('Reference saved successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error saving reference via IPC:', error);
            throw error;
        }
    },

    async getCommReferences(commId) {
        console.log('getCommReferences called:', commId);
        try {
            const references = await ipcRenderer.invoke('get-comm-references', commId);
            console.log('References loaded successfully via IPC:', references.length);
            return references;
        } catch (error) {
            console.error('Error loading references via IPC:', error);
            console.log('Returning empty array due to error');
            return [];
        }
    },

    async deleteCommReference(commId, filename) {
        console.log('deleteCommReference called:', { commId, filename });
        try {
            const result = await ipcRenderer.invoke('delete-comm-reference', commId, filename);
            console.log('Reference deleted successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error deleting reference via IPC:', error);
            throw error;
        }
    },

    async getReferenceFilePath(commId, filename) {
        console.log('getReferenceFilePath called:', { commId, filename });
        try {
            const filePath = await ipcRenderer.invoke('get-reference-file-path', commId, filename);
            console.log('File path retrieved successfully via IPC:', filePath);
            return filePath;
        } catch (error) {
            console.error('Error getting file path via IPC:', error);
            throw error;
        }
    },

    async openFile(filePath) {
        console.log('openFile called:', filePath);
        try {
            const result = await ipcRenderer.invoke('open-file', filePath);
            console.log('File opened successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error opening file via IPC:', error);
            throw error;
        }
    },

    // ========== DELETE COMM FOLDER ==========
    async deleteCommFolder(commId) {
        console.log('deleteCommFolder called:', commId);
        try {
            const result = await ipcRenderer.invoke('delete-comm-folder', commId);
            console.log('Comm folder deleted via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error deleting comm folder via IPC:', error);
            throw error;
        }
    },

    // ========== CLEANUP ORPHANED COMMS ==========
    async cleanupOrphanedComms() {
        console.log('cleanupOrphanedComms called');
        try {
            const result = await ipcRenderer.invoke('cleanup-orphaned-comms');
            console.log('Orphaned comms cleaned up via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error cleaning up orphaned comms via IPC:', error);
            throw error;
        }
    },

    // ========== UTILITIES ==========
    async openSaveFolder() {
        console.log('openSaveFolder called');
        try {
            const result = await ipcRenderer.invoke('open-save-folder');
            console.log('Folder opened successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error opening folder via IPC:', error);
            throw error;
        }
    },

    async deleteAllData() {
        console.log('deleteAllData called');
        try {
            const result = await ipcRenderer.invoke('delete-all-data');
            console.log('All data deleted successfully via IPC:', result);
            return result;
        } catch (error) {
            console.error('Error deleting all data via IPC:', error);
            throw error;
        }
    },

    // ========== TEST METHODS ==========
    testConnection: async () => {
        console.log('Testing IPC connection...');
        try {
            const result = await ipcRenderer.invoke('load-config');
            console.log('IPC connection test successful:', result !== undefined);
            return true;
        } catch (error) {
            console.error('IPC connection test failed:', error);
            return false;
        }
    }
};

// Exponer la API al renderer usando contextBridge
try {
    console.log('Exposing electronAPI to renderer...');
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
    console.log('electronAPI exposed successfully');
    console.log('Available methods:', Object.keys(electronAPI));
    
    // Test the connection
    setTimeout(async () => {
        console.log('Testing IPC connection...');
        const connected = await electronAPI.testConnection();
        console.log('IPC Connection test result:', connected);
    }, 1000);
    
} catch (error) {
    console.error('Error exposing electronAPI:', error);
    // Fallback: expose directly to window (no context isolation)
    console.log('Falling back to window.electronAPI');
    window.electronAPI = electronAPI;
}

console.log('Preload script loaded successfully');

// Evento para cuando el renderer está listo
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded in preload');
});