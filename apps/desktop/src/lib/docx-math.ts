import {
  BuilderElement,
  MathFraction,
  MathLimitLower,
  MathLimitUpper,
  MathRadical,
  MathRun,
  MathSubScript,
  MathSubSuperScript,
  MathSuperScript,
} from "docx";
import type { MathComponent } from "docx";

/** Convert KaTeX's semantic MathML once, rather than exporting both hidden and visible text. */
export function createDocxMath(element: Element): MathComponent[] {
  const children = Array.from(element.children);

  // Preserve matrix rows and columns instead of flattening them into unrelated text.
  if (element.localName === "mtable") {
    return [
      new BuilderElement({
        name: "m:m",
        children: children.map(
          (row) =>
            new BuilderElement({
              name: "m:mr",
              children: Array.from(
                row.children,
                (cell) =>
                  new BuilderElement({
                    name: "m:e",
                    children: createDocxMath(cell),
                  }),
              ),
            }),
        ),
      }),
    ];
  }

  const operands = children.map(createDocxMath);
  const base = operands[0] ?? [];
  const second = operands[1] ?? [];

  switch (element.localName) {
    case "annotation":
    case "annotation-xml":
      return [];
    case "semantics":
      return base;
    case "mi":
    case "mn":
    case "mo":
    case "mtext":
      return [new MathRun(element.textContent ?? "")];
    case "mspace":
      return [new MathRun(" ")];
    case "mfrac":
      return [new MathFraction({ numerator: base, denominator: second })];
    case "msqrt":
      return [new MathRadical({ children: operands.flat() })];
    case "mroot":
      return [new MathRadical({ children: base, degree: second })];
    case "msub":
      return [new MathSubScript({ children: base, subScript: second })];
    case "msup":
      return [new MathSuperScript({ children: base, superScript: second })];
    case "msubsup":
      return [
        new MathSubSuperScript({
          children: base,
          subScript: second,
          superScript: operands[2] ?? [],
        }),
      ];
    case "munder":
      return [new MathLimitLower({ children: base, limit: second })];
    case "mover":
      if (element.getAttribute("accent") === "true") {
        return [
          new BuilderElement({
            name: "m:acc",
            children: [
              new BuilderElement({
                name: "m:accPr",
                children: [
                  new BuilderElement({
                    name: "m:chr",
                    attributes: {
                      value: {
                        key: "m:val",
                        value: children[1]?.textContent ?? "\u0302",
                      },
                    },
                  }),
                ],
              }),
              new BuilderElement({ name: "m:e", children: base }),
            ],
          }),
        ];
      }

      return [new MathLimitUpper({ children: base, limit: second })];
    case "munderover":
      return [
        new MathLimitUpper({
          children: [new MathLimitLower({ children: base, limit: second })],
          limit: operands[2] ?? [],
        }),
      ];
    default:
      return operands.flat();
  }
}
