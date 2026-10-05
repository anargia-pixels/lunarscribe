const { readFileSync } = require("node:fs");

const { dirname, resolve } = require("node:path");

const EXCALIDRAW_DIST = "/@excalidraw/excalidraw/dist/prod/";

/**
 * Keeps drawings offline: Excalidraw's fonts become data URLs instead of files it
 * would fetch from a CDN, since the DOM component page has no public dir to serve
 * them from. Xiaolai, the 13MB CJK handwriting font, is left out as on desktop.
 */
module.exports = ({ types }) => ({
  name: "excalidraw-assets",
  visitor: {
    StringLiteral(path, state) {
      const { filename } = state.file.opts;
      const { value } = path.node;

      if (
        !filename?.includes(EXCALIDRAW_DIST) ||
        !/^\.\/fonts\/(?!Xiaolai)[^"]+\.woff2$/u.test(value)
      ) {
        return;
      }

      const font = readFileSync(resolve(dirname(filename), value));

      path.replaceWith(
        types.stringLiteral(
          `data:font/woff2;base64,${font.toString("base64")}`,
        ),
      );
      path.skip();
    },
  },
});
