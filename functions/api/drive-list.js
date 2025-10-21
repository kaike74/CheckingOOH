// Add this function to the file
async function findOrCreateFolder(folderName, parentFolderId) {
    const folderId = await findFolder(folderName, parentFolderId);
    if (folderId) {
        return folderId;
    } else {
        // Create the folder if it doesn't exist
        const newFolder = await createFolder(folderName, parentFolderId);
        return newFolder.id;
    }
}

// Modify the buildFolderStructure function
async function buildFolderStructure(databaseId) {
    const parentFolderId = await findOrCreateFolder('Exibidora', rootFolderId);
    const campanhaFolderId = await findOrCreateFolder(`Campanha (${databaseId})`, parentFolderId);
    
    const entradaFolderId = await findOrCreateFolder('Entrada', campanhaFolderId);
    const saidaFolderId = await findOrCreateFolder('Saida', campanhaFolderId);

    // Return success with empty file list when folders are newly created
    return {
        status: 'success',
        files: []
    };
}