const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/regulations (paginated + search)
router.get('/', async (req, res) => {
  try {
    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 20;
    var offset = (page - 1) * limit;
    var search = req.query.search || '';

    var countSql = 'SELECT COUNT(*) AS total FROM regulations r JOIN regulatory_sources rs ON r.source_id = rs.source_id';
    var dataSql = `SELECT r.reg_id, rs.source_name, r.title, r.category, r.content, r.version, r.published_date, r.ingested_at
       FROM regulations r JOIN regulatory_sources rs ON r.source_id = rs.source_id`;
    var params = [];

    if (search) {
      var searchClause = ' WHERE r.title LIKE ? OR r.category LIKE ?';
      countSql += searchClause;
      dataSql += searchClause;
      params.push('%' + search + '%', '%' + search + '%');
    }
    dataSql += ' ORDER BY r.ingested_at DESC LIMIT ? OFFSET ?';

    var [countRows] = await pool.query(countSql, params);
    var total = countRows[0].total;
    var [rows] = await pool.query(dataSql, params.concat([limit, offset]));
    res.status(200).json({ data: rows, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/regulations
router.post('/', async (req, res) => {
  try {
    var { source_id, title, category, content, version, published_date } = req.body;
    if (!source_id || !title || !category || !content) {
      return res.status(400).json({ error: 'source_id, title, category, and content are required' });
    }
    var [sources] = await pool.query('SELECT source_id FROM regulatory_sources WHERE source_id = ?', [source_id]);
    if (sources.length === 0) return res.status(400).json({ error: 'Source not found' });

    var [result] = await pool.query(
      'INSERT INTO regulations (source_id, title, category, content, version, published_date) VALUES (?, ?, ?, ?, ?, ?)',
      [source_id, title, category, content, version || 1.0, published_date || null]
    );
    res.status(201).json({ message: 'Regulation created', reg_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/regulations/:id
router.put('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { title, category, content, version, published_date } = req.body;
    var fields = [], values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (version !== undefined) { fields.push('version = ?'); values.push(version); }
    if (published_date !== undefined) { fields.push('published_date = ?'); values.push(published_date); }
    values.push(id);

    var [result] = await pool.query(`UPDATE regulations SET ${fields.join(', ')} WHERE reg_id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Regulation not found' });
    res.status(200).json({ message: 'Regulation updated', reg_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
