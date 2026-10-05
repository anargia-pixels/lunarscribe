import { File, Paths } from "expo-file-system";
import { createJSONStorage } from "zustand/middleware";

function storeFile(name: string) {
  return new File(Paths.document, `${name}.json`);
}

/** Persisted store state, one JSON file per store in the app's Documents folder. */
export const fileStorage = createJSONStorage(() => ({
  getItem: (name) => {
    const file = storeFile(name);

    return file.exists ? file.textSync() : null;
  },
  setItem: (name, value) => {
    storeFile(name).write(value);
  },
  removeItem: (name) => {
    const file = storeFile(name);

    if (file.exists) {
      file.delete();
    }
  },
}));
