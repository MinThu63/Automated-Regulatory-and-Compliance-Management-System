const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const pool = require('../db');

// =============================================
// Source IDs — must match your regulatory_sources table
// source_id 1 = MAS, source_id 2 = FATF
// =============================================

const MAS_SOURCE_ID = 1;
const FATF_SOURCE_ID = 2;
const FINCEN_SOURCE_ID = 3;
const ECB_SOURCE_ID = 4;
const FCA_SOURCE_ID = 5;
const BIS_SOURCE_ID = 6;
const HKMA_SOURCE_ID = 7;

// External URLs from environment variables
const MAS_SCRAPE_URL = process.env.MAS_SCRAPE_URL || 'https://www.mas.gov.sg/regulation/anti-money-laundering';
const MAS_API_URL = process.env.MAS_API_URL || 'https://eservices.mas.gov.sg/api/action/datastore/search.json';
const FATF_SCRAPE_URL = process.env.FATF_SCRAPE_URL || 'https://www.fatf-gafi.org/en/publications.html';
const FINCEN_SCRAPE_URL = process.env.FINCEN_SCRAPE_URL || 'https://www.fincen.gov/news-room';
const ECB_SCRAPE_URL = process.env.ECB_SCRAPE_URL || 'https://www.ecb.europa.eu/press/pubbydate/html/index.en.html';
const FCA_SCRAPE_URL = process.env.FCA_SCRAPE_URL || 'https://www.fca.org.uk/news';
const BIS_SCRAPE_URL = process.env.BIS_SCRAPE_URL || 'https://www.bis.org/list/bcbs/index.htm';
const HKMA_SCRAPE_URL = process.env.HKMA_SCRAPE_URL || 'https://www.hkma.gov.hk/eng/regulatory-resources/regulatory-guides/';

// =============================================
// Database Insertion
// =============================================

