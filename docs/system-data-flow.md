# System Data Flow & Architecture

## Automated Regulatory Monitoring and Compliance Management System
### Green Link Digital Bank (GLDB) — POC

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DATA SOURCES                                │
│                                                                             │
│   ┌─────┐  ┌──────┐  ┌────────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌──────┐    │
│   │ MAS │  │ FATF │  │ FinCEN │  │ ECB │  │ FCA │  │ BIS │  │ HKMA │    │
│   └──┬──┘  └──┬───┘  └───┬────┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬───┘    │
│      │        │           │          │        │        │        │         │
└──────┼────────┼───────────┼──────────┼────────┼────────┼────────┼─────────┘
       │        │           │          │        │        │        │
       ▼        ▼           ▼          ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTOMATION LAYER (Background Service)                      │
│                                                                             │
│   services/feedIntegrator.js                                                │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  1. SCRAPE — axios + cheerio fetches HTML from 7 sources        │      │
│   │  2. PARSE — extracts regulation titles, content, categories     │      │
│   │  3. DEDUPLICATE — checks MySQL for existing records             │      │
│   │  4. ASSESS IMPACT — LLM (OpenAI) analyzes risk level            │      │
│   │     (fallback: keyword-based scoring)                           │      │
│   │  5. GENERATE ALERTS — creates alerts with severity levels       │      │
│   │  6. STORE — inserts into MySQL (regulations, changes, alerts)   │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   Triggered by: node-cron (every 14 days) + on server startup              │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MySQL DATABASE (Azure)                                │
│                                                                             │
│   ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐      │
│   │ regulatory_sources│  │   regulations     │  │ regulation_changes │      │
│   │ (7 authorities)  │──│ (scraped data)    │──│ (version diffs)    │      │
│   └──────────────────┘  └───────────────────┘  └────────────────────┘      │
│                                                                             │
│   ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐      │
│   │     alerts       │  │ internal_policies │  │  compliance_gaps   │      │
│   │ (auto-generated) │  │ (GLDB PMPs)      │  │ (reg vs policy)    │      │
│   └──────────────────┘  └───────────────────┘  └────────────────────┘      │
│                                                                             │
│   ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────┐      │
│   │      users       │  │      tasks        │  │    audit_logs      │      │
│   │ (3 roles)        │  │ (assigned work)   │  │ (all actions)      │      │
│   └──────────────────┘  └───────────────────┘  └────────────────────┘      │
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
│   server.js (Express app — route mounting only, 45 lines)                   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │  routes/auth.js        — POST /api/login, GET /api/users        │      │
│   │  routes/alerts.js      — GET /api/alerts, PATCH /api/alerts/:id │      │
│   │  routes/dashboard.js   — GET /summary, /categories, /trends     │      │
│   │  routes/regulations.js — GET/POST/PUT (paginated + search)      │      │
│   │  routes/changes.js     — GET /api/regulation-changes            │      │
│   │  routes/tasks.js       — GET/POST/PATCH/DELETE                  │      │
│   │  routes/gaps.js        — GET/POST/PATCH                         │      │
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

## Data Flow: End-to-End Pipeline

```
STEP 1: INGEST
─────────────────────────────────────────────────────────
  node-cron triggers every 14 days (or on server startup)
       │
       ▼
  feedIntegrator.js scrapes 7 regulatory websites in parallel
       │
       ▼
  axios fetches HTML → cheerio parses it → extracts titles & content
       │
       ▼

STEP 2: DEDUPLICATE
─────────────────────────────────────────────────────────
  For each scraped regulation:
       │
       ├── EXISTS in DB with same version? → SKIP (log "duplicate")
       │
       ├── EXISTS with LOWER version? → UPDATE regulation
       │   └── Create regulation_changes record (version diff)
       │
       └── NEW (not in DB)? → INSERT into regulations table

STEP 3: ASSESS IMPACT
─────────────────────────────────────────────────────────
  For each new/updated regulation:
       │
       ▼
  Send content to OpenAI LLM for impact analysis
  (Fallback: keyword scan for "penalty", "enforcement", "risk", etc.)
       │
       ▼
  Assign score: Critical | High | Medium | Low
       │
       ▼

STEP 4: GENERATE ALERT
─────────────────────────────────────────────────────────
  Map impact score to severity:
       │
       ├── Critical/High → "Immediate Action Required"
       ├── Medium        → "Review Recommended"
       └── Low           → "Informational"
       │
       ▼
  INSERT into alerts table (linked to regulation + change record)
       │
       ▼

STEP 5: DISPLAY
─────────────────────────────────────────────────────────
  Compliance Officer opens dashboard → logs in
       │
       ▼
  Frontend calls GET /api/alerts → Backend queries MySQL → returns JSON
       │
       ▼
  JavaScript renders alerts table with severity badges
       │
       ▼
  Officer reviews, filters, updates status, assigns tasks
       │
       ▼
  All actions logged to audit_logs table automatically
```

---

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────┐
│                    TECH STACK                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BACKEND          │  FRONTEND         │  DATA           │
│  ─────────────    │  ─────────────    │  ──────────     │
│  Node.js          │  HTML5            │  MySQL (Azure)  │
│  Express.js       │  Bootstrap 5      │  9 tables       │
│  bcryptjs         │  Vanilla JS       │  Foreign keys   │
│  axios            │  Chart.js         │                 │
│  cheerio          │  (No frameworks)  │                 │
│  node-cron        │                   │                 │
│  dotenv           │                   │                 │
│  OpenAI API       │                   │                 │
│                   │                   │                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ARCHITECTURE: API-First, Decoupled                     │
│  METHODOLOGY:  Agile/Scrum (3 sprints)                  │
│  HOSTING:      Azure MySQL + localhost (dev)             │
│  REPO:         GitHub (private)                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| API-first (no server-side rendering) | Matches GLDB's cloud-native architecture; frontend can be replaced independently |
| Web scraping (not APIs) | Regulatory authorities don't offer free APIs for notices |
| LLM for impact assessment | Patrick's recommendation; deeper semantic understanding than keywords |
| Keyword fallback | Ensures system works even when LLM is unavailable |
| node-cron (biweekly) | Matches regulatory review cycle; runs on startup for immediate data |
| MySQL (not NoSQL) | Relational data with foreign keys; compliance requires data integrity |
| Separate route files | Clean separation of concerns; each module is independently maintainable |
| Audit logging middleware | Every action tracked automatically; satisfies MAS audit requirements |
| Phased approach (MAS first) | Patrick's recommendation; validate with one source before expanding |
