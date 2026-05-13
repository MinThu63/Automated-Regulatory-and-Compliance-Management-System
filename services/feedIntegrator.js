const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const pool = require('../db');
const { assessImpactRAG, embedRegulation, embedAllExistingData } = require('./ragEngine');

// =============================================
// Source ID — MAS only (Phase 1 POC)
// =============================================

const MAS_SOURCE_ID = 1;

// External URLs
const MAS_SCRAPE_URL = process.env.MAS_SCRAPE_URL || 'https://www.mas.gov.sg/regulation/anti-money-laundering';
const MAS_API_URL = process.env.MAS_API_URL || 'https://eservices.mas.gov.sg/api/action/datastore/search.json';

// =============================================
// Impact-to-Severity Mapping
// =============================================

function mapImpactToSeverity(impactScore) {
  if (impactScore === 'Critical') return 'Immediate Action Required';
  if (impactScore === 'High') return 'Immediate Action Required';
  if (impactScore === 'Medium') return 'Review Recommended';
  return 'Informational';
}

// =============================================
// Database Insertion (with RAG-powered impact assessment)
// =============================================

async function saveToDatabase(data) {
  var inserted = 0;
  for (var item of data) {
    try {
      var [existing] = await pool.query(
        'SELECT reg_id, version FROM regulations WHERE title = ? AND source_id = ?',
        [item.title, item.source_id]
      );

      if (existing.length > 0) {
        var existingReg = existing[0];
        var existingVersion = parseFloat(existingReg.version) || 1.0;
        var newVersion = parseFloat(item.version) || 1.0;

        if (newVersion > existingVersion) {
          await pool.query(
            'UPDATE regulations SET content = ?, version = ?, published_date = ? WHERE reg_id = ?',
            [item.content, newVersion, item.published_date || null, existingReg.reg_id]
          );

          // RAG-powered impact assessment
          var impactScore = await assessImpactRAG(item);
          await pool.query(
            'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES (?, ?, ?, ?, ?)',
            [existingReg.reg_id, existingVersion, newVersion, 'Updated: ' + item.content.substring(0, 500), impactScore]
          );
          console.log('[ChangeDetection] Version change:', item.title, '(' + existingVersion + ' → ' + newVersion + ') Impact:', impactScore);

          var [changeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
          var changeId = changeRows[0].change_id;

          var severityLevel = mapImpactToSeverity(impactScore);
          await pool.query(
            'INSERT INTO alerts (reg_id, change_id, severity_level) VALUES (?, ?, ?)',
            [existingReg.reg_id, changeId, severityLevel]
          );
          console.log('[AlertSystem] Alert created:', severityLevel);

          // Re-embed the updated regulation
          await embedRegulation(existingReg.reg_id, item.title, item.content);

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

      // Embed the new regulation into vector store
      await embedRegulation(newRegId, item.title, item.content);

      // RAG-powered impact assessment
      var newRegImpact = await assessImpactRAG(item);
      await pool.query(
        'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES (?, ?, ?, ?, ?)',
        [newRegId, 0.0, item.version || 1.0, 'New regulation ingested: ' + item.content.substring(0, 500), newRegImpact]
      );
      console.log('[ChangeDetection] New regulation impact:', newRegImpact);

      var [newChangeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
      var newChangeId = newChangeRows[0].change_id;

      var newRegSeverity = mapImpactToSeverity(newRegImpact);
      await pool.query(
        'INSERT INTO alerts (reg_id, change_id, severity_level) VALUES (?, ?, ?)',
        [newRegId, newChangeId, newRegSeverity]
      );
      console.log('[AlertSystem] Alert:', newRegSeverity, 'for', item.title);

    } catch (err) {
      console.error('[FeedIntegrator] DB insert error:', err.message);
    }
  }
  return inserted;
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

    $('a[href*="/regulation/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');

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

// =============================================
// MAS Fallback Data — Notice 626 and related notices
// =============================================

function getMASFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Prevention of Money Laundering and Countering the Financing of Terrorism',
      category: 'AML',
      content: 'MAS Notice 626 sets out requirements for banks in Singapore relating to the prevention of money laundering and countering the financing of terrorism. Key areas include: (1) Customer Due Diligence (CDD) — banks must identify and verify customers, beneficial owners, and persons acting on behalf of customers before establishing business relations. (2) Enhanced Due Diligence (EDD) — required for higher-risk customers including politically exposed persons (PEPs), correspondent banking relationships, and non-face-to-face business relations. (3) Ongoing Monitoring — banks must conduct ongoing monitoring of business relations and scrutinize transactions to ensure consistency with the bank\'s knowledge of the customer. (4) Suspicious Transaction Reporting (STR) — banks must file STRs with the Suspicious Transaction Reporting Office when there are reasonable grounds to suspect money laundering or terrorism financing. (5) Record Keeping — banks must maintain records of all transactions and CDD information for at least 5 years. (6) Wire Transfer Requirements — banks must include originator and beneficiary information in wire transfers.',
      version: 2.0,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 1014 - Prevention of Money Laundering and Countering the Financing of Terrorism - Capital Markets Intermediaries',
      category: 'AML',
      content: 'MAS Notice 1014 applies to holders of capital markets services licences and sets out AML/CFT requirements including customer due diligence, ongoing monitoring, suspicious transaction reporting, and record keeping obligations specific to capital markets intermediaries.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Guidelines on Environmental Risk Management for Banks',
      category: 'ESG',
      content: 'Guidelines requiring banks to integrate environmental risk considerations into their risk management frameworks. Banks must conduct scenario analysis on environmental risk exposures, set metrics and targets for managing environmental risk, and make appropriate disclosures on environmental risk.',
      version: 1.1,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Technology Risk Management Guidelines',
      category: 'Technology Risk',
      content: 'Updated guidelines on cybersecurity, IT resilience, and third-party technology risk management for financial institutions regulated by MAS. Covers system availability, data protection, access controls, cyber surveillance, and incident response.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 644 - Submission of Statistics and Returns',
      category: 'Reporting',
      content: 'Requirements for banks to submit statistical returns and reports to MAS on a regular basis, including capital adequacy ratios, liquidity coverage ratios, and other prudential metrics.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 637 - Notice on Risk Based Capital Adequacy Requirements for Banks',
      category: 'Capital Requirements',
      content: 'Sets out the minimum capital adequacy requirements for banks incorporated in Singapore, including Common Equity Tier 1, Additional Tier 1, and Tier 2 capital requirements aligned with Basel III standards.',
      version: 1.0,
      published_date: now
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Guidelines on Individual Accountability and Conduct',
      category: 'Governance',
      content: 'Guidelines promoting the accountability of senior managers and strengthening oversight of material risk personnel in financial institutions. Covers fit and proper criteria, conduct standards, and accountability mapping.',
      version: 1.0,
      published_date: now
    }
  ];
}

// =============================================
// MAS Official API
// =============================================

async function fetchMASAPI() {
  console.log('[FeedIntegrator] Fetching from MAS Official API...');
  var results = [];
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    var exchangeRateResponse = await axios.get(MAS_API_URL, {
      params: { resource_id: '95932927-c8bc-4e7a-b484-68a66a24edfe', limit: 5, sort: 'end_of_day desc' },
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
          content: 'Official MAS exchange rate data. Includes USD/SGD, EUR/SGD, GBP/SGD, JPY/SGD spot rates. Data date: ' + latestDate,
          version: 1.0,
          published_date: now
        });
      }
    }
  } catch (err) {
    console.error('[FeedIntegrator] MAS API exchange rate fetch failed:', err.message);
  }

  try {
    var interestRateResponse = await axios.get(MAS_API_URL, {
      params: { resource_id: '9a0bf149-308c-4bd2-832d-76c8e6cb47ed', limit: 5, sort: 'end_of_day desc' },
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
          content: 'Official MAS domestic interest rate data. Includes interbank rates, prime lending rates, and fixed deposit rates. Data date: ' + intDate,
          version: 1.0,
          published_date: now
        });
      }
    }
  } catch (err) {
    console.error('[FeedIntegrator] MAS API interest rate fetch failed:', err.message);
  }

  try {
    var moneySupplyResponse = await axios.get(MAS_API_URL, {
      params: { resource_id: '5f2b18a8-0883-4f98-962c-ab4a0f467634', limit: 3, sort: 'end_of_month desc' },
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
          content: 'Official MAS money supply statistics. Includes M1 (narrow money) and M2 (broad money) aggregates. Data date: ' + msDate,
          version: 1.0,
          published_date: now
        });
      }
    }
  } catch (err) {
    console.error('[FeedIntegrator] MAS API money supply fetch failed:', err.message);
  }

  console.log('[FeedIntegrator] MAS API returned ' + results.length + ' items');
  return results;
}

