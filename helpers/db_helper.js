const { Pool } = require('pg');
const { config } = require('../config');
const log4js = require('log4js');

const logger = log4js.getLogger("log");

const pool = new Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,
  max: 20, // max connection
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000, 
});

pool.on('error', (err) => {
  logger.error('Database connection pool error:', err);
});

pool.on('connect', () => {
  logger.info('successfully connected to the database');
});

pool.on('remove', () => {
  logger.info('removed from the database');
});

async function init_db() {
  try {
    logger.info('starting database initialization');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        url TEXT,
        number TEXT,
        clinic_name TEXT,
        notified BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    logger.info('database initialization completed');
  } catch (err) {
    logger.error('database initialization failed:', err);
    throw err;
  }
}

async function getUser(userId) {
  const res = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}


async function setUser(userId, url, number, notified = false, clinicName = null) {
  await pool.query(`
    INSERT INTO users (user_id, url, number, clinic_name, notified, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET url = $2, number = $3, clinic_name = $4, notified = $5, updated_at = NOW()
  `, [userId, url, number, clinicName, notified]);
}


async function updateUser(userId, fields) {
  const updates = [];
  const values = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = $${i + 1}`);
    values.push(value);
    i++;
  }
  values.unshift(userId);
  updates.push(`updated_at = NOW()`);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = $1`, values);
}


async function deleteUser(userId) {
  await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
}


async function getAllUsers() {
  const res = await pool.query('SELECT * FROM users');
  return res.rows;
}

module.exports = {
  init_db,
  getUser,
  setUser,
  updateUser,
  deleteUser,
  getAllUsers
};
