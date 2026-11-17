import { QuoteNode } from "@lexical/rich-text";
import {
  $applyNodeReplacement,
  $getState,
  $setState,
  createState,
  type EditorConfig,
  type LexicalNode,
} from "lexical";

/** A note, a warning, or a caution for destructive or irreversible actions. */
export type QuoteAlert = "note" | "warning" | "caution";

const alertState = createState("alert", {
  parse: (value): QuoteAlert =>
    value === "note" || value === "caution" ? value : "warning",
});

/**
 * A quote that flags a note, a warning or a caution, written in markdown as
 * GitHub's alerts: `> [!NOTE]`, `> [!WARNING]` or `> [!CAUTION]` on the quote's first line. It is a
 * quote in every other way; `data-alert` picks its colors and icon in globals.css.
 */
export class AlertQuoteNode extends QuoteNode {
  $config() {
    return this.config("alert-quote", {
      extends: QuoteNode,
      stateConfigs: [{ flat: true, stateConfig: alertState }],
    });
  }

  getAlert(): QuoteAlert {
    return $getState(this, alertState);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);

    element.dataset.alert = this.getAlert();

    return element;
  }

  updateDOM(previous: this, element: HTMLElement): boolean {
    if (previous.getAlert() !== this.getAlert()) {
      element.dataset.alert = this.getAlert();
    }

    return false;
  }
}

export function $createAlertQuoteNode(alert: QuoteAlert): AlertQuoteNode {
  return $setState(
    $applyNodeReplacement(new AlertQuoteNode()),
    alertState,
    alert,
  );
}

export function $isAlertQuoteNode(
  node: LexicalNode | null | undefined,
): node is AlertQuoteNode {
  return node instanceof AlertQuoteNode;
}

const QUOTE_ALERTS = [
  "note",
  "warning",
  "caution",
] as const satisfies readonly QuoteAlert[];

/** The alert a GitHub marker such as `WARNING` names; null for markers Lunarscribe does not style. */
export function parseQuoteAlert(marker: string | undefined): QuoteAlert | null {
  const name = marker?.toLowerCase();

  return QUOTE_ALERTS.find((alert) => alert === name) ?? null;
}
