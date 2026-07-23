import productsData from "../data/products.json";

// ===== Types =====
export interface ProductSpec {
  specsValue1?: string; specsValue2?: string; imageUrl?: string;
  productWeightKgs?: number; productLengthIn?: number; productWidthIn?: number;
  productHeightIn?: number; printLength?: number; printWidth?: number;
  packingMethodEn?: string; colorRgb?: string;
}
export interface PricingStep { num: number; price: string; }
export interface PrintingSurface {
  printingPositionNameEn?: string; printingRegions?: PrintingRegion[];
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
export interface SurfaceDisplay { name: string; regions: { name: string; width: number; height: number; label: string }[]; }

// ===== Color heuristic =====
const COLOR_NAME_RGB: Record<string, string> = {
  white:"#ffffff",black:"#000000",red:"#e74c3c",blue:"#3498db",navy:"#1f3a5f","navy blue":"#1f3a5f",
  green:"#27ae60","forest green":"#228b22","lime green":"#32cd32","yellow":"#f1c40f",orange:"#e67e22",
  pink:"#ff69b4",purple:"#9b59b6",gray:"#95a5a6",grey:"#95a5a6",silver:"#c0c0c0",gold:"#ffd700",
  brown:"#8b4513",beige:"#f5f5dc",tan:"#d2b48c",clear:"#e0e0e0",transparent:"#e0e0e0",
  bamboo:"#e8c291",wood:"#deb887",natural:"#deb887",royal:"#4169e1","royal blue":"#4169e1",
  maroon:"#800000",burgundy:"#800020",teal:"#008080",cyan:"#00ffff",magenta:"#ff00ff",
};
function guessRgb(n: string): string {
  if(!n)return"#ccc";const key=n.toLowerCase().trim();if(COLOR_NAME_RGB[key])return COLOR_NAME_RGB[key];
  for(const[k,v]of Object.entries(COLOR_NAME_RGB))if(key.includes(k))return v;return"#ccc";
}

// ===== 单文件加载 =====
export function getAllProducts(): ProductData[] {
  return (productsData as any).products || [];
}

export function loadProduct(code: string): ProductData | null {
  return getAllProducts().find(p => p.code === code) || null;
}

export function getColorOptions(p: ProductData): ColorOption[] {
  const seen = new Map<string, ColorOption>();
  for (const s of p.productSpecs || []) {
    const n = (s.specsValue1 || "").trim();
    if (!n || seen.has(n)) continue;
    seen.set(n, { name: n, rgb: s.colorRgb || guessRgb(n), imageUrl: s.imageUrl || p.imgMainUrl || "" });
  }
  return Array.from(seen.values());
}

export function getPricingSteps(p: ProductData): PricingStepDisplay[] {
  return (p.productPricingSteps || [])
    .filter(s => typeof s.num === "number" && s.price)
    .sort((a, b) => a.num - b.num)
    .map(s => ({ label: `${s.num}+`, quantity: s.num, price: parseFloat(s.price), formatted: `$${parseFloat(s.price).toFixed(2)}` }));
}

export function getPrintMethodTabs(p: ProductData): { name: string; pricingSteps: PricingStep[] }[] {
  const base = (p.productPricingSteps || []).map(s => ({ num: s.num, price: s.price }));
  const find = (n: string) =>
    (p.printingWays || []).find(w => (w.printingWayNameEn || "").toLowerCase().includes(n.toLowerCase()))
      ?.productPrintingWayPrices?.[0]?.productPrintingWayPriceSteps || base;
  return [
    { name: "Screen Print", pricingSteps: find("screen") },
    { name: "Heat Transfer", pricingSteps: find("heat") },
    { name: "Blank", pricingSteps: base },
  ];
}

export function getPrintingSurfaces(p: ProductData): SurfaceDisplay[] {
  return (p.printingSurfaces || []).map(surface => ({
    name: surface.printingPositionNameEn || "Surface",
    regions: (surface.printingRegions || []).map(r => ({
      name: r.regionName || surface.printingPositionNameEn || "",
      width: r.regionWidth || 0,
      height: r.regionHigh || 0,
      label: `${r.regionWidth || 0} in / ${r.regionHigh || 0} in`,
    })),
  }));
}

export function getAllImages(p: ProductData): string[] {
  const imgs: string[] = [];
  const push = (u?: string | null) => { if (u && !imgs.includes(u)) imgs.push(u); };
  push(p.imgMainUrl);
  for (const s of p.productSpecs || []) push(s.imageUrl);
  for (const f of p.files || []) { if (f.type === 0) push(f.file?.path); }
  for (const i of p.imgs || []) push(i.url || i.path);
  return imgs;
}

export function getDownloadFiles(p: ProductData): { path?: string }[] {
  return (p.files || []).filter(f => f.type === 0 && f.file?.path).map(f => f.file!);
}
export function getTemplateFiles(p: ProductData): { path?: string }[] {
  return (p.knifeFiles || []).filter(f => f.file?.path).map(f => f.file!);
}

export function getSpecifications(p: ProductData): SpecRow[] {
  const f = p.productSpecs?.[0];
  const colors = getColorOptions(p).map(c => c.name).join(", ");
  const size = f && (f.productLengthIn || f.productWidthIn || f.productHeightIn)
    ? `${f.productLengthIn || "?"}" × ${f.productWidthIn || "?"}" × ${f.productHeightIn || "?"}"` : "-";
  const wt = f?.productWeightKgs ? (f.productWeightKgs * 2.20462).toFixed(2) : "-";
  const methods = (p.printingWays || []).map(w => w.printingWayNameEn).filter(Boolean).join(" / ") || "-";
  const area = f && (f.printLength || f.printWidth) ? `${f.printLength || "?"}" × ${f.printWidth || "?"}"` : "-";
  return [
    { label: "Standard Color Options", value: colors || "-" },
    { label: "Material", value: p.material || "-" },
    { label: "Product Size", value: size },
    { label: "Product Weight", value: wt === "-" ? "-" : `${wt} lbs` },
    { label: "Imprint Method", value: methods },
    { label: "Imprint Area (inch)", value: area },
    { label: "Packing Method", value: f?.packingMethodEn || "-" },
  ];
}
