export default async function handler(req, res) {
  try {
    const { idea } = req.body;

    const systemPrompt = `
You are a strict startup idea evaluator.
Return ONLY valid JSON.

Schema:
{
  "idea_summary": string,
  "scores": {
    "market_demand": number,
    "competition": number,
    "revenue_potential": number,
    "technical_feasibility": number,
    "go_to_market_difficulty": number
  },
  "strengths": string[],
  "risks": string[],
  "opportunities": string[],
  "validation_steps": string[],
  "verdict": string
}
`;

    const response = await fetch(
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
            { role: "user", content: idea }
          ],
          temperature: 0.2,
          max_tokens: 900
        })
      }
    );

    const data = await response.json();

    const output = data?.choices?.[0]?.message?.content;

    if (!output) {
      return res.status(500).json({ error: "No model output" });
    }

    // extract JSON safely
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");

    const json = JSON.parse(output.slice(start, end + 1));

    res.status(200).json(json);

  } catch (err) {
    res.status(500).json({
      error: err.message || "Server error"
    });
  }
}
