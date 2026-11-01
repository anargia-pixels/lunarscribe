/**
 * Saved files and folders are named by their path inside the lunarscribe folder, with `/`
 * between folders, such as `work/plans.md`. The empty string is the top level.
 */

/** Slashes and null characters cannot appear in a file or folder name. */
const INVALID_NAME_CHARACTERS = /[/\\\0]/gu;

/** `name` inside `folder`; the top level is `""`. */
export function joinSavedPath(folder: string, name: string) {
  return folder ? `${folder}/${name}` : name;
}

/** The folder holding `path`, or `""` at the top level. */
export function folderOf(path: string) {
  const index = path.lastIndexOf("/");

  return index === -1 ? "" : path.slice(0, index);
}

/** The last part of `path`: a file or folder name without its folders. */
export function baseNameOf(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Whether `path` is `folder` itself or sits anywhere inside it. */
export function isInFolder(path: string, folder: string) {
  return path === folder || path.startsWith(`${folder}/`);
}

/** `path` with its `from` folder prefix replaced by `to`. */
export function replaceFolder(path: string, from: string, to: string) {
  return to + path.slice(from.length);
}

/**
 * Whether every part of `path` is a plain name, so it stays inside the lunarscribe folder.
 * Hidden names (a leading `.`) are left out, which also skips `.git` and sync temp files.
 */
export function isSafeSavedPath(path: string) {
  return (
    path !== "" &&
    !/[\\\0]/u.test(path) &&
    path.split("/").every((part) => part !== "" && !part.startsWith("."))
  );
}

/** A folder name typed by the user, trimmed, with slashes replaced; throws when unusable. */
export function toFolderName(input: string) {
  const name = input.trim().replaceAll(INVALID_NAME_CHARACTERS, "_");

  if (!name) {
    throw new Error("Enter a name for the folder.");
  }

  if (name.startsWith(".")) {
    throw new Error("Folder names cannot start with a dot.");
  }

  return name;
}

/** Saved files and folders, each named by its path. */
export type SavedEntries = { files: string[]; folders: string[] };

export type SavedTreeFile = { kind: "file"; path: string; name: string };

export type SavedTreeFolder = {
  kind: "folder";
  path: string;
  name: string;
  children: SavedTreeNode[];
  /** Files anywhere inside, including subfolders. */
  fileCount: number;
};

export type SavedTreeNode = SavedTreeFile | SavedTreeFolder;

/**
 * Nests saved files under their folders. Folders come first by name, then files in
 * `compareFiles` order. Folders that only appear in a file path are added too.
 */
export function buildSavedTree(
  { files, folders }: SavedEntries,
  compareFiles: (first: string, second: string) => number,
): SavedTreeNode[] {
  const root: SavedTreeFolder = {
    kind: "folder",
    path: "",
    name: "",
    children: [],
    fileCount: 0,
  };

  const byPath = new Map<string, SavedTreeFolder>([["", root]]);

  function folderNode(path: string): SavedTreeFolder {
    const existing = byPath.get(path);

    if (existing) {
      return existing;
    }

    const node: SavedTreeFolder = {
      kind: "folder",
      path,
      name: baseNameOf(path),
      children: [],
      fileCount: 0,
    };

    byPath.set(path, node);
    folderNode(folderOf(path)).children.push(node);

    return node;
  }

  for (const folder of folders) {
    folderNode(folder);
  }

  for (const path of files) {
    folderNode(folderOf(path)).children.push({
      kind: "file",
      path,
      name: baseNameOf(path),
    });

    for (
      let folder: string | null = folderOf(path);
      folder !== null;
      folder = folder ? folderOf(folder) : null
    ) {
      folderNode(folder).fileCount += 1;
    }
  }

  for (const folder of byPath.values()) {
    folder.children.sort((first, second) => {
      if (first.kind !== second.kind) {
        return first.kind === "folder" ? -1 : 1;
      }

      return first.kind === "folder"
        ? first.name.localeCompare(second.name)
        : compareFiles(first.path, second.path);
    });
  }

  return root.children;
}

/** Every folder in `folders`, plus the folders file paths imply, sorted by path. */
export function allFolders({ files, folders }: SavedEntries) {
  const paths = new Set(folders);

  for (const path of [...files, ...folders]) {
    for (let folder = folderOf(path); folder; folder = folderOf(folder)) {
      paths.add(folder);
    }
  }

  return [...paths].sort((first, second) => first.localeCompare(second));
}
