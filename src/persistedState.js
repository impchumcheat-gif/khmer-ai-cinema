const DATABASE_NAME = 'khmer-ai-cinema';
const DATABASE_VERSION = 1;
const STATE_STORE = 'app-state';
const STATE_KEY = 'current';

let writeQueue = Promise.resolve();

const openDatabase = () => new Promise((resolve, reject) => {
  if (!window.indexedDB) {
    reject(new Error('IndexedDB is not available in this browser.'));
    return;
  }

  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STATE_STORE)) {
      database.createObjectStore(STATE_STORE);
    }
  };
  request.onerror = () => reject(request.error || new Error('Could not open the local database.'));
  request.onsuccess = () => resolve(request.result);
});

export const loadAppState = async () => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STATE_STORE, 'readonly');
    const request = transaction.objectStore(STATE_STORE).get(STATE_KEY);

    request.onsuccess = () => {
      database.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error('Could not load saved data.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Could not load saved data.'));
    };
  });
};

export const saveAppState = (state) => {
  const write = writeQueue.then(async () => {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STATE_STORE, 'readwrite');
      transaction.objectStore(STATE_STORE).put(state, STATE_KEY);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Could not save data.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('Could not save data.'));
      };
    });
  });

  writeQueue = write.catch(() => undefined);
  return write;
};
