const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      'SELECT a.alert_id, r.title, a.severity_level, a.status FROM alerts a JOIN regulations r ON a.reg_id = r.reg_id'
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id
router.patch('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { status } = req.body;
    var VALID_STATUSES = ['Unread', 'Read', 'Dismissed'];

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: Unread, Read, Dismissed' });
    }
    var [result] = await pool.query('UPDATE alerts SET status = ? WHERE alert_id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    await logAudit(req.body.user_id || 1, 'STATUS_UPDATE', 'alerts', id, 'Alert ' + id + ' status changed to ' + status);
    res.status(200).json({ message: 'Alert status updated successfully', alert_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
