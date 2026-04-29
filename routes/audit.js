const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/audit-logs
router.get('/', async (req, res) => {
  try {
    var { user_id, action_type, target_table, start_date, end_date } = req.query;
    var sql = `SELECT al.log_id, u.username, al.action_type, al.target_table, al.target_id, al.description, al.timestamp
               FROM audit_logs al JOIN users u ON al.user_id = u.user_id WHERE 1=1`;
    var params = [];
    if (user_id) { sql += ' AND al.user_id = ?'; params.push(user_id); }
    if (action_type) { sql += ' AND al.action_type = ?'; params.push(action_type); }
    if (target_table) { sql += ' AND al.target_table = ?'; params.push(target_table); }
    if (start_date) { sql += ' AND al.timestamp >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND al.timestamp <= ?'; params.push(end_date); }
    sql += ' ORDER BY al.timestamp DESC';

    var [rows] = await pool.query(sql, params);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
