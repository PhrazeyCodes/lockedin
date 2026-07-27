// AI food analysis — Claude vision + text. ANTHROPIC_API_KEY stays server-side only.
export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM = `You are a nutrition estimation engine for a fitness app. You are given a photo of food or a text description, and you always return your best numeric estimate — never a refusal, never a follow-up question.

Rules:
- Restaurant and fast-food items: use your knowledge of that chain's published nutrition (e.g. "In-N-Out Double Double" ≈ 670 kcal, 37g protein, 39g carbs, 41g fat). Match the specific menu item named.
- Packaged/branded products: use the label values for the portion described.
- Home-cooked or generic food: estimate from typical portion sizes and ingredients.
- If the portion is unstated, assume one standard serving of that item.
- If the description is vague, still estimate using the most common interpretation, and set confidence to "low".
- Name should be the recognisable item name, including the brand when given.

Always call the log_food tool with your estimate.`;

const TOOL = {
  name: "log_food",
  description: "Record the nutrition estimate for the food described or shown.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Recognisable food name, including brand if known" },
      kcal: { type: "number", description: "Total calories for the whole portion" },
      p: { type: "number", description: "Grams of protein for the whole portion" },
      c: { type: "number", description: "Grams of carbohydrate for the whole portion" },
      f: { type: "number", description: "Grams of fat for the whole portion" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: ["name", "kcal", "p", "c", "f", "confidence"],
  },
};

// Last-resort fallback: USDA Branded search, so packaged foods still resolve when
// the AI path is unavailable (no key, rate limited, upstream outage).
async function usdaFallback(description) {
  const key = process.env.NEXT_PUBLIC_USDA_KEY || process.env.USDA_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}` +
    `&query=${encodeURIComponent(description)}&pageSize=1&dataType=Branded,Foundation,SR%20Legacy`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const f = (data.foods || [])[0];
  if (!f) return null;
  const nut = (id) => f.foodNutrients?.find((n) => n.nutrientId === id)?.value || 0;
  // USDA values are per 100g; scale to the listed serving when there is one.
  const grams = +f.servingSize && /g|gram/i.test(f.servingSizeUnit || "") ? +f.servingSize : 100;
  const k = grams / 100;
  return {
    name: f.description || description,
    kcal: Math.round(nut(1008) * k),
    p: Math.round(nut(1003) * k),
    c: Math.round(nut(1005) * k),
    f: Math.round(nut(1004) * k),
    confidence: "low",
    source: "usda",
  };
}

function clean(o, source) {
  return {
    name: String(o.name || "Food"),
    kcal: Math.max(0, Math.round(+o.kcal || 0)),
    p: Math.max(0, Math.round(+o.p || 0)),
    c: Math.max(0, Math.round(+o.c || 0)),
    f: Math.max(0, Math.round(+o.f || 0)),
    confidence: o.confidence || "medium",
    source,
  };
}

export async function POST(req) {
  let description;
  try {
    const body = await req.json();
    const { image, mime, apiKey } = body;
    description = body.description;

    if (!image && !description) {
      return Response.json({ error: "Provide an image or description" }, { status: 400 });
    }

    // User's own key (from Settings, stored on their device) wins; server env var is the fallback.
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      if (description) {
        const fb = await usdaFallback(description);
        if (fb) return Response.json(fb);
      }
      return Response.json(
        { error: "No API key — add your Anthropic API key in Settings → AI food scan" },
        { status: 401 }
      );
    }

    const content = [];
    if (image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mime || "image/jpeg", data: image },
      });
    }
    content.push({
      type: "text",
      text: description
        ? `Estimate the nutrition for: ${description}`
        : "Estimate the nutrition for the food in this photo.",
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "log_food" },
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic error:", res.status, detail);
      if (description) {
        const fb = await usdaFallback(description);
        if (fb) return Response.json(fb);
      }
      const msg = res.status === 401 ? "API key rejected — check it in Settings"
        : res.status === 429 ? "Rate limited — try again in a moment"
        : "AI analysis failed";
      return Response.json({ error: msg }, { status: 502 });
    }

    const data = await res.json();
    const blocks = data.content || [];

    // Preferred path: the forced tool call gives structured, already-typed values.
    const tool = blocks.find((b) => b.type === "tool_use" && b.name === "log_food");
    if (tool?.input) return Response.json(clean(tool.input, "ai"));

    // Fallback: pull JSON out of any text blocks (older behaviour, plus code fences).
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const match = text.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
    if (match) {
      try { return Response.json(clean(JSON.parse(match[0]), "ai")); } catch {}
    }

    // Still nothing usable — try USDA before giving up.
    if (description) {
      const fb = await usdaFallback(description);
      if (fb) return Response.json(fb);
    }
    console.error("Unparseable response:", JSON.stringify(blocks).slice(0, 500));
    return Response.json(
      { error: "Couldn't estimate that — try naming the item and portion, e.g. \"In-N-Out Double Double\"" },
      { status: 502 }
    );
  } catch (e) {
    console.error(e);
    if (description) {
      try {
        const fb = await usdaFallback(description);
        if (fb) return Response.json(fb);
      } catch {}
    }
    return Response.json({ error: "Scan failed" }, { status: 500 });
  }
}