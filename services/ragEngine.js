const OpenAI = require('openai');
const { ChromaClient } = require('chromadb');
const pool = require('../db');
const { piiGuard } = require('./piiFilter');

// =============================================
// RAG Engine — Retrieval-Augmented Generation
// Uses Chroma as vector database
// Uses OpenAI for embeddings and generation
// =============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

// Chroma client and collections
var chroma = new ChromaClient({ path: CHROMA_URL });
var regulationsCollection = null;
var policiesCollection = null;

// =============================================
// Initialize Chroma Collections
// =============================================

async function initChroma() {
  try {
    regulationsCollection = await chroma.getOrCreateCollection({
      name: 'regulations',
      metadata: { description: 'MAS regulatory documents' }
    });

    policiesCollection = await chroma.getOrCreateCollection({
      name: 'policies',
      metadata: { description: 'GLDB internal policies' }
    });

    console.log('[RAG] Chroma collections initialized (regulations + policies)');
    return true;
  } catch (err) {
    console.error('[RAG] Chroma connection failed:', err.message);
    console.error('[RAG] Make sure Chroma is running: chroma run --path ./chroma_data --port 8000');
    return false;
  }
}

// =============================================
// 1. TEXT CHUNKING
// =============================================

function chunkText(text, maxChunkSize = 500) {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }

  var chunks = [];
  var sentences = text.split(/(?<=[.!?])\s+/);
  var currentChunk = '';

  for (var sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// =============================================
// 2. EMBEDDING GENERATION (OpenAI)
// =============================================

async function generateEmbedding(text) {
  try {
    var response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000)
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[RAG] Embedding generation failed:', err.message);
    return null;
  }
}

// =============================================
// 3. EMBED A REGULATION INTO CHROMA
// =============================================

async function embedRegulation(regId, title, content) {
  if (!regulationsCollection) return;

  console.log('[RAG] Embedding regulation:', title);

  // PII GUARD
  var piiCheck = await piiGuard(title + ' ' + content, 'Embedding regulation: ' + title);
  if (!piiCheck.allowed) {
    console.log('[RAG] Embedding blocked by PII filter:', piiCheck.reason);
    return;
  }

  var fullText = title + '. ' + content;
  var chunks = chunkText(fullText);

  var ids = [];
  var documents = [];
  var embeddings = [];
  var metadatas = [];

  for (var i = 0; i < chunks.length; i++) {
    var embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      ids.push('reg_' + regId + '_chunk_' + i);
      documents.push(chunks[i]);
      embeddings.push(embedding);
      metadatas.push({ source_id: regId, title: title, chunk_index: i, type: 'regulation' });
    }
  }

  if (ids.length > 0) {
    await regulationsCollection.upsert({
      ids: ids,
      documents: documents,
      embeddings: embeddings,
      metadatas: metadatas
    });
    console.log('[RAG] Stored', ids.length, 'chunks for regulation:', title);
  }
}

// =============================================
// 4. EMBED A POLICY INTO CHROMA
// =============================================

async function embedPolicy(policyId, policyName, description) {
  if (!policiesCollection) return;

  console.log('[RAG] Embedding policy:', policyName);

  // PII GUARD
  var piiCheck = await piiGuard(policyName + ' ' + description, 'Embedding policy: ' + policyName);
  if (!piiCheck.allowed) {
    console.log('[RAG] Embedding blocked by PII filter:', piiCheck.reason);
    return;
  }

  var fullText = policyName + '. ' + description;
  var chunks = chunkText(fullText);

  var ids = [];
  var documents = [];
  var embeddings = [];
  var metadatas = [];

  for (var i = 0; i < chunks.length; i++) {
    var embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      ids.push('pol_' + policyId + '_chunk_' + i);
      documents.push(chunks[i]);
      embeddings.push(embedding);
      metadatas.push({ source_id: policyId, policy_name: policyName, chunk_index: i, type: 'policy' });
    }
  }

  if (ids.length > 0) {
    await policiesCollection.upsert({
      ids: ids,
      documents: documents,
      embeddings: embeddings,
      metadatas: metadatas
    });
    console.log('[RAG] Stored', ids.length, 'chunks for policy:', policyName);
  }
}

// =============================================
// 5. RETRIEVE RELEVANT CHUNKS FROM CHROMA
// =============================================

async function retrieveRelevantChunks(query, sourceType, topK = 5) {
  var collection = sourceType === 'regulation' ? regulationsCollection : policiesCollection;
  if (!collection) return [];

  var queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  try {
    var results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK
    });

    if (!results || !results.documents || !results.documents[0]) return [];

    return results.documents[0].map(function (doc, i) {
      return {
        chunk_text: doc,
        metadata: results.metadatas[0][i],
        distance: results.distances ? results.distances[0][i] : null
      };
    });
  } catch (err) {
    console.error('[RAG] Chroma query failed:', err.message);
    return [];
  }
}

