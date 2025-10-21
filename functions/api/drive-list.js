// Original functions from the main branch...

// Existing findFolder function...

// New findOrCreateFolder function
async function findOrCreateFolder(folderName) {
    const folder = await findFolder(folderName);
    if (folder) {
        return folder;
    }
    const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        })
    });
    const newFolder = await response.json();
    return { id: newFolder.id, name: newFolder.name };
}

// Modified buildFolderStructure function
async function buildFolderStructure() {
    const exibidoraFolder = await findOrCreateFolder('Exibidora');
    const campanhaFolder = await findOrCreateFolder('Campanha');
    const tipoFolder = await findOrCreateFolder('Tipo');
    // Keep other logic unchanged...
}

// All other functions unchanged...
