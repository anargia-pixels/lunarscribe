import { cn } from "@lunarscribe/utils/cn";
import { useEffect, useRef } from "react";

/*
 * Adapted from React Bits' PixelSnow (https://reactbits.dev), MIT. The canvas
 * sits behind the page, so pointer movement is read from the window.
 */

type SnowVariant = "square" | "round" | "snowflake";

/** Pixel art per flake size: `@` is the bright core, `o` the body, `x` the rim. */
const SPRITES: Record<SnowVariant, string[][]> = {
  square: [
    ["@"],
    ["oo", "oo"],
    ["xox", "o@o", "xox"],
    ["xoox", "o@@o", "o@@o", "xoox"],
    ["xooox", "oo@oo", "o@@@o", "oo@oo", "xooox"],
    ["xox", "o@o", "xox"],
    ["xoox", "o@@o", "o@@o", "xoox"],
    ["xooox", "oo@oo", "o@@@o", "oo@oo", "xooox"],
  ],
  round: [
    ["@"],
    [".x.", "x@x", ".x."],
    [".xx.", "x@@x", "x@@x", ".xx."],
    [".xxx.", "xo@ox", "x@@@x", "xo@ox", ".xxx."],
    [
      "..xxx..",
      ".xooox.",
      "xoo@oox",
      "xo@@@ox",
      "xoo@oox",
      ".xooox.",
      "..xxx..",
    ],
    [".xx.", "x@@x", "x@@x", ".xx."],
    [".xxx.", "xo@ox", "x@@@x", "xo@ox", ".xxx."],
    [
      "..xxx..",
      ".xooox.",
      "xoo@oox",
      "xo@@@ox",
      "xoo@oox",
      ".xooox.",
      "..xxx..",
    ],
  ],
  snowflake: [
    ["@"],
    [".x.", "x@x", ".x."],
    ["..x..", "x.o.x", ".o@o.", "x.o.x", "..x.."],
    [
      "...x...",
      ".x.o.x.",
      "..ooo..",
      "xoo@oox",
      "..ooo..",
      ".x.o.x.",
      "...x...",
    ],
    [
      "....x....",
      ".x..o..x.",
      "..o.o.o..",
      "...ooo...",
      "xooo@ooox",
      "...ooo...",
      "..o.o.o..",
      ".x..o..x.",
      "....x....",
    ],
    ["x...x", ".o.o.", "..@..", ".o.o.", "x...x"],
    [
      "x..x..x",
      ".o.o.o.",
      "..ooo..",
      "xoo@oox",
      "..ooo..",
      ".o.o.o.",
      "x..x..x",
    ],
    [
      "x...x...x",
      ".o..o..o.",
      "..o.o.o..",
      "...ooo...",
      "xooo@ooox",
      "...ooo...",
      "..o.o.o..",
      ".o..o..o.",
      "x...x...x",
    ],
  ],
};

const VARIANTS: SnowVariant[] = ["square", "round", "snowflake"];

const CELL = 9;

const LEVELS = 5;

const SLOTS = 8;

const MAX_FLAKES = 4000;

const LEVEL_WEIGHTS = [0.46, 0.27, 0.15, 0.08, 0.04];

const LEVEL_FALL = [16, 24, 34, 48, 66];

const LEVEL_LIGHT = [0.42, 0.58, 0.76, 0.92, 1];

const INTRO_SECONDS = 1.4;

/** How strongly far flakes fall slower and dimmer than near ones. */
const DEPTH = 0.6;

/** The radius in px around the pointer that brushes flakes aside. */
const POINTER_RADIUS = 120;

