import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Typing in the shown file refreshes its access time at most this often. */
const ACCESS_REFRESH_MS = 60_000;

type FileAccessStore = {
  /** Last access in epoch milliseconds, by `fileKey`. */
  accessedAt: Record<string, number>;
  /** Editor scroll position in CSS pixels, by `fileKey`. */
  scrollTops: Record<string, number>;
  /** Marks `key` accessed now, skipping repeats within a minute. */
  recordAccess: (key: string) => void;
  /** Keeps a renamed file's access time and scroll position under its new key. */
  moveAccess: (fromKey: string, toKey: string) => void;
  setScrollTop: (key: string, scrollTop: number) => void;
  /** Forgets the scroll positions of deleted or removed files. */
  forgetScrollTops: (keys: readonly string[]) => void;
};

/** `entries` with `fromKey`'s value moved to `toKey`; `merge` settles a value already there. */
function moveEntry(
  entries: Record<string, number>,
  fromKey: string,
  toKey: string,
  merge: (moved: number, existing: number | undefined) => number,
) {
  const { [fromKey]: moved, ...rest } = entries;

  if (moved === undefined) {
    return entries;
  }

  return { ...rest, [toKey]: merge(moved, rest[toKey]) };
}

/**
 * When each saved and external file was last shown and where its editor was scrolled,
 * remembered across launches.
 */
export const useFileAccessStore = create<FileAccessStore>()(
  persist(
    (set) => ({
      accessedAt: {},
      scrollTops: {},
      recordAccess: (key) =>
        set((state) => {
          const now = Date.now();

          return now - (state.accessedAt[key] ?? 0) < ACCESS_REFRESH_MS
            ? state
            : { accessedAt: { ...state.accessedAt, [key]: now } };
        }),
      moveAccess: (fromKey, toKey) =>
        set((state) =>
          fromKey === toKey
            ? state
            : {
                // The later access wins; the renamed file's own position wins.
                accessedAt: moveEntry(
                  state.accessedAt,
                  fromKey,
                  toKey,
                  (moved, existing) => Math.max(moved, existing ?? 0),
                ),
                scrollTops: moveEntry(
                  state.scrollTops,
                  fromKey,
                  toKey,
                  (moved) => moved,
                ),
              },
        ),
      setScrollTop: (key, scrollTop) =>
        set((state) => ({
          scrollTops: { ...state.scrollTops, [key]: scrollTop },
        })),
      forgetScrollTops: (keys) =>
        set((state) => ({
          scrollTops: Object.fromEntries(
            Object.entries(state.scrollTops).filter(
              ([key]) => !keys.includes(key),
            ),
          ),
        })),
    }),
    { name: "lunarscribe-file-access" },
  ),
);
