async function review({ prompt, model, maxWords }) {
  return complete({ prompt, model, maxWords });
}

async function decide({ prompt, model, maxWords }) {
  return complete({ prompt, model, maxWords });
}

async function complete({ prompt, model, maxWords }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for --backend openai.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: Math.max(256, Math.ceil((maxWords || 800) * 1.5)),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const text = extractText(data);
  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return text.trim();
}

function extractText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

module.exports = {
  review,
  decide,
};