// =============================================
// 6. RAG-POWERED IMPACT ASSESSMENT
// =============================================

async function assessImpactRAG(item) {
  var startTime = Date.now();

  // PII GUARD
  var piiCheck = await piiGuard(item.title + ' ' + item.content, 'Impact Assessment: ' + item.title);
  if (!piiCheck.allowed) {
    console.log('[RAG] Impact assessment blocked by PII filter:', piiCheck.reason);
    return 'Medium';
  }

  // RETRIEVAL: Find relevant internal policies
  var relevantPolicies = await retrieveRelevantChunks(
    item.title + ' ' + item.content,
    'policy',
    3
  );

  var policyContext = '';
  if (relevantPolicies.length > 0) {
    policyContext = '\n\nRELEVANT GLDB INTERNAL POLICIES (for context):\n' +
      relevantPolicies.map(function (p, i) { return (i + 1) + '. ' + p.chunk_text; }).join('\n');
  }

  // AUGMENTED PROMPT
  var prompt = `You are a regulatory compliance analyst at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank serving MSMEs.

Analyze the following MAS regulation and assess its impact on GLDB's compliance operations.

REGULATION:
Title: ${item.title}
Category: ${item.category}
Content: ${item.content}
${policyContext}

Based on the regulation content and how it relates to GLDB's existing policies, assess the impact.

Respond with ONLY a JSON object (no markdown, no explanation):
{"impact_score": "Critical|High|Medium|Low", "reasoning": "one sentence explanation", "affected_areas": ["list of affected compliance areas"]}

Impact scoring criteria:
- Critical: Requires immediate action, involves penalties, enforcement actions, or mandatory changes with strict deadlines
- High: Significant compliance risk, involves AML/CFT requirements, sanctions, or major regulatory changes affecting GLDB operations
- Medium: Requires review and potential updates to existing procedures or guidelines
- Low: Informational, minor updates, or general guidance with no immediate action required`;

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    var content = response.choices[0].message.content.trim();
    var duration = Date.now() - startTime;

    var parsed = JSON.parse(content);
    var impactScore = parsed.impact_score;

    var validScores = ['Critical', 'High', 'Medium', 'Low'];
    if (!validScores.includes(impactScore)) {
      impactScore = 'Medium';
    }

    await logLLMCall('IMPACT_ASSESSMENT', prompt, content, item.title, impactScore, duration, relevantPolicies.length);

    console.log('[RAG] Impact assessed:', impactScore, '—', parsed.reasoning || '');
    console.log('[RAG] Retrieved', relevantPolicies.length, 'policy chunks from Chroma');
    return impactScore;

  } catch (err) {
    var duration = Date.now() - startTime;
    console.error('[RAG] Impact assessment failed:', err.message);
    await logLLMCall('IMPACT_ASSESSMENT_ERROR', prompt, 'Error: ' + err.message, item.title, 'Error', duration, 0);
    return 'Medium';
  }
}

// =============================================
// 7. RAG-POWERED GAP ANALYSIS
// =============================================

