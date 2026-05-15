# C300 Final Year Project Report

## Automated Regulatory Monitoring and Compliance Management System
### Green Link Digital Bank Pte. Ltd. (GLDB)

**Team ID:** SOI-2026-0039
**Team Members:** Min Thu (Lead Developer), Eaint, Kay, Hsu
**Supervisor:** [Supervisor Name]
**Academic Year:** AY2025 Semester 1

---

## 1. Project Specification and Plan

### 1.1 Project Overview

**Project Motivation**

Financial institutions face increasing challenges in keeping up with rapidly evolving regulatory requirements issued by authorities such as the Monetary Authority of Singapore (MAS), the Financial Action Task Force (FATF), the Financial Crimes Enforcement Network (FinCEN), the European Central Bank (ECB), and other governing bodies. For Greenlink Digital Bank (GLDB), a Digital Wholesale Bank licensed by MAS to serve the Micro, Small, and Medium Enterprise (MSME) segment, manual tracking of regulatory changes is time-consuming, prone to oversight, and directly threatens the bank's core value proposition of near-instantaneous supply chain financing. Any delay in detecting and responding to regulatory changes could result in non-compliance penalties, operational disruptions, or loss of the DWB license.

This project addresses this critical business need by developing an automated regulatory monitoring and compliance management system that eliminates manual tracking, provides real-time regulatory intelligence, and equips compliance officers with actionable dashboards and workflow tools.

**Project Objectives**

- Automate the retrieval of regulatory updates from 7 international and local regulatory bodies (MAS, FATF, FinCEN, ECB, FCA, BIS, HKMA) via web scraping and the MAS Official API.
- Detect and analyze changes in regulatory documents by comparing versions and recording semantic differences.
- Assess how new regulations affect existing compliance processes using LLM-powered impact analysis (Critical, High, Medium, Low) with keyword-based fallback.
- Provide automated alerts categorized by severity (Immediate Action Required, Review Recommended, Informational) and user-friendly dashboards for compliance teams.
- Maintain a centralized, searchable archive of all regulatory changes, LLM interactions, and corresponding staff actions for audit purposes.
- Implement PII guardrails to prevent personal identification information from being processed or stored by the system.
- Deliver a working Proof of Concept (POC) focused initially on MAS regulations, with a phased expansion plan for other regulatory bodies.

**Phased Implementation Approach (per industry partner feedback)**

Following guidance from GLDB's industry partner (Patrick), the project adopts a phased approach:
- Phase 1 (Current): Focus on MAS regulations and sample Policy & Procedure Manuals (PMPs) for validation
- Phase 2 (Future): Expand to FATF, FinCEN, ECB, FCA, BIS, HKMA
- Phase 3 (Future): SharePoint integration for automatic internal policy retrieval

**Project Scope**

The system covers 9 functional modules:

1. Regulatory Feed Integration (web scraping + MAS API)
2. Change Detection (biweekly automated scanning)
3. Impact Assessment (LLM-powered risk analysis with keyword fallback)
4. Notification and Alert System (severity-categorized alerts)
5. Knowledge Base Management (regulations + policies CRUD)
6. Compliance Gap Analysis (regulation-to-policy comparison)
7. Task and Workflow Management (assignment, deadlines, tracking)
8. Historical Archive and Audit Trail (searchable, filterable logs)
9. Reporting and Dashboards (charts, trends, print-friendly reports)

**Deliverables:**
- Working web application (Node.js backend + decoupled HTML/JS frontend)
- MySQL database with 9 normalized tables
- Automated feed integrator service (7 scrapers + 1 API)
- Project documentation and report

**Project Assumptions**

- The system operates on localhost during development; deployment to a production server is planned for a later phase.
- Regulatory source websites (MAS, FATF, etc.) maintain their current HTML structure. If a site changes its layout, the scraper falls back to cached reference data.
- The MAS Official API remains free and publicly accessible without an API key.
- All team members have access to Node.js (v18+), MySQL, and the shared Azure database server.
- The system is designed as a Proof of Concept (POC) for demonstration purposes; production-grade features such as JWT session tokens, rate limiting, and HTTPS are out of scope for this phase.
- The industry partner (GLDB) will provide sample Policy & Procedure Manuals (PMPs) for validation of the compliance gap analysis module.
- LLM (Large Language Model) integration uses the OpenAI API for impact assessment and regulatory-to-policy comparison. API costs are managed within the free/trial tier.
- PII (Personal Identification Information) must not be uploaded to or processed by the LLM. Guardrail mechanisms will filter sensitive data before LLM calls.

