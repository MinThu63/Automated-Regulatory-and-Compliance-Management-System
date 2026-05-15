# Setup Guide — Team Members

## Automated Regulatory Monitoring and Compliance Management System
### Team ID: SOI-2026-0039

---

## Prerequisites

- Node.js v18+
- Python 3.8+ (for Chroma)
- MySQL 8+ (or access to Azure database)
- Git

---

## Step 1: Clone and Install Node Dependencies

```bash
git clone https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System.git
cd Automated-Regulatory-and-Compliance-Management-System
npm install
```

---

## Step 2: Configure Environment

Edit `.env` with your database credentials and API keys. The file should contain:

```
DB_HOST=dft-fyp.mysql.database.azure.com
DB_USER=dft_fyp
DB_PASSWORD=RepublicPoly2026
DB_NAME=SOI-2026-0039-MinThu
DB_PORT=3306

MAS_SCRAPE_URL=https://www.mas.gov.sg/regulation/anti-money-laundering
MAS_API_URL=https://eservices.mas.gov.sg/api/action/datastore/search.json

API_PORT=3000

OPENAI_API_KEY=<your-key-here>
OPENAI_MODEL=gpt-4o-mini

CHROMA_URL=http://localhost:8000
```

---

## Step 3: Set Up MySQL Database

Open MySQL Workbench and run the entire `schema.sql` file against the database. This creates 9 tables and inserts seed data.

---

## Step 4: Install Chroma (Vector Database)

```bash
pip install chromadb
```

If `pip` doesn't work, try:
```bash
python -m pip install chromadb
```

---

## Step 5: Start Chroma Server

Open a **separate terminal** and run:

```bash
chroma run --path ./chroma_data --port 8000
```

You should see:
```
Saving data to: ./chroma_data
Connect to Chroma at: http://localhost:8000
```

**Keep this terminal open.** Chroma must be running for the RAG pipeline to work.

---

## Step 6: Start the Application

In a **different terminal** (not the Chroma one):

```bash
npm start
```

You should see:
```
Server is running on port 3000
Database connected successfully to SOI-2026-0039-MinThu
[FeedIntegrator] Feed scheduler initialized (MAS only — RAG enabled)
[RAG] Chroma collections initialized (regulations + policies)
[RAG] Embedding all existing regulations and policies into Chroma...
[RAG] Found 25 regulations to embed
[RAG] Embedding regulation: Notice 626 Prevention of Money Laundering
...
[RAG] Embedding complete. Chroma vector store ready.
```

---

## Step 7: Open the Dashboard

```bash
start frontend/index.html
```

Login credentials:
| Role | Email | Password |
|------|-------|----------|
| Compliance Officer | officer@gldb.com | 123456 |
| Internal Auditor | auditor@gldb.com | 123456 |
| Admin | admin@gldb.com | 123456 |

---

## Step 8: Verify Chroma Has Data

In a third terminal:

```bash
node -e "const {ChromaClient}=require('chromadb'); async function check(){const c=new ChromaClient({path:'http://localhost:8000'}); const reg=await c.getCollection({name:'regulations'}); const pol=await c.getCollection({name:'policies'}); console.log('Regulations:', await reg.count()); console.log('Policies:', await pol.count());} check().then(()=>process.exit())"
```

Expected output:
```
Regulations: 28
Policies: 8
```

---

## Summary of Running Terminals

You need **2 terminals** running simultaneously:

| Terminal | Command | Purpose |
|----------|---------|---------|
| Terminal 1 | `chroma run --path ./chroma_data --port 8000` | Vector database |
| Terminal 2 | `npm start` | Backend API server |

Then open `frontend/index.html` in your browser.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `EADDRINUSE: port 3000` | Kill existing node: `taskkill /F /IM node.exe` then retry |
| `Chroma connection failed` | Make sure Chroma is running in Terminal 1 |
| `429 quota exceeded` | OpenAI credits exhausted — contact school for top-up |
| `Cannot find module` | Run `npm install` again |
| `chroma: command not found` | Run `pip install chromadb` again, or use `python -m chromadb run ...` |

---

## Architecture Overview

```
MySQL (9 tables) — structured data (regulations, alerts, tasks, gaps, etc.)
Chroma (2 collections) — vector embeddings for semantic search
OpenAI GPT-4o-mini — LLM for impact assessment and gap analysis
OpenAI text-embedding-3-small — converts text to vectors
PII Filter — blocks personal data before reaching OpenAI
```
