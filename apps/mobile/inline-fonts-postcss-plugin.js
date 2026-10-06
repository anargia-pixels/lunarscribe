const { readFileSync } = require("node:fs");

const { dirname, resolve } = require("node:path");

const WOFF2_URL = /url\("?([^")]+\.woff2)"?\)/u;

/**
 * Inlines `@font-face` fonts as data URLs. Metro can't serve files a CSS `url()`
 * points to, and the DOM component page has no public dir to serve them from.
 * The WebView reads woff2, so older-format fallbacks (KaTeX's woff and ttf) are
 * dropped. Runs after Tailwind, which rebases imported URLs onto the entry file.
 */
module.exports = () => ({
  postcssPlugin: "inline-fonts",
  Declaration: {
    src(declaration, { result }) {
      const sources = declaration.value
        .split(",")
        .map((source) => source.match(WOFF2_URL)?.[1])
        .filter((path) => path !== undefined);

      if (sources.length === 0) {
        return;
      }

      declaration.value = sources
        .map((path) => {
          const font = readFileSync(resolve(dirname(result.opts.from), path));

          return `url("data:font/woff2;base64,${font.toString("base64")}") format("woff2")`;
        })
        .join(", ");
    },
  },
});

module.exports.postcss = true;