---

### 1.2 Functional Requirements

**FR1: Regulatory Feed Integration**
The system must connect to external regulatory databases, central banks, and government portals (such as MAS, FATF, FinCEN, ECB, FCA, BIS, and HKMA) via web scraping and the MAS Official API to retrieve regulatory updates. It must parse the retrieved HTML and JSON data using axios and cheerio, perform duplicate detection against existing records, and store new regulations in the internal MySQL knowledge base with source attribution, category classification, and version tracking.

**FR2: Automated Change Detection**
The system must automatically scan for updates in regulatory documents and advisories approximately every two weeks using a node-cron scheduled job. When a regulation with a higher version number is detected, the system must record the version change in the regulation_changes table along with a description of the semantic differences between the old and new versions.

**FR3: Impact Assessment and Risk Scoring**
The system must analyze each new or updated regulation to determine its impact on GLDB compliance processes using LLM-powered content analysis (OpenAI GPT). The system must assign an impact score of Critical, High, Medium, or Low based on the LLM's semantic understanding of the regulation's content, context, and implications for GLDB's operations. A keyword-based fallback mechanism shall be available when the LLM is unavailable. Impact data must be displayed in a dedicated dashboard view with color-coded severity cards and prioritized sorting.

**FR4: Notification and Alert Management**
The system must automatically generate alerts categorized by severity (Immediate Action Required, Review Recommended, Informational) when new regulations are ingested or existing regulations are updated. Compliance officers must be able to view alerts with color-coded severity badges, filter alerts by severity level and status using client-side filtering, and update alert status (Unread, Read, Dismissed) directly from the dashboard.

**FR5: Knowledge Base Management**
The system must maintain a centralized knowledge base of all ingested regulations with source attribution, version history, and category classification. Compliance officers must be able to view, add, and edit regulations and internal policies through the dashboard.

**FR6: Compliance Gap Analysis**
The system must allow compliance officers to identify and record compliance gaps between new regulatory requirements and existing internal bank policies. Each gap must be linked to a specific regulation and policy, with a status lifecycle of Open, In Review, and Remediated.

**FR7: Task and Workflow Management**
The system must allow compliance officers to create tasks for relevant departments with task assignment to specific users, deadline setting, optional linking to related alerts, and progress tracking through a status lifecycle of Pending, In Progress, and Completed. Tasks with deadlines within 3 days or past due must be visually highlighted.

**FR8: Historical Archive and Audit Trail**
The database must maintain a fully searchable archive of every regulatory change detected. The system must record all actions taken by GLDB staff in an audit_logs table with user attribution, action type, target table, target identifier, description, and timestamp. The audit trail must also capture all LLM interactions including the input prompt, output response, target regulation/policy, and processing timestamp. Compliance officers must be able to filter audit logs by user, action type, target table, and date range.

**FR9: Reporting and Dashboards**
The system must provide a professional, multi-view dashboard with sidebar navigation across 10 views. The Reports view must display regulatory changes summarized by category in a table, alert trends over time in a Chart.js line chart, severity distribution in a pie chart, impact distribution in a doughnut chart, task status in a bar chart, and compliance status indicators with a progress bar.

**FR10: PII Detection and Filtering**
The system must implement a PII (Personal Identification Information) detection filter that scans all text content before it is sent to the LLM or stored in the database. The filter must detect Singapore NRIC/FIN numbers (pattern: [STFGM]\d{7}[A-Z]), phone numbers, email addresses, physical addresses, and personal names. When PII is detected, the system must block the content from being transmitted to the LLM, log the detection event in the audit trail, and return an appropriate error message to the user. This ensures compliance with PDPA (Personal Data Protection Act) requirements and prevents sensitive data leakage to third-party AI services.

**FR11: LLM Interaction Audit Logging**
The system must log every interaction with the LLM (OpenAI API) in the audit trail for full traceability. Each log entry must record: the timestamp of the call, the input prompt sent to the LLM (with any PII-filtered content noted), the full response received from the LLM, the regulation or policy being analyzed, the resulting impact score or gap assessment, and the processing duration. This audit trail must be queryable through the existing audit log interface and satisfies MAS requirements for explainability and accountability in AI-assisted decision-making.

**Business Rules**

BR1 (Alert Categorization): All incoming regulatory alerts must be strictly categorized into one of three severity levels: Immediate Action Required, Review Recommended, or Informational.

BR2 (Audit Immutability): The audit_logs table must act as an append-only ledger. Past compliance actions and historical regulation versions cannot be overwritten or deleted.

