const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT t.task_id, t.title, t.description, t.deadline, t.status, u.username AS assignee, t.created_at
       FROM tasks t JOIN users u ON t.assigned_to = u.user_id`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    var { assigned_to, title, deadline, alert_id, description } = req.body;
    if (!assigned_to || !title || !deadline) {
      return res.status(400).json({ error: 'assigned_to, title, and deadline are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO tasks (alert_id, assigned_to, title, description, deadline) VALUES (?, ?, ?, ?, ?)',
      [alert_id || null, assigned_to, title, description || null, deadline]
    );
    await logAudit(assigned_to, 'TASK_CREATED', 'tasks', result.insertId, 'Task created: ' + title);
    res.status(201).json({ message: 'Task created', task_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { status } = req.body;
    var VALID_STATUSES = ['Pending', 'In Progress', 'Completed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: Pending, In Progress, Completed' });
    }
    var [result] = await pool.query('UPDATE tasks SET status = ? WHERE task_id = ?', [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    await logAudit(req.body.user_id || 1, 'STATUS_UPDATE', 'tasks', id, 'Task ' + id + ' status changed to ' + status);
    res.status(200).json({ message: 'Task status updated', task_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var [result] = await pool.query('DELETE FROM tasks WHERE task_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    await logAudit(1, 'TASK_DELETED', 'tasks', id, 'Task ' + id + ' deleted');
    res.status(200).json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
