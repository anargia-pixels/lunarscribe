/** A saved markdown or drawing file kept in IndexedDB in place of the documents folder. */
export type SavedFileRecord = {
  name: string;
  content: string;
  modifiedAt: number;
};

/** An external file the browser granted access to; the handle survives reloads. */
export type ExternalFileRecord = {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
};

type StoreName = "files" | "external-files";

type StoreRecords = {
  files: SavedFileRecord;
  "external-files": ExternalFileRecord;
};

const DATABASE_NAME = "lunarscribe";

const DATABASE_VERSION = 1;

let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore("files", { keyPath: "name" });
      request.result.createObjectStore("external-files", { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(new Error("Browser storage is unavailable.")),
    );
    request.addEventListener("blocked", () =>
      reject(
        new Error("Close other Lunarscribe tabs, then reload to continue."),
      ),
    );
  }).catch((cause) => {
    database = null;

    throw cause;
  });

  return database;
}

function settle<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("Browser storage request failed.")),
    );
  });
}

/** Runs `operation` in one transaction and resolves after the transaction commits. */
export async function withStore<Name extends StoreName, T>(
  name: Name,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
) {
  const transaction = (await openDatabase()).transaction(name, mode);

  const committed = new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("Browser storage was aborted.")),
    );
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error("Browser storage failed.")),
    );
  });

  const result = await operation(transaction.objectStore(name));
  await committed;

  return result;
}

export function getRecord<Name extends StoreName>(
  store: IDBObjectStore,
  key: string,
): Promise<StoreRecords[Name] | undefined> {
  return settle(store.get(key));
}

export function getAllRecords<Name extends StoreName>(
  store: IDBObjectStore,
): Promise<StoreRecords[Name][]> {
  return settle(store.getAll());
}

export function putRecord<Name extends StoreName>(
  store: IDBObjectStore,
  record: StoreRecords[Name],
) {
  return settle(store.put(record));
}

export function deleteRecord(store: IDBObjectStore, key: string) {
  return settle(store.delete(key));
}
