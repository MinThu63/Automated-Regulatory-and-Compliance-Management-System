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

// PUT /api/regulatory-sources/:id
router.put('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { source_name, base_url } = req.body;
    var fields = [], values = [];
    if (source_name !== undefined) { fields.push('source_name = ?'); values.push(source_name); }
    if (base_url !== undefined) { fields.push('base_url = ?'); values.push(base_url); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    var [result] = await pool.query(`UPDATE regulatory_sources SET ${fields.join(', ')} WHERE source_id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Source not found' });
    res.status(200).json({ message: 'Source updated', source_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/regulatory-sources/:id
router.delete('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var [result] = await pool.query('DELETE FROM regulatory_sources WHERE source_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Source not found' });
    res.status(200).json({ message: 'Source deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
