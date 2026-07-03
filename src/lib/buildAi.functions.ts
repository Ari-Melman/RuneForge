import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const rateMyBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { build: unknown }) => data)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an Elden Ring build coach. Given a JSON build, rate it out of 10, explain strengths/weaknesses in 4-6 short bullet lines, and suggest 1-2 concrete improvements. Be concise. No markdown headers." },
          { role: "user", content: JSON.stringify(data.build) },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable Cloud.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const j = await res.json();
    return { text: j.choices?.[0]?.message?.content ?? "No response." };
  });
