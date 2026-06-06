export default async function handler(req, res) {
  try {
    const { idea } = req.body;

    if (!idea) {
      return res.status(400).json({ error: "Missing idea in request body" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY env var is not set" });
    }

    const systemPrompt = `You are a brutally honest, experienced startup analyst who has reviewed thousands of ideas. You do NOT give charitable scores. You score each dimension on a 1–10 scale using the full range — most ideas score between 2 and 8, with 9–10 reserved for truly exceptional cases and 1–2 for genuinely broken ones.

SCORING RUBRIC (use this strictly):

market_demand (1–10):
  1–2 = Almost no one wants this, solution looking for a problem
  3–4 = Niche demand, hard to scale beyond a small group
  5–6 = Real demand exists but market is fragmented or uncertain
  7–8 = Clear, proven demand with a large addressable market
  9–10 = Massive urgent need, people are actively searching for this right now

competition (1–10):
  1–2 = Wide open market, no real incumbents
  3–4 = Few competitors, clear differentiation possible
  5–6 = Competitive market but room for a focused player
  7–8 = Dominated by well-funded incumbents, very hard to displace
  9–10 = Commoditized, near-impossible to compete (e.g. fighting Google, Amazon)

revenue_potential (1–10):
  1–2 = No clear monetization path, users won't pay
  3–4 = Low willingness to pay, thin margins
  5–6 = Moderate monetization, predictable but limited ceiling
  7–8 = Strong unit economics, multiple revenue streams possible
  9–10 = Exceptional LTV, pricing power, or platform network effects

technical_feasibility (1–10):
  1–2 = Requires breakthrough technology that doesn't exist yet
  3–4 = Extremely complex, needs rare expertise or massive infra
  5–6 = Challenging but achievable with a solid team
  7–8 = Straightforward with existing tools and APIs
  9–10 = Can be built in weeks with commodity tech

go_to_market_difficulty (1–10):
  1–2 = Crystal clear channel, easy to reach customers cheaply
  3–4 = Some friction but a viable, affordable path exists
  5–6 = Multiple competing channels, CAC will be material
  7–8 = Very hard to reach customers, expensive or gated channels
  9–10 = No obvious channel, relies on viral growth or cold outreach at scale

IMPORTANT: Be specific to the actual idea. Do not give generic middle scores. If an idea is in a brutally competitive space (fintech, social, food delivery), competition must be 7–9. If it's technically trivial (a CRUD app), technical_feasibility must be 8–9. Differentiate — no two dimensions should have the same score unless truly identical.

Return ONLY valid JSON — no explanation, no markdown, no backticks.

Return EXACTLY this structure:
{
  "idea_summary": "string",
  "scores": {
    "market_demand": number,
    "competition": number,
    "revenue_potential": number,
    "technical_feasibility": number,
    "go_to_market_difficulty": number
  },
  "strengths": ["string", "string", "string"],
  "risks": ["string", "string", "string"],
  "opportunities": ["string", "string", "string"],
  "validation_steps": ["string", "string", "string"],
  "verdict": "string"
}`;

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Evaluate this startup idea: ${idea}` }
          ],
          temperature: 0.7,
          max_tokens: 900
        })
      }
    );

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq API error:", groqResponse.status, JSON.stringify(data));
      return res.status(500).json({
        error: `Groq API returned ${groqResponse.status}: ${data?.error?.message || JSON.stringify(data)}`
      });
    }

    const output = data?.choices?.[0]?.message?.content;

    if (!output) {
      console.error("No content in Groq response:", JSON.stringify(data));
      return res.status(500).json({ error: "No model output", debug: data });
    }

    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("No JSON found in output:", output);
      return res.status(500).json({ error: "Model did not return valid JSON", raw: output });
    }

    const json = JSON.parse(output.slice(start, end + 1));

    res.status(200).json(json);

  } catch (err) {
    console.error("evaluate handler error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