BR3 (Compliance Gap Identification): New regulatory requirements must be systematically compared against GLDB's existing internal policies to highlight outdated, missing, or non-compliant areas.

BR4 (Duplicate Prevention): The system must not insert duplicate regulations. Before inserting, the system must check for an existing record with the same title and source.

BR5 (Impact-to-Severity Mapping): Critical and High impact scores must generate Immediate Action Required alerts. Medium impact must generate Review Recommended alerts. Low impact must generate Informational alerts.

BR6 (Task Deadline Escalation): Tasks with deadlines within 3 calendar days or past due must be visually flagged as urgent.

BR7 (Regulatory Source Resilience): If a live regulatory source is unreachable, the system must gracefully fall back to cached reference data and continue processing remaining sources.

BR8 (Alert Status Validation): Alert status updates must only accept Unread, Read, or Dismissed. Task status must only accept Pending, In Progress, or Completed. Gap status must only accept Open, In Review, or Remediated.

BR9 (Scheduled Scanning Interval): The automated feed integration must execute on a biweekly schedule and also run immediately upon system startup.

BR10 (PII Guardrails): No personally identifiable information (NRIC numbers, personal names, phone numbers, physical addresses) shall be transmitted to external LLM services or stored in regulation content fields. The system must scan and block PII before any LLM API call.

BR11 (LLM Traceability): Every LLM API call must be recorded in the audit_logs table with full input/output content, enabling compliance officers and auditors to review AI-assisted decisions at any time.

---

### 1.3 Project Plan

**Development Methodology:** Agile/Scrum with 3 sprints across 3 weeks

**Sprint Schedule:**

| Sprint | Duration | Focus | Story Points | Team Hours |
|--------|----------|-------|-------------|------------|
| Sprint 1 | Week 3 (Wed-Fri) to Week 4 (Mon-Tue) — 5 days | Backend: All API endpoints, feed integrator, database | 24 | 47 |
| Sprint 2 | Week 4 (Wed-Fri) to Week 5 (Mon) — 4 days | Frontend: All 10 dashboard views, charts, UI | 28 | 41 |
| Sprint 3 | Week 5 (Tue-Fri) — 4 days | Should Have/Nice to Have features, testing, bug fixes, demo prep | 11 | 56 |

**Team Allocation:**

| Team Member | Role | Modules Owned | Total Hours |
|-------------|------|---------------|-------------|
| Min Thu | Main Developer | Modules 1, 2 (Feed Integration, Change Detection) + project setup | 42 |
| Eaint | Alerts and Audit | Modules 3, 4 (Impact Assessment, Alerts) + login | 38 |
| Kay | Reports and Tasks | Modules 7, 9 (Tasks, Reporting) | 38 |
| Hsu | Knowledge Base and Gaps | Modules 5, 6 (Knowledge Base, Gap Analysis) | 30 |

**Overall Timeline:**

| Week | Activity | Deliverable |
|------|----------|-------------|
| Week 2 | Requirements, business analysis, project planning | Sections 1, 2, 3 of report |
| Week 3 | System architecture design + Sprint 1 begins | Section 4.1 |
| Week 4 | Sprint 1 ends, Sprint 2 begins | Section 4.2 (backend) |
| Week 5 | Sprint 2 ends, Sprint 3 (testing + polish) | Section 4.2 (frontend), Section 5 |
| Week 6-7 | Mid-term evaluation, documentation | Sections 6, 7 |

**Sprint Outcomes:**

| Sprint | Planned | Completed | Notes |
|--------|---------|-----------|-------|
| Sprint 1 | All backend API endpoints, feed integrator, database schema | 25+ endpoints, feed integrator (7 sources + MAS API), 9-table schema with seed data, audit middleware | All planned items delivered. 80+ regulations ingested on first run. |
| Sprint 2 | All 10 frontend dashboard views, charts, UI | 10 sidebar views, login overlay, Chart.js visualizations (pie, bar, doughnut, line), dark mode, pagination, CSV export, print report | All planned items delivered. Minor CSS adjustments carried to Sprint 3. |
| Sprint 3 | Should Have/Nice to Have features, testing, bug fixes, demo prep | Dark mode persistence, responsive sidebar, toast notifications, impact filtering, deadline highlighting, comprehensive testing (32 test cases passed) | All Must Have and most Should Have features completed. LLM integration and PII guardrails deferred to post-sprint phase per industry partner phased approach. |

---

## 2. Business Analysis

### 2.1 Business Issues

