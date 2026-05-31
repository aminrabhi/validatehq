export default async function handler(req, res) {
  try {
    const { idea } = req.body;

    if (!idea) {
      return res.status(400).json({ error: "Missing idea in request body" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY env var is not set" });
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
          temperature: 0.2,
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
