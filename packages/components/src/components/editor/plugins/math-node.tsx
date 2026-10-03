import katex from "katex";
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
import type { JSX } from "react";

import { MathComponent } from "./math-component";

type SerializedMathNode = Spread<
  { equation: string; inline: boolean },
  SerializedLexicalNode
>;

/** Keeps LaTeX separate from rendered HTML so markdown exports stay lossless. */
export class MathNode extends DecoratorNode<JSX.Element> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return "math";
  }

  static clone(node: MathNode): MathNode {
    return new MathNode(node.__equation, node.__inline, node.__key);
  }

  constructor(equation = "", inline = true, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline;
  }

  static importJSON(node: SerializedMathNode): MathNode {
    return $createMathNode(node.equation, node.inline).updateFromJSON(node);
  }

  exportJSON(): SerializedMathNode {
    return {
      ...super.exportJSON(),
      equation: this.getEquation(),
      inline: this.isInline(),
    };
  }

  static importDOM(): DOMConversionMap {
    const convert = (element: HTMLElement) => {
      const equation = element.getAttribute("data-math-equation");

      if (equation === null) {
        return null;
      }

      return {
        conversion: () => ({
          node: $createMathNode(
            equation,
            element.getAttribute("data-math-inline") === "true",
          ),
          // KaTeX's HTML is a preview, not additional editor text.
          forChild: () => null,
        }),
        priority: 1 as const,
      };
    };

    return { span: convert, div: convert };
  }

  createDOM(): HTMLElement {
    const element = document.createElement(this.__inline ? "span" : "div");

    element.className = this.__inline
      ? "editor-math editor-math-inline"
      : "editor-math editor-math-block";

    return element;
  }

  updateDOM(previous: MathNode): boolean {
    return previous.__inline !== this.__inline;
  }

  exportDOM(): DOMExportOutput {
    const element = this.createDOM();

    element.setAttribute("data-math-equation", this.getEquation());
    element.setAttribute("data-math-inline", String(this.isInline()));
    katex.render(this.getEquation(), element, {
      displayMode: !this.isInline(),
      throwOnError: false,
      trust: false,
    });

    return { element };
  }

  isInline(): boolean {
    return this.getLatest().__inline;
  }

  getEquation(): string {
    return this.getLatest().__equation;
  }

  setEquation(equation: string): this {
    const writable = this.getWritable();

    writable.__equation = equation;

    return writable;
  }

  getTextContent(): string {
    const equation = this.getEquation();

    return this.isInline() ? `$${equation}$` : `$$\n${equation}\n$$`;
  }

  decorate(): JSX.Element {
    return (
      <MathComponent
        equation={this.getEquation()}
        inline={this.isInline()}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createMathNode(equation = "", inline = true): MathNode {
  return $applyNodeReplacement(new MathNode(equation, inline));
}

export function $isMathNode(
  node: LexicalNode | null | undefined,
): node is MathNode {
  return node instanceof MathNode;
}