**Current Business Situation**

Greenlink Digital Bank (GLDB) operates as an inaugural holder of the Digital Wholesale Bank (DWB) license issued by the Monetary Authority of Singapore (MAS), and is purpose-built to serve the Micro, Small, and Medium Enterprise (MSME) segment and the broader supply chain ecosystem. GLDB's core value proposition is "Supply Chain Finance 2.0," which heavily relies on the "Speed of Execution" to provide near-instantaneous financing for MSME invoices. To maintain this agility, GLDB utilizes a cloud-native, API-first architecture designed for rapid integration with B2B marketplaces and logistics platforms. As a primary facilitator for businesses operating in the China-Singapore corridor, GLDB must continuously navigate and adhere to a complex landscape of cross-border trade laws, green finance (ESG) mandates, and evolving regulations from authorities such as MAS, FATF, FinCEN, and the ECB.

**The Difficulties and Business Issues to Solve**

The primary business issue is that financial institutions face increasing challenges in keeping up with these rapidly evolving regulatory requirements, largely because the manual tracking of these regulatory changes is highly time-consuming and prone to oversight. For GLDB, these manual bottlenecks present a critical threat to their entire operational model. Relying on slow, manual compliance checks and updates leads to delays in internal processes, which directly contradicts their promise of near-instantaneous financing and fast MSME onboarding.

Furthermore, as a DWB license holder, GLDB operates under very strict regulatory guardrails, such as being restricted from taking retail deposits and facing limitations on certain lending activities compared to full banks. Any human oversight in tracking these complex MAS updates or high-impact changes could result in immediate risk or severe penalties. Ultimately, the business issue we are trying to solve is the dangerous bottleneck created by manual regulatory monitoring, which threatens GLDB's competitive advantage in execution speed and risks non-compliance with strict digital banking regulations.

### 2.2 Market Analysis

**Size of Business and Market Segment**

The global RegTech market was valued at USD 15.80 billion in 2024 and is projected to reach USD 85.92 billion by 2032, representing a CAGR of 23.6% (Fortune Business Insights). Singapore hosts 354,600 MSMEs representing 99.6% of all enterprises and contributing 47.3% to GDP (Department of Statistics Singapore, 2024). GLDB is one of 5 Digital Bank license holders in Singapore (3 Digital Full Banks: GXS Bank, MariBank, Trust Bank; 2 Digital Wholesale Banks: ANEXT Bank, Green Link Digital Bank). Singapore ranks 4th globally in the Global Financial Centres Index (GFCI 39, Z/Yen Group, 2026).

**Competitive Analysis**

| Solution | Type | Strengths | Weaknesses |
|----------|------|-----------|------------|
| Manual Compliance Teams | In-house | Deep institutional knowledge | Slow, expensive, error-prone |
| Thomson Reuters Regulatory Intelligence | Commercial SaaS | Comprehensive global coverage | Expensive enterprise pricing |
| Wolters Kluwer OneSumX | Commercial SaaS | End-to-end regulatory reporting | High implementation cost |
| Our System (GLDB POC) | Custom-built | Tailored to GLDB's exact sources, LLM-powered analysis, zero licensing cost, API-first | POC stage, expanding to full coverage |

### 2.3 Business Solutions

**Process Flow**

The current manual compliance process at GLDB involves compliance officers manually visiting regulatory websites, reading through documents, identifying changes, and updating internal procedures. This process is reactive, slow, and prone to human error.

Our automated system transforms this into a proactive, real-time pipeline:

1. **Automated Ingestion:** The feedIntegrator.js service scrapes 7 regulatory authority websites and calls the MAS API every 14 days (and on server startup), automatically retrieving new regulatory data.
2. **Change Detection:** The system compares scraped regulation versions against stored versions, recording any changes with semantic difference descriptions.
3. **Impact Assessment:** Each change is automatically analyzed using LLM (OpenAI GPT) to determine its impact on GLDB's operations, scoring it as Critical/High/Medium/Low based on semantic understanding of the regulatory text. A keyword-based fallback is used when the LLM is unavailable.
4. **Alert Generation:** Alerts are auto-created with severity levels, appearing immediately on the compliance officer's dashboard.
5. **Task Assignment:** Compliance officers create and assign tasks to team members with deadlines, tracking progress through to completion.
6. **Gap Analysis:** Officers compare new regulations against internal policies, flagging gaps for remediation.
7. **Audit Trail:** Every action is logged automatically, providing a searchable archive for regulatory inspections.

**How IT Helps**

