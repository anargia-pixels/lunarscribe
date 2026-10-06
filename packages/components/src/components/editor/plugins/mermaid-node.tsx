import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { type JSX, lazy, Suspense } from "react";

// Lazy, as in Lexical's playground: the component imports this node back.
const MermaidComponent = lazy(() =>
  import("./mermaid-component").then((module) => ({
    default: module.MermaidComponent,
  })),
);

type SerializedMermaidNode = Spread<{ code: string }, SerializedLexicalNode>;

/** Stores the Mermaid definition independently of the rendered diagram. */
export class MermaidNode extends DecoratorNode<JSX.Element> {
  __code: string;

  static getType(): string {
    return "mermaid";
  }

  static clone(node: MermaidNode): MermaidNode {
    return new MermaidNode(node.__code, node.__key);
  }

  constructor(code = "", key?: NodeKey) {
    super(key);
    this.__code = code;
  }

  static importJSON(node: SerializedMermaidNode): MermaidNode {
    return $createMermaidNode(node.code).updateFromJSON(node);
  }

  exportJSON(): SerializedMermaidNode {
    return { ...super.exportJSON(), code: this.getCode() };
  }

  static importDOM(): DOMConversionMap {
    return {
      pre: (element) => {
        const code = element.getAttribute("data-mermaid-code");

        if (code === null) {
          return null;
        }

        return {
          conversion: () => ({
            node: $createMermaidNode(code),
            forChild: () => null,
          }),
          priority: 1 as const,
        };
      },
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");

    element.className = "editor-mermaid";

    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("pre");

    element.setAttribute("data-mermaid-code", this.getCode());
    element.textContent = this.getTextContent();

    return { element };
  }

  isInline(): boolean {
    return false;
  }

  getCode(): string {
    return this.getLatest().__code;
  }

  setCode(code: string): this {
    const writable = this.getWritable();

    writable.__code = code;

    return writable;
  }

  getTextContent(): string {
    const code = this.getCode();
    // Keep literal backticks inside diagram labels from closing the markdown block.
    const runs = code.match(/`{3,}/g) ?? [];
    const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));

    return `${fence}mermaid\n${code}\n${fence}`;
  }

  decorate(): JSX.Element {
    return (
      <Suspense fallback={null}>
        <MermaidComponent code={this.getCode()} nodeKey={this.getKey()} />
      </Suspense>
    );
  }
}

export function $createMermaidNode(code = ""): MermaidNode {
  return $applyNodeReplacement(new MermaidNode(code));
}

export function $isMermaidNode(
  node: LexicalNode | null | undefined,
): node is MermaidNode {
  return node instanceof MermaidNode;
}
