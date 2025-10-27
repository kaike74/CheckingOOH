// =============================================================================
// 📁 DRIVE FOLDER UTILS - Utilitário centralizado para gerenciar pastas
// =============================================================================
// Proteção contra race conditions com Map de locks em memória
// Este módulo implementa um sistema de locks para evitar duplicação de pastas

const createFolderLocks = new Map(); // key -> Promise resolving to folder object { id, name }

function makeLockKey(parentId, folderName) {
  return `${parentId}:::${folderName}`;
}

function escapeForQuery(name) {
  if (typeof name !== 'string') return name;
  // Escape backslashes first, then single quotes
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findFolder(folderName, parentId, accessToken) {
  try {
    const escaped = escapeForQuery(folderName);
    const q = `name='${escaped}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn('findFolder: search failed', res.status, t);
      return null;
    }
    const body = await res.json();
    if (body.files && body.files.length > 0) {
      if (body.files.length > 1) {
        console.warn(`⚠️ Encontradas ${body.files.length} pastas duplicadas "${folderName}" em parent ${parentId}. Usando a primeira.`);
      }
      return body.files[0];
    }
    return null;
  } catch (err) {
    console.error('findFolder error', err);
    return null;
  }
}

async function createFolder(folderName, parentId, accessToken) {
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    }
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Erro ao criar pasta: ${createRes.status} - ${text}`);
  }

  const created = await createRes.json();
  return created;
}

async function findOrCreateFolder(folderName, parentId, accessToken) {
  if (!parentId) {
    throw new Error('findOrCreateFolder: parentId obrigatório');
  }
  const key = makeLockKey(parentId, folderName);

  if (createFolderLocks.has(key)) {
    console.log(`⏳ aguardando promessa existente para pasta "${folderName}" (parent: ${parentId})`);
    return createFolderLocks.get(key);
  }

  const p = (async () => {
    try {
      const existing = await findFolder(folderName, parentId, accessToken);
      if (existing) {
        return existing;
      }

      console.log(`📁 Criando pasta "${folderName}" em parent ${parentId}...`);
      const created = await createFolder(folderName, parentId, accessToken);

      const after = await findFolder(folderName, parentId, accessToken);
      if (after) {
        return after;
      }

      return { id: created.id, name: created.name };
    } catch (err) {
      console.error(`❌ Erro em findOrCreateFolder("${folderName}")`, err);
      throw err;
    }
  })();

  createFolderLocks.set(key, p);

  p
    .catch(() => {})
    .then(() => {
      createFolderLocks.delete(key);
    });

  return p;
}

export {
  findOrCreateFolder,
  findFolder
};
