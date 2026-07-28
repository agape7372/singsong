import type {
  Affine,
  HalftoneGlyphsPrimitive,
  PunchColumnPrimitive,
  SceneFont,
  ScenePrimitive,
  TextPrimitive,
  TicketScene,
} from "./scene.js";

/**
 * Options that affect only the SVG envelope. Artwork geometry always comes from
 * the canonical TicketScene display list.
 */
export type TicketSvgOptions = {
  readonly title?: string;
  readonly description?: string;
  /**
   * SVG paint servers use document-global ids. Give sibling tickets distinct
   * prefixes when more than one is embedded in the same HTML document.
   */
  readonly idPrefix?: string;
};

type PrimitivePaint = Pick<ScenePrimitive, "blend" | "opacity">;
type SvgTextPrimitive = Pick<
  TextPrimitive,
  "x" | "y" | "font" | "align" | "text" | "color" | "blend" | "opacity"
>;

type RenderContext = {
  readonly scene: TicketScene;
  readonly prefix: string;
  readonly definitions: string[];
  serial: number;
};

const XML_REPLACEMENTS: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escapes both XML text and quoted attribute values. */
export function escapeTicketSvgText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu, "\uFFFD")
    .replace(/[&<>"']/gu, (character) => XML_REPLACEMENTS[character] ?? character);
}

function number(value: number) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`TicketScene SVG 숫자는 유한해야 합니다: ${value}`);
  }
  return String(Object.is(value, -0) ? 0 : value);
}

function affine(value: Affine) {
  return `matrix(${value.map(number).join(" ")})`;
}

function safeIdPrefix(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9_.-]/gu, "-");
  const nonEmpty = sanitized || "ticket";
  return /^[A-Za-z_]/u.test(nonEmpty) ? nonEmpty : `ticket-${nonEmpty}`;
}

function nextId(context: RenderContext, label: string) {
  context.serial += 1;
  return `${context.prefix}-${label}-${context.serial}`;
}

function paintAttributes(paint: PrimitivePaint, includeOpacity = true) {
  const attributes: string[] = [];
  if (includeOpacity && paint.opacity !== undefined) {
    attributes.push(`opacity="${number(paint.opacity)}"`);
  }
  if (paint.blend === "multiply") {
    attributes.push('style="mix-blend-mode:multiply"');
  }
  return attributes.length ? ` ${attributes.join(" ")}` : "";
}

function fontFamily(font: SceneFont) {
  const css = font.family
    .map((family) => `"${family.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`)
    .join(",");
  return escapeTicketSvgText(css);
}

function textAnchor(align: TextPrimitive["align"]) {
  if (align === "center") return "middle";
  if (align === "right") return "end";
  return "start";
}

/**
 * TicketScene y is a line-box top. SVG owns font metrics, so centering its
 * central baseline on the line-box midpoint preserves the scene's half-leading
 * contract without re-deriving layout geometry.
 */
function textAttributes(
  primitive: Pick<TextPrimitive, "x" | "y" | "font" | "align">,
  offsetX = 0,
  offsetY = 0,
) {
  const { font } = primitive;
  const y = primitive.y + offsetY + font.lineHeight / 2;
  return [
    `x="${number(primitive.x + offsetX)}"`,
    `y="${number(y)}"`,
    `text-anchor="${textAnchor(primitive.align)}"`,
    'dominant-baseline="central"',
    `font-family="${fontFamily(font)}"`,
    `font-size="${number(font.size)}"`,
    `font-weight="${number(font.weight)}"`,
    `letter-spacing="${number(font.letterSpacing)}"`,
    ...(font.tabularNums ? ['font-variant-numeric="tabular-nums"'] : []),
  ].join(" ");
}

function textElement(
  primitive: SvgTextPrimitive,
  kind: "text" | "ghostText",
  offsetX = 0,
  offsetY = 0,
) {
  return `<text data-kind="${kind}" ${textAttributes(primitive, offsetX, offsetY)} fill="${escapeTicketSvgText(primitive.color)}"${paintAttributes(primitive)}>${escapeTicketSvgText(primitive.text)}</text>`;
}

