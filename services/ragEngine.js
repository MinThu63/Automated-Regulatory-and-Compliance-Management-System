const OpenAI = require('openai');
const pool = require('../db');
const { piiGuard } = require('./piiFilter');

// =============================================
// RAG Engine — Retrieval-Augmented Generation
// Handles embeddings, vector search, and LLM generation
// =============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EMBEDDING_MODEL = 'text-embedding-3-small';

// =============================================
// 1. TEXT CHUNKING
// Breaks large documents into smaller chunks
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
// 2. EMBEDDING GENERATION
// Converts text into numerical vectors using OpenAI
// =============================================

async function generateEmbedding(text) {
  try {
    var response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000) // Token limit safety
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[RAG] Embedding generation failed:', err.message);
    return null;
  }
}

// =============================================
// 3. VECTOR STORAGE (MySQL-based for POC)
// Stores embeddings in a dedicated table
// =============================================

async function storeEmbedding(sourceType, sourceId, chunkIndex, chunkText, embedding) {
  try {
    var embeddingJson = JSON.stringify(embedding);
    await pool.query(
      `INSERT INTO embeddings (source_type, source_id, chunk_index, chunk_text, embedding)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE chunk_text = VALUES(chunk_text), embedding = VALUES(embedding)`,
      [sourceType, sourceId, chunkIndex, chunkText, embeddingJson]
    );
  } catch (err) {
    console.error('[RAG] Store embedding failed:', err.message);
  }
}

// =============================================
// 4. EMBED A REGULATION (called when new regulation is stored)
// =============================================

async function embedRegulation(regId, title, content) {
  console.log('[RAG] Embedding regulation:', title);

  // PII GUARD — Block if personal data detected before sending to OpenAI
  var { piiGuard } = require('./piiFilter');
  var piiCheck = await piiGuard(title + ' ' + content, 'Embedding regulation: ' + title);
  if (!piiCheck.allowed) {
    console.log('[RAG] Embedding blocked by PII filter:', piiCheck.reason);
    return;
  }

  var fullText = title + '. ' + content;
  var chunks = chunkText(fullText);

  for (var i = 0; i < chunks.length; i++) {
    var embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      await storeEmbedding('regulation', regId, i, chunks[i], embedding);
    }
  }
  console.log('[RAG] Stored', chunks.length, 'chunks for regulation:', title);
}

// =============================================
// 5. EMBED A POLICY (called when policy is stored/updated)
// =============================================

async function embedPolicy(policyId, policyName, description) {
  console.log('[RAG] Embedding policy:', policyName);

  // PII GUARD — Block if personal data detected before sending to OpenAI
  var { piiGuard } = require('./piiFilter');
  var piiCheck = await piiGuard(policyName + ' ' + description, 'Embedding policy: ' + policyName);
  if (!piiCheck.allowed) {
    console.log('[RAG] Embedding blocked by PII filter:', piiCheck.reason);
    return;
  }

  var fullText = policyName + '. ' + description;
  var chunks = chunkText(fullText);

  for (var i = 0; i < chunks.length; i++) {
    var embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      await storeEmbedding('policy', policyId, i, chunks[i], embedding);
    }
  }
  console.log('[RAG] Stored', chunks.length, 'chunks for policy:', policyName);
}

// =============================================
// 6. VECTOR SIMILARITY SEARCH (Cosine Similarity)
// Finds the most relevant chunks for a query
// =============================================

