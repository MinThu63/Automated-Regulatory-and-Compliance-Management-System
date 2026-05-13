# System Architecture — Data Flow

## Phase 1 POC: MAS Only + RAG Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DATA SOURCE (Phase 1: MAS Only)              │
│                                                                             │
│   ┌───────────────────────────┐       ┌───────────────────────────┐        │
│   │  MAS Website              │       │  MAS Official API         │        │
│   │  (Web Scraping)           │       │  (REST — Free, No Key)    │        │
│   │                           │       │                           │        │
│   │  • Notice 626 (AML/CFT)  │       │  • Exchange Rates         │        │
│   │  • Notice 1014           │       │  • Interest Rates         │        │
│   │  • TRM Guidelines        │       │  • Money Supply           │        │
│   │  • ESG Guidelines        │       │                           │        │
│   │  • Notice 637, 644       │       │                           │        │
│   └─────────────┬─────────────┘       └─────────────┬─────────────┘        │
│                 │                                   │                       │
└─────────────────┼───────────────────────────────────┼───────────────────────┘
                  │ axios + cheerio                    │ axios GET
                  ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTOMATION LAYER (Background Service)                      │
│                                                                             │
│   services/feedIntegrator.js                                                │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  1. SCRAPE — axios fetches MAS HTML, cheerio parses it          │      │
│   │  2. FETCH — MAS Official API for monetary data                  │      │
│   │  3. DEDUPLICATE — checks MySQL for existing records             │      │
│   │  4. EMBED — chunks text + generates vectors (RAG)               │      │
│   │  5. RETRIEVE — finds relevant policy chunks (cosine similarity) │      │
│   │  6. ASSESS — GPT-4o-mini analyzes impact with policy context    │      │
│   │  7. GENERATE ALERTS — creates severity-categorized alerts       │      │
│   │  8. LOG — records all LLM calls to audit trail                  │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   Triggered by: node-cron (every 14 days) + on server startup              │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAG ENGINE (services/ragEngine.js)                    │
│                                                                             │
│   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │  CHUNKING   │───▶│  EMBEDDING   │───▶│ VECTOR STORE │                  │
│   │             │    │              │    │              │                  │
│   │ Split text  │    │ OpenAI       │    │ MySQL        │                  │
│   │ into ~500   │    │ text-embed-  │    │ embeddings   │                  │
│   │ char chunks │    │ ding-3-small │    │ table (JSON) │                  │
│   └─────────────┘    └──────────────┘    └──────┬───────┘                  │
│                                                  │                          │
│   ┌─────────────┐    ┌──────────────┐           │                          │
│   │  RETRIEVER  │◀───│ QUERY ENCODE │◀──────────┘                          │
│   │             │    │              │  cosine similarity                    │
│   │ Top-K most  │    │ Convert query│  search                              │
│   │ relevant    │    │ to vector    │                                      │
│   │ chunks      │    │              │                                      │
│   └──────┬──────┘    └──────────────┘                                      │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │  PROMPT AUGMENTATION                                     │              │
│   │                                                         │              │
│   │  Regulation text + Retrieved policy chunks              │              │
│   │  → Combined into enriched prompt for LLM                │              │
│   └──────────────────────────┬──────────────────────────────┘              │
│                              │                                              │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OpenAI LLM (GPT-4o-mini)                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  IMPACT ASSESSMENT                                               │      │
│   │  Input: Regulation + relevant policy context (from RAG)          │      │
│   │  Output: { impact_score, reasoning, affected_areas }             │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  GAP ANALYSIS                                                    │      │
│   │  Input: Regulation + Policy + related chunks (from RAG)          │      │
│   │  Output: { has_gaps, gaps[], compliance_score, recommendations } │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   All calls logged to audit_logs (input, output, duration, timestamp)       │
│                                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MySQL DATABASE (Azure)                                │
│                                                                             │
│   ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐      │
│   │ regulatory_sources│  │   regulations     │  │ regulation_changes │      │
│   │ (MAS only)       │──│ (MAS notices)     │──│ (version diffs)    │      │
│   └──────────────────┘  └───────────────────┘  └────────────────────┘      │
│                                                                             │
│   ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐      │
│   │     alerts       │  │ internal_policies │  │  compliance_gaps   │      │
│   │ (auto-generated) │  │ (GLDB PMPs)      │  │ (LLM-identified)   │      │
│   └──────────────────┘  └───────────────────┘  └────────────────────┘      │
│                                                                             │
│   ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐      │
│   │      users       │  │      tasks        │  │    audit_logs      │      │
│   │ (3 roles)        │  │ (assigned work)   │  │ (all actions +     │      │
│   └──────────────────┘  └───────────────────┘  │  LLM calls logged) │      │
│                                                 └────────────────────┘      │
│   ┌──────────────────┐                                                      │
│   │   embeddings     │  ← NEW: RAG vector store                             │
│   │ (regulation +    │  Stores chunked text + 1536-dim vectors              │
│   │  policy vectors) │  Enables semantic similarity search                  │
│   └──────────────────┘                                                      │
│                                                                             │
│   Connection: db.js (mysql2 connection pool, credentials from .env)         │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▲
                                   │ SQL queries
                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND API LAYER (REST API)                             │
