// frontend/src/utils/db.js

const DB_NAME = 'BusinessAnalyticsDB';
const DB_VERSION = 1;
const STORE_NAME = 'persistentCache';

let dbPromise = null;

function initDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });

    return dbPromise;
}

/**
 * Lấy một giá trị từ IndexedDB.
 * @param {IDBValidKey} key - Key của mục cần lấy.
 * @returns {Promise<any>} - Promise sẽ resolve với giá trị, hoặc undefined nếu không tìm thấy.
 */
export async function get(key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            console.error(`Error getting item with key ${key} from IndexedDB:`, event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Lưu một giá trị vào IndexedDB.
 * @param {IDBValidKey} key - Key của mục cần lưu.
 * @param {any} value - Giá trị cần lưu.
 * @returns {Promise<void>} - Promise sẽ resolve khi việc lưu hoàn tất.
 */
export async function set(key, value) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error(`Error setting item with key ${key} in IndexedDB:`, event.target.error);
            reject(event.target.error);
        };
    });
}
