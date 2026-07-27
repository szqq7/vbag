import type { ProductData } from "./product-data";

/**
 * 产品页面类型
 * - single-spec: 非服装 + 单一规格（尺寸只有一种）
 * - multi-spec : 非服装 + 多种规格（尺寸有多个，size-tags 单选 + qtyInput）
 * - apparel    : 服装（每个尺码一个 input 多选）
 */
export type ProductPageType = "single-spec" | "multi-spec" | "apparel";

const APPAREL_KEYWORDS = /garment[- _]?size|apparel[- _]?size|clothing[- _]?size/i;

/**
 * 判定产品应该走哪种页面。
 *
 * 判定优先级（务必与 /products 需求文档一致）：
 * 1. specsType 含服装尺码关键词 → apparel
 * 2. productSpecs 中 specsValue2 唯一非空值 > 1 → multi-spec
 * 3. 其余 → single-spec
 */
export function getProductPageType(p: ProductData | null | undefined): ProductPageType {
  if (!p) return "single-spec";
  const specsType: string = (p as any).specsType || "";
  if (APPAREL_KEYWORDS.test(specsType)) return "apparel";

  const specs = p.productSpecs || [];
  const uniqueV2 = new Set<string>();
  for (const s of specs) {
    const v = (s.specsValue2 || "").trim();
    if (v) uniqueV2.add(v);
  }
  return uniqueV2.size > 1 ? "multi-spec" : "single-spec";
}
