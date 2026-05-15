# Post-Meeting Implementation — Patrick's Feedback

## Automated Regulatory Monitoring and Compliance Management System
### Team ID: SOI-2026-0039

---

## Summary

Following the meeting with Patrick (GLDB Industry Partner), the following changes were implemented to align the system with his feedback and the agreed phased approach.

---

## 1. Focus on MAS Only (Phase 1 POC)

**Patrick's Feedback:** Start with MAS regulations only. Validate against MAS Notice 626 and related notices using GLDB's internal Policy & Procedure Manuals (PMPs).

**What Was Done:**

- Removed all 6 non-MAS scrapers (FATF, FinCEN, ECB, FCA, BIS, HKMA) from `services/feedIntegrator.js`
- Retained only `scrapeMAS()` and `fetchMASAPI()` as data sources
- Updated `.env` to comment out all non-MAS source URLs
- Updated `schema.sql` seed data to include only MAS as the regulatory source
- Enhanced MAS fallback data with Notice 626, Notice 1014, Notice 637, Notice 644, and other key MAS notices

**Before vs After:**

```
BEFORE: 7 sources scraped in parallel (MAS, FATF, FinCEN, ECB, FCA, BIS, HKMA)
         → 80+ regulations per run
         → Broad but unfocused

AFTER:  1 source only (MAS web scraping + MAS Official API)
         → ~30 MAS regulations per run
         → Focused on Notice 626 and related AML/CFT notices
         → Ready for PMP validation
```

**Architecture (Phase 1 — MAS Only):**

```
┌─────────────────────────────────────────────────┐
│           EXTERNAL DATA SOURCES                  │
│                                                 │
│   ┌─────────────────────┐  ┌────────────────┐  │
│   │ MAS Website         │  │ MAS Official   │  │
│   │ (Web Scraping)      │  │ API (REST)     │  │
│   │                     │  │                │  │
│   │ • Notice 626        │  │ • Exchange     │  │
│   │ • Notice 1014       │  │   Rates        │  │
│   │ • TRM Guidelines    │  │ • Interest     │  │
│   │ • ESG Guidelines    │  │   Rates        │  │
│   └────────┬────────────┘  └───────┬────────┘  │
│            │                       │            │
└────────────┼───────────────────────┼────────────┘
             │                       │
             ▼                       ▼
┌─────────────────────────────────────────────────┐
│         feedIntegrator.js (MAS Only)             │
│                                                 │
│   1. Scrape MAS website (axios + cheerio)       │
│   2. Fetch MAS API data                         │
│   3. Deduplicate against existing records       │
│   4. Embed into vector store (RAG)              │
│   5. Assess impact via LLM (GPT-4o-mini)       │
│   6. Generate alerts with severity levels       │
│   7. Log all LLM calls to audit trail           │
│                                                 │
│   Trigger: Every 14 days + on server startup    │
└─────────────────────────────────────────────────┘
```

---

## 2. LLM Integration (OpenAI GPT-4o-mini)

**Patrick's Feedback:** Replace keyword-based impact assessment with LLM-powered analysis. Use LLM to compare regulations against internal policies for gap analysis. This is the biggest differentiator.

**What Was Done:**

- Installed `openai` npm package
- Added `OPENAI_API_KEY` and `OPENAI_MODEL` to `.env`
- Replaced the keyword-based `assessImpact()` function entirely with LLM-powered `assessImpactRAG()`
- Added LLM-powered gap analysis via `analyzeGapRAG()`
- Created new API endpoint: `POST /api/compliance-gaps/analyze`
- No manual/keyword logic remains — all assessment is done by GPT-4o-mini

**Before vs After:**

```
BEFORE (Keyword-Based):
  if (text.includes('penalty')) → Critical
  if (text.includes('risk'))    → High
  if (text.includes('update'))  → Medium
  else                          → Low

AFTER (LLM-Powered):
  GPT-4o-mini reads the full regulation text
  + relevant GLDB policy context (retrieved via RAG)
  → Returns: {"impact_score": "Critical", "reasoning": "...", "affected_areas": [...]}
```

---

## 3. RAG (Retrieval-Augmented Generation) Pipeline

**Patrick's Feedback:** Use LLM for deeper semantic analysis. Compare regulations against PMPs intelligently.

