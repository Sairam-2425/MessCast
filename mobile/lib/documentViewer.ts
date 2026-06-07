import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

// ─── MIME / type detection ────────────────────────────────────────────────────
// Cloudinary stores the upload's mimetype, but older messages or odd uploads
// may be missing it — fall back to the file extension so the OS still gets a
// usable type to pick a viewer with.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt:  'text/plain',
  json: 'application/json',
  csv:  'text/csv',
};

const EXTENSION_LABELS: Record<string, string> = {
  pdf:  'PDF',
  doc:  'Word Document',
  docx: 'Word Document',
  xls:  'Excel Spreadsheet',
  xlsx: 'Excel Spreadsheet',
  ppt:  'PowerPoint Presentation',
  pptx: 'PowerPoint Presentation',
  txt:  'Text File',
  json: 'JSON File',
  csv:  'CSV File',
};

function extensionOf(fileName?: string | null): string | null {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : null;
}

export function getDocumentTypeLabel(fileName?: string | null): string {
  const ext = extensionOf(fileName);
  return (ext && EXTENSION_LABELS[ext]) || 'Document';
}

export function resolveMimeType(fileName?: string | null, declaredMime?: string | null): string {
  if (declaredMime && declaredMime !== 'application/octet-stream') return declaredMime;
  const ext = extensionOf(fileName);
  return (ext && EXTENSION_MIME_TYPES[ext]) || declaredMime || 'application/octet-stream';
}

// ─── Local cache ──────────────────────────────────────────────────────────────

const CACHE_DIR = `${FileSystem.cacheDirectory}documents/`;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Downloads the document into the local cache (or reuses an existing copy),
// returning a `file://` URI that native viewers can be granted access to.
// Cloudinary URLs are content-addressed (the filename + size never change for
// a given message), so a same-named cached file is always the same content.
async function ensureCached(uri: string, fileName: string): Promise<string> {
  await ensureCacheDir();
  const localUri = `${CACHE_DIR}${sanitizeFileName(fileName)}`;

  const existing = await FileSystem.getInfoAsync(localUri);
  if (existing.exists && existing.size > 0) {
    console.log('[DocumentViewer] using cached copy', localUri);
    return localUri;
  }

  console.log('[DocumentViewer] downloading', uri, '→', localUri);
  const result = await FileSystem.downloadAsync(uri, localUri);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed with status ${result.status}`);
  }
  console.log('[DocumentViewer] downloaded', result.uri);
  return result.uri;
}

// Deletes cached documents older than MAX_CACHE_AGE_MS. Called opportunistically
// (not on a timer) — once per app session is enough to keep the cache bounded.
let cleaned = false;
export async function cleanDocumentCacheOnce() {
  if (cleaned) return;
  cleaned = true;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) return;
    const names = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const now = Date.now();
    await Promise.all(names.map(async (name) => {
      const path = `${CACHE_DIR}${name}`;
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (fileInfo.exists && !fileInfo.isDirectory && fileInfo.modificationTime) {
        const ageMs = now - fileInfo.modificationTime * 1000;
        if (ageMs > MAX_CACHE_AGE_MS) {
          console.log('[DocumentViewer] removing stale cached file', path);
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      }
    }));
  } catch (err) {
    console.log('[DocumentViewer] cache cleanup failed', err instanceof Error ? err.message : err);
  }
}

// ─── Open ─────────────────────────────────────────────────────────────────────

export class NoViewerAppError extends Error {}

// Downloads the file locally (native viewers need a local/content URI — they
// generally can't stream a remote https URL directly) and asks the OS to open
// it with the correct MIME type. On Android this triggers the system's
// "Open with…" chooser (Word/Excel/PowerPoint/PDF reader/etc, exactly like
// WhatsApp); on iOS the share sheet's "Open in…" row serves the same purpose
// since iOS has no public ACTION_VIEW-style intent API.
export async function openDocument(opts: {
  uri: string;
  fileName: string;
  mimeType?: string | null;
}): Promise<void> {
  const { uri, fileName } = opts;
  const mimeType = resolveMimeType(fileName, opts.mimeType);
  console.log('[DocumentViewer] opening', { uri, fileName, mimeType });

  const localUri = await ensureCached(uri, fileName);

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION — required for content:// URIs
        type: mimeType,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[DocumentViewer] startActivityAsync failed', message);
      if (/no activity found|activitynotfound/i.test(message)) {
        throw new NoViewerAppError(message);
      }
      throw err;
    }
  } else {
    const available = await Sharing.isAvailableAsync();
    if (!available) throw new NoViewerAppError('Sharing is not available on this device');
    await Sharing.shareAsync(localUri, { mimeType, UTI: undefined, dialogTitle: fileName });
  }
}

export async function shareDocument(opts: { uri: string; fileName: string; mimeType?: string | null }): Promise<void> {
  const { uri, fileName } = opts;
  const mimeType = resolveMimeType(fileName, opts.mimeType);
  const localUri = await ensureCached(uri, fileName);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(localUri, { mimeType, dialogTitle: fileName });
}
