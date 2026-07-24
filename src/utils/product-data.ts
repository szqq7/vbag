import productsData from "../data/products.json";

// ===== 类型定义 =====
export interface ProductSpec {
  specsValue1?: string; specsValue2?: string; imageUrl?: string;
  productWeightKgs?: number; productLengthIn?: number; productWidthIn?: number;
  productHeightIn?: number; printLength?: number; printWidth?: number;
  packingMethodEn?: string; colorRgb?: string;
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

// ===== 颜色启发式 =====
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

// ===== 数组/字符串安全访问(替代 ?.) =====
function safeArr<T>(v: T[] | undefined | null): T[] {
  return v || [];
}
function safeStr(v: any, fallback: string): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

// ===== 加载所有产品(单文件) =====
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

export function getPricingSteps(p: ProductData): PricingStepDisplay[] {
  const out: PricingStepDisplay[] = [];
  const steps = safeArr(p.productPricingSteps);
  const filtered = steps.filter(s => typeof s.num === "number" && s.price);
  filtered.sort((a, b) => a.num - b.num);
  for (let i = 0; i < filtered.length; i++) {
    const s = filtered[i];
    const price = parseFloat(s.price);
    out.push({
      label: s.num + "+",
      quantity: s.num,
      price: price,
      formatted: "$" + price.toFixed(2)
    });
  }
  return out;
}

export function getPrintMethodTabs(p: ProductData): { name: string; pricingSteps: PricingStep[] }[] {
  const base: PricingStep[] = [];
  const steps = safeArr(p.productPricingSteps);
  for (let i = 0; i < steps.length; i++) {
    base.push({ num: steps[i].num, price: steps[i].price });
  }
  const ways = safeArr(p.printingWays);
  function findWay(name: string): PricingStep[] {
    const target = name.toLowerCase();
    for (let i = 0; i < ways.length; i++) {
      const way = ways[i];
      const wayName = safeStr(way.printingWayNameEn, "").toLowerCase();
      if (wayName.indexOf(target) !== -1) {
        const prices = way.productPrintingWayPrices;
        if (prices && prices[0] && prices[0].productPrintingWayPriceSteps) {
          return prices[0].productPrintingWayPriceSteps;
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
      const w = r.regionWidth || 0;
      const h = r.regionHigh || 0;
      regions.push({
        name: safeStr(r.regionName, surface.printingPositionNameEn || ""),
        width: w,
        height: h,
        label: w + " in / " + h + " in"
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
  for (let i = 0; i < imgs.length; i++) {
    push(imgs[i].url);
    push(imgs[i].path);
  }
  return out;
}

export function getDownloadFiles(p: ProductData): { path?: string }[] {
  const out: { path?: string }[] = [];
  const files = safeArr(p.files);
  for (let i = 0; i < files.length; i++) {
    if (files[i].type === 0 && files[i].file && files[i].file.path) {
      out.push(files[i].file);
    }
  }
  return out;
}

export function getTemplateFiles(p: ProductData): { path?: string }[] {
  const out: { path?: string }[] = [];
  const kf = safeArr(p.knifeFiles);
  for (let i = 0; i < kf.length; i++) {
    if (kf[i].file && kf[i].file.path) out.push(kf[i].file);
  }
  return out;
}

export function getSpecifications(p: ProductData): SpecRow[] {
  const specs = safeArr(p.productSpecs);
  const f = specs[0];
  const colors = getColorOptions(p);
  const colorNames = colors.map(c => c.name).join(", ");
  let size = "-";
  if (f && (f.productLengthIn || f.productWidthIn || f.productHeightIn)) {
    size = (f.productLengthIn || "?") + '" × ' +
           (f.productWidthIn || "?") + '" × ' +
           (f.productHeightIn || "?") + '"';
  }
  let wt = "-";
  if (f && f.productWeightKgs) {
    wt = (f.productWeightKgs * 2.20462).toFixed(2);
  }
  const ways = safeArr(p.printingWays);
  const methodNames: string[] = [];
  for (let i = 0; i < ways.length; i++) {
    if (ways[i].printingWayNameEn) methodNames.push(ways[i].printingWayNameEn!);
  }
  const methods = methodNames.join(" / ") || "-";
  let area = "-";
  if (f && (f.printLength || f.printWidth)) {
    area = (f.printLength || "?") + '" × ' + (f.printWidth || "?") + '"';
  }
  return [
    { label: "Standard Color Options", value: colorNames || "-" },
    { label: "Material", value: p.material || "-" },
    { label: "Product Size", value: size },
    { label: "Product Weight", value: wt === "-" ? "-" : wt + " lbs" },
    { label: "Imprint Method", value: methods },
    { label: "Imprint Area (inch)", value: area },
    { label: "Packing Method", value: (f && f.packingMethodEn) || "-" }
  ];
}
