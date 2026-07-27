import type { ProductData } from "./product-data";

/**
 * 产品页面类型
 * - single-spec: 非服装 + 单一规格（尺寸只有一种）
 * - multi-spec : 非服装 + 多种规格（尺寸有多个，size-tags 单选 + qtyInput）
 * - apparel    : 服装（每个尺码一个 input 多选）
 */
export type ProductPageType = "single-spec" | "multi-spec" | "apparel";

const APPAREL_KEYWORDS = /garment[- _]?size|apparel[- _]?size|clothing[- _]?size/i;
const LETTER_SIZE_PATTERN = /\b(XS|S|M|L|XL|XXL|XXXL|XXXL)\b/i;

/**
 * 判定产品应该走哪种页面。
 *
 * 判定优先级（务必与 /products 需求文档一致）：
 * 1. specsType 含服装尺码关键词 → apparel
 * 2. specsValue2 中含字母尺码(S/M/L/XL) → apparel（防数据缺少 specsType）
 * 3. productSpecs 中 specsValue2 唯一非空值 > 1 → multi-spec
 * 4. 其余 → single-spec
 */
export function getProductPageType(p: ProductData | null | undefined): ProductPageType {
  if (!p) return "single-spec";

  // ① specsType 字段判断
  const specsType: string = (p as any).specsType || "";
  if (APPAREL_KEYWORDS.test(specsType)) return "apparel";

  const specs = p.productSpecs || [];
  const uniqueV2 = new Set<string>();
  for (const s of specs) {
    const v = (s.specsValue2 || "").trim();
    if (v) uniqueV2.add(v);
  }

  // ② 备用:规格值含字母尺码(S/M/L/XL)→服装
  if (uniqueV2.size > 0) {
    for (const v of uniqueV2) {
      if (LETTER_SIZE_PATTERN.test(v)) return "apparel";
    }
  }

  return uniqueV2.size > 1 ? "multi-spec" : "single-spec";
}
