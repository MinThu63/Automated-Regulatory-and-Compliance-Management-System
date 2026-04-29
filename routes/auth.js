const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    var { email, password } = req.body;
    console.log('POST /api/login - attempt for', email);
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    var [users] = await pool.query('SELECT user_id, username, email, password, role FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    var user = users[0];
    var passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    console.log('POST /api/login - success for', user.username);
    await logAudit(user.user_id, 'LOGIN', 'users', user.user_id, user.username + ' logged in');
    res.status(200).json({ message: 'Login successful', user: { user_id: user.user_id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    console.error('POST /api/login - error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users
router.get('/users', async (req, res) => {
  try {
    var [rows] = await pool.query('SELECT user_id, username, email, role FROM users');
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