async function analyzeGapRAG(regId, policyId) {
  var startTime = Date.now();

  var [regs] = await pool.query('SELECT title, content FROM regulations WHERE reg_id = ?', [regId]);
  var [policies] = await pool.query('SELECT policy_name, description FROM internal_policies WHERE policy_id = ?', [policyId]);

  if (regs.length === 0 || policies.length === 0) {
    return { has_gaps: false, gaps: [], summary: 'Regulation or policy not found' };
  }

  var regulation = regs[0];
  var policy = policies[0];

  // PII GUARD
  var regPiiCheck = await piiGuard(regulation.content, 'Gap Analysis (regulation): ' + regulation.title);
  if (!regPiiCheck.allowed) {
    return { has_gaps: false, gaps: [], summary: 'Blocked: PII detected in regulation content. ' + regPiiCheck.reason };
  }

  var polPiiCheck = await piiGuard(policy.description, 'Gap Analysis (policy): ' + policy.policy_name);
  if (!polPiiCheck.allowed) {
    return { has_gaps: false, gaps: [], summary: 'Blocked: PII detected in policy content. ' + polPiiCheck.reason };
  }

  // RETRIEVAL from Chroma
  var relevantRegChunks = await retrieveRelevantChunks(
    policy.policy_name + ' ' + policy.description,
    'regulation',
    3
  );

  var relevantPolicyChunks = await retrieveRelevantChunks(
    regulation.title + ' ' + regulation.content,
    'policy',
    3
  );

  var additionalRegContext = '';
  if (relevantRegChunks.length > 0) {
    additionalRegContext = '\n\nADDITIONAL RELATED REGULATIONS:\n' +
      relevantRegChunks.map(function (r, i) { return (i + 1) + '. ' + r.chunk_text; }).join('\n');
  }

  var additionalPolicyContext = '';
  if (relevantPolicyChunks.length > 0) {
    additionalPolicyContext = '\n\nADDITIONAL RELATED POLICIES:\n' +
      relevantPolicyChunks.map(function (p, i) { return (i + 1) + '. ' + p.chunk_text; }).join('\n');
  }

  // AUGMENTED PROMPT
  var prompt = `You are a regulatory compliance analyst at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank.

Compare the following MAS regulation against GLDB's internal policy and identify compliance gaps.

REGULATION:
Title: ${regulation.title}
Content: ${regulation.content}
${additionalRegContext}

INTERNAL POLICY:
Name: ${policy.policy_name}
Content: ${policy.description}
${additionalPolicyContext}

Identify specific areas where the internal policy does NOT adequately address requirements in the regulation.

Respond with ONLY a JSON object (no markdown, no explanation):
{"has_gaps": true|false, "gaps": [{"description": "specific gap description", "severity": "Critical|High|Medium|Low", "recommendation": "what GLDB should do to close this gap"}], "summary": "one sentence overall assessment", "compliance_score": 0-100}`;

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800
    });

    var content = response.choices[0].message.content.trim();
    var duration = Date.now() - startTime;

    var parsed = JSON.parse(content);

    await logLLMCall(
      'GAP_ANALYSIS',
      prompt,
      content,
      regulation.title + ' vs ' + policy.policy_name,
      parsed.has_gaps ? 'Gaps Found (' + (parsed.gaps ? parsed.gaps.length : 0) + ')' : 'No Gaps',
      duration,
      relevantRegChunks.length + relevantPolicyChunks.length
    );

    console.log('[RAG] Gap analysis complete:', parsed.has_gaps ? (parsed.gaps ? parsed.gaps.length : 0) + ' gaps found' : 'No gaps');
    console.log('[RAG] Retrieved', relevantRegChunks.length + relevantPolicyChunks.length, 'chunks from Chroma');
    return parsed;

  } catch (err) {
    var duration = Date.now() - startTime;
    console.error('[RAG] Gap analysis failed:', err.message);
    await logLLMCall('GAP_ANALYSIS_ERROR', prompt, 'Error: ' + err.message, regulation.title + ' vs ' + policy.policy_name, 'Error', duration, 0);
    return { has_gaps: false, gaps: [], summary: 'LLM analysis unavailable: ' + err.message, compliance_score: 0 };
  }
}

// =============================================
// 8. LLM AUDIT LOGGING
// =============================================

async function logLLMCall(actionType, inputPrompt, outputResponse, targetDescription, result, durationMs, chunksRetrieved) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action_type, target_table, target_id, description) VALUES (?, ?, ?, ?, ?)',
      [
        1,
        'LLM_' + actionType,
        'regulations',
        0,
        JSON.stringify({
          model: OPENAI_MODEL,
          embedding_model: EMBEDDING_MODEL,
          vector_db: 'Chroma',
          input: inputPrompt.substring(0, 1500),
          output: outputResponse.substring(0, 1500),
          target: targetDescription,
          result: result,
          chunks_retrieved: chunksRetrieved,
          duration_ms: durationMs,
          timestamp: new Date().toISOString()
        })
      ]
    );
  } catch (err) {
    console.error('[RAG Audit] Failed to log:', err.message);
  }
}

// =============================================
// 9. EMBED ALL EXISTING DATA (initialization)
// =============================================

async function embedAllExistingData() {
  var chromaReady = await initChroma();
  if (!chromaReady) {
    console.error('[RAG] Cannot embed data — Chroma is not running');
    return;
  }

  console.log('[RAG] Embedding all existing regulations and policies into Chroma...');

  var [regulations] = await pool.query('SELECT reg_id, title, content FROM regulations');
  console.log('[RAG] Found', regulations.length, 'regulations to embed');
  for (var reg of regulations) {
    await embedRegulation(reg.reg_id, reg.title, reg.content);
  }

  var [policies] = await pool.query('SELECT policy_id, policy_name, description FROM internal_policies');
  console.log('[RAG] Found', policies.length, 'policies to embed');
  for (var pol of policies) {
    await embedPolicy(pol.policy_id, pol.policy_name, pol.description);
  }

  console.log('[RAG] Embedding complete. Chroma vector store ready.');
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
  initChroma,
  chunkText,
  generateEmbedding,
  embedRegulation,
  embedPolicy,
  retrieveRelevantChunks,
  assessImpactRAG,
  analyzeGapRAG,
  embedAllExistingData
};
