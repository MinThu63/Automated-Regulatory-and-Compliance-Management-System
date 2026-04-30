# Future Feature Ideas

## Automated Regulatory Monitoring and Compliance Management System
## Team ID: SOI-2026-0039

---

## Should Have Features

1. As a compliance officer,
   I want to receive email notifications when a Critical alert is generated,
   so that I am immediately informed of high-risk regulatory changes even when I am not logged into the dashboard.

2. As an administrator,
   I want to control which dashboard views each role can access (Admin sees all, Compliance Officer sees operations, Internal Auditor sees only Audit Trail and Reports),
   so that sensitive compliance data is restricted to authorized personnel based on their job function.

3. As a compliance officer,
   I want the system to automatically log me out after 30 minutes of inactivity,
   so that unauthorized users cannot access the compliance dashboard if I leave my workstation unattended.

4. As a compliance officer,
   I want to see specific field-level validation errors highlighted in red with descriptive messages below each form field,
   so that I can quickly identify and correct input mistakes when creating tasks, gaps, regulations, or policies.

5. As a compliance officer,
   I want delete actions to display a professional Bootstrap confirmation modal instead of a basic browser dialog,
   so that accidental deletions are prevented with a clear and polished user experience.

6. As a compliance officer,
   I want a global search bar in the header that filters across alerts, regulations, and changes simultaneously,
   so that I can quickly find any compliance-related information without navigating to individual views.

7. As a compliance officer,
   I want the system to integrate with communication tools such as Slack, Microsoft Teams, or email,
   so that regulatory alerts and task assignments are delivered directly to the channels my team already uses daily.

8. As a compliance officer,
   I want the system to use JWT (JSON Web Tokens) for session management instead of client-side state,
   so that authentication is secure, stateless, and resistant to session hijacking.

9. As a compliance officer,
   I want to export data from any table view (tasks, gaps, regulations, changes, audit logs) as a CSV file,
   so that I can share compliance data across departments and include it in external reports.

10. As an administrator,
    I want to create, edit, and deactivate user accounts directly from the dashboard,
    so that I can manage team access without needing to modify the database directly.

---

## Nice to Have Features

11. As a compliance officer,
    I want the system to use AI (OpenAI GPT) for impact assessment instead of keyword matching,
    so that the analysis of regulatory changes is more accurate and can understand context and nuance in legal language.

12. As a compliance officer,
    I want to use natural language search (e.g., "show me all AML regulations from MAS that mention penalties"),
    so that I can find relevant regulations without knowing exact titles or categories.

13. As a compliance officer,
    I want the system to automatically generate a summary of each new regulation using AI,
    so that I can quickly understand the key points without reading the full document.

14. As a compliance officer,
    I want the system to automatically suggest which internal policies may be affected when a new regulation is detected,
    so that compliance gap identification is faster and more proactive.

15. As a compliance officer,
    I want to view a real-time notification bell icon in the header showing the count of new unread alerts since my last login,
    so that I am immediately aware of new regulatory activity when I open the dashboard.

16. As a compliance officer,
    I want the dashboard to support multiple languages (English and Mandarin),
    so that GLDB staff operating in the China-Singapore corridor can use the system in their preferred language.

17. As a compliance officer,
    I want to attach files (PDFs, documents) to compliance gaps and tasks,
    so that supporting evidence and reference materials are stored alongside the compliance records.

18. As a compliance officer,
    I want to receive a weekly digest email summarizing all new regulations, changes, and outstanding tasks from the past 7 days,
    so that I have a consolidated overview without needing to log in daily.

19. As an administrator,
    I want to view a system health dashboard showing scraper success/failure rates, API response times, and database connection status,
    so that I can monitor the reliability of the automated feed integration pipeline.

20. As a compliance officer,
    I want the system to be deployed to a cloud server (AWS, Azure, or GCP) with HTTPS,
    so that the dashboard is accessible from any device without running localhost and data is transmitted securely.

21. As a compliance officer,
    I want to add comments or notes to individual alerts, tasks, and compliance gaps,
    so that I can document my review findings and share context with team members.

22. As a compliance officer,
    I want to set up custom alert rules (e.g., always flag regulations containing specific keywords as Critical),
    so that the impact assessment can be tailored to GLDB's specific compliance priorities.

23. As an administrator,
    I want to view an activity log showing which users logged in, what actions they performed, and when,
    so that I can monitor system usage and detect any unusual behavior.

24. As a compliance officer,
    I want the Reports view to allow selecting a custom date range for trend charts and category breakdowns,
    so that I can analyze compliance patterns for specific time periods (monthly, quarterly, yearly).

25. As a compliance officer,
    I want the system to detect and highlight when two different regulatory sources issue conflicting requirements,
    so that I can escalate potential regulatory conflicts to management for resolution.
