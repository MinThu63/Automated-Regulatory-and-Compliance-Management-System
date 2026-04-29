const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/regulatory-sources
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query('SELECT * FROM regulatory_sources');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/regulatory-sources
router.post('/', async (req, res) => {
  try {
    var { source_name, base_url } = req.body;
    if (!source_name || !base_url) {
      return res.status(400).json({ error: 'source_name and base_url are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO regulatory_sources (source_name, base_url) VALUES (?, ?)',
      [source_name, base_url]
    );
    res.status(201).json({ message: 'Source created', source_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