// =============================================
// Main Feed Runner (MAS Only — Phase 1 POC with RAG)
// =============================================

async function runFeedIntegration() {
  console.log('');
  console.log('========================================');
  console.log('[FeedIntegrator] Starting MAS feed integration at', new Date().toLocaleString());
  console.log('[FeedIntegrator] Phase 1 POC — MAS only + RAG pipeline');
  console.log('========================================');

  var [masData, masApiData] = await Promise.all([
    scrapeMAS(),
    fetchMASAPI()
  ]);

  var allData = masData.concat(masApiData);
  console.log('[FeedIntegrator] Total MAS items fetched:', allData.length);

  if (allData.length > 0) {
    var inserted = await saveToDatabase(allData);
    console.log('[FeedIntegrator] New MAS regulations inserted:', inserted);
  } else {
    console.log('[FeedIntegrator] No MAS data to insert');
  }

  console.log('[FeedIntegrator] Feed integration complete');
  console.log('========================================');
}

// =============================================
// Cron Scheduler
// =============================================

function startFeedScheduler() {
  console.log('[FeedIntegrator] Feed scheduler initialized (MAS only — RAG enabled)');

  // Embed existing data first, then run feed integration
  embedAllExistingData().then(function () {
    runFeedIntegration();
  }).catch(function (err) {
    console.error('[FeedIntegrator] Initial embedding failed:', err.message);
    runFeedIntegration();
  });

  cron.schedule('0 2 */14 * *', function () {
    runFeedIntegration();
  });

  console.log('[FeedIntegrator] Scheduled: every 14 days at 2:00 AM');
}

module.exports = { startFeedScheduler, runFeedIntegration };
