# Automated Regulatory Monitoring and Compliance Management System

**Green Link Digital Bank (GLDB) — Digital Wholesale Bank Licensed by MAS**

A decoupled, API-first compliance management platform that automates the monitoring of regulatory changes from 7 international authorities, detects changes, assesses impact, generates alerts, and provides compliance officers with a professional dashboard for task management, gap analysis, and audit-ready reporting.

---

## Project Structure

```
├── server.js                  # Express app entry point (route mounting only)
├── db.js                      # MySQL connection pool (mysql2 + dotenv)
├── .env                       # Environment variables (DB credentials, API URLs)
├── schema.sql                 # Database schema (9 tables) + seed data
├── package.json               # Node.js dependencies
│
├── routes/                    # API route modules (separation of concerns)
│   ├── auth.js                # POST /api/login, GET /api/users
│   ├── alerts.js              # GET/PATCH /api/alerts
│   ├── dashboard.js           # GET /api/dashboard/summary, /categories, /trends
│   ├── regulations.js         # GET/POST/PUT /api/regulations (paginated + search)
│   ├── changes.js             # GET /api/regulation-changes
│   ├── tasks.js               # GET/POST/PATCH/DELETE /api/tasks
│   ├── gaps.js                # GET/POST/PATCH /api/compliance-gaps
│   ├── sources.js             # GET/POST /api/regulatory-sources
│   ├── policies.js            # GET/POST/PUT /api/internal-policies
│   └── audit.js               # GET /api/audit-logs (filtered)
│
├── middleware/
│   └── auditLog.js            # Shared audit logging helper
│
├── services/
│   └── feedIntegrator.js      # Automated regulatory feed scraper + MAS API
│                              # (7 sources, cron-scheduled every 14 days)
│
├── frontend/                  # Decoupled frontend (plain HTML/CSS/JS)
│   ├── index.html             # Dashboard UI (10 views, login, sidebar)
│   ├── styles.css             # All custom CSS (dark mode, responsive, print)
│   └── script.js              # All frontend logic (fetch, render, pagination)
│
└── docs/
    └── use-case-diagram.puml  # PlantUML use case diagram
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express.js | RESTful API routing |
| Database | MySQL + mysql2 | Persistent storage with connection pooling |
| Authentication | bcryptjs | Password hashing |
| Scraping | axios + cheerio | HTTP requests + HTML parsing |
| Scheduling | node-cron | Automated biweekly feed integration |
| Configuration | dotenv | Externalized credentials and URLs |
| Frontend | HTML + Bootstrap 5 + Vanilla JS | Decoupled dashboard UI |
| Visualization | Chart.js (CDN) | Pie, bar, doughnut, and line charts |

---

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MySQL (v8+)
- MySQL Workbench (for running schema.sql)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Edit `.env` with your MySQL credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=gldb_regulatory_compliance_db
DB_PORT=3306
```

### Step 3: Create Database
Open MySQL Workbench and run `schema.sql`. This creates the database, all 9 tables, and inserts seed data (3 users, 7 regulatory sources, sample regulations).

### Step 4: Start the Server
```bash
npm start
```
You should see:
```
Server is running on port 3000
Database connected successfully to gldb_regulatory_compliance_db
[FeedIntegrator] Feed scheduler initialized
[FeedIntegrator] Starting feed integration...
```

### Step 5: Open the Dashboard
Open `frontend/index.html` in your browser.

Login credentials:
| Role | Email | Password |
|------|-------|----------|
| Compliance Officer | officer@gldb.com | 123456 |
| Internal Auditor | auditor@gldb.com | 123456 |
| Admin | admin@gldb.com | 123456 |

---

## System Modules (9 Total)

