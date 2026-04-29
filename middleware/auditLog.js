const pool = require('../db');

async function logAudit(userId, actionType, targetTable, targetId, description) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action_type, target_table, target_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, actionType, targetTable, targetId, description]
    );
  } catch (err) {
    console.error('[AuditLog] Failed to log:', err.message);
  }
}

module.exports = logAudit;