The IT solution eliminates the manual bottleneck by automating the entire regulatory monitoring lifecycle. Instead of compliance officers spending hours manually checking websites, the system does it automatically and presents only actionable intelligence. This reduces response time from days to seconds, ensures no regulatory change is missed, and provides audit-ready documentation that satisfies MAS inspection requirements.

---

## 3. System Design and Implementation

### 3.1 System Architecture

The system follows a strict API-First, Decoupled Architecture with three independent layers:

**Use Case Diagram:**

```
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Compliance Officer" as CO
actor "Internal Auditor" as IA
actor "Admin" as AD
actor "node-cron Scheduler" as CRON
actor "Regulatory Websites" as RW
actor "OpenAI LLM" as LLM

rectangle "Automated Regulatory Monitoring System" {
  usecase "Login / Authenticate" as UC1
  usecase "View Alerts Dashboard" as UC2
  usecase "Filter Alerts by Severity/Status" as UC3
  usecase "Update Alert Status" as UC4
  usecase "View Regulations Knowledge Base" as UC5
  usecase "Add/Edit Regulations" as UC6
  usecase "View Regulation Changes" as UC7
  usecase "View Impact Assessment" as UC8
  usecase "Create/Manage Tasks" as UC9
  usecase "Identify Compliance Gaps" as UC10
  usecase "View/Manage Internal Policies" as UC11
  usecase "View Audit Trail" as UC12
  usecase "Generate Reports" as UC13
  usecase "Export CSV" as UC14
  usecase "Print Compliance Report" as UC15
  usecase "Toggle Dark Mode" as UC16
  usecase "Scrape Regulatory Sources" as UC17
  usecase "Detect Regulation Changes" as UC18
  usecase "Assess Impact (LLM)" as UC19
  usecase "Generate Alerts" as UC20
  usecase "Filter PII" as UC21
  usecase "Log LLM Interactions" as UC22
  usecase "Compare Regulations vs Policies (LLM)" as UC23
  usecase "Manage Users" as UC24
  usecase "Manage Regulatory Sources" as UC25
}

CO --> UC1
CO --> UC2
CO --> UC3
CO --> UC4
CO --> UC5
CO --> UC6
CO --> UC7
CO --> UC8
CO --> UC9
CO --> UC10
CO --> UC11
CO --> UC12
CO --> UC13
CO --> UC14
CO --> UC15
CO --> UC16

IA --> UC1
IA --> UC12
IA --> UC13

AD --> UC1
AD --> UC24
AD --> UC25
AD --> UC12

CRON --> UC17
CRON --> UC18
UC17 --> RW
UC18 --> UC19
UC19 --> LLM
UC19 --> UC21
UC19 --> UC20
UC19 --> UC22
UC23 --> LLM
UC23 --> UC21
UC10 --> UC23
@enduml
```

**Architecture Diagram:**

```
Browser (index.html + script.js + styles.css)
    |
    | fetch() HTTP requests
    v
Express REST API (server.js + routes/)
    |
    | mysql2 pool queries
    v
MySQL Database (9 tables on Azure)
    ^
    | automated inserts
Feed Integrator (services/feedIntegrator.js)
    ^
    | axios + cheerio
External Regulatory Websites (7 sources + MAS API)
```

**Backend Layer:** Node.js/Express server exposing 25+ RESTful API endpoints returning raw JSON. Routes are organized into 9 separate modules under the routes/ directory for clean separation of concerns. Authentication uses bcryptjs for password hashing. A shared audit logging middleware automatically records user actions.

**Frontend Layer:** Completely separate application in the frontend/ directory built with plain HTML, Bootstrap 5 CSS, and vanilla JavaScript. Communicates with the backend exclusively through fetch() HTTP requests. Uses Chart.js (loaded via CDN) for data visualization. No frontend frameworks or build tools.

**Automation Layer:** The feedIntegrator.js background service runs inside the Node.js process, triggered by node-cron on a biweekly schedule. It scrapes 7 regulatory websites in parallel using axios and cheerio, calls the MAS Official API, performs duplicate detection, LLM-powered impact assessment (with keyword fallback), and auto-generates alerts and change records. All LLM interactions are logged in the audit trail for traceability.

**Database:** MySQL with 9 normalized tables (users, regulatory_sources, regulations, regulation_changes, alerts, internal_policies, compliance_gaps, tasks, audit_logs) hosted on Azure (dft-fyp.mysql.database.azure.com). All tables use foreign key constraints for referential integrity.