**What Was Done:**

Created `services/ragEngine.js` — a complete RAG pipeline with all components:

| RAG Component | Implementation | File |
|---------------|---------------|------|
| External Knowledge Source | MySQL (regulations + policies) | `db.js` |
| Text Chunking | `chunkText()` — splits at sentence boundaries, ~500 chars | `ragEngine.js` |
| Embedding Model | OpenAI `text-embedding-3-small` (1536 dimensions) | `ragEngine.js` |
| Vector Database | **Chroma** (localhost:8000, 2 collections) | `ragEngine.js` |
| Query Encoder | Same embedding model converts queries to vectors | `ragEngine.js` |
| Retriever | Chroma native vector similarity search (top-K) | `ragEngine.js` |
| Prompt Augmentation | Injects top-K relevant chunks into LLM prompt | `ragEngine.js` |
| LLM Generator | GPT-4o-mini generates impact scores and gap analysis | `ragEngine.js` |
| Updater | Auto-embeds new regulations on ingestion + startup | `feedIntegrator.js` |

**RAG Pipeline Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAG PIPELINE FLOW                              │
└─────────────────────────────────────────────────────────────────┘

STEP 1: INGESTION & EMBEDDING
═══════════════════════════════════════════════════════════════════

  New MAS Regulation Scraped
       │
       ▼
  ┌─────────────────────┐
  │  TEXT CHUNKING       │  Break into ~500 char chunks
  │  (sentence-aware)    │  at sentence boundaries
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  EMBEDDING MODEL     │  OpenAI text-embedding-3-small
  │  (1536 dimensions)   │  Converts text → numerical vector
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  VECTOR STORE        │  MySQL `embeddings` table
  │  (MySQL JSON)        │  Stores: source_type, source_id,
  │                      │  chunk_text, embedding vector
  └─────────────────────┘


STEP 2: RETRIEVAL (when assessing impact or analyzing gaps)
═══════════════════════════════════════════════════════════════════

  Query: "Assess impact of MAS Notice 626 update"
       │
       ▼
  ┌─────────────────────┐
  │  QUERY ENCODER       │  Convert query → vector
  │  (same model)        │  using text-embedding-3-small
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  SIMILARITY SEARCH   │  Cosine similarity between
  │  (cosine distance)   │  query vector and all stored
  │                      │  policy/regulation vectors
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  TOP-K RESULTS       │  Return 3-5 most relevant
  │  (ranked by score)   │  chunks from the vector store
  └─────────────────────┘


STEP 3: AUGMENTATION & GENERATION
═══════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────┐
  │  AUGMENTED PROMPT                                │
  │                                                 │
  │  "You are a compliance analyst at GLDB..."      │
  │                                                 │
  │  REGULATION:                                    │
  │  [Full text of MAS Notice 626]                  │
  │                                                 │
  │  RELEVANT GLDB POLICIES (retrieved via RAG):    │
  │  1. GLDB AML/CFT Policy — automated eKYC...    │
  │  2. GLDB KYC Onboarding Policy — standard...   │
  │  3. GLDB Transaction Monitoring Policy — ...    │
  │                                                 │
  │  "Assess the impact on GLDB operations..."      │
  └──────────────────────┬──────────────────────────┘
                         │
                         ▼
  ┌─────────────────────────────────────────────────┐
  │  GPT-4o-mini (LLM GENERATOR)                    │
  │                                                 │
  │  Input: Regulation + Retrieved Policy Context   │
  │  Output: {                                      │
  │    "impact_score": "Critical",                  │
  │    "reasoning": "Notice 626 requires...",       │
  │    "affected_areas": ["CDD", "EDD", "STR"]     │
  │  }                                             │
  └──────────────────────┬──────────────────────────┘
                         │
                         ▼
  ┌─────────────────────────────────────────────────┐
  │  AUDIT LOG                                      │
  │                                                 │
  │  Records: model, input prompt, output,          │
  │  target regulation, result, duration,           │
  │  chunks_retrieved, timestamp                    │
  └─────────────────────────────────────────────────┘
