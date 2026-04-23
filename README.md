# Student-Aid-Semantic-Search

## Local AI setup

To run the chatbot with Ollama and llama3.1:

1. Install and start Ollama in a separate terminal:

   ```bash
   ollama serve
   ```

2. Pull the model once if it is not already available:

   ```bash
   ollama pull llama3.1
   ```

3. Copy [backend/.env.example](backend/.env.example) to [backend/.env](backend/.env) and fill in your own values.

4. Start the backend from [backend](backend):

   ```bash
   npm start
   ```

5. Start the frontend from [frontend](frontend):

   ```bash
   npm start
   ```

The chatbot health endpoint is available at `/api/chat/health` and will report whether Ollama is reachable and whether llama3.1 is loaded.
