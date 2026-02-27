/**
 * Ollama LLM Service
 * Connects to a local Ollama instance for RAG-powered chat responses.
 *
 * Supported models (install any with `ollama pull <model>`):
 *   - mistral       (7B, best quality/speed balance)
 *   - llama3.2      (latest Meta model)
 *   - phi3          (small & fast, by Microsoft)
 *
 * Environment variables:
 *   OLLAMA_BASE_URL  – default http://localhost:11434
 *   OLLAMA_MODEL     – default mistral
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

/**
 * Generate a chat completion from Ollama.
 * @param {string} prompt - The full prompt (system + context + user question)
 * @param {object} [options] - Optional generation parameters
 * @returns {string} The model's response text
 */
export const generateResponse = async (prompt, options = {}) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model || OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          top_p: options.top_p ?? 0.9,
          num_predict: options.max_tokens ?? 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Ollama generateResponse error:", error.message);
    throw error;
  }
};

/**
 * Stream a chat completion from Ollama (returns a ReadableStream).
 * Use this for real-time token-by-token delivery to the frontend.
 * @param {string} prompt
 * @param {object} [options]
 * @returns {ReadableStream}
 */
export const generateResponseStream = async (prompt, options = {}) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model || OLLAMA_MODEL,
      prompt,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        num_predict: options.max_tokens ?? 1024,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama stream error (${response.status}): ${errText}`);
  }

  return response.body;
};

/**
 * Quick health-check: is Ollama reachable and is the model loaded?
 */
export const checkOllamaHealth = async () => {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return { healthy: false, error: "Ollama not reachable" };

    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    const modelLoaded = models.some((n) => n.startsWith(OLLAMA_MODEL));

    return {
      healthy: true,
      model: OLLAMA_MODEL,
      modelLoaded,
      availableModels: models,
    };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
};
