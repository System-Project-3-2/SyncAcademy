

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

/**
 
 * @param {string} prompt 
 * @param {object} [options]
 * @returns {string} 
 */
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 180_000);

const normalizeModelName = (name = "") => name.toLowerCase().trim();

const modelMatches = (availableModel, requestedModel) => {
  const available = normalizeModelName(availableModel);
  const requested = normalizeModelName(requestedModel);
  if (!available || !requested) return false;
  if (available === requested) return true;
  return available.startsWith(`${requested}:`);
};

const fetchAvailableModels = async () => {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.models || []).map((m) => m.name).filter(Boolean);
};

const resolveModelName = async (requestedModel) => {
  const available = await fetchAvailableModels();
  const requested = requestedModel || OLLAMA_MODEL;
  const matched = available.find((name) => modelMatches(name, requested));
  return {
    model: matched || requested,
    available,
  };
};

export const generateResponse = async (prompt, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const { model } = await resolveModelName(options.model || OLLAMA_MODEL);
    let response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.1,   
          top_p: options.top_p ?? 0.9,
          num_predict: options.max_tokens ?? 384,
          num_ctx: 2048,
          repeat_penalty: 1.3,                      
          stop: ["\n\nQuestion:", "\n\nStudent:"],     
        },
      }),
    });

    if (response.status === 404 || response.status === 400) {
      const { available } = await resolveModelName(options.model || OLLAMA_MODEL);
      if (available.length > 0) {
        response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: available[0],
            prompt,
            stream: false,
            options: {
              temperature: options.temperature ?? 0.1,
              top_p: options.top_p ?? 0.9,
              num_predict: options.max_tokens ?? 384,
              num_ctx: 2048,
              repeat_penalty: 1.3,
              stop: ["\n\nQuestion:", "\n\nStudent:"],
            },
          }),
        });
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Ollama request timed out after 2 minutes. Try a shorter question.");
    }
    console.error("Ollama generateResponse error:", error.message);
    throw error;
  } finally {
    clearTimeout(timer);
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
 *
 * @param {string} systemPrompt  - The system instruction (role + task description)
 * @param {string} userPrompt    - The user message (the actual content to evaluate)
 * @param {object} [options]     - Optional generation parameters
 * @returns {string}               Raw JSON string from the model
 */
export const generateChatJSON = async (systemPrompt, userPrompt, options = {}) => {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || OLLAMA_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { model } = await resolveModelName(options.model || OLLAMA_MODEL);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        format: "json",   // ← enforces JSON-only output at the Ollama level
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
        options: {
          temperature:    options.temperature    ?? 0.0,
          top_p:          options.top_p          ?? 0.9,
          num_predict:    options.max_tokens     ?? 200,
          num_ctx:        options.num_ctx        ?? 2048,
          repeat_penalty: 1.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama chat error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    // /api/chat returns { message: { role, content }, ... }
    return data.message?.content ?? "";
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Ollama eval request timed out.");
    }
    console.error("generateChatJSON error:", error.message);
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
    const modelLoaded = models.some((n) => modelMatches(n, OLLAMA_MODEL));

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
