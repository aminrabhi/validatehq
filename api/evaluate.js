export default async function handler(req, res) {
  try {
    const { idea } = req.body;

    if (!idea) {
      return res.status(400).json({ error: "Missing idea in request body" });
    }

    if (!process.env.HF_API_TOKEN) {
      return res.status(500).json({ error: "HF_API_TOKEN env var is not set" });
    }

    if (!process.env.HF_MODEL) {
      return res.status(500).json({ error: "HF_MODEL env var is not set" });
    }

    const systemPrompt = `You are a strict startup idea evaluator.
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

    const hfResponse = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.HF_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Evaluate this startup idea: ${idea}` }
          ],
          temperature: 0.2,
          max_tokens: 900
        })
      }
    );

    const data = await hfResponse.json();

    // Surface HF errors clearly instead of swallowing them
    if (!hfResponse.ok) {
      console.error("HF API error:", hfResponse.status, JSON.stringify(data));
      return res.status(500).json({
        error: `HF API returned ${hfResponse.status}: ${data?.error?.message || data?.error || JSON.stringify(data)}`
      });
    }

    const output = data?.choices?.[0]?.message?.content;

    if (!output) {
      console.error("No content in HF response:", JSON.stringify(data));
      return res.status(500).json({
        error: "No model output",
        debug: data  // sends full HF response to client so you can see it
      });
    }

    // Extract JSON safely — handles any text before/after the object
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
    res.status(500).json({
      error: err.message || "Server error"
    });
  }
}
