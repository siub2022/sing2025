const { Pool } = require('pg');
const express = require('express');
const app = express();

// Database config (use Render env vars)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// HTML Escape Helper
const escapeHtml = text => text?.toString()
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;') || '';

// ==================== ROUTES ====================

// Homepage redirect
app.get('/', (req, res) => res.redirect('/library'));

// List all songs
app.get('/library', async (req, res) => {
  try {
    const songs = (await pool.query('SELECT * FROM songs ORDER BY singer, title')).rows;
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Music Library</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
          .song { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
          .actions a { margin-right: 10px; }
          form { display: grid; gap: 10px; max-width: 500px; }
          input, button { padding: 8px; }
        </style>
      </head>
      <body>
        <h1>Song Library</h1>
        <a href="/create" class="add-button">＋ Add New Song</a>
    `;

    songs.forEach(song => {
      const encodedSinger = encodeURIComponent(song.singer);
      const encodedTitle = encodeURIComponent(song.title);
      
      html += `
        <div class="song">
          <h3>${escapeHtml(song.title)}</h3>
          <p>Artist: ${escapeHtml(song.singer)}</p>
          ${song.youtubelink ? `
            <p><a href="${escapeHtml(song.youtubelink)}" target="_blank" rel="noopener">
              ▶ Watch on YouTube
            </a></p>` : ''}
          <div class="actions">
            <a href="/update/${encodedSinger}/${encodedTitle}">✏️ Edit</a>
            <a href="/delete/${encodedSinger}/${encodedTitle}" class="delete">🗑️ Delete</a>
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

// Create song handler
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

// Edit song form
app.get('/update/:singer/:title', async (req, res) => {
  try {
    const singer = decodeURIComponent(req.params.singer);
    const title = decodeURIComponent(req.params.title);
    
    const song = (await pool.query(
      'SELECT * FROM songs WHERE singer = $1 AND title = $2',
      [singer, title]
    )).rows[0];

    if (!song) return res.status(404).send('Song not found');

    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Edit Song</h1>
        <form action="/update/${encodeURIComponent(song.singer)}/${encodeURIComponent(song.title)}" method="POST">
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
app.post('/update/:singer/:title', async (req, res) => {
  try {
    const oldSinger = decodeURIComponent(req.params.singer);
    const oldTitle = decodeURIComponent(req.params.title);
    
    await pool.query(
      `UPDATE songs 
       SET singer = $1, title = $2, youtubelink = $3 
       WHERE singer = $4 AND title = $5`,
      [
        req.body.singer, 
        req.body.title, 
        req.body.youtubelink,
        oldSinger,
        oldTitle
      ]
    );
    res.redirect('/library');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Delete confirmation
app.get('/delete/:singer/:title', async (req, res) => {
  try {
    const singer = decodeURIComponent(req.params.singer);
    const title = decodeURIComponent(req.params.title);
    
    const song = (await pool.query(
      'SELECT * FROM songs WHERE singer = $1 AND title = $2',
      [singer, title]
    )).rows[0];

    if (!song) return res.status(404).send('Song not found');

    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Delete Song?</h1>
        <p>Are you sure you want to delete "${escapeHtml(song.title)}" by ${escapeHtml(song.singer)}?</p>
        <form action="/delete/${encodeURIComponent(song.singer)}/${encodeURIComponent(song.title)}" method="POST">
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
app.post('/delete/:singer/:title', async (req, res) => {
  try {
    const singer = decodeURIComponent(req.params.singer);
    const title = decodeURIComponent(req.params.title);
    
    await pool.query(
      'DELETE FROM songs WHERE singer = $1 AND title = $2',
      [singer, title]
    );
    res.redirect('/library');
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${escapeHtml(err.message)}</pre>`);
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});