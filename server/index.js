require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 1. Konfigurasi Database (MENGGUNAKAN NEON CLOUD)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Wajib untuk koneksi Neon/Render
  }
});

// Cek koneksi database saat startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log("❌ KONEKSI DATABASE GAGAL:", err.message);
    console.log("Tip: Pastikan DATABASE_URL di .env sudah benar dan pakai tanda petik.");
  } else {
    console.log("✅ DATABASE TERHUBUNG (NEON CLOUD)!");
  }
});

// 2. Setting Penyimpanan Gambar (Multer)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Tambahkan { recursive: true }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. ROUTES (API)

// --- FITUR LOGIN ---
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE password_akses = $1", [password]);

    if (result.rows.length > 0) {
      const userFound = result.rows[0];
      res.json({ 
        success: true, 
        user: { 
          role: userFound.role, 
          nama: userFound.nama,
          cabang_id: userFound.cabang_id
        } 
      });
    } else {
      // Backup jika .env ADMIN_PASSWORD diset
      if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
        return res.json({ success: true, user: { role: 'admin', nama: 'Admin Backup' } });
      }
      res.status(401).json({ success: false, pesan: "Password Salah!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, pesan: "Kesalahan server" });
  }
});

// Ambil Daftar Menu (Untuk Pembeli)
app.get('/api/menu', async (req, res) => {
  try {
    const allMenu = await pool.query("SELECT * FROM daftar_teh ORDER BY id ASC");
    res.json(allMenu.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- FITUR STOK (INVENTORY) ---
app.get('/api/admin/inventory', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM daftar_teh ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fitur Update Stok
app.put('/api/admin/update-stok/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { jumlah } = req.body; 

    const nilaiStok = parseInt(jumlah);

    const result = await pool.query(
      "UPDATE daftar_teh SET stok = $1 WHERE id = $2 RETURNING *", 
      [nilaiStok, id]
    );

    if (result.rowCount > 0) {
      res.json({ success: true, pesan: "Stok berhasil diperbarui" });
    } else {
      res.status(404).json({ success: false, pesan: "Item tidak ditemukan" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Gagal update stok");
  }
});

// --- FITUR PESANAN ---
app.post('/api/pesan', upload.single('bukti'), async (req, res) => {
  console.log("--- REQUEST MASUK ---");
  console.log("Body:", req.body);
  console.log("File:", req.file);

  const client = await pool.connect();
  try {
    const { pembeli, detail, total } = req.body;
    const namaFileGambar = req.file ? req.file.filename : null;

    // Cek apakah data penting ada
    if (!pembeli || !detail) {
      console.log("❌ DATA TIDAK LENGKAP");
      return res.status(400).json({ success: false, pesan: "Data pembeli atau detail kosong" });
    }

    await client.query('BEGIN');

    const order = await client.query(
      "INSERT INTO pesanan (nama_pembeli, detail_pesanan, total_harga, bukti_transfer) VALUES($1, $2, $3, $4) RETURNING *",
      [pembeli, detail, total || 0, namaFileGambar]
    );

    // Update stok (pastikan detail ada isinya)
    const itemPesanan = detail.split(", ");
    for (let namaTeh of itemPesanan) {
      await client.query(
        "UPDATE daftar_teh SET stok = GREATEST(stok - 1, 0) WHERE nama_teh = $1",
        [namaTeh.trim()]
      );
    }

    await client.query('COMMIT');
    console.log("✅ PESANAN BERHASIL DISIMPAN");
    res.json({ success: true, data: order.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERROR SERVER:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/admin/pesanan', async (req, res) => {
  try {
    const orders = await pool.query("SELECT * FROM pesanan ORDER BY waktu_pesan DESC");
    res.json(orders.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fitur Selesai/Hapus Pesanan
app.delete('/api/admin/pesanan/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("DELETE FROM pesanan WHERE id = $1", [parseInt(id)]);
    
    if (result.rowCount > 0) {
      res.json({ success: true, pesan: "Pesanan telah diselesaikan." });
    } else {
      res.status(404).json({ success: false, pesan: "ID Pesanan tidak ditemukan." });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Gagal menghapus pesanan");
  }
});

// --- FITUR KHUSUS OWNER ---

app.post('/api/admin/cabang', async (req, res) => {
  try {
    const { nama_cabang } = req.body;
    const result = await pool.query("INSERT INTO cabang (nama_cabang) VALUES ($1) RETURNING *", [nama_cabang]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, pesan: "Gagal tambah cabang" });
  }
});

app.get('/api/admin/daftar-cabang', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cabang ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/admin/karyawan', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.nama, c.nama_cabang as cabang 
      FROM users u 
      LEFT JOIN cabang c ON u.cabang_id = c.id 
      WHERE u.role = 'admin'
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.put('/api/admin/pindah-karyawan', async (req, res) => {
  try {
    const { user_id, cabang_id } = req.body;
    await pool.query("UPDATE users SET cabang_id = $1 WHERE id = $2", [cabang_id, user_id]);
    res.json({ success: true, pesan: "Karyawan berhasil dipindahkan" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- 4. JALANKAN SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("-----------------------------------------");
  console.log(`Server Tea_kita running on port ${PORT}`);
  console.log("Database & Owner Features Aktif");
  console.log("-----------------------------------------");
});