function punchColumn(context: RenderContext, primitive: PunchColumnPrimitive) {
  if (primitive.pitch <= 0 || primitive.radius <= 0) {
    throw new RangeError("punchColumn pitch와 radius는 양수여야 합니다.");
  }

  const clipId = nextId(context, "punch-clip");
  const gradientId = nextId(context, "punch-gradient");
  context.definitions.push(
    `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${number(primitive.x)}" y="${number(primitive.top)}" width="${number(primitive.width)}" height="${number(primitive.height)}"/></clipPath>`,
    `<radialGradient id="${gradientId}"><stop offset="0" stop-color="${escapeTicketSvgText(primitive.color)}"/><stop offset="${number(primitive.innerStop)}" stop-color="${escapeTicketSvgText(primitive.color)}"/><stop offset="${number(primitive.outerStop)}" stop-color="${escapeTicketSvgText(primitive.color)}" stop-opacity="0"/><stop offset="1" stop-color="${escapeTicketSvgText(primitive.color)}" stop-opacity="0"/></radialGradient>`,
  );

  const steps = Math.ceil(primitive.height / 2 / primitive.pitch) + 1;
  const circles: string[] = [];
  for (let index = -steps; index <= steps; index += 1) {
    circles.push(
      `<circle cx="${number(primitive.x + primitive.width / 2)}" cy="${number(primitive.centerY + index * primitive.pitch)}" r="${number(primitive.radius)}" fill="url(#${gradientId})"/>`,
    );
  }
  return `<g data-kind="punchColumn" data-side="${primitive.side}" clip-path="url(#${clipId})"${paintAttributes(primitive)}>${circles.join("")}</g>`;
}

function barcodeBars(
  context: RenderContext,
  primitive: Extract<ScenePrimitive, { kind: "barcodeBars" }>,
) {
  if (primitive.period <= 0) {
    throw new RangeError("barcodeBars period는 양수여야 합니다.");
  }
  if (Math.ceil(primitive.width / primitive.period) * primitive.bars.length > 100_000) {
    throw new RangeError("barcodeBars가 안전한 SVG 크기를 초과했습니다.");
  }

  const clipId = nextId(context, "barcode-clip");
  context.definitions.push(
    `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${number(primitive.x)}" y="${number(primitive.y)}" width="${number(primitive.width)}" height="${number(primitive.height)}"/></clipPath>`,
  );
  const bars: string[] = [];
  for (let periodX = 0; periodX < primitive.width; periodX += primitive.period) {
    for (const bar of primitive.bars) {
      bars.push(
        `<rect x="${number(primitive.x + periodX + bar.offset)}" y="${number(primitive.y)}" width="${number(bar.width)}" height="${number(primitive.height)}" fill="${escapeTicketSvgText(primitive.color)}"/>`,
      );
    }
  }
  return `<g data-kind="barcodeBars" clip-path="url(#${clipId})" shape-rendering="crispEdges"${paintAttributes(primitive)}>${bars.join("")}</g>`;
}