**Technology Stack:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express.js | RESTful API routing |
| Database | MySQL + mysql2 | Persistent storage with connection pooling |
| Authentication | bcryptjs | Password hashing |
| Scraping | axios + cheerio | HTTP requests + HTML parsing |
| Scheduling | node-cron | Automated biweekly feed integration |
| Configuration | dotenv | Externalized credentials and URLs |
| AI/LLM | OpenAI API | Impact assessment, regulatory analysis, gap comparison |
| Vector DB | Chroma | Semantic vector search for RAG pipeline |
| Frontend | HTML + Bootstrap 5 + Vanilla JS | Decoupled dashboard UI |
| Visualization | Chart.js (CDN) | Pie, bar, doughnut, and line charts |

### 3.2 Detailed System Design

**Entity Relationship Diagram**

The database consists of 9 tables with the following relationships:

- regulatory_sources (1) → (many) regulations
- regulations (1) → (many) regulation_changes
- regulations (1) → (many) alerts
- regulation_changes (1) → (many) alerts
- regulations (1) → (many) compliance_gaps
- internal_policies (1) → (many) compliance_gaps
- alerts (1) → (many) tasks
- users (1) → (many) tasks
- users (1) → (many) audit_logs

**API Endpoint Design (25+ endpoints):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | Authentication with bcrypt |
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

**File Structure:**

```
server.js                    # Express app entry point (route mounting)
db.js                        # MySQL connection pool
schema.sql                   # Database schema (9 tables) + seed data
.env                         # Environment variables
routes/
  auth.js                    # Login + users
  alerts.js                  # Alert CRUD
  dashboard.js               # Summary, categories, trends
  regulations.js             # Regulation CRUD (paginated)
  changes.js                 # Regulation changes
  tasks.js                   # Task CRUD
  gaps.js                    # Compliance gap CRUD
  sources.js                 # Regulatory sources
  policies.js                # Internal policies CRUD
  audit.js                   # Audit logs (filtered)
middleware/
  auditLog.js                # Shared audit logging helper
services/
  feedIntegrator.js           # Automated scraper + MAS API
frontend/
  index.html                 # Dashboard UI (10 views, login)
  styles.css                 # All custom CSS (dark mode, responsive)
  script.js                  # All frontend logic
```

**Regulatory Sources:**

| Source | Method | Scope |
|--------|--------|-------|
| MAS | Web Scraping + API | Singapore |
| FATF | Web Scraping | Global |
| FinCEN | Web Scraping | US |
| ECB | Web Scraping | Europe |
| FCA | Web Scraping | UK |
| BIS | Web Scraping | Global |
| HKMA | Web Scraping | Asia |

**Sequence Diagram — Automated Feed Integration Pipeline:**

```
@startuml
participant "node-cron\nScheduler" as CRON
participant "feedIntegrator.js" as FI
participant "Regulatory\nWebsite (MAS)" as WEB
participant "PII Filter" as PII
participant "OpenAI LLM" as LLM
participant "MySQL Database" as DB
participant "Audit Logger" as AUDIT

CRON -> FI: trigger (every 14 days / startup)
FI -> WEB: axios GET (scrape HTML)
WEB --> FI: HTML response
FI -> FI: cheerio parse (extract title, content, category)
FI -> DB: SELECT (check for duplicate by title + source)
alt New regulation
  FI -> PII: scan content for PII
  PII --> FI: content clean (no PII detected)
  FI -> LLM: POST /chat/completions (analyze impact)
  LLM --> FI: impact score (Critical/High/Medium/Low)
  FI -> AUDIT: log LLM call (input, output, timestamp)
  FI -> DB: INSERT INTO regulations
  FI -> DB: INSERT INTO regulation_changes
  FI -> DB: INSERT INTO alerts (severity mapped from impact)
else Existing with higher version
  FI -> DB: UPDATE regulations (new version)
  FI -> PII: scan content for PII
  PII --> FI: content clean
  FI -> LLM: POST /chat/completions (analyze impact of change)
  LLM --> FI: impact score
  FI -> AUDIT: log LLM call
  FI -> DB: INSERT INTO regulation_changes (version diff)
  FI -> DB: INSERT INTO alerts
else Duplicate (same version)
  FI -> FI: skip (log "duplicate")
end
@enduml
```

**Sequence Diagram — LLM-Powered Gap Analysis:**

