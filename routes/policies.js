const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// GET /api/internal-policies
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query('SELECT policy_id, policy_name, description, last_updated FROM internal_policies');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/internal-policies
router.post('/', async (req, res) => {
  try {
    var { policy_name, description } = req.body;
    if (!policy_name || !description) {
      return res.status(400).json({ error: 'policy_name and description are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO internal_policies (policy_name, description) VALUES (?, ?)',
      [policy_name, description]
    );
    await logAudit(req.body.user_id || 1, 'POLICY_CREATED', 'internal_policies', result.insertId, 'Policy created: ' + policy_name);
    res.status(201).json({ message: 'Policy created', policy_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/internal-policies/:id
router.put('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { policy_name, description } = req.body;
    var fields = [], values = [];
    if (policy_name !== undefined) { fields.push('policy_name = ?'); values.push(policy_name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);

    var [result] = await pool.query(`UPDATE internal_policies SET ${fields.join(', ')} WHERE policy_id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Policy not found' });
    await logAudit(req.body.user_id || 1, 'POLICY_UPDATED', 'internal_policies', id, 'Policy ' + id + ' updated');
    res.status(200).json({ message: 'Policy updated', policy_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
