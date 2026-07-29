import productsData from "../data/products.json";

// ===== 类型定义 =====
export interface ProductSpec {
  specsValue1?: string; specsValue2?: string; imageUrl?: string;
  productWeightKgs?: number; productLengthIn?: number; productWidthIn?: number;
  productHeightIn?: number; printLength?: number; printWidth?: number;
  packingMethodEn?: string; colorRgb?: string;
  specsPricingSteps?: { num: number; price: number }[];
}
export interface PricingStep { num: number; price: string; }
export interface PrintingSurface {
  printingPositionNameEn?: string;
  printingRegions?: PrintingRegion[];
}
export interface PrintingRegion { regionWidth?: number; regionHigh?: number; }
export interface PrintingWay {
  printingWayNameEn?: string;
  productPrintingWayPrices?: { productPrintingWayPriceSteps?: PricingStep[] }[];
}
export interface ProductFile { type?: number; file?: { path?: string }; }
export interface ProductImage { path?: string; url?: string; }
export interface ProductCategory { nameEn?: string; parent?: ProductCategory | null; }

export interface ProductData {
  id?: string; code: string; nameEn: string; type?: string;
  descriptionEn?: string; descriptionCn?: string; material?: string;
  imgMain?: string; imgMainUrl?: string;
  productSpecs?: ProductSpec[]; productPricingSteps?: PricingStep[];
  printingSurfaces?: PrintingSurface[]; printingWays?: PrintingWay[];
  files?: ProductFile[]; knifeFiles?: ProductFile[]; imgs?: ProductImage[];
  category?: ProductCategory;
}

export interface SpecRow { label: string; value: string; }
export interface ColorOption { name: string; rgb: string; imageUrl: string; }
export interface PricingStepDisplay { label: string; quantity: number; price: number; formatted: string; }
export interface SurfaceDisplay {
  name: string;
  regions: { name: string; width: number; height: number; label: string }[];
}

const COLOR_NAME_RGB: Record<string, string> = {
  white: "#ffffff", black: "#000000", red: "#e74c3c", blue: "#3498db",
  navy: "#1f3a5f", "navy blue": "#1f3a5f", green: "#27ae60",
  "forest green": "#228b22", "lime green": "#32cd32", yellow: "#f1c40f",
  orange: "#e67e22", pink: "#ff69b4", purple: "#9b59b6",
  gray: "#95a5a6", grey: "#95a5a6", silver: "#c0c0c0", gold: "#ffd700",
  brown: "#8b4513", beige: "#f5f5dc", tan: "#d2b48c",
  clear: "#e0e0e0", transparent: "#e0e0e0", bamboo: "#e8c291",
  wood: "#deb887", natural: "#deb887", royal: "#4169e1",
  "royal blue": "#4169e1", maroon: "#800000", burgundy: "#800020",
  teal: "#008080", cyan: "#00ffff", magenta: "#ff00ff"
};

function guessRgb(name: string): string {
  if (!name) return "#cccccc";
  const key = name.toLowerCase().trim();
  if (COLOR_NAME_RGB[key]) return COLOR_NAME_RGB[key];
  const keys = Object.keys(COLOR_NAME_RGB);
  for (let i = 0; i < keys.length; i++) {
    if (key.indexOf(keys[i]) !== -1) return COLOR_NAME_RGB[keys[i]];
  }
  return "#cccccc";
}

function safeArr<T>(v: T[] | undefined | null): T[] {
  return v || [];
}
function safeStr(v: any, fallback: string): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function getAllProducts(): ProductData[] {
  const data = productsData as any;
  if (!data || !data.products) return [];
  return data.products;
}

export function loadProduct(code: string): ProductData | null {
  const list = getAllProducts();
  for (let i = 0; i < list.length; i++) {
    if (list[i].code === code) return list[i];
  }
  return null;
}

/**
 * 提取产品的印刷版费表 + 单价表(V3.0)
 * - setUpFeeMap["Screen Print|1-color|1"] = 50.00  (set_up_charge)
 * - unitPriceMap["Screen Print|1-color|1"] = 1.30  (unit_price)
 * - baseSetUpFees["Screen Print"]    = 50.00
 * - baseUnitPrices["Screen Print"]   = 1.30
 */
