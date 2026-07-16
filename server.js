const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const port = process.env.PORT || 3000;

// Konfigurasi koneksi ke database Postgres menggunakan koneksi string dari .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Fungsi untuk membuat tabel otomatis jika belum ada di database
async function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS interns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      track VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Database table initialized successfully.');

    // Tambahkan satu data awal jika tabel masih kosong (untuk pembuktian persistence nanti)
    const res = await pool.query('SELECT COUNT(*) FROM interns');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(
        "INSERT INTO interns (name, track, status) VALUES ('Aldy Putra Manurung', 'Backend AI Engineering', 'Active')"
      );
      console.log('Seed data inserted.');
    }
  } catch (err) {
    console.error('Error initializing database table:', err.message);
  }
}

// Jalankan inisialisasi tabel sebelum server mulai menerima request
initDatabase();

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Endpoint 1: GET /
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ message: "Welcome to FlyRank Backend AI Engineering Track with Docker!" }));
  } 
  // Endpoint 2: GET /status (Mengambil data dari database Postgres)
  else if (req.url === '/status' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM interns LIMIT 1');
      if (result.rows.length > 0) {
        const intern = result.rows[0];
        res.writeHead(200);
        res.end(JSON.stringify({
          status: intern.status,
          intern: intern.name,
          track: intern.track,
          storage: "PostgreSQL Database (Docker Compose)"
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "No intern data found in database" }));
      }
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Database query failed", details: err.message }));
    }
  } 
  // Handle 404 Not Found
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Endpoint not found" }));
  }
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});