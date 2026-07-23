// Food data: Claude vision via /api/scan, USDA FDC search, Open Food Facts barcode.

const KEY_NS = "lockedin_v1:anthropic_key";

export function getUserApiKey() {
  try { return localStorage.getItem(KEY_NS) || ""; } catch { return ""; }
}

export function setUserApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_NS, key.trim());
    else localStorage.removeItem(KEY_NS);
  } catch {}
}

export async function scanImage(base64, mime) {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mime, apiKey: getUserApiKey() || undefined }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Scan failed");
  return res.json();
}

export async function describeFood(text) {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: text, apiKey: getUserApiKey() || undefined }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Analysis failed");
  return res.json();
}

const USDA_KEY = process.env.NEXT_PUBLIC_USDA_KEY || "DEMO_KEY";

export async function searchUSDA(query) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}&query=${encodeURIComponent(query)}&pageSize=15&dataType=Foundation,SR%20Legacy,Branded`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA search failed");
  const data = await res.json();
  return (data.foods || []).map((f) => {
    const nut = (id) => f.foodNutrients?.find((n) => n.nutrientId === id)?.value || 0;
    return {
      name: f.description,
      brand: f.brandOwner || f.brandName || "",
      per100: { kcal: nut(1008), p: nut(1003), c: nut(1005), f: nut(1004) },
    };
  });
}

export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
  if (!res.ok) throw new Error("Product not found");
  const data = await res.json();
  if (data.status !== 1) throw new Error("Product not found");
  const p = data.product;
  const n = p.nutriments || {};
  return {
    name: p.product_name || "Unknown product",
    brand: p.brands || "",
    per100: {
      kcal: n["energy-kcal_100g"] || 0,
      p: n.proteins_100g || 0,
      c: n.carbohydrates_100g || 0,
      f: n.fat_100g || 0,
    },
    servingG: parseFloat(p.serving_quantity) || null,
  };
}

// Resize an image File to <=1024px JPEG base64 (for /api/scan)
export function fileToScanPayload(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(url);
      resolve({ base64: dataUrl.split(",")[1], mime: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}
