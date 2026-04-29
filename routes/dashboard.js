const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(status = 'Unread') AS unread, SUM(status = 'Read') AS readCount,
       SUM(status = 'Dismissed') AS dismissed, SUM(severity_level = 'Immediate Action Required') AS immediate,
       SUM(severity_level = 'Review Recommended') AS review, SUM(severity_level = 'Informational') AS informational
       FROM alerts`
    );
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/categories
router.get('/categories', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT r.category, COUNT(rc.change_id) AS change_count FROM regulation_changes rc
       JOIN regulations r ON rc.reg_id = r.reg_id GROUP BY r.category`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/trends
router.get('/trends', async (req, res) => {
  try {
    var [rows] = await pool.query(
      'SELECT DATE(created_at) AS date, COUNT(*) AS count FROM alerts GROUP BY DATE(created_at) ORDER BY date ASC'
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