| # | Module | Description |
|---|--------|-------------|
| 1 | Regulatory Feed Integration | Scrapes 7 authorities (MAS, FATF, FinCEN, ECB, FCA, BIS, HKMA) + MAS API |
| 2 | Change Detection | Compares regulation versions, records changes biweekly |
| 3 | Impact Assessment | Keyword-based scoring (Critical/High/Medium/Low) |
| 4 | Notification & Alerts | Auto-generates severity-categorized alerts |
| 5 | Knowledge Base | Regulations + policies CRUD with version tracking |
| 6 | Compliance Gap Analysis | Links regulations to policies, tracks remediation |
| 7 | Task & Workflow Management | Task assignment, deadlines, progress tracking |
| 8 | Historical Archive & Audit Trail | Searchable, filterable audit log |
| 9 | Reporting & Dashboards | Charts, category breakdown, print-friendly reports |

---

## API Endpoints (25+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | Authentication (bcrypt) |
| GET | /api/users | List all users |
| GET | /api/alerts | List alerts with regulation titles |
| PATCH | /api/alerts/:id | Update alert status |
| GET | /api/dashboard/summary | Aggregated alert metrics |
| GET | /api/dashboard/categories | Changes grouped by category |
| GET | /api/dashboard/trends | Alert counts by date |
| GET | /api/regulations | Paginated regulations with search |
| POST | /api/regulations | Create regulation |
| PUT | /api/regulations/:id | Update regulation |
| GET | /api/regulation-changes | All detected changes |
| GET | /api/regulation-changes/:regId | Changes for specific regulation |
| GET | /api/tasks | Tasks with assignee info |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/:id | Update task status |
| DELETE | /api/tasks/:id | Delete task |
| GET | /api/compliance-gaps | Gaps with regulation + policy info |
| POST | /api/compliance-gaps | Create gap |
| PATCH | /api/compliance-gaps/:id | Update gap status |
| GET | /api/regulatory-sources | List sources |
| POST | /api/regulatory-sources | Add source |
| GET | /api/internal-policies | List policies |
| POST | /api/internal-policies | Create policy |
| PUT | /api/internal-policies/:id | Update policy |
| GET | /api/audit-logs | Filtered audit trail |

---

## Dashboard Features

- Login with bcrypt-hashed passwords
- 10 sidebar views with responsive collapse
- Dark mode toggle (persists via localStorage)
- Welcome banner with unread alert count
- Color-coded severity badges and status indicators
- Client-side pagination (10 items per page) on all tables
- Server-side pagination + search on Regulations view
- Impact filtering (Critical/High/Medium/Low)
- Chart.js visualizations (pie, bar, doughnut, line)
- Tabbed report pages (Overview, Trends, Categories, Status)
- Print-friendly compliance report generation
- CSV export for alerts
- Toast notifications on all CRUD operations
- Loading spinners and empty state messages
- Auto audit logging on all user actions

---

## Regulatory Sources

| Source | Method | Scope |
|--------|--------|-------|
| MAS (Monetary Authority of Singapore) | Web Scraping + API | Singapore |
| FATF (Financial Action Task Force) | Web Scraping | Global |
| FinCEN (Financial Crimes Enforcement Network) | Web Scraping | US |
| ECB (European Central Bank) | Web Scraping | Europe |
| FCA (Financial Conduct Authority) | Web Scraping | UK |
| BIS (Bank for International Settlements) | Web Scraping | Global |
| HKMA (Hong Kong Monetary Authority) | Web Scraping | Asia |

All sources have fallback data for resilience when live sites are unreachable.

---

## Architecture

```
Browser (index.html + script.js)
    ↓ fetch() HTTP requests
Express REST API (server.js + routes/)
    ↓ mysql2 pool queries
MySQL Database (9 tables)
    ↑ automated inserts
Feed Integrator (services/feedIntegrator.js)
    ↑ axios + cheerio
External Regulatory Websites (7 sources)
```

**Architecture Pattern:** API-First, Decoupled (no server-side rendering)
**Development Methodology:** Agile/Scrum (2 sprints, 4-person team)
**Database:** Relational, normalized (9 tables with foreign keys)
