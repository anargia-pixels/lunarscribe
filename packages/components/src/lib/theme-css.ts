/**
 * Applies an imported color theme's stylesheet. Theme CSS comes from the
 * internet, so it must not fetch: a `url()` behind an attribute selector can
 * send what is on screen to another host. The browser parses the text first,
 * so the checks see normalized values and CSS escapes cannot dodge them.
 * Adapted from T3 Code (MIT, https://github.com/pingdotgg/t3code).
 */

/**
 * Selectors theme CSS may rely on. T3 skins target T3 Code, so the editor and
 * sidebar carry T3 Code's names for the matching areas, and their backgrounds
 * and rows restyle Lunarscribe the way they restyle T3 Code.
 */
export const THEME_CSS_HOOKS = {
  /** The editor page: header, toolbar and text, behind the buffer. */
  editorArea: { "data-workspace-area": "conversation" },
  /** The editor page's header with the file path. */
  editorHeader: { "data-chat-header": "" },
  /** A file row in the sidebar; the open file also has `data-active`. */
  sidebarFile: { "data-thread-item": "" },
} as const;

const FETCHES_BY_STRING = /image-set\(|\bsrc\(/i;

// Only CSS whitespace may come first; \s also matches U+00A0, which makes the address relative.
const URL_NOT_LOCAL = /url\((?![ \t\n\f\r]*["']?(?:data:|#))/i;

// Read tokens left to right, as CSS does: a url( inside a string loads nothing, and a quote in an
// unquoted url( is not a string. A quoted url() that is not data: or #id keeps `url(` for the check.
const URL_OR_STRING =
  /url\((?![ \t\n\f\r]*["'])[^)]*|url\([ \t\n\f\r]*("[^"\n\r\f]*"|'[^'\n\r\f]*')|"[^"\n\r\f]*"|'[^'\n\r\f]*'/gi;

/** The code with its strings removed, keeping `url(` where a quoted url() can load a file. */
function withoutStrings(code: string): string {
  return code.replace(URL_OR_STRING, (token, urlString: string | undefined) => {
    if (urlString !== undefined) {
      return /^["'](?:data:|#)/i.test(urlString) ? "" : "url(";
    }

    return token.startsWith('"') || token.startsWith("'") ? "" : token;
  });
}

/**
 * Whether one declaration value can load a remote file. A value with var()
 * stays unparsed until use, and an escape can spell `var` or `url` in it, so
 * every value that still has a backslash is refused.
 */
function valueFetches(value: string): boolean {
  const code = withoutStrings(value);

  return (
    value.includes("\\") ||
    FETCHES_BY_STRING.test(code) ||
    URL_NOT_LOCAL.test(code)
  );
}

type RuleParent = Pick<CSSStyleSheet, "cssRules" | "deleteRule">;

// @keyframes also has both members, but its deleteRule takes a keyframe selector.
function isRuleParent(rule: CSSRule): rule is CSSRule & RuleParent {
  return (
    "cssRules" in rule &&
    "deleteRule" in rule &&
    !(rule instanceof CSSKeyframesRule)
  );
}

function stripDeclarations(rule: CSSRule): boolean {
  if (!("style" in rule) || !(rule.style instanceof CSSStyleDeclaration)) {
    return false;
  }

  for (let item = rule.style.length - 1; item >= 0; item -= 1) {
    const property = rule.style.item(item);

    if (valueFetches(rule.style.getPropertyValue(property))) {
      rule.style.removeProperty(property);
    }
  }

  return true;
}

/** Keeps only rule shapes it can check, so a new at-rule that fetches is dropped by default. */
function stripFetches(parent: RuleParent) {
  for (let index = parent.cssRules.length - 1; index >= 0; index -= 1) {
    const rule = parent.cssRules[index];

    if (rule === undefined) {
      continue;
    }

    const hasStyle = stripDeclarations(rule);

    if (rule instanceof CSSKeyframesRule) {
      for (const frame of rule.cssRules) {
        stripDeclarations(frame);
      }
    } else if (isRuleParent(rule)) {
      stripFetches(rule);
    } else if (rule instanceof CSSPropertyRule) {
      // A registered property's initial value is used wherever var() reads it.
      if (valueFetches(rule.initialValue ?? "")) {
        parent.deleteRule(index);
      }
    } else if (
      !hasStyle &&
      !(rule instanceof CSSLayerStatementRule) &&
      // Names a namespace without loading it. CSSOM refuses to delete one while style rules remain.
      !(rule instanceof CSSNamespaceRule)
    ) {
      parent.deleteRule(index);
    }
  }
}

let themeSheet: CSSStyleSheet | null = null;

let appliedCss = "";

/** Replaces the theme stylesheet; an empty string removes every theme rule. */
export function applyThemeCss(css: string) {
  if (css === appliedCss) {
    return;
  }

  appliedCss = css;

  if (themeSheet === null) {
    // Adopted sheets come after the document's own, and they cannot hold @import.
    themeSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, themeSheet];
  }

  themeSheet.replaceSync(css);
  stripFetches(themeSheet);
  // Lets globals.css frost the editor only while theme styles may paint behind it.
  document.documentElement.toggleAttribute("data-theme-css", css.length > 0);
}

/**
 * Shows a T3 Skins background image through `var(--theme-background-image)`,
 * which theme CSS reads. The address was checked when the theme was imported.
 */
export function applyThemeBackgroundImage(url: string | undefined) {
  const root = document.documentElement;

  if (url === undefined) {
    root.style.removeProperty("--theme-background-image");
  } else {
    root.style.setProperty("--theme-background-image", `url("${url}")`);
  }
}