```
@startuml
actor "Compliance Officer" as CO
participant "Frontend\nDashboard" as FE
participant "Express API\n(routes/gaps.js)" as API
participant "PII Filter" as PII
participant "OpenAI LLM" as LLM
participant "MySQL Database" as DB
participant "Audit Logger" as AUDIT

CO -> FE: Click "Analyze Gap" (select regulation + policy)
FE -> API: POST /api/compliance-gaps/analyze {reg_id, policy_id}
API -> DB: SELECT regulation content WHERE reg_id
API -> DB: SELECT policy description WHERE policy_id
API -> PII: scan regulation + policy text
alt PII detected
  PII --> API: BLOCKED (PII found)
  API --> FE: 400 {error: "PII detected, content blocked"}
  FE --> CO: Error toast notification
else No PII
  PII --> API: content clean
  API -> LLM: POST /chat/completions\n("Compare this regulation against this policy.\nIdentify compliance gaps.")
  LLM --> API: gap analysis response (gaps identified, severity, recommendations)
  API -> AUDIT: log LLM call (input, output, reg_id, policy_id, timestamp)
  API -> DB: INSERT INTO compliance_gaps (auto-generated gaps)
  API --> FE: 201 {gaps: [...], llm_analysis: "..."}
  FE --> CO: Display gaps with LLM recommendations
end
@enduml
```

---

## 4. System Testing

**Test Strategy**

System testing was conducted during Sprint 3 (Week 5) across four categories:

**4.1 CRUD Operation Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Create a new task with title, assignee, and deadline | Task appears in task list | Task created and displayed | Pass |
| Update alert status from Unread to Read | Status updates, summary cards refresh | Status updated correctly | Pass |
| Delete a task after confirmation | Task removed from database and list | Task deleted successfully | Pass |
| Create a compliance gap linking regulation to policy | Gap appears in gaps table | Gap created with correct links | Pass |
| Add a new regulatory source | Source appears in sources table | Source added successfully | Pass |
| Edit an existing regulation | Updated fields reflected in table | Regulation updated correctly | Pass |
| Add a new internal policy | Policy appears in policies table | Policy created successfully | Pass |
| Update gap status from Open to Remediated | Status badge changes color | Status updated correctly | Pass |

**4.2 Feed Integrator Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Server startup triggers feed integration | All 7 sources scraped, data inserted | 80+ regulations inserted on first run | Pass |
| Duplicate regulation detected | Skipped with log message | "Skipping duplicate" logged correctly | Pass |
| Source unreachable (403/404) | Fallback data used, no crash | Fallback activated for FCA and BIS | Pass |
| MAS API timeout | Pipeline continues with other sources | 0 API items, scraping continued | Pass |
| Second run with no new data | All items skipped as duplicates | 0 new insertions, all skipped | Pass |

**4.3 Authentication Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Login with valid credentials | Dashboard loads, user badge shown | Login successful | Pass |
| Login with wrong password | Error message displayed | "Invalid email or password" shown | Pass |
| Login with non-existent email | Error message displayed | "Invalid email or password" shown | Pass |
| Logout | Login overlay reappears | Logged out successfully | Pass |

**4.4 UI/UX Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Dark mode toggle | All views switch to dark theme | Dark mode applied correctly | Pass |
| Pagination on tables with 10+ items | Page controls appear, 10 items per page | Pagination working | Pass |
| Impact filter (Critical/High/Medium/Low) | Table filters to selected level | Filtering works correctly | Pass |
| Print report generation | Formatted report opens in print dialog | Report generated with all 5 sections | Pass |
| CSV export | File downloads with alert data | CSV downloaded successfully | Pass |
| Responsive sidebar on small screen | Sidebar collapses to icons | Responsive behavior correct | Pass |

---

## 5. User and Technical Documentation

### 5.1 User Documentation/Guide/Manual

**Getting Started**

1. Open the dashboard in your browser by navigating to frontend/index.html
2. Log in with your credentials (e.g., officer@gldb.com / 123456)
3. The Alerts view loads by default showing all regulatory alerts with severity badges

**Dashboard Navigation**

The left sidebar provides access to 10 views:
- **Alerts** — View, filter, and manage regulatory alerts by severity and status
- **Reports** — View charts, category breakdowns, and print compliance reports
- **Tasks** — Create, assign, and track compliance tasks with deadlines
- **Gaps** — Identify and manage compliance gaps between regulations and policies
- **Sources** — View and add regulatory authority sources
- **Regulations** — Browse, search, add, and edit the regulatory knowledge base
- **Changes** — View detected regulation version changes with impact scores
- **Impact** — View impact assessment dashboard with severity cards and filtering
- **Policies** — View and manage internal bank policies
- **Audit Trail** — Search and filter the complete audit log of all system actions

