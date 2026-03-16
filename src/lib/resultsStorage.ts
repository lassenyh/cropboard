const DB_NAME = "cropboard-results-db";
const STORE_NAME = "results";
const KEY = "latest";

export type StoredResult = {
  filename: string;
  originalWidth: number;
  originalHeight: number;
  cropWidth: number;
  cropHeight: number;
  mimeType: string;
  dataUrl: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
  });
}

export function saveResults(results: StoredResult[]): Promise<void> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(results, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function loadResults(): Promise<StoredResult[] | null> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => {
        db.close();
        const value = req.result;
        resolve(
          Array.isArray(value) && value.length > 0 ? value : null
        );
      };
      req.onerror = () => reject(req.error);
    });
  });
}
