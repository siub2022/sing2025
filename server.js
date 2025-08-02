const { Pool } = require('pg');
const express = require('express');
const app = express();
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Simplified for Render
});

// JSON API
app.get('/songs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM songs ORDER BY singer, title');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Basic HTML UI
app.get('/library', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM songs ORDER BY singer, title');
    let html = `<!DOCTYPE html><html><head><title>Music Library</title>
               <style>body { font-family: sans-serif; max-width: 800px; margin: 0 auto; }
               .song { margin: 10px; padding: 10px; border: 1px solid #ddd; }</style>
               </head><body><h1>Music Library</h1>`;
    
    result.rows.forEach(song => {
      html += `<div class="song">
              <h3>${song.title}</h3>
              <p>Artist: ${song.singer}</p>
              <a href="${song.youtubelink}" target="_blank">YouTube</a>
              </div>`;
    });

    html += `</body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));