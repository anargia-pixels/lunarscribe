/** Side-effect stylesheet imports (Excalidraw's) are bundled by the app's Vite build. */
declare module "*.css";

/** Vite returns `?inline` stylesheets as a string instead of injecting them. */
declare module "*.css?inline" {
  const css: string;
  export default css;
}
