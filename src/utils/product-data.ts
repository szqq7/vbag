import productsData from "../data/products.json";
import imprintColorsData from "../data/imprint-colors.json";

// ===== 类型定义 =====
export interface ProductSpec {
  specsValue1?: string; specsValue2?: string; imageUrl?: string;
  productWeightKgs?: number; productLengthIn?: number; productWidthIn?: number;
  productHeightIn?: number; printLength?: number; printWidth?: number;
  packingMethodEn?: string; colorRgb?: string;
  specsPricingSteps?: { num: number; price: number }[];
  // 每规格独立的 printing 数据(way → baseSteps)
  printingByWay?: Record<string, { num: number; price: string }[]>;
  // ★ variants 加价表(颜色×位置 → setUpCharge + addOn)
  variantsByWay?: Record<string, { colorCount: number; positionCount: number; setUpCharge: number; addOn: number }[]>;
  // ★ 拆分后的尺码数组(从 specsValue1 拆分)
  sizes?: string[];
  // ★ 尺码加价映射({"2XL": 2, "3XL": 2.5})
  sizeSurcharges?: Record<string, number>;
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
  return data.products.map((p: any) => normalizeProduct(p));
}

/**
 * 将新版扁平 JSON 格式适配为代码内部期望的 ProductData 结构。
 * 检测依据:顶层是否有 SPU 字段。
 */
