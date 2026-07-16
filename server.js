const http = require('http');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 3000;
// Kunci rahasia untuk JWT, sebaiknya ditaruh di .env nantinya
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_flyrank';

// Konfigurasi koneksi ke database Postgres menggunakan koneksi string dari .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Fungsi untuk membuat tabel otomatis jika belum ada di database
async function initDatabase() {
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS interns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      track VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTablesQuery);
    console.log('Database tables initialized successfully.');

    // Tambahkan satu data awal jika tabel masih kosong (untuk pembuktian persistence nanti)
    const res = await pool.query('SELECT COUNT(*) FROM interns');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(
        "INSERT INTO interns (name, track, status) VALUES ('Aldy Putra Manurung', 'Backend AI Engineering', 'Active')"
      );
      console.log('Seed data inserted.');
    }
  } catch (err) {
    console.error('Error initializing database tables:', err.message);
  }
}

// Jalankan inisialisasi tabel sebelum server mulai menerima request
initDatabase();

// Helper untuk membaca body dari request POST/JSON
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

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

  // Endpoint 3: POST /register (Pendaftaran User Baru)
  else if (req.url === '/register' && req.method === 'POST') {
    try {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Email and password are required" }));
      }

      // Hash password sebelum disimpan
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2)',
        [email, hashedPassword]
      );

      res.writeHead(201);
      res.end(JSON.stringify({ message: "User registered successfully!" }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Registration failed", details: err.message }));
    }
  }

  // Endpoint 4: POST /login (Autentikasi User & Pembuatan Token)
  else if (req.url === '/login' && req.method === 'POST') {
    try {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: "Email and password are required" }));
      }

      // Cari user di database
      const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "Invalid credentials" }));
      }

      const user = userResult.rows[0];
      
      // Bandingkan password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "Invalid credentials" }));
      }

      // Buat JWT Token berlaku selama 1 jam
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

      res.writeHead(200);
      res.end(JSON.stringify({ message: "Login successful!", token }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Login failed", details: err.message }));
    }
  }

  // Endpoint 5: GET /protected (Rute Terproteksi dengan Validasi Token)
  else if (req.url === '/protected' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401); // Jujur mengirim status 401 jika tidak membawa token
      return res.end(JSON.stringify({ error: "Unauthorized. Token is missing or invalid format." }));
    }

    const token = authHeader.split(' ')[1];

    try {
      // Verifikasi token
      const decoded = jwt.verify(token, JWT_SECRET);
      res.writeHead(200);
      res.end(JSON.stringify({
        message: "Access granted! You unlocked this protected route.",
        user: decoded
      }));
    } catch (err) {
      res.writeHead(403); // Jujur mengirim status 403 jika token salah/kedaluwarsa
      res.end(JSON.stringify({ error: "Forbidden. Invalid or expired token." }));
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