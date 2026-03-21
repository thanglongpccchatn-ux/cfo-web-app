/**
 * Google Drive API Service Layer (OAuth2)
 * Handles authentication and folder/file operations.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// This will be populated from an environment variable or a configuration file.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''; 

let tokenClient;
let accessToken = null;

/**
 * Initialize the Google Identity Services client
 */
export const initGoogleAuth = () => {
    return new Promise((resolve, reject) => {
        if (!window.google) {
            reject(new Error('Google Identity Services script not loaded.'));
            return;
        }

        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.error !== undefined) {
                    reject(response);
                }
                accessToken = response.access_token;
                console.log('Google Auth success:', response);
                resolve(response);
            },
        });
        resolve();
    });
};

/**
 * Request access token
 */
export const requestAccessToken = () => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            initGoogleAuth().then(() => {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            }).catch(reject);
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
};

/**
 * Generic fetch wrapper for Google Drive API
 */
async function driveFetch(url, options = {}) {
    if (!accessToken) {
        throw new Error('Google Drive connection required.');
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Drive API error');
    }

    return response.json();
}

/**
 * Create a folder in Google Drive
 */
export async function createFolder(name, parentId = null) {
    const body = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
        body.parents = [parentId];
    }

    return driveFetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

/**
 * Create the standard folder structure for a project
 */
export async function createProjectFolderStructure(projectName, internalCode) {
    // 1. Root folder
    const rootFolderName = `[${internalCode}] - ${projectName}`;
    const rootFolder = await createFolder(rootFolderName);
    const rootId = rootFolder.id;

    // 2. Sub-folders
    const subfolders = ['Hợp đồng', 'Phụ lục', 'Phát sinh', 'Bản vẽ', 'Thanh toán'];
    for (const name of subfolders) {
        await createFolder(name, rootId);
    }

    return {
        id: rootId,
        link: `https://drive.google.com/drive/folders/${rootId}`
    };
}

/**
 * List subfolders of a specific folder
 */
export async function getSubfolders(parentId) {
    const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
    const result = await driveFetch(url);
    return result.files || [];
}

/**
 * Upload a file to Google Drive
 */
export async function uploadFile(file, parentId = null) {
    if (!accessToken) throw new Error('Google Drive connection required.');

    const metadata = {
        name: file.name,
        parents: parentId ? [parentId] : []
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Upload failed');
    }

    return response.json();
}

export const isConnected = () => !!accessToken;
