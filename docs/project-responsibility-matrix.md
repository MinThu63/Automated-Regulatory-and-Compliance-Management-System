# Project Responsibility Matrix

## Automated Regulatory Monitoring and Compliance Management System
### Team ID: SOI-2026-0039

---

## Team Members

| Member | Role |
|--------|------|
| Min Thu | Lead Developer |
| Eaint | Alerts & Audit Developer |
| Kay | Reports & Tasks Developer |
| Hsu | Knowledge Base & Gaps Developer |

---

## Feature Sets

| Feature Set | Modules Covered | Description |
|-------------|----------------|-------------|
| Feature Set A | Modules 1, 2 (Feed Integration, Change Detection) | Automated scraping of 7 regulatory sources, MAS API integration, duplicate detection, version comparison, biweekly scheduling |
| Feature Set B | Modules 3, 4 (Impact Assessment, Alerts & Notifications) | LLM-powered impact scoring, keyword fallback, PII filtering, severity-categorized alert generation, alert status management |
| Feature Set C | Modules 5, 6, 8 (Knowledge Base, Gap Analysis, Audit Trail) | Regulations/policies CRUD, LLM-powered regulation-vs-policy comparison, audit logging, LLM interaction logging |
| Feature Set D | Modules 7, 9 (Task Management, Reporting & Dashboards) | Task assignment/tracking, deadline escalation, Chart.js visualizations, CSV export, print reports, dark mode |

---

## Project Responsibility Matrix

| Project Phase | Feature Set A (Feed & Changes) | Feature Set B (Impact & Alerts) | Feature Set C (Knowledge Base, Gaps & Audit) | Feature Set D (Tasks & Reports) |
|---------------|-------------------------------|--------------------------------|---------------------------------------------|-------------------------------|
| **Analysis** | Min Thu | Eaint | Hsu | Kay |
| **Design** | Min Thu | Eaint | Hsu | Kay |
| **Development** | Min Thu | Eaint | Hsu | Kay |
| **Implement** | Min Thu | Eaint | Hsu | Kay |
| **Test** | Min Thu | Eaint | Hsu | Kay |
| **Documentation** | Min Thu | Eaint | Hsu | Kay |
| **Presentation** | Min Thu | Eaint | Hsu | Kay |

---

## Cross-Involvement (Every member involved in all phases)

While each member owns their feature set end-to-end, all members participate across phases:

| Activity | All Members Involved |
|----------|---------------------|
| Requirements gathering & analysis | All 4 members attend client meetings, contribute to FR definitions |
| System design review | All 4 members review architecture, ER diagram, API design |
| Code review | Each member reviews at least 1 other member's pull requests |
| Integration testing | All 4 members test cross-module interactions (e.g., feed → alerts → tasks) |
| Documentation | All 4 members contribute to C300 report sections |
| Presentation & demo | All 4 members present their respective modules during demo |

---

## Workload Distribution

| Member | Estimated Hours | Story Points | Modules |
|--------|----------------|--------------|---------|
| Min Thu | 42 | 16 | 1, 2 (Feed Integration, Change Detection) + project setup |
| Eaint | 38 | 14 | 3, 4 (Impact Assessment, Alerts) + login + PII filter |
| Kay | 38 | 14 | 7, 9 (Tasks, Reporting) + frontend charts |
| Hsu | 30 | 12 | 5, 6, 8 (Knowledge Base, Gap Analysis, Audit Trail) |

---

## Sprint Allocation per Feature Set

### Sprint 1 (Backend — 5 days)

| Feature Set | Tasks |
|-------------|-------|
| A (Min Thu) | feedIntegrator.js (7 scrapers + MAS API), db.js, schema.sql, server.js setup |
| B (Eaint) | routes/alerts.js, routes/dashboard.js (summary, categories, trends), login endpoint |
| C (Hsu) | routes/regulations.js, routes/gaps.js, routes/policies.js, routes/audit.js |
| D (Kay) | routes/tasks.js, routes/sources.js, routes/changes.js |

### Sprint 2 (Frontend — 4 days)

| Feature Set | Tasks |
|-------------|-------|
| A (Min Thu) | Sources view, Changes view, feed status display |
| B (Eaint) | Alerts view (summary cards, filtering, status update), Impact view |
| C (Hsu) | Regulations view (CRUD, pagination, search), Policies view, Gaps view, Audit Trail view |
| D (Kay) | Tasks view, Reports view (charts, print, CSV export), sidebar navigation |

### Sprint 3 (Testing & Polish — 4 days)

| Feature Set | Tasks |
|-------------|-------|
| A (Min Thu) | Feed integrator testing, fallback data verification, integration testing |
| B (Eaint) | Alert CRUD testing, impact filter testing, LLM integration prep |
| C (Hsu) | Gap analysis testing, audit log testing, pagination testing |
| D (Kay) | Task CRUD testing, chart rendering, dark mode, responsive testing |

---

## Semester Break Utilization Plan

| Period | Activity | Owner |
|--------|----------|-------|
| Break Week 1 | LLM (OpenAI) integration for impact assessment | Min Thu + Eaint |
| Break Week 1 | PII detection filter implementation | Eaint |
| Break Week 2 | LLM-powered gap analysis (regulation vs policy comparison) | Hsu + Min Thu |
| Break Week 2 | LLM audit logging implementation | Hsu |
| Break Week 3 | MAS-focused POC narrowing and demo preparation | All |
| Break Week 3 | Upload Patrick's sample PMPs and validate gap analysis | All |

---

## Notes

- Workload is distributed to ensure even contribution across all 4 members
- Every member participates in all 7 project phases (Analysis → Presentation)
- Feature ownership ensures accountability while cross-involvement ensures knowledge sharing
- Semester break is utilized for Phase 1 enhancements (LLM, PII, MAS focus) per industry partner feedback