const QUAD_VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FLAKE_VERTEX = `#version 300 es
in vec2 aCorner;
in vec4 aFlake;
uniform vec2 uGrid;
uniform vec4 uSizes;
uniform float uLargest;
flat out ivec2 vOrigin;
flat out ivec2 vCell;
flat out int vSize;
flat out float vLight;
void main() {
  int index = int(aFlake.z + 0.5);
  int slot = index % ${SLOTS};
  int variant = index / ${SLOTS};
  int level = slot < ${LEVELS} ? slot : slot - 3;
  float size = level == 0 ? 1.0 : (level == 1 ? uSizes.x : (level == 2 ? uSizes.y : (level == 3 ? uSizes.z : uLargest)));
  vec2 origin = floor(aFlake.xy) - floor(size * 0.5);
  origin.y = uGrid.y - origin.y - size;
  vec2 corner = origin + (aCorner * 0.5 + 0.5) * size;
  gl_Position = vec4(corner / uGrid * 2.0 - 1.0, 0.0, 1.0);
  vOrigin = ivec2(origin);
  vCell = ivec2(slot * ${CELL}, variant * ${CELL});
  vSize = int(size);
  vLight = aFlake.w;
}`;

const FLAKE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uAtlas;
flat in ivec2 vOrigin;
flat in ivec2 vCell;
flat in int vSize;
flat in float vLight;
out vec4 outColor;
void main() {
  ivec2 local = ivec2(gl_FragCoord.xy) - vOrigin;
  if (local.x < 0 || local.y < 0 || local.x >= vSize || local.y >= vSize) discard;
  vec4 texel = texelFetch(uAtlas, vCell + local, 0);
  if (texel.r < 0.5) discard;
  outColor = vec4(vLight, texel.g * vLight, 0.0, 1.0);
}`;

const DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uTarget;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec4 sum = texture(uSource, uv) * 4.0;
  sum += texture(uSource, uv - uTexel);
  sum += texture(uSource, uv + uTexel);
  sum += texture(uSource, uv + vec2(uTexel.x, -uTexel.y));
  sum += texture(uSource, uv - vec2(uTexel.x, -uTexel.y));
  outColor = sum / 8.0;
}`;

const UP = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uBase;
uniform vec2 uTexel;
uniform vec2 uTarget;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec2 h = uTexel * 0.5;
  vec4 sum = texture(uSource, uv + vec2(-h.x * 2.0, 0.0));
  sum += texture(uSource, uv + vec2(h.x * 2.0, 0.0));
  sum += texture(uSource, uv + vec2(0.0, -h.y * 2.0));
  sum += texture(uSource, uv + vec2(0.0, h.y * 2.0));
  sum += texture(uSource, uv + vec2(-h.x, h.y)) * 2.0;
  sum += texture(uSource, uv + h) * 2.0;
  sum += texture(uSource, uv + vec2(h.x, -h.y)) * 2.0;
  sum += texture(uSource, uv - h) * 2.0;
  outColor = (sum / 12.0 + texture(uBase, uv)) * 0.5;
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uSnow;
uniform sampler2D uGlowMap;
uniform vec2 uGrid;
uniform float uPixel;
uniform vec3 uColor;
uniform float uGlow;
uniform float uLightMode;
out vec4 outColor;

