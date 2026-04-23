/**
 * Quick RAG Test Script
 * Run: node test-rag.js
 * 
 * Tests the full Ollama + RAG pipeline without needing a logged-in user.
 */
import 'dotenv/config';
import { checkOllamaHealth, generateResponse } from './services/ollamaService.js';
import { embedText } from './services/embeddingServices.js';

const DIVIDER = '─'.repeat(50);

async function testOllamaHealth() {
  console.log('\n' + DIVIDER);
  console.log('TEST 1: Ollama Health Check');
  console.log(DIVIDER);
  
  const health = await checkOllamaHealth();
  console.log(JSON.stringify(health, null, 2));
  
  if (!health.healthy) {
    console.error('❌ Ollama is NOT reachable. Make sure "ollama serve" is running.');
    process.exit(1);
  }
  
  if (!health.modelLoaded) {
    console.error(`❌ Model "${health.model}" is not loaded. Run: ollama pull ${health.model}`);
    process.exit(1);
  }
  
  console.log('✅ Ollama is healthy and model is loaded!');
  return true;
}

async function testOllamaGenerate() {
  console.log('\n' + DIVIDER);
  console.log('TEST 2: Ollama Text Generation');
  console.log(DIVIDER);
  
  const prompt = 'Answer in one sentence: What is machine learning?';
  console.log(`Prompt: "${prompt}"`);
  console.log('Generating...');
  
  const start = Date.now();
  const response = await generateResponse(prompt, { max_tokens: 100 });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`Response (${elapsed}s): ${response}`);
  console.log('✅ Ollama generation works!');
  return true;
}

async function testEmbedding() {
  console.log('\n' + DIVIDER);
  console.log('TEST 3: HuggingFace Embedding');
  console.log(DIVIDER);
  
  const text = 'What is machine learning?';
  console.log(`Text: "${text}"`);
  console.log('Embedding...');
  
  const embedding = await embedText(text);
  console.log(`Embedding dimension: ${embedding.length}`);
  console.log(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
  console.log('✅ Embedding works!');
  return true;
}

async function testRAGPrompt() {
  console.log('\n' + DIVIDER);
  console.log('TEST 4: Full RAG-style Prompt (no DB, simulated context)');
  console.log(DIVIDER);
  
  const simulatedPrompt = `You are Student Aid Tutor, an AI assistant for students.

=== RELEVANT CONTEXT FROM COURSE MATERIALS ===

[Source 1: Introduction to AI (CSE 4001)]:
Machine learning is a subset of artificial intelligence that enables systems to learn from data.
Supervised learning uses labeled data, while unsupervised learning finds patterns in unlabeled data.

=== END OF CONTEXT ===

Student's Question: What is the difference between supervised and unsupervised learning?

Tutor's Answer:`;

  console.log('Sending RAG-style prompt to Ollama...');
  
  const start = Date.now();
  const response = await generateResponse(simulatedPrompt, { max_tokens: 200 });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  
  console.log(`\nResponse (${elapsed}s):\n${response}`);
  console.log('\n✅ RAG-style generation works!');
  return true;
}

// ── Run all tests ──
async function main() {
  console.log('🔧 Student-Aid RAG System Test');
  console.log(`   Model: ${process.env.OLLAMA_MODEL || 'llama3.1'}`);
  console.log(`   Ollama URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
  console.log(`   Embedding: ${process.env.EMBEDDING_PROVIDER || 'huggingface'}`);
  
  try {
    await testOllamaHealth();
    await testOllamaGenerate();
    await testEmbedding();
    await testRAGPrompt();
    
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 ALL TESTS PASSED! Your RAG system is ready.');
    console.log('═'.repeat(50));
    console.log('\nNext steps:');
    console.log('1. Start the backend:  npm start');
    console.log('2. Start the frontend: cd ../frontend && npm run dev');
    console.log('3. Upload materials as a teacher');
    console.log('4. Chat with the AI as a student — it will use your uploaded materials!');
    console.log('');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

main();
