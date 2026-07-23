// AI food analysis — Claude vision. ANTHROPIC_API_KEY stays server-side only.
export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM = `You are a nutrition analysis engine. Given a photo of food or a text description of a meal, estimate its nutrition. Respond with ONLY a JSON object, no other text:
{"name": "short food name", "kcal": number, "p": number, "c": number, "f": number, "confidence": "high"|"medium"|"low"}
kcal is total calories; p/c/f are grams of protein, carbs, fat for the whole portion shown/described. Be realistic about portion sizes.`;

export async function POST(req) {
  try {
    const { image, mime, description, apiKey } = await req.json();
    if (!image && !description) {
      return Response.json({ error: "Provide an image or description" }, { status: 400 });
    }
    // User's own key (from Settings, stored on their device) wins; server env var is the fallback.
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
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
        ? `Analyze this meal: ${description}`
        : "Analyze the food in this photo.",
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
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      return Response.json({ error: "AI analysis failed" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Could not parse analysis" }, { status: 502 });
    const parsed = JSON.parse(match[0]);
    return Response.json({
      name: String(parsed.name || "Food"),
      kcal: Math.max(0, Math.round(+parsed.kcal || 0)),
      p: Math.max(0, Math.round(+parsed.p || 0)),
      c: Math.max(0, Math.round(+parsed.c || 0)),
      f: Math.max(0, Math.round(+parsed.f || 0)),
      confidence: parsed.confidence || "medium",
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Scan failed" }, { status: 500 });
  }
}
