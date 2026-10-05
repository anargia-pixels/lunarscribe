/** Metro resolves bundled HTML files to an asset module ID. */
declare module "*.html" {
  const asset: number;
  export default asset;
}

/** Uniwind compiles the global stylesheet; importing it has no exports. */
declare module "*.css";