export function getPublishFeeData(p: ProductData): {
  setUpFeeMap: Record<string, number>;
  unitPriceMap: Record<string, number>;
  baseSetUpFees: Record<string, number>;
  baseUnitPrices: Record<string, number>;
} {
  const setUpFeeMap: Record<string, number> = {};
  const unitPriceMap: Record<string, number> = {};
  const baseSetUpFees: Record<string, number> = {};
  const baseUnitPrices: Record<string, number> = {};
  const ways = safeArr((p as any).printingWays);
  for (const way of ways) {
    const wn: string = (way as any).printingWayNameEn || "";
    const prices = safeArr((way as any).productPrintingWayPrices);
    for (const pp of prices) {
      const method = pp.pricingMethod;
      const pos = pp.printingPositionNum;
      const key = wn + "|" + method + "|" + pos;
      setUpFeeMap[key] = parseFloat(pp.set_up_charge ?? pp.publishFee ?? "0") || 0;
      // unit_price 优先取字段,否则取第一档
      const upRaw = pp.unit_price ?? (pp.productPrintingWayPriceSteps?.[0]?.price ?? "0");
      unitPriceMap[key] = parseFloat(upRaw) || 0;
      if (pp.isBaseOption) {
        if (baseSetUpFees[wn] === undefined) baseSetUpFees[wn] = setUpFeeMap[key];
        if (baseUnitPrices[wn] === undefined) baseUnitPrices[wn] = unitPriceMap[key];
      }
    }
  }
  return { setUpFeeMap, unitPriceMap, baseSetUpFees, baseUnitPrices };
}

/**
 * 提取产品各 (way, method, position, qtyTier) 的 deliverDay
 * - deliveryDayMap["Screen Print|1-color|1|100"] = 9
 */
export function getDeliveryDayData(p: ProductData): {
  deliveryDayMap: Record<string, number>;
} {
  const deliveryDayMap: Record<string, number> = {};
  const ways = safeArr((p as any).printingWays);
  for (const way of ways) {
    const wn: string = (way as any).printingWayNameEn || "";
    const prices = safeArr((way as any).productPrintingWayPrices);
    for (const pp of prices) {
      const steps = safeArr(pp.productPrintingWayPriceSteps);
      for (const step of steps) {
        const key = wn + "|" + pp.pricingMethod + "|" + pp.printingPositionNum + "|" + step.num;
        deliveryDayMap[key] = step.deliverDay || 0;
      }
    }
  }
  return { deliveryDayMap };
}

export function getColorOptions(p: ProductData): ColorOption[] {
  const seen: Record<string, ColorOption> = {};
  const result: ColorOption[] = [];
  const specs = safeArr(p.productSpecs);
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const name = safeStr(s.specsValue1, "").trim();
    if (!name || seen[name]) continue;
    const opt: ColorOption = {
      name: name,
      rgb: s.colorRgb || guessRgb(name),
      imageUrl: s.imageUrl || p.imgMainUrl || ""
    };
    seen[name] = opt;
    result.push(opt);
  }
  return result;
}

/**
 * 获取产品的有效阶梯价：优先 productPricingSteps，回退到第一个 SKU 的 specsPricingSteps
 */
function getEffectivePricingSteps(p: ProductData): PricingStep[] {
  const topSteps = safeArr(p.productPricingSteps);
  if (topSteps.length > 0) return topSteps;
  const specs = safeArr(p.productSpecs);
  if (specs.length > 0 && Array.isArray((specs[0] as any).specsPricingSteps)) {
    return (specs[0] as any).specsPricingSteps.map((t: any) => ({ num: t.num, price: String(t.price) }));
  }
  return [];
}

export function getPricingSteps(p: ProductData): PricingStepDisplay[] {
  const out: PricingStepDisplay[] = [];
  const steps = getEffectivePricingSteps(p);
  const filtered = steps.filter(s => typeof s.num === "number" && s.price);
  filtered.sort((a, b) => a.num - b.num);
  for (let i = 0; i < filtered.length; i++) {
    const s = filtered[i];
    const price = parseFloat(s.price);
    out.push({ label: s.num + "+", quantity: s.num, price: price, formatted: "$" + price.toFixed(2) });
  }
  return out;
}

