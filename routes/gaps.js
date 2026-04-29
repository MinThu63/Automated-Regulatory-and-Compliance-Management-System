const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
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

module.exports = router;
