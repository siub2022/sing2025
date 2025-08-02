const { Pool } = require('pg');
const express = require('express');
const fs = require('fs');
const app = express();

// Debug environment variables
console.log('ENV Variables:', {
  DB_HOST: !!process.env.DB_HOST,
  DB_USER: !!process.env.DB_USER,
  DB_NAME: !!process.env.DB_NAME,
  SSL_CA: process.env.SSL_CA,
  PORT: process.env.PORT
});

// Database connection with encoded password
const pool = new Pool({
  connectionString: `postgres://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(process.env.SSL_CA).toString()
  }
});

// Test connection immediately
pool.connect()
  .then(client => {
    console.log('✅ Database connected');
    client.release();
  })
  .catch(err => console.error('❌ Database connection failed:', err));

// Routes
app.get('/', (req, res) => res.redirect('/library'));

app.get('/songs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM songs ORDER BY singer, title');
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/library', async (req, res) => {
  try {
    const search = req.query.search || '';
    const query = {
      text: `SELECT * FROM songs 
             WHERE $1 = '' OR 
                   singer ILIKE $1 OR 
                   title ILIKE $1 
             ORDER BY singer, title`,
      values: [`%${search}%`]
    };
    const result = await pool.query(query);
    
    // HTML response
    res.send(`
      <html>
        <body>
          <h1>Search Results</h1>
          <pre>${JSON.stringify(result.rows, null, 2)}</pre>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});