export function getPrintMethodTabs(p: ProductData): { name: string; pricingSteps: PricingStep[] }[] {
  const base: PricingStep[] = [];
  const steps = getEffectivePricingSteps(p);
  for (let i = 0; i < steps.length; i++) {
    base.push({ num: steps[i].num, price: steps[i].price });
  }
  const ways = safeArr(p.printingWays);
  function findWay(name: string): PricingStep[] {
    const target = name.toLowerCase();
    for (let i = 0; i < ways.length; i++) {
      if (safeStr(ways[i].printingWayNameEn, "").toLowerCase().indexOf(target) !== -1) {
        if (ways[i].productPrintingWayPrices && ways[i].productPrintingWayPrices[0] && ways[i].productPrintingWayPrices[0].productPrintingWayPriceSteps) {
          return ways[i].productPrintingWayPrices![0].productPrintingWayPriceSteps!;
        }
      }
    }
    return base;
  }
  return [
    { name: "Screen Print", pricingSteps: findWay("screen") },
    { name: "Heat Transfer", pricingSteps: findWay("heat") },
    { name: "Blank", pricingSteps: base }
  ];
}

export function getPrintingSurfaces(p: ProductData): SurfaceDisplay[] {
  const out: SurfaceDisplay[] = [];
  const surfaces = safeArr(p.printingSurfaces);
  for (let i = 0; i < surfaces.length; i++) {
    const surface = surfaces[i];
    const regions: SurfaceDisplay["regions"] = [];
    const rs = safeArr(surface.printingRegions);
    for (let j = 0; j < rs.length; j++) {
      const r = rs[j];
      regions.push({
        name: safeStr(r.regionName, surface.printingPositionNameEn || ""),
        width: r.regionWidth || 0,
        height: r.regionHigh || 0,
        label: (r.regionWidth || 0) + " in / " + (r.regionHigh || 0) + " in"
      });
    }
    out.push({ name: safeStr(surface.printingPositionNameEn, "Surface"), regions });
  }
  return out;
}

export function getAllImages(p: ProductData): string[] {
  const out: string[] = [];
  function push(u: any): void {
    if (!u || typeof u !== "string") return;
    if (out.indexOf(u) === -1) out.push(u);
  }
  push(p.imgMainUrl);
  const specs = safeArr(p.productSpecs);
  for (let i = 0; i < specs.length; i++) push(specs[i].imageUrl);
  const files = safeArr(p.files);
  for (let i = 0; i < files.length; i++) {
    if (files[i].type === 0 && files[i].file) push(files[i].file.path);
  }
  const imgs = safeArr(p.imgs);
  for (let i = 0; i < imgs.length; i++) { push(imgs[i].url); push(imgs[i].path); }
  return out;
}

export function getDownloadFiles(p: ProductData): { path?: string }[] {
  const out: { path?: string }[] = [];
  const files = safeArr(p.files);
  for (let i = 0; i < files.length; i++) {
    if (files[i].type === 0 && files[i].file && files[i].file.path) out.push(files[i].file!);
  }
  // 兜底:部分产品(例如 1812092)files 为空,使用 imgMainUrl 作为 Hi-Res 图片
  if (out.length === 0 && (p as any).imgMainUrl) {
    out.push({ path: (p as any).imgMainUrl });
  }
  return out;
}

export function getTemplateFiles(p: ProductData): { path?: string }[] {
  const out: { path?: string }[] = [];
  const kf = safeArr(p.knifeFiles);
  for (let i = 0; i < kf.length; i++) {
    if (kf[i].file && kf[i].file.path) out.push(kf[i].file!);
  }
  return out;
}

export function getSpecifications(p: ProductData): SpecRow[] {
  const specs = safeArr(p.productSpecs);
  const f = specs[0];
  const colors = getColorOptions(p).map(c => c.name).join(", ");
  let size = "-";
  if (f && (f.productLengthIn || f.productWidthIn || f.productHeightIn)) {
    size = (f.productLengthIn || "?") + '" × ' + (f.productWidthIn || "?") + '" × ' + (f.productHeightIn || "?") + '"';
  }
  let wt = "-";
  if (f && f.productWeightKgs) wt = (f.productWeightKgs * 2.20462).toFixed(2);
  const methods = safeArr(p.printingWays).map(w => w.printingWayNameEn).filter(Boolean).join(" / ") || "-";
  let area = "-";
  if (f && (f.printLength || f.printWidth)) area = (f.printLength || "?") + '" × ' + (f.printWidth || "?") + '"';
  return [
    { label: "Standard Color Options", value: colors || "-" },
    { label: "Material", value: p.material || "-" },
    { label: "Product Size", value: size },
    { label: "Product Weight", value: wt === "-" ? "-" : wt + " lbs" },
    { label: "Imprint Method", value: methods },
    { label: "Imprint Area (inch)", value: area },
    { label: "Packing Method", value: (f && f.packingMethodEn) || "-" }
  ];
}