async function saveToDatabase(data) {
  var inserted = 0;
  for (var item of data) {
    try {
      // Check if regulation with same title already exists
      var [existing] = await pool.query(
        'SELECT reg_id, version FROM regulations WHERE title = ? AND source_id = ?',
        [item.title, item.source_id]
      );

      if (existing.length > 0) {
        var existingReg = existing[0];
        var existingVersion = parseFloat(existingReg.version) || 1.0;
        var newVersion = parseFloat(item.version) || 1.0;

        // If version is higher, treat as an update (Change Detection - Module 2)
        if (newVersion > existingVersion) {
          // Update the regulation
          await pool.query(
            'UPDATE regulations SET content = ?, version = ?, published_date = ? WHERE reg_id = ?',
            [item.content, newVersion, item.published_date || null, existingReg.reg_id]
          );

          // Create a regulation_changes record (Module 2: Change Detection)
          var impactScore = assessImpact(item);
          await pool.query(
            'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES (?, ?, ?, ?, ?)',
            [existingReg.reg_id, existingVersion, newVersion, 'Updated: ' + item.content.substring(0, 500), impactScore]
          );
          console.log('[ChangeDetection] Version change detected for:', item.title, '(' + existingVersion + ' → ' + newVersion + ')');

          // Get the change_id we just inserted
          var [changeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
          var changeId = changeRows[0].change_id;

          // Create an alert (Module 4: Notification & Alert System)
          var severityLevel = mapImpactToSeverity(impactScore);
          await pool.query(
            'INSERT INTO alerts (reg_id, change_id, severity_level) VALUES (?, ?, ?)',
            [existingReg.reg_id, changeId, severityLevel]
          );
          console.log('[AlertSystem] Alert created:', severityLevel, 'for', item.title);

          inserted++;
        } else {
          console.log('[FeedIntegrator] Skipping duplicate:', item.title);
        }
        continue;
      }

      // New regulation — insert it
      var [result] = await pool.query(
        'INSERT INTO regulations (source_id, title, category, content, version, published_date) VALUES (?, ?, ?, ?, ?, ?)',
        [item.source_id, item.title, item.category, item.content, item.version || 1.0, item.published_date || null]
      );
      var newRegId = result.insertId;
      inserted++;
      console.log('[FeedIntegrator] Inserted:', item.title);

      // Create a change detection record for new regulations (Module 2)
      // Treat new regulation as version 0.0 → current version
      var newRegImpact = assessImpact(item);
      await pool.query(
        'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES (?, ?, ?, ?, ?)',
        [newRegId, 0.0, item.version || 1.0, 'New regulation ingested: ' + item.content.substring(0, 500), newRegImpact]
      );
      console.log('[ChangeDetection] New regulation change record:', newRegImpact, 'for', item.title);

      // Get the change_id
      var [newChangeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
      var newChangeId = newChangeRows[0].change_id;

      // Create an alert with the change_id linked (Module 4)
      var newRegSeverity = mapImpactToSeverity(newRegImpact);
      await pool.query(
        'INSERT INTO alerts (reg_id, change_id, severity_level) VALUES (?, ?, ?)',
        [newRegId, newChangeId, newRegSeverity]
      );
      console.log('[AlertSystem] New regulation alert:', newRegSeverity, 'for', item.title);

    } catch (err) {
      console.error('[FeedIntegrator] DB insert error:', err.message);
    }
  }
  return inserted;
}

// =============================================
// Impact Assessment (Module 3)
// =============================================

function assessImpact(item) {
  // Simple keyword-based impact scoring
  var content = (item.content || '').toLowerCase();
  var title = (item.title || '').toLowerCase();
  var combined = content + ' ' + title;

  if (combined.includes('penalty') || combined.includes('immediate') || combined.includes('mandatory') || combined.includes('enforcement')) {
    return 'Critical';
  }
  if (combined.includes('risk') || combined.includes('compliance') || combined.includes('laundering') || combined.includes('terrorism')) {
    return 'High';
  }
  if (combined.includes('update') || combined.includes('guideline') || combined.includes('review')) {
    return 'Medium';
  }
  return 'Low';
}

function mapImpactToSeverity(impactScore) {
  if (impactScore === 'Critical') return 'Immediate Action Required';
  if (impactScore === 'High') return 'Immediate Action Required';
  if (impactScore === 'Medium') return 'Review Recommended';
  return 'Informational';
}

// =============================================
// Web Scraping: MAS Advisories
// =============================================

async function scrapeMAS() {
  console.log('[FeedIntegrator] Scraping MAS advisories...');
  var results = [];

  try {
    var response = await axios.get(MAS_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);

    // Parse advisory/regulation links from the MAS page
    $('a[href*="/regulation/"]').each(function (i, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');

      // Filter out navigation links and empty titles
      if (title && title.length > 10 && title.length < 300) {
        results.push({
          source_id: MAS_SOURCE_ID,
          title: title.substring(0, 255),
          category: 'AML',
          content: 'Scraped from MAS: ' + (href || '') + ' — ' + title,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
      }
    });

    // If scraping returned nothing (site structure changed), use fallback mock data
    if (results.length === 0) {
      console.log('[FeedIntegrator] MAS scrape returned 0 results, using fallback data...');
      results = getMASFallbackData();
    }

    console.log('[FeedIntegrator] MAS scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] MAS scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback MAS data...');
    results = getMASFallbackData();
  }

  return results;
}

function getMASFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Prevention of Money Laundering and Countering the Financing of Terrorism',
      category: 'AML',
      content: 'Updated requirements for customer due diligence, enhanced monitoring of cross-border transactions, and mandatory reporting of suspicious activities for financial institutions.',
      version: 2.0,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Guidelines on Environmental Risk Management for Banks',
      category: 'ESG',
      content: 'Banks are required to conduct scenario analysis on environmental risk exposures and integrate climate risk into their risk management frameworks.',
      version: 1.1,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Technology Risk Management Guidelines',
      category: 'Technology Risk',
      content: 'Updated guidelines on cybersecurity, IT resilience, and third-party technology risk management for financial institutions regulated by MAS.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// REST API: MAS Official API (Free, no API key required)
// Fetches real macroeconomic and regulatory data from MAS
// =============================================

async function fetchMASAPI() {
  console.log('[FeedIntegrator] Fetching from MAS Official API...');
  var results = [];
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    // MAS Exchange Rate data — real central bank data
    var exchangeRateResponse = await axios.get(MAS_API_URL, {
      params: {
        resource_id: '95932927-c8bc-4e7a-b484-68a66a24edfe',
        limit: 5,
        sort: 'end_of_day desc'
      },
      timeout: 15000
    });

    if (exchangeRateResponse.data && exchangeRateResponse.data.result && exchangeRateResponse.data.result.records) {
      var records = exchangeRateResponse.data.result.records;
      if (records.length > 0) {
        var latestDate = records[0].end_of_day || now;
        results.push({
          source_id: MAS_SOURCE_ID,
          title: 'MAS Official Exchange Rate Data - Daily Spot Rates (' + latestDate + ')',
          category: 'Monetary Policy',
          content: 'Official MAS exchange rate data retrieved via API. Includes USD/SGD, EUR/SGD, GBP/SGD, JPY/SGD spot rates. Data date: ' + latestDate + '. Source: MAS API (resource_id: 95932927-c8bc-4e7a-b484-68a66a24edfe).',
          version: 1.0,
          published_date: now
        });
        console.log('[FeedIntegrator] MAS API - Exchange rate data retrieved for', latestDate);
      }
    }
  } catch (err) {
    console.error('[FeedIntegrator] MAS API exchange rate fetch failed:', err.message);
  }

  try {
    // MAS Interest Rate data — real monetary policy data
    var interestRateResponse = await axios.get(MAS_API_URL, {
      params: {
        resource_id: '9a0bf149-308c-4bd2-832d-76c8e6cb47ed',
        limit: 5,
        sort: 'end_of_day desc'
      },
      timeout: 15000
    });

    if (interestRateResponse.data && interestRateResponse.data.result && interestRateResponse.data.result.records) {
      var intRecords = interestRateResponse.data.result.records;
      if (intRecords.length > 0) {
        var intDate = intRecords[0].end_of_day || now;
        results.push({
          source_id: MAS_SOURCE_ID,
          title: 'MAS Official Interest Rate Data - Domestic Rates (' + intDate + ')',
          category: 'Monetary Policy',
          content: 'Official MAS domestic interest rate data retrieved via API. Includes interbank rates, prime lending rates, and fixed deposit rates. Data date: ' + intDate + '. Source: MAS API (resource_id: 9a0bf149-308c-4bd2-832d-76c8e6cb47ed).',
          version: 1.0,
          published_date: now
        });
        console.log('[FeedIntegrator] MAS API - Interest rate data retrieved for', intDate);
      }
    }
  } catch (err) {
    console.error('[FeedIntegrator] MAS API interest rate fetch failed:', err.message);
  }

  try {
    // MAS Money Supply data — real macroeconomic indicator
    var moneySupplyResponse = await axios.get(MAS_API_URL, {
      params: {
        resource_id: '5f2b18a8-0883-4f98-962c-ab4a0f467634',
        limit: 3,
        sort: 'end_of_month desc'
      },
      timeout: 15000
    });

    if (moneySupplyResponse.data && moneySupplyResponse.data.result && moneySupplyResponse.data.result.records) {
      var msRecords = moneySupplyResponse.data.result.records;
      if (msRecords.length > 0) {
        var msDate = msRecords[0].end_of_month || now;
        results.push({
          source_id: MAS_SOURCE_ID,
          title: 'MAS Money Supply Statistics - M1 and M2 Aggregates (' + msDate + ')',
          category: 'Monetary Policy',
          content: 'Official MAS money supply statistics retrieved via API. Includes M1 (narrow money) and M2 (broad money) aggregates for monetary policy monitoring. Data date: ' + msDate + '. Source: MAS API (resource_id: 5f2b18a8-0883-4f98-962c-ab4a0f467634).',
          version: 1.0,
          published_date: now
        });
        console.log('[FeedIntegrator] MAS API - Money supply data retrieved for', msDate);
      }
    }
  } catch (err) {
    console.error('[FeedIntegrator] MAS API money supply fetch failed:', err.message);
  }

  console.log('[FeedIntegrator] MAS API returned ' + results.length + ' items');
  return results;
}

// =============================================
// Web Scraping: FATF Publications
// =============================================

async function scrapeFATF() {
  console.log('[FeedIntegrator] Scraping FATF publications...');
  var results = [];

  try {
    var response = await axios.get(FATF_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // FATF publications page lists items with titles and descriptions
    $('a[href*="/publications/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href') || '';

      if (title && title.length > 10 && title.length < 300) {
        // Determine category from keywords in title
        var category = 'AML';
        var titleLower = title.toLowerCase();
        if (titleLower.includes('terrorist') || titleLower.includes('terrorism') || titleLower.includes('financing')) {
          category = 'CFT';
        } else if (titleLower.includes('virtual') || titleLower.includes('crypto') || titleLower.includes('digital')) {
          category = 'Digital Assets';
        } else if (titleLower.includes('risk') || titleLower.includes('assessment')) {
          category = 'Risk Assessment';
        } else if (titleLower.includes('beneficial') || titleLower.includes('transparency')) {
          category = 'Transparency';
        }

        results.push({
          source_id: FATF_SOURCE_ID,
          title: title.substring(0, 255),
          category: category,
          content: 'Scraped from FATF: https://www.fatf-gafi.org' + href + ' — ' + title,
          version: 1.0,
          published_date: now
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] FATF scrape returned 0 results, using fallback data...');
      results = getFATFFallbackData();
    }

    console.log('[FeedIntegrator] FATF scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] FATF scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback FATF data...');
    results = getFATFFallbackData();
  }

  return results;
}

function getFATFFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: FATF_SOURCE_ID,
      title: 'FATF Recommendations - International Standards on Combating Money Laundering',
      category: 'AML',
      content: 'The FATF Recommendations set out a comprehensive framework of measures for countries to combat money laundering, terrorist financing, and proliferation financing.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FATF_SOURCE_ID,
      title: 'FATF Guidance on Risk-Based Approach for Virtual Assets and VASPs',
      category: 'Digital Assets',
      content: 'Updated guidance on applying risk-based approach to virtual assets and virtual asset service providers, including compliance obligations for crypto exchanges.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FATF_SOURCE_ID,
      title: 'FATF Mutual Evaluation Report - Effectiveness of AML/CFT Systems',
      category: 'Risk Assessment',
      content: 'Assessment methodology for evaluating the effectiveness of national AML/CFT systems against FATF standards.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FATF_SOURCE_ID,
      title: 'FATF Guidance on Beneficial Ownership and Transparency',
      category: 'Transparency',
      content: 'Guidelines requiring countries to ensure adequate transparency of beneficial ownership of legal persons and arrangements to prevent misuse for money laundering.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FATF_SOURCE_ID,
      title: 'FATF Report on Terrorist Financing Risk Assessment Guidance',
      category: 'CFT',
      content: 'Guidance for countries and financial institutions on identifying and assessing terrorist financing risks at national and institutional levels.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// Web Scraping: FinCEN Advisories (No public API)
// =============================================

async function scrapeFinCEN() {
  console.log('[FeedIntegrator] Scraping FinCEN advisories...');
  var results = [];

  try {
    var response = await axios.get(FINCEN_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    $('a[href*="/news/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href') || '';

      if (title && title.length > 10 && title.length < 300) {
        var category = 'AML';
        var titleLower = title.toLowerCase();
        if (titleLower.includes('sanction') || titleLower.includes('enforcement')) {
          category = 'Enforcement';
        } else if (titleLower.includes('cyber') || titleLower.includes('ransomware')) {
          category = 'Cyber Crime';
        } else if (titleLower.includes('beneficial') || titleLower.includes('ownership')) {
          category = 'Transparency';
        }

        results.push({
          source_id: FINCEN_SOURCE_ID,
          title: title.substring(0, 255),
          category: category,
          content: 'Scraped from FinCEN: https://www.fincen.gov' + href + ' — ' + title,
          version: 1.0,
          published_date: now
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] FinCEN scrape returned 0 results, using fallback data...');
      results = getFinCENFallbackData();
    }

    console.log('[FeedIntegrator] FinCEN scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] FinCEN scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback FinCEN data...');
    results = getFinCENFallbackData();
  }

  return results;
}

function getFinCENFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: FINCEN_SOURCE_ID,
      title: 'FinCEN Advisory on Ransomware and the Use of the Financial System to Facilitate Ransom Payments',
      category: 'Cyber Crime',
      content: 'Advisory to financial institutions on detecting and reporting ransomware-related transactions under the Bank Secrecy Act.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FINCEN_SOURCE_ID,
      title: 'FinCEN Beneficial Ownership Information Reporting Requirements',
      category: 'Transparency',
      content: 'New requirements under the Corporate Transparency Act for reporting beneficial ownership information to FinCEN.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FINCEN_SOURCE_ID,
      title: 'FinCEN Anti-Money Laundering Program Effectiveness Guidance',
      category: 'AML',
      content: 'Guidance on maintaining effective AML programs including risk assessment, customer due diligence, and suspicious activity reporting.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// REST API: ECB Banking Supervision (Free public API)
// =============================================

async function fetchECB() {
  console.log('[FeedIntegrator] Fetching ECB supervisory data via API...');
  var results = [];

  try {
    // ECB provides a public RSS/XML feed for banking supervision press releases
    var response = await axios.get(ECB_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    $('a[href*="/press/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href') || '';

      if (title && title.length > 15 && title.length < 300) {
        var category = 'Monetary Policy';
        var titleLower = title.toLowerCase();
        if (titleLower.includes('supervision') || titleLower.includes('prudential')) {
          category = 'Banking Supervision';
        } else if (titleLower.includes('payment') || titleLower.includes('settlement')) {
          category = 'Payment Systems';
        } else if (titleLower.includes('climate') || titleLower.includes('environment') || titleLower.includes('green')) {
          category = 'ESG';
        } else if (titleLower.includes('digital') || titleLower.includes('crypto') || titleLower.includes('euro')) {
          category = 'Digital Currency';
        }

        results.push({
          source_id: ECB_SOURCE_ID,
          title: title.substring(0, 255),
          category: category,
          content: 'Fetched from ECB: https://www.ecb.europa.eu' + href + ' — ' + title,
          version: 1.0,
          published_date: now
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] ECB fetch returned 0 results, using fallback data...');
      results = getECBFallbackData();
    }

    // Limit to 10 most relevant items
    results = results.slice(0, 10);
    console.log('[FeedIntegrator] ECB fetch found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] ECB fetch failed:', err.message);
    console.log('[FeedIntegrator] Using fallback ECB data...');
    results = getECBFallbackData();
  }

  return results;
}

function getECBFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: ECB_SOURCE_ID,
      title: 'ECB Guide on Climate-Related and Environmental Risks for Banks',
      category: 'ESG',
      content: 'Supervisory expectations for banks on managing climate-related and environmental risks within their risk management frameworks.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: ECB_SOURCE_ID,
      title: 'ECB Supervisory Priorities for Banking Supervision 2025-2027',
      category: 'Banking Supervision',
      content: 'Key priorities including credit risk management, digital transformation governance, and operational resilience for supervised institutions.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: ECB_SOURCE_ID,
      title: 'ECB Digital Euro Regulatory Framework Consultation',
      category: 'Digital Currency',
      content: 'Consultation on the regulatory framework for a digital euro, covering privacy, AML compliance, and interoperability requirements.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// Web Scraping: FCA Warnings and Notices (No free API for notices)
// =============================================

async function scrapeFCA() {
  console.log('[FeedIntegrator] Scraping FCA warnings and notices...');
  var results = [];

  try {
    var response = await axios.get(FCA_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    $('a[href*="/news/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href') || '';

      if (title && title.length > 10 && title.length < 300) {
        var category = 'Consumer Protection';
        var titleLower = title.toLowerCase();
        if (titleLower.includes('aml') || titleLower.includes('money laundering') || titleLower.includes('financial crime')) {
          category = 'AML';
        } else if (titleLower.includes('fine') || titleLower.includes('enforcement') || titleLower.includes('penalty')) {
          category = 'Enforcement';
        } else if (titleLower.includes('crypto') || titleLower.includes('digital')) {
          category = 'Digital Assets';
        } else if (titleLower.includes('climate') || titleLower.includes('sustainability')) {
          category = 'ESG';
        }

        results.push({
          source_id: FCA_SOURCE_ID,
          title: title.substring(0, 255),
          category: category,
          content: 'Scraped from FCA: https://www.fca.org.uk' + href + ' — ' + title,
          version: 1.0,
          published_date: now
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] FCA scrape returned 0 results, using fallback data...');
      results = getFCAFallbackData();
    }

    // Limit to 10 most relevant items
    results = results.slice(0, 10);
    console.log('[FeedIntegrator] FCA scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] FCA scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback FCA data...');
    results = getFCAFallbackData();
  }

  return results;
}

function getFCAFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: FCA_SOURCE_ID,
      title: 'FCA Consumer Duty - New Standards for Financial Services Firms',
      category: 'Consumer Protection',
      content: 'New consumer duty requiring firms to deliver good outcomes for retail customers across products, services, price, and support.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FCA_SOURCE_ID,
      title: 'FCA Guidance on Financial Crime Systems and Controls',
      category: 'AML',
      content: 'Updated guidance on anti-money laundering systems and controls for firms regulated by the FCA, including enhanced due diligence requirements.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FCA_SOURCE_ID,
      title: 'FCA Cryptoasset Financial Promotions Regime',
      category: 'Digital Assets',
      content: 'Rules for marketing cryptoassets to UK consumers, including mandatory risk warnings and cooling-off periods.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: FCA_SOURCE_ID,
      title: 'FCA Enforcement Action - Penalty for AML Compliance Failures',
      category: 'Enforcement',
      content: 'Enforcement notice detailing penalty imposed on a financial institution for systematic failures in anti-money laundering controls.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// Web Scraping: BIS Publications (No public API for regulatory papers)
// =============================================

async function scrapeBIS() {
  console.log('[FeedIntegrator] Scraping BIS publications...');
  var results = [];

  try {
    var response = await axios.get(BIS_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    $('a[href*="/bcbs/"], a[href*="/publ/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href') || '';

      if (title && title.length > 10 && title.length < 300) {
        var category = 'Banking Standards';
        var titleLower = title.toLowerCase();
        if (titleLower.includes('capital') || titleLower.includes('basel')) {
          category = 'Capital Requirements';
        } else if (titleLower.includes('liquidity') || titleLower.includes('leverage')) {
          category = 'Liquidity Standards';
        } else if (titleLower.includes('risk') || titleLower.includes('operational')) {
          category = 'Risk Management';
        } else if (titleLower.includes('climate') || titleLower.includes('sustainable')) {
          category = 'ESG';
        }

        results.push({
          source_id: BIS_SOURCE_ID,
          title: title.substring(0, 255),
          category: category,
          content: 'Scraped from BIS: https://www.bis.org' + href + ' — ' + title,
          version: 1.0,
          published_date: now
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] BIS scrape returned 0 results, using fallback data...');
      results = getBISFallbackData();
    }

    results = results.slice(0, 10);
    console.log('[FeedIntegrator] BIS scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] BIS scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback BIS data...');
    results = getBISFallbackData();
  }

  return results;
}

function getBISFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: BIS_SOURCE_ID,
      title: 'Basel III Framework - Finalising Post-Crisis Reforms',
      category: 'Capital Requirements',
      content: 'Final Basel III standards on risk-weighted assets, output floor, and revised standardised approaches for credit risk, market risk, and operational risk.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: BIS_SOURCE_ID,
      title: 'BIS Principles for Operational Resilience in Banking',
      category: 'Risk Management',
      content: 'Principles requiring banks to identify critical operations, set impact tolerances, and ensure continuity of services during severe disruptions.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: BIS_SOURCE_ID,
      title: 'BIS Climate-Related Financial Risks - Supervisory Framework',
      category: 'ESG',
      content: 'Framework for supervisors to address climate-related financial risks in the banking sector, including scenario analysis and stress testing requirements.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// Web Scraping: HKMA Regulatory Updates (No public API)
// =============================================

async function scrapeHKMA() {
  console.log('[FeedIntegrator] Scraping HKMA regulatory updates...');
  var results = [];

  try {
    var response = await axios.get(HKMA_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    $('a[href*="/regulatory-resources/"], a[href*="/eng/key-functions/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href') || '';

      if (title && title.length > 10 && title.length < 300) {
        var category = 'Banking Regulation';
        var titleLower = title.toLowerCase();
        if (titleLower.includes('aml') || titleLower.includes('money laundering') || titleLower.includes('cft')) {
          category = 'AML';
        } else if (titleLower.includes('fintech') || titleLower.includes('virtual') || titleLower.includes('digital')) {
          category = 'Fintech';
        } else if (titleLower.includes('capital') || titleLower.includes('liquidity')) {
          category = 'Capital Requirements';
        } else if (titleLower.includes('consumer') || titleLower.includes('conduct')) {
          category = 'Consumer Protection';
        }

        results.push({
          source_id: HKMA_SOURCE_ID,
          title: title.substring(0, 255),
          category: category,
          content: 'Scraped from HKMA: https://www.hkma.gov.hk' + href + ' — ' + title,
          version: 1.0,
          published_date: now
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] HKMA scrape returned 0 results, using fallback data...');
      results = getHKMAFallbackData();
    }

    results = results.slice(0, 10);
    console.log('[FeedIntegrator] HKMA scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] HKMA scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback HKMA data...');
    results = getHKMAFallbackData();
  }

  return results;
}

function getHKMAFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: HKMA_SOURCE_ID,
      title: 'HKMA Guideline on Anti-Money Laundering and Counter-Terrorist Financing',
      category: 'AML',
      content: 'Comprehensive guideline for authorized institutions on AML/CFT obligations including customer due diligence, ongoing monitoring, and suspicious transaction reporting.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: HKMA_SOURCE_ID,
      title: 'HKMA Supervisory Policy Manual on Capital Adequacy',
      category: 'Capital Requirements',
      content: 'Requirements for authorized institutions on maintaining adequate capital ratios in line with Basel III standards as implemented in Hong Kong.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: HKMA_SOURCE_ID,
      title: 'HKMA Fintech Supervisory Sandbox Framework',
      category: 'Fintech',
      content: 'Framework allowing authorized institutions to conduct pilot trials of fintech initiatives in a controlled environment before full-scale deployment.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// Main Feed Runner
// =============================================

async function runFeedIntegration() {
  console.log('');
  console.log('========================================');
  console.log('[FeedIntegrator] Starting feed integration at', new Date().toLocaleString());
  console.log('========================================');

  // Run all 7 scraping sources + MAS API in parallel
  var [masData, masApiData, fatfData, fincenData, ecbData, fcaData, bisData, hkmaData] = await Promise.all([
    scrapeMAS(),
    fetchMASAPI(),
    scrapeFATF(),
    scrapeFinCEN(),
    fetchECB(),
    scrapeFCA(),
    scrapeBIS(),
    scrapeHKMA()
  ]);

  var allData = masData.concat(masApiData).concat(fatfData).concat(fincenData).concat(ecbData).concat(fcaData).concat(bisData).concat(hkmaData);
  console.log('[FeedIntegrator] Total items fetched:', allData.length);

  if (allData.length > 0) {
    var inserted = await saveToDatabase(allData);
    console.log('[FeedIntegrator] New regulations inserted:', inserted);
  } else {
    console.log('[FeedIntegrator] No data to insert');
  }

  console.log('[FeedIntegrator] Feed integration complete');
  console.log('========================================');
  console.log('');
}

// =============================================
// Cron Scheduler
// =============================================

function startFeedScheduler() {
  console.log('[FeedIntegrator] Feed scheduler initialized');

  // Run immediately on startup
  runFeedIntegration();

  // Schedule to run every 14 days (biweekly) at 2:00 AM
  // Cron: minute hour day-of-month month day-of-week
  cron.schedule('0 2 */14 * *', function () {
    runFeedIntegration();
  });

  console.log('[FeedIntegrator] Scheduled: every 14 days at 2:00 AM');
}

module.exports = { startFeedScheduler, runFeedIntegration };