**Key Features**
- Click the moon/sun icon in the header to toggle dark mode
- Use the Export CSV button on the Alerts view to download alert data
- Click Print Report on the Reports view to generate a formatted compliance report
- All tables support pagination (10 items per page) with page navigation controls

### 5.2 Technical Documentation (Installation Guide)

**Prerequisites:**
- Node.js v18 or higher
- MySQL v8 or higher (or access to the shared Azure database)
- Git

**Installation Steps:**

1. Clone the repository:
   ```
   git clone https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System.git
   ```
2. Navigate to the project folder:
   ```
   cd Automated-Regulatory-and-Compliance-Management-System
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Rename .env.example to .env and fill in the database credentials
5. Run schema.sql in MySQL Workbench against the target database
6. Start the server:
   ```
   npm start
   ```
7. Open frontend/index.html in a browser

**Project Structure:**
- server.js — Express app entry point
- db.js — MySQL connection pool
- routes/ — 9 API route modules
- middleware/ — Shared audit logging
- services/ — Feed integrator (scraping + automation)
- frontend/ — Decoupled HTML/CSS/JS dashboard

### 5.3 Generative AI Usage Declaration

| Generative AI Tool Used | How the Output Was Used |
|------------------------|------------------------|
| Kiro (AI-powered IDE) | Used for code generation, debugging, and refactoring of Node.js backend routes, Express server setup, MySQL schema design, frontend JavaScript logic, CSS styling, and feedIntegrator.js scraping service. All generated code was reviewed, tested, and modified by the team. |
| Kiro (AI-powered IDE) | Used for generating project documentation including product backlog user stories, sprint planning, functional requirements, business rules, system architecture descriptions, and this report template. All content was reviewed and adapted by the team. |
| Gemini AI | Used for researching and verifying market analysis statistics (RegTech market size, MSME demographics, digital bank license information, compliance cost data). All statistics were cross-referenced with original sources. |

### 5.4 Git Repository

**Repository URL:** https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System

**Branch Strategy:** Single main branch for this prototype phase.

**Commit History:** All code changes are tracked with descriptive commit messages.

---

## 6. Conclusions

The Automated Regulatory Monitoring and Compliance Management System successfully addresses the core business problem of manual regulatory tracking at Greenlink Digital Bank. The system automates the entire compliance monitoring lifecycle — from data ingestion through 7 international regulatory sources, to change detection, impact assessment, alert generation, and compliance workflow management.

Key achievements:
- Built a fully functional 9-module compliance platform with 25+ REST API endpoints
- Implemented real-time web scraping from 7 regulatory authorities (MAS, FATF, FinCEN, ECB, FCA, BIS, HKMA) plus the MAS Official API
- Developed a professional 10-view dashboard with login authentication, dark mode, pagination, Chart.js visualizations, CSV export, and print-friendly reports
- Achieved clean code separation with modular route files, shared middleware, and externalized configuration
- Deployed the database to Azure for team collaboration

The system demonstrates that automated compliance monitoring is not only technically feasible for a Digital Wholesale Bank but is an operational necessity. By replacing manual regulatory tracking with an automated pipeline, GLDB can maintain its competitive advantage in execution speed while ensuring continuous compliance with MAS and international regulatory requirements.

**Future Enhancements:**
- Role-based access control (Admin, Compliance Officer, Internal Auditor)
- AI-powered impact assessment using OpenAI GPT for deeper semantic analysis of regulatory text
- LLM-powered compliance gap analysis comparing regulations against internal PMPs
- PII detection and filtering guardrails before LLM processing
- LLM usage audit logging (recording all prompts, responses, and timestamps for traceability)
- SharePoint integration for automatic retrieval of latest internal Policy & Procedure Manuals
- Email/SMS notifications for Critical alerts
- Session management with JWT tokens
- Deployment to a production cloud server
- Expansion from MAS-focused POC to full multi-regulatory coverage (FATF, FinCEN, ECB, FCA, BIS, HKMA)

**Industry Partner Feedback (Meeting with Patrick, GLDB):**
- Confirmed all 9 functional requirements are aligned with GLDB's needs
- Recommended phased approach: start with MAS regulations and sample PMPs before expanding
- Suggested integrating LLMs for analysis and comparison (multiple models may be needed)
- Emphasized PII guardrails and audit trail for LLM usage
- Offered to provide sample PMPs for validation
- Agreed the initial goal is a working POC/pilot, not a complete product
- Suggested future SharePoint integration for automatic knowledge base updates
