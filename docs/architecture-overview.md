# System Architecture — Data Flow

```
┌───────────────────────┐
│  Regulatory Websites  │
│  (MAS, FATF, FinCEN,  │
│   ECB, FCA, BIS, HKMA)│
└──────────┬────────────┘
           │ Web Scraping (axios + cheerio)
           ▼
┌───────────────────────┐        ┌───────────────────────┐
│  feedIntegrator.js    │───────▶│    OpenAI LLM (GPT)   │
│  (Automation Service) │        │                       │
│                       │◀───────│  • Impact Assessment  │
│  • Scrapes 7 sources  │        │  • Gap Analysis       │
│  • Detects changes    │        │  • PII filtered out   │
│  • Runs every 14 days │        │  • All calls logged   │
└──────────┬────────────┘        └───────────────────────┘
           │ SQL INSERT/UPDATE
           ▼
┌───────────────────────┐
│  MySQL Database       │
│  (Azure-hosted)       │
│                       │
│  9 tables:            │
│  regulations,         │
│  regulation_changes,  │
│  alerts, tasks,       │
│  compliance_gaps,     │
│  internal_policies,   │
│  regulatory_sources,  │
│  users, audit_logs    │
└──────────┬────────────┘
           │ SQL queries (mysql2 pool)
           ▼
┌───────────────────────┐
│  server.js            │
│  (Express REST API)   │
│                       │
│  • 25+ endpoints      │
│  • Routes requests    │
│  • Returns JSON only  │
│  • Audit middleware   │
└──────────┬────────────┘
           │ HTTP JSON responses
           ▼
┌───────────────────────┐
│  Frontend Dashboard   │
│  (Browser)            │
│                       │
│  • 10 views           │
│  • Charts (Chart.js)  │
│  • Login, Dark Mode   │
│  • CSV Export, Print  │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  Compliance Officer   │
│  Reviews alerts,      │
│  assigns tasks,       │
│  tracks gaps          │
└───────────────────────┘
```
