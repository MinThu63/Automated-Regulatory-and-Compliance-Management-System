-- Create database if it doesn't exist, then use it
CREATE DATABASE IF NOT EXISTS `SOI-2026-0039-MinThu`;
USE `SOI-2026-0039-MinThu`;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('Compliance Officer', 'Internal Auditor', 'Admin') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. regulatory_sources
CREATE TABLE IF NOT EXISTS regulatory_sources (
    source_id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. regulations
CREATE TABLE IF NOT EXISTS regulations (
    reg_id INT AUTO_INCREMENT PRIMARY KEY,
    source_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    version DECIMAL(5,2) DEFAULT 1.0,
    published_date DATETIME,
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES regulatory_sources(source_id) ON DELETE CASCADE
);

-- 4. regulation_changes
CREATE TABLE IF NOT EXISTS regulation_changes (
    change_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_id INT NOT NULL,
    previous_version DECIMAL(5,2) NOT NULL,
    new_version DECIMAL(5,2) NOT NULL,
    semantic_differences TEXT NOT NULL,
    impact_score ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_id) REFERENCES regulations(reg_id) ON DELETE CASCADE
);

-- 5. alerts
CREATE TABLE IF NOT EXISTS alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_id INT NOT NULL,
    change_id INT,
    severity_level ENUM('Immediate Action Required', 'Review Recommended', 'Informational') NOT NULL,
    status ENUM('Unread', 'Read', 'Dismissed') DEFAULT 'Unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_id) REFERENCES regulations(reg_id) ON DELETE CASCADE,
    FOREIGN KEY (change_id) REFERENCES regulation_changes(change_id) ON DELETE SET NULL
);

-- 6. internal_policies
CREATE TABLE IF NOT EXISTS internal_policies (
    policy_id INT AUTO_INCREMENT PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. compliance_gaps
CREATE TABLE IF NOT EXISTS compliance_gaps (
    gap_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_id INT NOT NULL,
    policy_id INT NOT NULL,
    gap_description TEXT NOT NULL,
    status ENUM('Open', 'In Review', 'Remediated') DEFAULT 'Open',
    identified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_id) REFERENCES regulations(reg_id) ON DELETE CASCADE,
    FOREIGN KEY (policy_id) REFERENCES internal_policies(policy_id) ON DELETE CASCADE
);

-- 8. tasks
CREATE TABLE IF NOT EXISTS tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT,
    assigned_to INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATETIME NOT NULL,
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 9. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    description TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 10. embeddings (RAG vector store)
CREATE TABLE IF NOT EXISTS embeddings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_type ENUM('regulation', 'policy') NOT NULL,
    source_id INT NOT NULL,
    chunk_index INT NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_chunk (source_type, source_id, chunk_index)
);

-- =============================================
-- Seed Data
-- =============================================

INSERT IGNORE INTO users (username, email, password, role) VALUES 
('Alex Tan', 'officer@gldb.com', '$2b$10$xtJXo9NyK54qbDW88jeisefWGdzzrt9IvqJBY.5DJHceoucS27Dp2', 'Compliance Officer'),
('Sarah Lee', 'auditor@gldb.com', '$2b$10$xtJXo9NyK54qbDW88jeisefWGdzzrt9IvqJBY.5DJHceoucS27Dp2', 'Internal Auditor'),
('Admin User', 'admin@gldb.com', '$2b$10$xtJXo9NyK54qbDW88jeisefWGdzzrt9IvqJBY.5DJHceoucS27Dp2', 'Admin');

INSERT IGNORE INTO regulatory_sources (source_name, base_url) VALUES 
('MAS', 'https://www.mas.gov.sg/regulation');

INSERT IGNORE INTO regulations (source_id, title, category, content, version) VALUES 
(1, 'Notice 626 Prevention of Money Laundering', 'AML', 'Updated CDD rules for cross-border MSME transfers.', 1.1),
(1, 'Environmental Risk Management Guidelines', 'ESG', 'Banks must conduct scenario analysis on environmental risk.', 1.0);

INSERT IGNORE INTO internal_policies (policy_name, description) VALUES 
('GLDB AML/CFT Compliance Policy', 'Automated eKYC and Enhanced Due Diligence (EDD) procedures for MSME onboarding, including AI-driven biometric verification, UBO screening, and shell company detection via third-party identity systems (e.g., Chekk). Mandates senior management approval for high-risk customer relationships.'),
('GLDB KYC Onboarding Policy', 'Standard procedure for verifying MSME identities using digital document acquisition, biometric verification, and cross-referencing against localized internal blacklists and international sanctions lists.'),
('GLDB Transaction Monitoring Policy', 'Continuous monitoring of all transactions using automated systems to detect suspicious activity, trade-based money laundering patterns, and shell company indicators. Includes escalation procedures for flagged transactions.'),
('GLDB Data Privacy and PDPA Policy', 'Compliance with the Singapore Personal Data Protection Act (PDPA) 2012. Enforces consent-based data collection, data minimization for corporate onboarding, and explicit mechanisms for data subject rights including access, correction, and portability of MSME director and UBO personal data.'),
('GLDB Green Finance Framework', 'Criteria and risk assessment procedures for approving green supply chain loans and ESG-aligned financing products. Includes environmental risk scenario analysis requirements aligned with MAS Environmental Risk Management Guidelines.'),
('GLDB Credit and Liquidity Risk Policy', 'Risk management framework for uncollateralized business term loans and supply chain finance products. Covers credit risk assessment, liquidity ratio monitoring, and capital adequacy requirements aligned with Basel III and MAS prudential standards.'),
('GLDB Cybersecurity and TRM Policy', 'Alignment with MAS Technology Risk Management (TRM) Guidelines. Includes Vulnerability Disclosure Policy (VDP) for ethical security researchers, rules of engagement prohibiting DDoS/phishing/social engineering, and incident response procedures.'),
('GLDB Wholesale Banking Operations Policy', 'Compliance with MAS Digital Wholesale Bank (DWB) license conditions. Restricts all banking services, deposit-taking, and loan products exclusively to non-retail customers (SMEs, MSMEs, corporate clients). Enforces minimum paid-up capital of S$100 million and high deposit minimums for individual exceptions.');

INSERT IGNORE INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES 
(1, 1.0, 1.1, 'Added mandatory automated transaction monitoring for jurisdictions classified as high risk.', 'Critical');

INSERT IGNORE INTO alerts (reg_id, change_id, severity_level) VALUES 
(1, 1, 'Immediate Action Required'),
(2, NULL, 'Review Recommended');

INSERT IGNORE INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES 
(1, 1, 'Current KYC policy lacks specific escalation steps for the newly identified high-risk jurisdictions in Notice 626.');

INSERT IGNORE INTO tasks (alert_id, assigned_to, title, description, deadline) VALUES 
(1, 1, 'Update AML Screening Rules', 'Adjust the Node.js screening logic to incorporate the new MAS high-risk jurisdictions.', DATE_ADD(NOW(), INTERVAL 7 DAY));

INSERT IGNORE INTO audit_logs (user_id, action_type, target_table, target_id, description) VALUES 
(1, 'TASK_CREATED', 'tasks', 1, 'Task assigned to Alex Tan for AML rule update.');