function halftoneGlyphs(context: RenderContext, primitive: HalftoneGlyphsPrimitive) {
  if (primitive.cell <= 0 || primitive.dotRadius <= 0 || primitive.tileSize <= 0) {
    throw new RangeError("halftoneGlyphs 셀과 타일 크기는 양수여야 합니다.");
  }

  const dotGradientId = nextId(context, "halftone-dot-gradient");
  const dotPatternId = nextId(context, "halftone-dot-pattern");
  const toneId = nextId(context, "halftone-tone");
  const thresholdId = nextId(context, "halftone-threshold");
  const maskId = nextId(context, "halftone-mask");
  const text = escapeTicketSvgText(primitive.text);
  const attributes = textAttributes(primitive);
  const toneStops = primitive.toneStops
    .map(
      ([offset, color]) =>
        `<stop offset="${number(offset)}" stop-color="${escapeTicketSvgText(color)}"/>`,
    )
    .join("");

  context.definitions.push(
    `<radialGradient id="${dotGradientId}"><stop offset="0" stop-color="#ffffff"/><stop offset="${number(primitive.dotCoreStop)}" stop-color="#ffffff"/><stop offset="1" stop-color="#000000"/></radialGradient>`,
    `<pattern id="${dotPatternId}" patternUnits="userSpaceOnUse" width="${number(primitive.cell)}" height="${number(primitive.cell)}"><rect width="${number(primitive.cell)}" height="${number(primitive.cell)}" fill="#000000"/><circle cx="${number(primitive.cell / 2)}" cy="${number(primitive.cell / 2)}" r="${number(primitive.dotRadius)}" fill="url(#${dotGradientId})"/></pattern>`,
    `<linearGradient id="${toneId}" gradientUnits="userSpaceOnUse" x1="0" y1="${number(primitive.rampTop)}" x2="0" y2="${number(primitive.rampTop + primitive.tileSize)}">${toneStops}</linearGradient>`,
    `<filter id="${thresholdId}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${number(primitive.thresholdGain)} ${number(primitive.thresholdGain)} ${number(primitive.thresholdGain)} 0 ${number(primitive.thresholdBias)}"/></filter>`,
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="${number(context.scene.width)}" height="${number(context.scene.height)}" style="mask-type:alpha"><g filter="url(#${thresholdId})" style="isolation:isolate"><text ${attributes} fill="url(#${dotPatternId})">${text}</text><text ${attributes} fill="url(#${toneId})" style="mix-blend-mode:multiply">${text}</text></g></mask>`,
  );

  return `<text data-kind="halftoneGlyphs" ${attributes} fill="${escapeTicketSvgText(primitive.inkColor)}" mask="url(#${maskId})"${paintAttributes(primitive)}>${text}</text>`;
}

function grain(context: RenderContext, primitive: Extract<ScenePrimitive, { kind: "grain" }>) {
  const filterId = nextId(context, "grain");
  const opacity = primitive.opacity ?? 1;
  context.definitions.push(
    `<filter id="${filterId}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${number(primitive.x)}" y="${number(primitive.y)}" width="${number(primitive.tileWidth)}" height="${number(primitive.tileHeight)}" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${number(primitive.baseFrequency)}" numOctaves="${number(primitive.octaves)}" seed="0" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 6 -3"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${number(opacity)} 0"/></filter>`,
  );
  return `<rect data-kind="grain" x="${number(primitive.x)}" y="${number(primitive.y)}" width="${number(primitive.width)}" height="${number(primitive.height)}" fill="#000000" filter="url(#${filterId})"${paintAttributes(primitive, false)}/>`;
}

function qrModules(primitive: Extract<ScenePrimitive, { kind: "qrModules" }>) {
  if (primitive.moduleSize <= 0 || primitive.quietZoneModules < 0) {
    throw new RangeError("qrModules 크기와 quiet zone이 올바르지 않습니다.");
  }
  const modules: string[] = [];
  primitive.modules.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (!filled) return;
      modules.push(
        `<rect x="${number(primitive.x + (columnIndex + primitive.quietZoneModules) * primitive.moduleSize)}" y="${number(primitive.y + (rowIndex + primitive.quietZoneModules) * primitive.moduleSize)}" width="${number(primitive.moduleSize)}" height="${number(primitive.moduleSize)}"/>`,
      );
    });
  });
  return `<g data-kind="qrModules" fill="${escapeTicketSvgText(primitive.color)}" shape-rendering="crispEdges"${paintAttributes(primitive)}>${modules.join("")}</g>`;
}

