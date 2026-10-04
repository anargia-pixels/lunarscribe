/**
 * Fonts beyond the bundled defaults come from Google Fonts. The desktop app lists installed
 * fonts instead, but browsers expose those only in Chromium behind a permission prompt.
 */

/** Bundled with the app, so they render offline. */
export const DEFAULT_FONTS = [
  "Poppins",
  "Roboto Mono",
  "Pixelify Sans",
] as const;

export const GOOGLE_FONT_GROUPS = [
  {
    label: "Sans serif",
    families: [
      "Inter",
      "Roboto",
      "Open Sans",
      "Lato",
      "Montserrat",
      "Nunito",
      "Source Sans 3",
      "Work Sans",
      "DM Sans",
      "IBM Plex Sans",
      "Noto Sans",
      "Atkinson Hyperlegible",
      "Lexend",
      "Manrope",
    ],
  },
  {
    label: "Serif",
    families: [
      "Merriweather",
      "Lora",
      "Literata",
      "Source Serif 4",
      "EB Garamond",
      "Crimson Pro",
      "Libre Baskerville",
      "Playfair Display",
      "IBM Plex Serif",
      "Noto Serif",
    ],
  },
  {
    label: "Monospace",
    families: [
      "JetBrains Mono",
      "Fira Code",
      "Source Code Pro",
      "IBM Plex Mono",
      "Space Mono",
      "Ubuntu Mono",
      "Inconsolata",
      "DM Mono",
    ],
  },
  {
    label: "Display and handwriting",
    families: [
      "Caveat",
      "Patrick Hand",
      "Kalam",
      "Comic Neue",
      "Courier Prime",
      "Special Elite",
    ],
  },
] as const;

const STYLESHEET_URL = "https://fonts.googleapis.com/css2";

// Families without italics or some weights reject the fuller requests, so try smaller ones.
const AXIS_VARIANTS = [
  ":ital,wght@0,400;0,500;0,600;0,700;1,400;1,700",
  ":wght@400;700",
  "",
];

const loadedFamilies = new Map<string, Promise<void>>();

function isDefaultFont(family: string) {
  return DEFAULT_FONTS.some((font) => font === family);
}

function appendStylesheet(href: string) {
  return new Promise<HTMLLinkElement>((resolve, reject) => {
    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.href = href;
    link.dataset.googleFont = "";
    link.addEventListener("load", () => resolve(link));
    link.addEventListener("error", () => {
      link.remove();
      reject(new Error(`Unable to load ${href}`));
    });
    document.head.append(link);
  });
}

async function loadFamily(family: string) {
  const name = family.trim().replaceAll(/\s+/gu, "+");

  for (const axes of AXIS_VARIANTS) {
    try {
      await appendStylesheet(
        `${STYLESHEET_URL}?family=${name}${axes}&display=swap`,
      );

      return;
    } catch {
      // Try the next, smaller set of styles.
    }
  }

  throw new Error(`Google Fonts has no family named "${family}".`);
}

/** Adds the family's stylesheet once; bundled defaults and failures resolve quietly. */
export function loadGoogleFont(family: string) {
  if (isDefaultFont(family)) {
    return Promise.resolve();
  }

  let loaded = loadedFamilies.get(family);

  if (!loaded) {
    loaded = loadFamily(family).catch((cause) => {
      // Allow a retry once the connection is back; the fallback font shows meanwhile.
      loadedFamilies.delete(family);

      throw cause;
    });
    loadedFamilies.set(family, loaded);
  }

  return loaded;
}
