const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getUserDataPath: () => {
        return new Promise((resolve) => {
            // Implementation would be added here if needed
            resolve(null);
        });
    }
});
