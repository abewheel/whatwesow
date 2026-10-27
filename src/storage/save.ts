import { parseState, type GameState } from "../game/state";
export async function openSaveStore(namespace: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`whatwesow-${namespace}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("saves");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function readRaw(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("saves")
        .objectStore("saves")
        .get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return {
    readRaw,
    async load(): Promise<GameState | undefined> {
      const value = await readRaw();
      return value === undefined ? undefined : parseState(value);
    },
    async save(state: GameState) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("saves", "readwrite");
        transaction.objectStore("saves").put(parseState(state), "current");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    },
  };
}