```

**RAG-Powered Gap Analysis Flow:**

```
  Compliance Officer clicks "Analyze Gap"
  (selects: MAS Notice 626 vs GLDB AML Policy)
       │
       ▼
  POST /api/compliance-gaps/analyze
  { reg_id: 1, policy_id: 1 }
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  RETRIEVE relevant regulation chunks     │
  │  (search embeddings WHERE type='reg')    │
  │  → Find chunks related to the policy    │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  RETRIEVE relevant policy chunks         │
  │  (search embeddings WHERE type='policy') │
  │  → Find chunks related to the regulation│
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  BUILD AUGMENTED PROMPT                  │
  │  • Full regulation text                  │
  │  • Full policy text                      │
  │  • Additional related reg chunks         │
  │  • Additional related policy chunks      │
  │  • Instructions for gap identification   │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  GPT-4o-mini GENERATES                   │
  │  {                                       │
  │    "has_gaps": true,                     │
  │    "gaps": [                             │
  │      {                                   │
  │        "description": "Policy lacks...", │
  │        "severity": "High",              │
  │        "recommendation": "Add..."        │
  │      }                                   │
  │    ],                                    │
  │    "compliance_score": 72                │
  │  }                                       │
  └──────────────────┬──────────────────────┘
                     │
                     ▼
  ┌─────────────────────────────────────────┐
  │  AUTO-CREATE GAPS IN DATABASE            │
  │  INSERT INTO compliance_gaps             │
  │  + LOG to audit_logs                     │
  └─────────────────────────────────────────┘
```

---

## 4. LLM Audit Logging

**Patrick's Feedback:** Log every LLM call in the audit trail — what was sent, what was returned, timestamp. Full traceability for compliance.

**What Was Done:**

- Every LLM call (impact assessment and gap analysis) is logged to `audit_logs` table
- Each log entry records:
  - `model` — which GPT model was used
  - `embedding_model` — which embedding model was used
  - `input` — the prompt sent to the LLM (truncated to 1500 chars)
  - `output` — the response received (truncated to 1500 chars)
  - `target` — which regulation/policy was being analyzed
  - `result` — the outcome (impact score or gap count)
  - `chunks_retrieved` — how many RAG chunks were used as context
  - `duration_ms` — how long the LLM call took
  - `timestamp` — when the call was made

**Audit Log Entry Example:**

```json
{
  "model": "gpt-4o-mini",
  "embedding_model": "text-embedding-3-small",
  "input": "You are a regulatory compliance analyst at GLDB... Analyze MAS Notice 626...",
  "output": "{\"impact_score\": \"Critical\", \"reasoning\": \"Notice 626 requires immediate updates...\"}",
  "target": "MAS Notice 626 - Prevention of Money Laundering",
  "result": "Critical",
  "chunks_retrieved": 3,
  "duration_ms": 1250,
  "timestamp": "2026-05-12T20:30:00.000Z"
}
```

---

## 5. PII Guardrails (Implemented)

**Patrick's Feedback:** Prevent personal data (NRIC numbers, names, addresses) from being uploaded/processed by the LLM.

**Status:** ✅ Implemented in `services/piiFilter.js`. Integrated into `ragEngine.js` as a guard before all LLM calls.

**What Was Done:**

- Created `services/piiFilter.js` with regex-based PII detection
- Integrated `piiGuard()` into `assessImpactRAG()` — checks regulation content before impact assessment
- Integrated `piiGuard()` into `analyzeGapRAG()` — checks both regulation and policy content before gap analysis
- If PII is detected: content is blocked, detection is logged to audit trail, and a safe default is returned
- Detects: NRIC/FIN numbers, phone numbers, email addresses, postal codes, physical addresses, credit card numbers, passport numbers

**Architecture:**

```
  Text content (regulation or policy)
       │
       ▼
  ┌─────────────────────────────────────┐
  │  PII FILTER (services/piiFilter.js) │
  │                                     │
  │  Regex patterns:                    │
  │  • NRIC: [STFGM]\d{7}[A-Z]         │
  │  • Phone: +65XXXXXXXX, 8/9XXXXXXX  │
  │  • Email: user@domain.com           │
  │  • Postal Code: 6-digit numbers    │
  │  • Address: Block/Blk patterns      │
  │  • Credit Card: 13-19 digit numbers │
  │  • Passport: Letter + 7-8 digits    │
  │                                     │
  │  If PII detected:                   │
  │  → BLOCK content from LLM           │
  │  → Log detection to audit_logs      │
  │  → Return safe default / error      │
  └──────────────────┬──────────────────┘
                     │
                     ▼ (only if clean)
  ┌─────────────────────────────────────┐
  │  PROCEED TO RAG + LLM               │
  └─────────────────────────────────────┘