│                                                                             │
│   server.js (Express app — route mounting only)                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  routes/auth.js        — POST /api/login, GET /api/users        │      │
│   │  routes/alerts.js      — GET /api/alerts, PATCH /api/alerts/:id │      │
│   │  routes/dashboard.js   — GET /summary, /categories, /trends     │      │
│   │  routes/regulations.js — GET/POST/PUT (paginated + search)      │      │
│   │  routes/changes.js     — GET /api/regulation-changes            │      │
│   │  routes/tasks.js       — GET/POST/PATCH/DELETE                  │      │
│   │  routes/gaps.js        — GET/POST/PATCH + POST /analyze (RAG)   │      │
│   │  routes/sources.js     — GET/POST/PUT/DELETE                    │      │
│   │  routes/policies.js    — GET/POST/PUT                           │      │
│   │  routes/audit.js       — GET (with query filters)               │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   middleware/auditLog.js — auto-logs all user actions to audit_logs         │
│                                                                             │
│   Output: Raw JSON only (no HTML rendering)                                 │
│   Auth: bcryptjs password hashing                                           │
│   Port: 3000 (configurable via .env)                                        │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ HTTP fetch() requests (JSON)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (Decoupled Dashboard)                    │
│                                                                             │
│   frontend/index.html — Structure (10 views, login overlay, sidebar)        │
│   frontend/styles.css — Styling (dark mode, responsive, print)              │
│   frontend/script.js  — Logic (fetch, render, pagination, charts)           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  10 Dashboard Views:                                            │      │
│   │                                                                 │      │
│   │  ┌────────┐ ┌────────┐ ┌───────┐ ┌──────┐ ┌─────────┐        │      │
│   │  │ Alerts │ │ Impact │ │Changes│ │Tasks │ │  Gaps   │        │      │
│   │  └────────┘ └────────┘ └───────┘ └──────┘ └─────────┘        │      │
│   │  ┌────────┐ ┌────────────┐ ┌───────┐ ┌────────┐ ┌─────┐      │      │
│   │  │Reports │ │Regulations │ │Sources│ │Policies│ │Audit│      │      │
│   │  └────────┘ └────────────┘ └───────┘ └────────┘ └─────┘      │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   Features: Login, Dark Mode, Pagination, Charts (Chart.js),                │
│             CSV Export, Print Report, Toast Notifications                    │
│                                                                             │
│   Libraries: Bootstrap 5 (CDN), Chart.js (CDN), Vanilla JavaScript          │
│   No frameworks. No build tools.                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  COMPLIANCE      │
                          │  OFFICER         │
                          │  (Browser)       │
                          └─────────────────┘
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    TECH STACK (Phase 1)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BACKEND          │  AI / RAG          │  DATA           │
│  ─────────────    │  ─────────────     │  ──────────     │
│  Node.js          │  GPT-4o-mini       │  MySQL (Azure)  │
│  Express.js       │  text-embedding-   │  10 tables      │
│  bcryptjs         │    3-small         │  (incl. vectors)│
│  axios            │  RAG Pipeline      │  Foreign keys   │
│  cheerio          │  Cosine Similarity │                 │
│  node-cron        │  Vector Store      │                 │
│  dotenv           │  Audit Logging     │                 │
│  openai SDK       │                    │                 │
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

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| API-first (no server-side rendering) | Matches GLDB's cloud-native architecture; frontend can be replaced independently |
| MAS only for Phase 1 | Patrick's recommendation; validate with one source before expanding |
| RAG over direct prompting | Grounds LLM responses in GLDB's actual policies; reduces hallucinations |
| MySQL for vector store | Avoids adding new infrastructure (Pinecone, Weaviate) for POC; JSON column stores embeddings |
| GPT-4o-mini (not GPT-4) | Cost-effective for POC volume; sufficient quality for classification tasks |
| text-embedding-3-small | Cheapest OpenAI embedding model; 1536 dimensions; good enough for POC |
| Cosine similarity in-app | Simple, no external vector DB needed; works for <1000 embeddings |
| Audit all LLM calls | Patrick's requirement; MAS compliance needs full traceability |
| Keyword fallback removed | Patrick wants pure LLM; defaults to "Medium" if API unavailable |
| Biweekly cron + startup | Matches regulatory review cycle; immediate data on deploy |

---

## Phased Expansion Plan

```
PHASE 1 (Current — POC)
════════════════════════
  Source: MAS only
  AI: GPT-4o-mini + RAG
  Data: Notice 626 + GLDB PMPs
  Goal: Validate with Patrick

PHASE 2 (Future)
════════════════════════
  Sources: + FATF, FinCEN, ECB, FCA, BIS, HKMA
  AI: Same RAG pipeline (scales automatically)
  Data: All 7 regulatory bodies
  Goal: Full multi-regulatory coverage

PHASE 3 (Future)
════════════════════════
  Integration: SharePoint for auto-pulling PMPs
  AI: Potentially multiple LLMs for different tasks
  Data: Live internal policy documents
  Goal: Fully automated compliance pipeline
```