function normalizeProduct(raw: any): ProductData {
  // 旧格式也兼容 proofing 字段:如果 raw 本身有 proofingSupported/proofingFee,直接补到结果上
  // 新格式走下面完整转换;旧格式先快速补 proofing,再返回原对象
  if (!raw || !raw.SPU) {
    if (raw && raw.proofingSupported !== undefined) {
      return {
        ...raw,
        proofingSupported: raw.proofingSupported === true,
        proofingFee: Number(raw.proofingFee || 0),
      };
    }
    return raw as ProductData;
  }

  // ---- 构建 productSpecs ----
  const productSpecs: ProductSpec[] = (raw.specs || []).map((s: any, idx: number) => {
    const sizeLabel = s.specsValue1 || "";
    // ★ 每个 spec 自己的 printing 数据(丝印/热转印等)按 way 名存下来
    // 因为不同规格的 printing baseSteps 不同,不能共用 printingWays 的价格
    // - printingByWay[way]      = 基础价阶梯(1c1p,最小印花)
    // - variantsByWay[way]      = variants 数组(colorCount × positionCount → setUpCharge + addOn)
    const printingByWay: Record<string, any[]> = {};
    const variantsByWay: Record<string, any[]> = {};
    for (const p of s.printing || []) {
      const wn = (p.wayEn || "").trim();
      if (!wn) continue;
      printingByWay[wn] = (p.baseSteps || []).map((bs: any) => ({
        num: bs.qty,
        price: String(bs.price),
      }));
      variantsByWay[wn] = (p.variants || []).map((v: any) => ({
        colorCount: Number(v.colorCount || 1),
        positionCount: Number(v.positionCount || 1),
        setUpCharge: Number(v.setUpCharge || p.baseSetUpCharge || 0),
        addOn: Number(v.addOn || 0),
      }));
    }

    // ★ 尺码拆分:JSON 把多个尺码用 "|" 拼成字符串,需要拆分成数组
    // 如 "XS|S|M|L|XL|2XL|3XL|4XL" → ["XS","S","M","L","XL","2XL","3XL","4XL"]
    const sizes: string[] = (s.specsValue1 || "")
      .split("|")
      .map((x: string) => x.trim())
      .filter((x: string) => x);

    // ★ 尺码加价:把顶层 sizeSurcharges 映射为 Record<size, addPrice>
    const surchargeMap: Record<string, number> = {};
    const ssArr = raw.sizeSurcharges || [];
    if (Array.isArray(ssArr)) {
      for (const item of ssArr) {
        if (item && item.specsValue) surchargeMap[item.specsValue] = Number(item.specsPrice || 0);
      }
    }

    const spec: ProductSpec = {
      specsValue1: sizeLabel,
      // 新格式的尺寸写在 specsValue1,但 MultiSpecProduct.astro 从 specsValue2 读 label
      // → 同时写入 specsValue2,保证多规格页能正确显示尺寸名(如 "4'' x 4.7''")
      specsValue2: s.specsValue2 || sizeLabel || String(idx),
      // ★ 拆分后的尺码数组 + 加价映射(供 ApparelProduct 使用)
      sizes,
      sizeSurcharges: surchargeMap,
      // blank[] 作为参考定价
      specsPricingSteps: (raw.qty || []).map((q: number, ki: number) => ({
        num: q,
        price: Number(s.blank?.[ki] ?? s.prc1 ?? 0),
      })),
      // ★ 把每规格独立的 printing 价存到 spec 上(前端按规格取)
      printingByWay,
      // ★ variants 加价表(颜色×位置 → setUpCharge + addOn)
      variantsByWay,
    };
    // ★ 新格式字段:productWeightKgs / printWidth / printLength / imageUrl
    if (s.productWeightKgs !== undefined) spec.productWeightKgs = Number(s.productWeightKgs);
    else if (s.productWeight) spec.productWeightKgs = Number(s.productWeight);
    if (s.printLength !== undefined && s.printWidth !== undefined) {
      spec.printLength = Number(s.printLength);
      spec.printWidth = Number(s.printWidth);
    }
    if (s.imageUrl) spec.imageUrl = s.imageUrl;
    if (s.productLength && s.productWidth) {
      spec.productLengthIn = Number(s.productLength);
      spec.productWidthIn = Number(s.productWidth);
      spec.productHeightIn = Number(s.productHeight || 0);
    }
    return spec;
  });

  // ---- 构建 printingWays (按工艺去重:多个 spec 可能共用同一工艺) ----
  const printingWays: any[] = [];
  const seenWays = new Set<string>();

  // ---- 先注入虚拟工艺 "Blank" (无印刷),放最前作为默认 ----
  const firstSpec = raw.specs?.[0];
  if (firstSpec && Array.isArray(firstSpec.blank) && firstSpec.blank.length > 0) {
    const blankSteps = (raw.qty || []).map((q: number, ki: number) => ({
      num: q,
      price: String(firstSpec.blank?.[ki] ?? firstSpec.prc1 ?? 0),
      printingDay: null,
      deliverDay: null,
    }));
    printingWays.push({
      printingWayNameEn: "Blank",
      productPrintingWayPrices: [{
        set_up_charge: "0",
        unit_price: blankSteps[0]?.price || "0",
        printingPositionNum: 0,
        pricingMethod: "blank",
        productPrintingWayPriceSteps: blankSteps,
        isBaseOption: true,
      }],
    });
    seenWays.add("Blank");
  }
  for (const spec of raw.specs || []) {
    for (const p of spec.printing || []) {
      const wayName = p.wayEn || "Unknown";
      if (seenWays.has(wayName)) continue;  // 同一工艺只取第一个 spec 的配置
      seenWays.add(wayName);

      const wayPrices: any[] = [];

      // 每个 variant → 一个 productPrintingWayPrice
      const positions = p.positions || [];
      for (const v of p.variants || []) {
        const posCount = v.positionCount || 1;
        const colorMethod = v.colorCount === 1 ? "1-color" : `${v.colorCount || 1}-color`;
        const addOn = Number(v.addOn || 0);

        const steps = (p.baseSteps || []).map((step: any) => ({
          num: step.qty,
          price: String((Number(step.price) + addOn).toFixed(6)),
          printingDay: step.printingDay,
          deliverDay: step.deliverDay,
        }));

        wayPrices.push({
          set_up_charge: String(v.setUpCharge || p.baseSetUpCharge || 0),
          unit_price: steps[0]?.price || "0",
          printingPositionNum: posCount,
          pricingMethod: colorMethod,
          productPrintingWayPriceSteps: steps,
          isBaseOption: posCount === 1 && v.colorCount === 1,
        });
      }

      // 兜底:添加 1-color 1-pos(如果 variants 没包括)
      const has1c1p = wayPrices.some((w: any) => w.pricingMethod === "1-color" && w.printingPositionNum === 1);
      if (!has1c1p) {
        const baseSteps = (p.baseSteps || []).map((step: any) => ({
          num: step.qty,
          price: String(step.price),
          printingDay: step.printingDay,
          deliverDay: step.deliverDay,
        }));
        wayPrices.unshift({
          set_up_charge: String(p.baseSetUpCharge || 0),
          unit_price: baseSteps[0]?.price || "0",
          printingPositionNum: 1,
          pricingMethod: "1-color",
          productPrintingWayPriceSteps: baseSteps,
          isBaseOption: true,
        });
      }

      printingWays.push({
        printingWayNameEn: p.wayEn || "Unknown",
        productPrintingWayPrices: wayPrices,
      });
    }
  }

  // ---- 构建 printingSurfaces ----
  // 兼容两种格式:字符串数组 ["Front","Back"] 或 对象数组 [{position:"Front",...}]
  const printingSurfaces = (raw.surfaces || []).map((s: any, i: number) => {
    if (typeof s === "string") return { printingPositionNameEn: s };
    return { printingPositionNameEn: s.position || s.surfaceName || `Surface ${i + 1}` };
  });

  // ---- 产品阶梯价(顶层 productPricingSteps) ----
  const productPricingSteps = (raw.qty || []).map((q: number) => ({
    num: q,
    price: productSpecs[0]?.specsPricingSteps?.find((sp: any) => sp.num === q)?.price ?? 0,
  }));

  // ---- images 处理:兼容三种格式 ----
  // 1) 数组 [{position,url},...] → 取 url
  // 2) 对象 { "Surface 1": "url" } → Object.values
  // 3) 字符串数组 ["url1","url2"] → 直接用
  let images: string[] = [];
  const si = raw.surfaceImages;
  if (Array.isArray(si)) {
    if (si.length > 0 && typeof si[0] === "string") {
      images = si;
    } else {
      images = si.map((it: any) => (typeof it === "string" ? it : it.url || "")).filter(Boolean);
    }
  } else if (si && typeof si === "object") {
    images = Object.values(si).map((v: any) => (typeof v === "string" ? v : v?.url || "")).filter(Boolean);
  }

  const result: any = {
    code: raw.SPU,
    nameEn: raw.title || "",
    specsType: raw.spec || "",
    specsValue: [productSpecs.map((s: any) => s.specsValue1)],
    imgMainUrl: raw.imgMain || "",
    files: raw.files || [],
    knifeFiles: raw.knifeFiles || [],
    printingWays,
    productSpecs,
    productPricingSteps,
    printingSurfaces,
    shippingCharge: { amount: 0, currency: "USD", isFixed: true },
    images,
    // ★ 保留顶层 colors 字段(产品本体颜色数组,供 getColorOptions 使用)
    colors: Array.isArray(raw.colors) ? raw.colors : [],
    // ★ Proofing 字段(替代 Physical Sample):勾选后 summary 加 proofingFee
    // 兼容多种 JSON 写法:"true"/"false"/true/false/数字等
    proofingSupported: raw.proofingSupported === true || raw.proofingSupported === "true" || raw.proofingSupported === 1 || raw.proofingSupported === "1",
    proofingFee: Number(raw.proofingFee || 0),
  };

  return result as ProductData;
}

