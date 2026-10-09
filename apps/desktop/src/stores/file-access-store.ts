import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Typing in the shown file refreshes its access time at most this often. */
const ACCESS_REFRESH_MS = 60_000;

type FileAccessStore = {
  /** Last access in epoch milliseconds, by `fileKey`. */
  accessedAt: Record<string, number>;
  /** Marks `key` accessed now, skipping repeats within a minute. */
  recordAccess: (key: string) => void;
  /** Keeps a renamed file's access time under its new key, or the later of the two. */
  moveAccess: (fromKey: string, toKey: string) => void;
};

/** When each saved and external file was last shown, remembered across launches. */
export const useFileAccessStore = create<FileAccessStore>()(
  persist(
    (set) => ({
      accessedAt: {},
      recordAccess: (key) =>
        set((state) => {
          const now = Date.now();

          return now - (state.accessedAt[key] ?? 0) < ACCESS_REFRESH_MS
            ? state
            : { accessedAt: { ...state.accessedAt, [key]: now } };
        }),
      moveAccess: (fromKey, toKey) =>
        set((state) => {
          const { [fromKey]: time, ...accessedAt } = state.accessedAt;

          if (time === undefined || fromKey === toKey) {
            return state;
          }

          return {
            accessedAt: {
              ...accessedAt,
              [toKey]: Math.max(time, accessedAt[toKey] ?? 0),
            },
          };
        }),
    }),
    { name: "lunarscribe-file-access" },
  ),
);
