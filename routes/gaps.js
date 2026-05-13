const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const { analyzeGapRAG } = require('../services/ragEngine');
const router = express.Router();

// GET /api/compliance-gaps
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT cg.gap_id, cg.gap_description, cg.status, r.title AS regulation_title, ip.policy_name, cg.identified_at
       FROM compliance_gaps cg JOIN regulations r ON cg.reg_id = r.reg_id
       JOIN internal_policies ip ON cg.policy_id = ip.policy_id`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance-gaps
router.post('/', async (req, res) => {
  try {
    var { reg_id, policy_id, gap_description } = req.body;
    if (!reg_id || !policy_id || !gap_description) {
      return res.status(400).json({ error: 'reg_id, policy_id, and gap_description are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES (?, ?, ?)',
      [reg_id, policy_id, gap_description]
    );
    await logAudit(req.body.user_id || 1, 'GAP_CREATED', 'compliance_gaps', result.insertId, 'Gap created: ' + gap_description.substring(0, 100));
    res.status(201).json({ message: 'Gap created', gap_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/compliance-gaps/:id
router.patch('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { status } = req.body;
    var VALID_STATUSES = ['Open', 'In Review', 'Remediated'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: Open, In Review, Remediated' });
    }
    var [result] = await pool.query('UPDATE compliance_gaps SET status = ? WHERE gap_id = ?', [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Gap not found' });
    await logAudit(req.body.user_id || 1, 'STATUS_UPDATE', 'compliance_gaps', id, 'Gap ' + id + ' status changed to ' + status);
    res.status(200).json({ message: 'Gap status updated', gap_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance-gaps/analyze — RAG-powered gap analysis
// Retrieves relevant chunks, then compares regulation vs policy using LLM
router.post('/analyze', async (req, res) => {
  try {
    var { reg_id, policy_id } = req.body;
    if (!reg_id || !policy_id) {
      return res.status(400).json({ error: 'reg_id and policy_id are required' });
    }

    // Verify regulation exists
    var [regs] = await pool.query('SELECT title FROM regulations WHERE reg_id = ?', [reg_id]);
    if (regs.length === 0) return res.status(404).json({ error: 'Regulation not found' });

    // Verify policy exists
    var [policies] = await pool.query('SELECT policy_name FROM internal_policies WHERE policy_id = ?', [policy_id]);
    if (policies.length === 0) return res.status(404).json({ error: 'Policy not found' });

    // Call RAG engine for gap analysis (handles retrieval + generation internally)
    var analysis = await analyzeGapRAG(reg_id, policy_id);

    // Auto-create gaps in database if RAG found any
    var createdGaps = [];
    if (analysis.has_gaps && analysis.gaps && analysis.gaps.length > 0) {
      for (var gap of analysis.gaps) {
        var [insertResult] = await pool.query(
          'INSERT INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES (?, ?, ?)',
          [reg_id, policy_id, gap.description]
        );
        createdGaps.push({ gap_id: insertResult.insertId, description: gap.description, severity: gap.severity, recommendation: gap.recommendation });
      }
      await logAudit(req.body.user_id || 1, 'RAG_GAP_ANALYSIS', 'compliance_gaps', reg_id, 'RAG identified ' + createdGaps.length + ' gaps: ' + regs[0].title + ' vs ' + policies[0].policy_name);
    }

    res.status(200).json({
      regulation: regs[0].title,
      policy: policies[0].policy_name,
      analysis: analysis,
      created_gaps: createdGaps
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
