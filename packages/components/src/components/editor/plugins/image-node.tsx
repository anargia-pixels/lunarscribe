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

import {
  formatImageEmbed,
  type ImageEmbed,
  parseImageLine,
} from "./image-markdown";

// Lazy, as in Lexical's playground: the component imports this node back.
const ImageComponent = lazy(() =>
  import("./image-component").then((module) => ({
    default: module.ImageComponent,
  })),
);

type SerializedImageNode = Spread<ImageEmbed, SerializedLexicalNode>;

/**
 * A block image embed. It keeps the embed as written, so the markdown round-trips in
 * Obsidian's syntax, and shows the image at its own aspect ratio, at most 80% wide.
 */
export class ImageNode extends DecoratorNode<JSX.Element> {
  __embed: ImageEmbed;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__embed, node.__key);
  }

  constructor(embed: ImageEmbed, key?: NodeKey) {
    super(key);
    this.__embed = embed;
  }

  static importJSON(node: SerializedImageNode): ImageNode {
    return $createImageNode({
      target: node.target,
      alt: node.alt,
      width: node.width,
      height: node.height,
      syntax: node.syntax,
      title: node.title,
    }).updateFromJSON(node);
  }

  exportJSON(): SerializedImageNode {
    return { ...super.exportJSON(), ...this.getEmbed() };
  }

  static importDOM(): DOMConversionMap {
    return {
      // Only images this editor copied; their target is the markdown one.
      img: (element) => {
        const markdown = element.getAttribute("data-image-embed");

        if (markdown === null) {
          return null;
        }

        return {
          conversion: () => {
            const embed = parseImageLine(markdown);

            return { node: embed ? $createImageNode(embed) : null };
          },
          priority: 1 as const,
        };
      },
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");

    element.className = "editor-image";

    return element;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("img");
    const embed = this.getEmbed();

    element.setAttribute("alt", embed.alt);
    element.setAttribute("data-image-embed", formatImageEmbed(embed));

    return { element };
  }

  isInline(): boolean {
    return false;
  }

  getEmbed(): ImageEmbed {
    return this.getLatest().__embed;
  }

  getTextContent(): string {
    return formatImageEmbed(this.getEmbed());
  }

  decorate(): JSX.Element {
    const { target, alt, width } = this.getEmbed();

    return (
      <Suspense fallback={null}>
        <ImageComponent
          nodeKey={this.getKey()}
          target={target}
          alt={alt}
          width={width}
        />
      </Suspense>
    );
  }
}

export function $createImageNode(embed: ImageEmbed): ImageNode {
  return $applyNodeReplacement(new ImageNode(embed));
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}
