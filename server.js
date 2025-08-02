const { Pool } = require('pg');
const express = require('express');
const app = express();

// Debug startup
console.log('=== Starting sing2025 Service ===');
console.log('Node Version:', process.version);
console.log('Environment Variables:', {
  DB_HOST: !!process.env.DB_HOST,
  DB_USER: !!process.env.DB_USER,
  NODE_ENV: process.env.NODE_ENV || 'development'
});

// Database connection with multiple fallbacks
const createPool = () => {
  const connectionString = `postgres://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}/${process.env.DB_NAME}`;
  
  // Try SSL first, then fallback to non-SSL
  const configs = [
    {
      connectionString,
      ssl: { 
        rejectUnauthorized: true,
        ca: require('fs').readFileSync('/etc/ssl/certs/ca-certificates.crt').toString()
      }
    },
    {
      connectionString,
      ssl: false
    }
  ];

  for (const config of configs) {
    try {
      const pool = new Pool(config);
      await pool.query('SELECT NOW()'); // Test connection
      console.log(`✅ Database connected ${config.ssl ? 'with SSL' : 'without SSL'}`);
      return pool;
    } catch (err) {
      console.warn(`⚠️ Connection attempt failed: ${err.message}`);
    }
  }
  throw new Error('All database connection attempts failed');
};

const pool = await createPool();

// Routes
app.get('/', (req, res) => res.redirect('/library'));

app.get('/songs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM songs ORDER BY singer, title');
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      error: 'Service unavailable',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  }
});

app.get('/library', async (req, res) => {
  try {
    const search = req.query.search || '';
    const result = await pool.query(
      `SELECT * FROM songs 
       WHERE $1 = '' OR singer ILIKE $1 OR title ILIKE $1 
       ORDER BY singer, title`,
      [`%${search}%`]
    );
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>sing2025 Music Library</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .song { margin: 15px 0; padding: 10px; border-radius: 5px; background: #f8f9fa; }
          .search { margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>sing2025 Music Library</h1>
        <form class="search" action="/library">
          <input type="text" name="search" value="${search.replace(/"/g, '&quot;')}" placeholder="Search songs...">
          <button type="submit">Search</button>
        </form>
        ${result.rows.map(song => `
          <div class="song">
            <h3>${song.title}</h3>
            <p>Artist: ${song.singer}</p>
            ${song.youtubelink ? `<a href="${song.youtubelink}" target="_blank">▶ Watch</a>` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Service unavailable');
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Service running on port ${PORT}`);
  console.log(`Web: http://localhost:${PORT}/library`);
  console.log(`API: http://localhost:${PORT}/songs`);
});

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});