```

---

## 6. Database Changes

**MySQL (9 tables — structured data):**
- `regulatory_sources` — MAS only (Phase 1)
- `regulations` — scraped MAS notices
- `regulation_changes` — version diffs with LLM impact scores
- `alerts` — auto-generated severity-categorized alerts
- `internal_policies` — 8 GLDB PMPs
- `compliance_gaps` — LLM-identified gaps
- `tasks` — assigned compliance work items
- `users` — 3 roles (Compliance Officer, Internal Auditor, Admin)
- `audit_logs` — all actions + LLM calls logged

**Chroma (2 collections — vector search):**
- `regulations` — 28 embedded chunks from MAS regulations
- `policies` — 8 embedded chunks from GLDB internal policies

**Seed Data:**
- Regulatory sources: 1 (MAS only)
- Internal policies: 8 GLDB-specific PMPs (AML, KYC, Transaction Monitoring, PDPA, Green Finance, Credit Risk, Cybersecurity, Wholesale Banking)

---

## 7. New Files Created

| File | Purpose |
|------|---------|
| `services/ragEngine.js` | Complete RAG pipeline — chunking, embeddings, vector search, LLM generation, audit logging |

---

## 8. Files Modified

| File | Changes |
|------|---------|
| `services/feedIntegrator.js` | Removed 6 non-MAS scrapers. Integrated RAG engine for impact assessment. Auto-embeds new regulations. |
| `routes/gaps.js` | Added `POST /api/compliance-gaps/analyze` endpoint using RAG-powered gap analysis |
| `schema.sql` | Added `embeddings` table. Reduced sources to MAS only. |
| `.env` | Added `OPENAI_API_KEY`, `OPENAI_MODEL`. Commented out non-MAS URLs. |
| `package.json` | Added `openai` dependency |

---

## 9. Phased Plan Status

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 (Now) | MAS regulations + GLDB PMPs + RAG/LLM analysis | ✅ Implemented (pending API quota) |
| Phase 2 (Later) | Expand to FATF, FinCEN, ECB, FCA, BIS, HKMA | 🔲 Not started |
| Phase 3 (Future) | SharePoint integration for auto-pulling policies | 🔲 Not started |

---

## 10. Outstanding Items

| Item | Status | Blocker |
|------|--------|---------|
| OpenAI API quota | ❌ Exceeded | School needs to top up credits or increase limit |
| PII detection filter | 🔲 Planned | Will implement once API is working |
| Sample PMPs from Patrick | ⏳ Waiting | Patrick to provide real Policy & Procedure Manuals |
| Frontend gap analysis UI | 🔲 Planned | Button to trigger `POST /api/compliance-gaps/analyze` |

---

## Technology Stack (Updated)

```
┌─────────────────────────────────────────────────────────┐
│                 UPDATED TECH STACK                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BACKEND          │  AI/RAG            │  DATA           │
│  ─────────────    │  ─────────────     │  ──────────     │
│  Node.js          │  OpenAI GPT-4o-mini│  MySQL (Azure)  │
│  Express.js       │  text-embedding-   │  9 tables       │
│  bcryptjs         │    3-small         │  Foreign keys   │
│  axios            │  Chroma (Vector DB)│                 │
│  cheerio          │  RAG Pipeline      │  Chroma         │
│  node-cron        │  PII Filter        │  2 collections  │
│  dotenv           │                    │  (localhost:8000)│
│  openai SDK       │                    │                 │
│  chromadb         │                    │                 │
│                   │                    │                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FRONTEND         │  ARCHITECTURE                       │
│  ─────────────    │  ─────────────────────────────      │
│  HTML5            │  API-First, Decoupled               │
│  Bootstrap 5      │  RAG (Retrieval-Augmented Gen)      │
│  Vanilla JS       │  MAS-Focused POC (Phase 1)          │
│  Chart.js         │  Biweekly Automated Ingestion       │
│                   │                                     │
└─────────────────────────────────────────────────────────┘
```