function cosineSimilarity(vecA, vecB) {
  var dotProduct = 0;
  var normA = 0;
  var normB = 0;
  for (var i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function retrieveRelevantChunks(query, sourceType, topK = 5) {
  // Generate embedding for the query
  var queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  // Fetch all embeddings of the specified type
  var [rows] = await pool.query(
    'SELECT source_id, chunk_index, chunk_text, embedding FROM embeddings WHERE source_type = ?',
    [sourceType]
  );

  if (rows.length === 0) return [];

  // Calculate similarity scores
  var scored = rows.map(function (row) {
    var storedEmbedding = JSON.parse(row.embedding);
    var similarity = cosineSimilarity(queryEmbedding, storedEmbedding);
    return {
      source_id: row.source_id,
      chunk_text: row.chunk_text,
      similarity: similarity
    };
  });

  // Sort by similarity (highest first) and return top K
  scored.sort(function (a, b) { return b.similarity - a.similarity; });
  return scored.slice(0, topK);
}

// =============================================
// 7. RAG-POWERED IMPACT ASSESSMENT
// Retrieves relevant policies, then asks LLM to assess impact
// =============================================

async function assessImpactRAG(item) {
  var startTime = Date.now();

  // PII GUARD — Block content if personal data detected
  var piiCheck = await piiGuard(item.title + ' ' + item.content, 'Impact Assessment: ' + item.title);
  if (!piiCheck.allowed) {
    console.log('[RAG] Impact assessment blocked by PII filter:', piiCheck.reason);
    return 'Medium'; // Safe default when blocked
  }

  // RETRIEVAL: Find relevant internal policies for context
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
    // GENERATION
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

    // Log LLM interaction
    await logLLMCall('IMPACT_ASSESSMENT', prompt, content, item.title, impactScore, duration, relevantPolicies.length);

    console.log('[RAG] Impact assessed:', impactScore, '—', parsed.reasoning || '');
    console.log('[RAG] Retrieved', relevantPolicies.length, 'policy chunks for context');
    return impactScore;

  } catch (err) {
    var duration = Date.now() - startTime;
    console.error('[RAG] Impact assessment failed:', err.message);
    await logLLMCall('IMPACT_ASSESSMENT_ERROR', prompt, 'Error: ' + err.message, item.title, 'Error', duration, 0);
    return 'Medium';
  }
}

// =============================================
// 8. RAG-POWERED GAP ANALYSIS
// Retrieves relevant regulation chunks + policy chunks, then compares
// =============================================

async function analyzeGapRAG(regId, policyId) {
  var startTime = Date.now();

  // Fetch full regulation and policy from DB
  var [regs] = await pool.query('SELECT title, content FROM regulations WHERE reg_id = ?', [regId]);
  var [policies] = await pool.query('SELECT policy_name, description FROM internal_policies WHERE policy_id = ?', [policyId]);

  if (regs.length === 0 || policies.length === 0) {
    return { has_gaps: false, gaps: [], summary: 'Regulation or policy not found' };
  }

  var regulation = regs[0];
  var policy = policies[0];

  // PII GUARD — Block content if personal data detected in regulation
  var regPiiCheck = await piiGuard(regulation.content, 'Gap Analysis (regulation): ' + regulation.title);
  if (!regPiiCheck.allowed) {
    return { has_gaps: false, gaps: [], summary: 'Blocked: PII detected in regulation content. ' + regPiiCheck.reason };
  }

  // PII GUARD — Block content if personal data detected in policy
  var polPiiCheck = await piiGuard(policy.description, 'Gap Analysis (policy): ' + policy.policy_name);
  if (!polPiiCheck.allowed) {
    return { has_gaps: false, gaps: [], summary: 'Blocked: PII detected in policy content. ' + polPiiCheck.reason };
  }

  // RETRIEVAL: Get relevant regulation chunks for deeper context
  var relevantRegChunks = await retrieveRelevantChunks(
    policy.policy_name + ' ' + policy.description,
    'regulation',
    3
  );

  // RETRIEVAL: Get relevant policy chunks for deeper context
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
    // GENERATION
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800
    });

    var content = response.choices[0].message.content.trim();
    var duration = Date.now() - startTime;

    var parsed = JSON.parse(content);

    // Log LLM interaction
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
    console.log('[RAG] Retrieved', relevantRegChunks.length + relevantPolicyChunks.length, 'chunks for context');
    return parsed;

  } catch (err) {
    var duration = Date.now() - startTime;
    console.error('[RAG] Gap analysis failed:', err.message);
    await logLLMCall('GAP_ANALYSIS_ERROR', prompt, 'Error: ' + err.message, regulation.title + ' vs ' + policy.policy_name, 'Error', duration, 0);
    return { has_gaps: false, gaps: [], summary: 'LLM analysis unavailable: ' + err.message, compliance_score: 0 };
  }
}

// =============================================
// 9. LLM AUDIT LOGGING
// Records every LLM call for traceability (Patrick's requirement)
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
// 10. EMBED ALL EXISTING DATA (one-time initialization)
// Call this to build the vector store from existing DB records
// =============================================

async function embedAllExistingData() {
  console.log('[RAG] Embedding all existing regulations and policies...');

  // Embed all regulations
  var [regulations] = await pool.query('SELECT reg_id, title, content FROM regulations');
  console.log('[RAG] Found', regulations.length, 'regulations to embed');
  for (var reg of regulations) {
    await embedRegulation(reg.reg_id, reg.title, reg.content);
  }

  // Embed all policies
  var [policies] = await pool.query('SELECT policy_id, policy_name, description FROM internal_policies');
  console.log('[RAG] Found', policies.length, 'policies to embed');
  for (var pol of policies) {
    await embedPolicy(pol.policy_id, pol.policy_name, pol.description);
  }

  console.log('[RAG] Embedding complete. Vector store ready.');
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
  chunkText,
  generateEmbedding,
  embedRegulation,
  embedPolicy,
  retrieveRelevantChunks,
  assessImpactRAG,
  analyzeGapRAG,
  embedAllExistingData
};