export function loadProduct(code: string): ProductData | null {
  const list = getAllProducts();
  for (let i = 0; i < list.length; i++) {
    if (list[i].code === code) return list[i];
  }
  return null;
}

/**
 * 读取 Imprint Color 选择器的颜色列表(独立于产品 JSON)
 * - 始终从 src/data/imprint-colors.json 读取
 * - 不读 product.colors(product.color 是另一个概念:产品的本体颜色,顶部色块用)
 * - 后期修改颜色只需改 imprint-colors.json 一个文件
 */
export function loadImprintColors(_product?: ProductData | null): ColorOption[] {
  const data = imprintColorsData as any;
  const list = Array.isArray(data) ? data : (data.colors || []);
  return list.map((c: any) => ({
    name: c.name,
    rgb: c.rgb,
    imageUrl: c.imageUrl || "",
  }));
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
  // 第1步:检查 JSON 中是否存在 colors 字段
  if (Array.isArray((p as any).colors) && (p as any).colors.length > 0) {
    // 第2步:存在则直接用 colors 数组
    return (p as any).colors.map((c: any) => ({
      name: safeStr(c.name || c, "").trim(),
      rgb: c.rgb || guessRgb(safeStr(c.name || c, "")),
      imageUrl: c.imageUrl || p.imgMainUrl || "",
    }));
  }
  // 第3步:不存在 → 返回空(不再从 productSpecs 读取,避免把尺寸当颜色)
  return [];
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
  // 兜底:从 printingWays[0].productPrintingWayPrices[0].productPrintingWayPriceSteps 读取(306227)
  const ways = safeArr(p.printingWays);
  for (const w of ways) {
    const prices = (w as any).productPrintingWayPrices;
    if (Array.isArray(prices) && prices[0] && Array.isArray(prices[0].productPrintingWayPriceSteps)) {
      const steps = prices[0].productPrintingWayPriceSteps as any[];
      if (steps.length > 0) {
        return steps.map((t: any) => ({ num: t.num, price: String(t.price) }));
      }
    }
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
  // 动态从 printingWays 数组读取(取代旧硬编码 Screen Print / Heat Transfer)
  if (ways.length > 0) {
    const tabs: { name: string; pricingSteps: PricingStep[] }[] = [];
    for (const w of ways) {
      const name = safeStr((w as any).printingWayNameEn, "").trim();
      if (!name) continue;
      let ps: PricingStep[] = base;
      const pp = (w as any).productPrintingWayPrices;
      if (Array.isArray(pp) && pp[0] && Array.isArray(pp[0].productPrintingWayPriceSteps)) {
        ps = pp[0].productPrintingWayPriceSteps;
      }
      tabs.push({ name, pricingSteps: ps });
    }
    if (tabs.length > 0) return tabs;
  }
  // 兜底:printingWays 为空时返回 Blank + 基础价
  return [
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
    if (files[i].type === 0) {
      const url = files[i].url || files[i].file?.path;
      if (url) push(url);
    }
  }
  const imgs = safeArr(p.imgs);
  for (let i = 0; i < imgs.length; i++) { push(imgs[i].url); push(imgs[i].path); }
  return out;
}

export function getDownloadFiles(p: ProductData): { path?: string }[] {
  const out: { path?: string }[] = [];
  const files = safeArr(p.files);
  for (let i = 0; i < files.length; i++) {
    // 兼容新旧格式:新 {url,type,name} / 旧 {file:{path}}
    if (files[i].type === 0) {
      const url = files[i].url || files[i].file?.path;
      if (url) out.push({ path: url });
    }
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
    // 兼容新旧格式:新 {url,...} / 旧 {file:{path}}
    const url = kf[i].url || kf[i].file?.path;
    if (url) out.push({ path: url });
  }
  // 新格式:files 数组里 type=1 是模板(PDF)
  if (out.length === 0) {
    const files = safeArr((p as any).files);
    for (let i = 0; i < files.length; i++) {
      if (files[i].type === 1) {
        const url = files[i].url || files[i].file?.path;
        if (url) out.push({ path: url });
      }
    }
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
