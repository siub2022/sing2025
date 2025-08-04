const { Pool } = require('pg');
const express = require('express');
const fs = require('fs');
const app = express();

// Database configuration (Render-specific)
const pool = new Pool({
  user: process.env.DB_USER || 'db2025_user',
  host: process.env.DB_HOST || 'dpg-d23sgh3e5dus73b245mg-a.singapore-postgres.render.com',
  database: process.env.DB_NAME || 'db2025',
  password: process.env.DB_PASSWORD || '9ok43BSy483OGvPCzpRLa5VnjnnFS4lv',
  port: 5432,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(process.env.SSL_CA || '/etc/ssl/certs/ca-certificates.crt').toString()
  }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// HTML Escape Helper
const escapeHtml = (text) => text?.toString()
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;') || '';

// ==================== ROUTES ====================

// Homepage
app.get('/', (req, res) => res.redirect('/library'));

// List all songs (Read)
app.get('/library', async (req, res) => {
  try {
    const songs = (await pool.query('SELECT * FROM songs ORDER BY singer, title')).rows;
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Music Library</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
          .song { border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
          .actions a { margin-right: 10px; color: #1a73e8; }
          form { display: grid; gap: 10px; max-width: 500px; }
          input, button { padding: 8px; }
        </style>
      </head>
      <body>
        <h1>Song Library</h1>
        <a href="/create" style="display: inline-block; margin-bottom: 20px; padding: 8px 12px; background: #1a73e8; color: white; text-decoration: none; border-radius: 4px;">＋ Add New Song</a>
    `;

    songs.forEach(song => {
      html += `
        <div class="song">
          <h3>${escapeHtml(song.title)}</h3>
          <p>Artist: ${escapeHtml(song.singer)}</p>
          ${song.youtubelink ? `<p><a href="${escapeHtml(song.youtubelink)}" target="_blank">▶ Watch on YouTube</a></p>` : ''}
          <div class="actions">
            <a href="/update/${song.id}">✏️ Edit</a>
            <a href="/delete/${song.id}" style="color: #d32f2f;">🗑️ Delete</a>
          </div>
        </div>
      `;
    });

    res.send(html + '</body></html>');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Create song form
app.get('/create', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Add New Song</h1>
      <form action="/create" method="POST">
        <input type="text" name="singer" placeholder="Artist" required>
        <input type="text" name="title" placeholder="Song Title" required>
        <input type="url" name="youtubelink" placeholder="YouTube URL">
        <button type="submit">Save</button>
        <a href="/library">Cancel</a>
      </form>
    </body>
    </html>
  `);
});

// Create song handler (Create)
app.post('/create', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO songs (singer, title, youtubelink) VALUES ($1, $2, $3)',
      [req.body.singer, req.body.title, req.body.youtubelink]
    );
    res.redirect('/library');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Update song form (Update)
app.get('/update/:id', async (req, res) => {
  try {
    const song = (await pool.query('SELECT * FROM songs WHERE id = $1', [req.params.id])).rows[0];
    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Edit Song</h1>
        <form action="/update/${song.id}" method="POST">
          <input type="text" name="singer" value="${escapeHtml(song.singer)}" required>
          <input type="text" name="title" value="${escapeHtml(song.title)}" required>
          <input type="url" name="youtubelink" value="${escapeHtml(song.youtubelink || '')}">
          <button type="submit">Update</button>
          <a href="/library">Cancel</a>
        </form>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Update song handler
app.post('/update/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE songs SET singer = $1, title = $2, youtubelink = $3 WHERE id = $4',
      [req.body.singer, req.body.title, req.body.youtubelink, req.params.id]
    );
    res.redirect('/library');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Delete confirmation (Delete)
app.get('/delete/:id', async (req, res) => {
  try {
    const song = (await pool.query('SELECT * FROM songs WHERE id = $1', [req.params.id])).rows[0];
    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Delete Song?</h1>
        <p>Are you sure you want to delete "${escapeHtml(song.title)}" by ${escapeHtml(song.singer)}?</p>
        <form action="/delete/${song.id}" method="POST">
          <button type="submit" style="background: #d32f2f; color: white;">Confirm Delete</button>
          <a href="/library">Cancel</a>
        </form>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Delete song handler
app.post('/delete/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM songs WHERE id = $1', [req.params.id]);
    res.redirect('/library');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Web UI: http://localhost:${PORT}/library`);
  console.log(`API: http://localhost:${PORT}/songs`);
});