function renderPrimitive(context: RenderContext, primitive: ScenePrimitive): string {
  switch (primitive.kind) {
    case "rrect":
      return `<rect data-kind="rrect" x="${number(primitive.x)}" y="${number(primitive.y)}" width="${number(primitive.width)}" height="${number(primitive.height)}" rx="${number(primitive.radius)}" ry="${number(primitive.radius)}" fill="${primitive.fill ? escapeTicketSvgText(primitive.fill) : "none"}"${primitive.stroke ? ` stroke="${escapeTicketSvgText(primitive.stroke)}"` : ""}${primitive.strokeWidth !== undefined ? ` stroke-width="${number(primitive.strokeWidth)}"` : ""}${paintAttributes(primitive)}/>`;
    case "path":
      return `<path data-kind="path" d="${escapeTicketSvgText(primitive.d)}" transform="${affine(primitive.transform)}" fill="${escapeTicketSvgText(primitive.fill)}"${paintAttributes(primitive)}/>`;
    case "circle":
      return `<circle data-kind="circle" cx="${number(primitive.cx)}" cy="${number(primitive.cy)}" r="${number(primitive.r)}" fill="${escapeTicketSvgText(primitive.fill)}"${paintAttributes(primitive)}/>`;
    case "rect":
      return `<rect data-kind="rect" x="${number(primitive.x)}" y="${number(primitive.y)}" width="${number(primitive.width)}" height="${number(primitive.height)}" fill="${escapeTicketSvgText(primitive.fill)}"${primitive.transform ? ` transform="${affine(primitive.transform)}"` : ""}${paintAttributes(primitive)}/>`;
    case "dashLine":
      return `<line data-kind="dashLine" x1="${number(primitive.x1)}" y1="${number(primitive.y1)}" x2="${number(primitive.x2)}" y2="${number(primitive.y2)}" fill="none" stroke="${escapeTicketSvgText(primitive.stroke)}" stroke-width="${number(primitive.strokeWidth)}" stroke-dasharray="${primitive.dash.map(number).join(" ")}"${paintAttributes(primitive)}/>`;
    case "punchColumn":
      return punchColumn(context, primitive);
    case "barcodeBars":
      return barcodeBars(context, primitive);
    case "text":
      return textElement(primitive, "text");
    case "ghostText":
      return textElement(primitive, "ghostText", primitive.dx, primitive.dy);
    case "halftoneGlyphs":
      return halftoneGlyphs(context, primitive);
    case "grain":
      return grain(context, primitive);
    case "qrModules":
      return qrModules(primitive);
    default: {
      const exhaustive: never = primitive;
      return exhaustive;
    }
  }
}

function defaultDescription(scene: TicketScene) {
  const announcements = scene.primitives.flatMap((primitive) => {
    if ((primitive.kind === "text" || primitive.kind === "halftoneGlyphs") && primitive.announce) {
      return [primitive.announce];
    }
    return [];
  });
  return [...new Set(announcements)].join(". ");
}

/**
 * Executes a TicketScene as a standalone, script-free SVG string.
 *
 * This renderer does not import React, DOM, filesystem, fonts, or a rasterizer,
 * so the same result can be embedded in server HTML or handed to an SVG/PNG
 * pipeline.
 */
export function renderTicketSceneSvg(scene: TicketScene, options: TicketSvgOptions = {}) {
  if (scene.width <= 0 || scene.height <= 0) {
    throw new RangeError("TicketScene SVG 크기는 양수여야 합니다.");
  }
  const prefix = safeIdPrefix(options.idPrefix ?? `ticket-${scene.variant}`);
  const context: RenderContext = {
    scene,
    prefix,
    definitions: [],
    serial: 0,
  };
  const clipId = nextId(context, "scene-clip");
  context.definitions.push(
    `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${number(scene.clip.x)}" y="${number(scene.clip.y)}" width="${number(scene.clip.width)}" height="${number(scene.clip.height)}" rx="${number(scene.clip.radius)}" ry="${number(scene.clip.radius)}"/></clipPath>`,
  );

  const primitives = scene.primitives
    .map((primitive) => renderPrimitive(context, primitive))
    .join("");
  const titleId = `${prefix}-title`;
  const descriptionId = `${prefix}-desc`;
  const title = options.title ?? "싱송 세션 티켓";
  const description = options.description ?? defaultDescription(scene);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(scene.width)}" height="${number(scene.height)}" viewBox="0 0 ${number(scene.width)} ${number(scene.height)}" role="img" aria-labelledby="${titleId} ${descriptionId}" focusable="false" data-ticket-variant="${scene.variant}"><title id="${titleId}">${escapeTicketSvgText(title)}</title><desc id="${descriptionId}">${escapeTicketSvgText(description)}</desc><defs>${context.definitions.join("")}</defs><g clip-path="url(#${clipId})" aria-hidden="true">${primitives}</g></svg>`;
}