void main() {
  ivec2 cell = ivec2(floor(gl_FragCoord.xy / uPixel));
  vec4 snow = texelFetch(uSnow, clamp(cell, ivec2(0), ivec2(uGrid) - 1), 0);
  vec2 glow = texture(uGlowMap, gl_FragCoord.xy / (uGrid * uPixel)).rg;
  float body = clamp(snow.r, 0.0, 1.0);
  float core = clamp(snow.g, 0.0, 1.0);
  float halo = clamp(glow.r * uGlow, 0.0, 1.0);
  if (uLightMode > 0.5) {
    vec3 tint = mix(uColor, vec3(1.0), clamp(core / max(body, 0.001), 0.0, 1.0) * 0.45);
    float alpha = body * 0.95;
    vec4 color = vec4(tint * alpha, alpha);
    float soft = halo * 0.22 * (1.0 - alpha);
    outColor = color + vec4(uColor * soft, soft);
  } else {
    vec3 color = uColor * (body * 0.82 + core * 0.18) + uColor * halo * 0.55;
    color = 1.0 - exp(-color * 1.6);
    outColor = vec4(color, max(color.r, max(color.g, color.b)));
  }
}`;

type Program = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

type Target = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
};

type Flake = {
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  rate: number;
  sparkle: number;
  drift: number;
  alt: boolean;
  reveal: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A deterministic random generator, so the snow looks the same on every load. */
const seeded = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const compile = (gl: WebGL2RenderingContext, type: GLenum, source: string) => {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }

  gl.deleteShader(shader);

  return null;
};

const link = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributes: string[],
): Program | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!vertex || !fragment) {
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  attributes.forEach((name, index) =>
    gl.bindAttribLocation(program, index, name),
  );
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);

    return null;
  }

  const uniforms: Program["uniforms"] = {};
  const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(program, index);

    if (info) {
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
  }

  return { program, uniforms };
};

/** Packs every sprite into one texture: red marks a pixel, green its brightness. */
const buildAtlas = () => {
  const width = CELL * SLOTS;
  const height = CELL * VARIANTS.length;
  const data = new Uint8Array(width * height * 4);

  VARIANTS.forEach((variant, row) => {
    SPRITES[variant].forEach((lines, level) => {
      lines.forEach((line, y) => {
        [...line].forEach((mark, x) => {
          if (mark === ".") {
            return;
          }

          const offset = ((row * CELL + y) * width + level * CELL + x) * 4;
          data[offset] = 255;
          data[offset + 1] = mark === "@" ? 255 : mark === "o" ? 128 : 0;
          data[offset + 3] = 255;
        });
      });
    });
  });

  return { data, width, height };
};

/** Resolves any CSS color to normalized RGB through a 2D canvas. */
const toRgb = (color: string): [number, number, number] => {
  const probe = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });

  if (!probe) {
    return [1, 1, 1];
  }

  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);

  const [red = 255, green = 255, blue = 255] = probe.getImageData(
    0,
    0,
    1,
    1,
  ).data;

  return [red / 255, green / 255, blue / 255];
};

type PixelSnowProps = {
  className?: string;
  color?: string;
  variant?: SnowVariant;
  density?: number;
  speed?: number;
  wind?: number;
  sway?: number;
  flakeSize?: number;
  pixelSize?: number;
  glow?: number;
  twinkle?: number;
  mouseInteraction?: boolean;
  lightMode?: boolean;
  opacity?: number;
};

/** Falling pixel-art snow on a transparent WebGL canvas that fills its container. */
export function PixelSnow({
  className,
  color = "#ffffff",
  variant = "snowflake",
  density = 0.5,
  speed = 1,
  wind = 0.25,
  sway = 0.5,
  flakeSize = 1,
  pixelSize = 3,
  glow = 0.8,
  twinkle = 0.35,
  mouseInteraction = true,
  lightMode = false,
  opacity = 1,
}: PixelSnowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    // A fresh canvas per run: cleanup loses the context, which can't be reused.
    const canvas = document.createElement("canvas");

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });

    if (!container || !gl) {
      return;
    }

    const flakeProgram = link(gl, FLAKE_VERTEX, FLAKE_FRAGMENT, [
      "aCorner",
      "aFlake",
    ]);

    const downProgram = link(gl, QUAD_VERTEX, DOWN, ["aPosition"]);
    const upProgram = link(gl, QUAD_VERTEX, UP, ["aPosition"]);
    const compositeProgram = link(gl, QUAD_VERTEX, COMPOSITE, ["aPosition"]);

    if (!flakeProgram || !downProgram || !upProgram || !compositeProgram) {
      return;
    }

    const variantIndex = VARIANTS.indexOf(variant);
    const sizes = SPRITES[variant].map((lines) => lines.length);
    const rgb = toRgb(color);
    const sizeShift = clamp(flakeSize, 0, 2) - 1;

    const weights = LEVEL_WEIGHTS.map(
      (weight, index) => weight * 2.2 ** (sizeShift * (index - 1.5)),
    );

    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

    const atlas = buildAtlas();
    const atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      atlas.width,
      atlas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      atlas.data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const quadBuffer = gl.createBuffer();
    const quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const cornerBuffer = gl.createBuffer();
    const instanceBuffer = gl.createBuffer();
    const flakeVao = gl.createVertexArray();
    gl.bindVertexArray(flakeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    const createTarget = (filter: GLenum): Target => {
      const target = {
        texture: gl.createTexture(),
        framebuffer: gl.createFramebuffer(),
        width: 0,
        height: 0,
      };

      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      return target;
    };

    const sizeTarget = (target: Target, width: number, height: number) => {
      if (target.width === width && target.height === height) {
        return;
      }

      target.width = width;
      target.height = height;
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target.texture,
        0,
      );
    };

    const snow = createTarget(gl.NEAREST);

    const down = [
      createTarget(gl.LINEAR),
      createTarget(gl.LINEAR),
      createTarget(gl.LINEAR),
    ];

    const up = [createTarget(gl.LINEAR), createTarget(gl.LINEAR)];

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const random = seeded(4271);
    const flakes: Flake[] = [];
    const view = { width: 1, height: 1, ratio: 1, pixel: 1, grid: [1, 1] };
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, inside: false, time: 0 };
    const state = { time: 0, intro: reduceMotion ? 1 : 0, push: 0 };
    const instances = new Float32Array(MAX_FLAKES * 4);
    let frame = 0;
    let last = 0;
    let visible = true;

    const pickLevel = () => {
      const roll = random();
      let total = 0;

      for (let index = 0; index < LEVELS; index++) {
        total += (weights[index] ?? 0) / weightSum;

        if (roll <= total) {
          return index;
        }
      }

      return LEVELS - 1;
    };

    const spawn = (top: boolean): Flake => {
      const flakeLevel = pickLevel();

      return {
        level: flakeLevel,
        x: random() * (view.width + 40) - 20,
        y: top ? -10 - random() * 30 : random() * view.height,
        vx: 0,
        vy: LEVEL_FALL[flakeLevel] ?? 0,
        phase: random() * Math.PI * 2,
        rate: 0.6 + random() * 0.9,
        sparkle: random() * 100,
        drift: 0.7 + random() * 0.6,
        alt: random() < 0.5,
        reveal: top ? -1 : random(),
      };
    };

    const populate = () => {
      const target = Math.round(
        clamp(
          (view.width * view.height * clamp(density, 0, 1)) / 1100,
          0,
          MAX_FLAKES,
        ),
      );

      while (flakes.length < target) {
        flakes.push(spawn(false));
      }

      flakes.length = target;
    };

    const simulate = (dt: number) => {
      const windSpeed = clamp(wind, -2, 2) * 46;
      const pushing = state.push > 0.001 && pointer.inside;
      const margin = 24;
      const ease = 1 - Math.exp(-dt * 2.2);

      flakes.forEach((flake, index) => {
        const parallax = 1 - DEPTH * (1 - (flake.level + 1) / LEVELS) * 0.75;

        const swing =
          Math.sin(state.time * flake.rate + flake.phase) *
          Math.max(0, sway) *
          (6 + flake.level * 7);

        const targetX = (windSpeed * parallax + swing) * flake.drift;

        const targetY =
          (LEVEL_FALL[flake.level] ?? 0) * parallax * speed * flake.drift;

        flake.vx += (targetX - flake.vx) * ease;
        flake.vy += (targetY - flake.vy) * ease;

        if (pushing) {
          const dx = flake.x - pointer.x;
          const dy = flake.y - pointer.y;
          const distance = Math.hypot(dx, dy);

          if (distance < POINTER_RADIUS && distance > 0.001) {
            const near = 1 - distance / POINTER_RADIUS;
            const repel = near ** 3 * state.push * 1500 * dt;
            const carry = near ** 2 * state.push * dt * 5;
            flake.vx += (dx / distance) * repel + pointer.vx * carry;
            flake.vy += (dy / distance) * repel + pointer.vy * carry;
          }
        }

        flake.x += flake.vx * dt;
        flake.y += flake.vy * dt;

        const fellOut =
          speed >= 0 ? flake.y > view.height + margin : flake.y < -margin;

        if (fellOut) {
          const next = spawn(true);

          if (speed < 0) {
            next.y = view.height + 10 + random() * 30;
          }

          flakes[index] = next;

          return;
        }

        if (flake.x < -margin) {
          flake.x += view.width + margin * 2;
        } else if (flake.x > view.width + margin) {
          flake.x -= view.width + margin * 2;
        }
      });
    };

    const bindTexture = (
      entry: Program,
      name: string,
      unit: number,
      texture: WebGLTexture | null,
    ) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(entry.uniforms[name] ?? null, unit);
    };

    const run = (target: Target | null, width: number, height: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const drawFlakes = () => {
      const sweep = state.intro * 1.75;
      let count = 0;

      for (const flake of flakes) {
        const depthLight = 1 - DEPTH * (1 - (LEVEL_LIGHT[flake.level] ?? 1));

        const spark =
          Math.max(0, Math.sin(state.time * 0.9 + flake.sparkle)) ** 60 *
          clamp(twinkle, 0, 1);

        const reveal =
          flake.reveal < 0 || state.intro >= 1
            ? 1
            : clamp(
                (sweep - flake.y / view.height - flake.reveal * 0.25) / 0.35,
                0,
                1,
              );

        if (reveal <= 0) {
          continue;
        }

        const slot =
          flake.level >= 2 && flake.alt ? flake.level + 3 : flake.level;

        const offset = count * 4;
        instances[offset] = flake.x / view.pixel;
        instances[offset + 1] = flake.y / view.pixel;
        instances[offset + 2] = variantIndex * SLOTS + slot;
        instances[offset + 3] =
          Math.min(1, depthLight * (0.85 + spark * 0.6)) * reveal * reveal;
        count++;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, snow.framebuffer);
      gl.viewport(0, 0, snow.width, snow.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (count === 0) {
        return;
      }

      gl.useProgram(flakeProgram.program);
      gl.uniform2f(
        flakeProgram.uniforms.uGrid ?? null,
        snow.width,
        snow.height,
      );
      gl.uniform4f(
        flakeProgram.uniforms.uSizes ?? null,
        sizes[1] ?? 1,
        sizes[2] ?? 1,
        sizes[3] ?? 1,
        0,
      );
      gl.uniform1f(flakeProgram.uniforms.uLargest ?? null, sizes[4] ?? 1);
      bindTexture(flakeProgram, "uAtlas", 0, atlasTexture);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
      gl.bindVertexArray(flakeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        instances.subarray(0, count * 4),
        gl.DYNAMIC_DRAW,
      );
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
    };

    /** Blurs the snow through a small down and up sample chain for the glow. */
    const drawGlow = () => {
      gl.bindVertexArray(quadVao);
      let source = snow;

      for (const target of down) {
        sizeTarget(
          target,
          Math.max(1, Math.ceil(source.width / 2)),
          Math.max(1, Math.ceil(source.height / 2)),
        );
        gl.useProgram(downProgram.program);
        gl.uniform2f(
          downProgram.uniforms.uTexel ?? null,
          1 / source.width,
          1 / source.height,
        );
        gl.uniform2f(
          downProgram.uniforms.uTarget ?? null,
          target.width,
          target.height,
        );
        bindTexture(downProgram, "uSource", 0, source.texture);
        run(target, target.width, target.height);
        source = target;
      }

      for (let index = up.length - 1; index >= 0; index--) {
        const from = up[index + 1] ?? source;
        const base = down[index];
        const target = up[index];

        if (!base || !target) {
          continue;
        }

        sizeTarget(target, base.width, base.height);
        gl.useProgram(upProgram.program);
        gl.uniform2f(
          upProgram.uniforms.uTexel ?? null,
          1 / from.width,
          1 / from.height,
        );
        gl.uniform2f(
          upProgram.uniforms.uTarget ?? null,
          target.width,
          target.height,
        );
        bindTexture(upProgram, "uSource", 0, from.texture);
        bindTexture(upProgram, "uBase", 1, base.texture);
        run(target, target.width, target.height);
      }
    };

    const render = () => {
      sizeTarget(snow, view.grid[0] ?? 1, view.grid[1] ?? 1);
      drawFlakes();
      drawGlow();

      const { uniforms } = compositeProgram;
      gl.useProgram(compositeProgram.program);
      gl.uniform2f(uniforms.uGrid ?? null, snow.width, snow.height);
      gl.uniform1f(uniforms.uPixel ?? null, view.pixel * view.ratio);
      gl.uniform3fv(uniforms.uColor ?? null, rgb);
      gl.uniform1f(uniforms.uGlow ?? null, Math.max(0, glow));
      gl.uniform1f(uniforms.uLightMode ?? null, lightMode ? 1 : 0);
      bindTexture(compositeProgram, "uSnow", 0, snow.texture);
      bindTexture(compositeProgram, "uGlowMap", 1, up[0]?.texture ?? null);
      run(null, canvas.width, canvas.height);
    };

    const update = (now: number) => {
      frame = 0;

      if (!visible || document.hidden) {
        return;
      }

      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      if (state.intro < 1) {
        state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);
      }

      const goal = mouseInteraction && pointer.inside && !reduceMotion ? 1 : 0;
      state.push += (goal - state.push) * (1 - Math.exp(-dt * (goal ? 6 : 3)));
      pointer.vx *= Math.exp(-dt * 6);
      pointer.vy *= Math.exp(-dt * 6);

      if (!reduceMotion) {
        state.time += dt;
        simulate(dt);
      }

      render();

      if (!reduceMotion || Math.abs(goal - state.push) > 0.001) {
        frame = requestAnimationFrame(update);
      } else {
        last = 0;
      }
    };

    const wake = () => {
      if (!frame && visible && !document.hidden) {
        frame = requestAnimationFrame(update);
      }
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      view.ratio = ratio;
      view.pixel =
        Math.max(1, Math.round(clamp(pixelSize, 1, 12) * ratio)) / ratio;
      view.grid = [
        Math.max(1, Math.ceil(width / view.pixel)),
        Math.max(1, Math.ceil(height / view.pixel)),
      ];
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      populate();

      if (!frame) {
        render();
      }

      wake();
    };

    const controller = new AbortController();
    const { signal } = controller;

    window.addEventListener(
      "pointermove",
      (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const now = performance.now();

        if (pointer.inside && pointer.time) {
          const elapsed = Math.max(1, now - pointer.time) / 1000;
          pointer.vx = clamp((x - pointer.x) / elapsed, -3000, 3000);
          pointer.vy = clamp((y - pointer.y) / elapsed, -3000, 3000);
        }

        pointer.x = x;
        pointer.y = y;
        pointer.time = now;
        pointer.inside =
          x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
        wake();
      },
      { passive: true, signal },
    );
    document.documentElement.addEventListener(
      "pointerleave",
      () => {
        pointer.inside = false;
        wake();
      },
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        last = 0;
        wake();
      },
      { signal },
    );

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);

      if (visible) {
        last = 0;
        wake();
      }
    });

    intersectionObserver.observe(container);
    canvas.ariaHidden = "true";
    canvas.className = "block size-full";
    canvas.style.opacity = String(clamp(opacity, 0, 1));
    container.append(canvas);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      controller.abort();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    color,
    variant,
    density,
    speed,
    wind,
    sway,
    flakeSize,
    pixelSize,
    glow,
    twinkle,
    mouseInteraction,
    lightMode,
    opacity,
  ]);

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)} />
  );
}
