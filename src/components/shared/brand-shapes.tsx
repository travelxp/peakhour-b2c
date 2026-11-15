import type { BrandShape } from "@/lib/brand-artwork";

/**
 * The official artwork's shapes as SVG children, for server-drawn images (the share image).
 * ⚠️Call it as a function, `{brandShapes(BRAND_MARK_SHAPES)}`, never as a component: Satori allows only intrinsic
 * elements inside <svg> and throws on a function component there.
 */
export function brandShapes(shapes: readonly BrandShape[]) {
  return shapes.map((s, i) => ("d" in s ? <path key={i} d={s.d} /> : <polygon key={i} points={s.points} />));
}
