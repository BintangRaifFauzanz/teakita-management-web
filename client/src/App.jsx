import { useState, useEffect } from 'react';
import './App.css';

const BASE_URL = "airy-reverence-production.up.railway.app";

function App() {
  const [mode, setMode] = useState('welcome'); 
  const [user, setUser] = useState(null); 
  const [menu, setMenu] = useState([]);
  const [keranjang, setKeranjang] = useState([]);
  const [namaPembeli, setNamaPembeli] = useState("");
  const [file, setFile] = useState(null);
  const [showBayar, setShowBayar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const ambilMenu = () => {
    fetch('airy-reverence-production.up.railway.app/api/menu')
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(err => console.error("Gagal ambil menu:", err));
  };

  useEffect(() => {
    ambilMenu();
    const interval = setInterval(ambilMenu, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdminLogin = async (passwordInput) => {
    try {
      const response = await fetch('airy-reverence-production.up.railway.app/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUser(data.user); 
        if (data.user.role === 'owner') {
          setMode('owner_dashboard');
        } else {
          setMode('admin');
        }
        setIsSidebarOpen(false);
      } else {
        alert("Sandi Akses Salah!");
      }
    } catch (err) {
      alert("Gagal terhubung ke server.");
    }
  };

  const tambahKeKeranjang = (item) => {
    const jumlahDiKeranjang = keranjang.filter(i => i.id === item.id).length;
    if (jumlahDiKeranjang < item.stok) {
      setKeranjang([...keranjang, item]);
    } else {
      alert(`Maaf, stok ${item.nama_teh} habis.`);
    }
  };

  // --- FITUR BARU: Hapus per item dari keranjang ---
  const hapusDariKeranjang = (indexHapus) => {
    const keranjangBaru = keranjang.filter((_, index) => index !== indexHapus);
    setKeranjang(keranjangBaru);
    // Jika keranjang kosong setelah dihapus, tutup modal bayar
    if (keranjangBaru.length === 0) setShowBayar(false);
  };

  const totalHarga = keranjang.reduce((sum, item) => sum + item.harga, 0);

  const konfirmasiBayar = async () => {
    if (!namaPembeli || !file) return alert("Lengkapi data!");
    const formData = new FormData();
    formData.append('pembeli', namaPembeli);
    formData.append('detail', keranjang.map(i => i.nama_teh).join(", "));
    formData.append('total', totalHarga);
    formData.append('bukti', file);
    try {
      const response = await fetch("airy-reverence-production.up.railway.app/api/pesan", { method: "POST", body: formData });
      if (response.ok) {
        alert("Pesanan Berhasil!");
        setKeranjang([]);
        setShowBayar(false);
        ambilMenu();
      }
    } catch (err) { console.error(err); }
  };

  if (mode === 'welcome') {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1 className="logo-neon">Tea_kita</h1>
          <p style={{color: '#888', marginBottom: '30px'}}>Sistem Manajemen Terpusat</p>
          <button className="btn-confirm" style={{ width: '100%', padding: '20px', fontSize: '1.2rem', marginBottom: '15px' }} onClick={() => setMode('pembeli')}>
            🍵 MULAI PESAN
          </button>
          <button className="sidebar-link" style={{ width: '100%', background: '#000', margin: '0', border: '1px solid #333' }} onClick={() => setMode('login')}>
            👤 LOGIN STAFF / OWNER
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'login') {
    return <LoginPage onLogin={handleAdminLogin} onCancel={() => setMode('welcome')} />;
  }

  if (mode === 'owner_dashboard') {
    return <OwnerDashboard setMode={setMode} user={user} />;
  }

  if (mode === 'admin') {
    return <AdminDashboard setMode={setMode} user={user} />;
  }

  return (
    <div className="main-layout">
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>×</button>
        <div className="sidebar-content">
          <h2 className="logo-neon" style={{fontSize: '1.5rem'}}>Teakita</h2>
          <hr style={{borderColor: '#222', margin: '20px 0'}} />
          <button className="sidebar-link" onClick={() => {setMode('welcome'); setIsSidebarOpen(false);}}>🏠 Halaman Awal</button>
          <button className="sidebar-link" style={{background: '#000'}} onClick={() => {setMode('login'); setIsSidebarOpen(false);}}>🔐 Login Internal</button>
        </div>
      </div>

      <nav className="navbar">
        <div className="burger-icon" onClick={() => setIsSidebarOpen(true)}>
          <div></div><div></div><div></div>
        </div>
        <h1 className="logo-neon">Tea_kita</h1>
        <div style={{width: '40px'}}></div>
      </nav>

      <div className="menu-grid">
        {menu.map(item => (
          <div key={item.id} className="menu-card">
            <div className="menu-info">
              <h3>{item.nama_teh}</h3>
              <p style={{fontSize: '0.8rem', color: item.stok > 0 ? '#00ffcc' : 'red'}}>
                Stok: {item.stok > 0 ? item.stok : 'Habis'}
              </p>
            </div>
            <p>Rp {item.harga.toLocaleString()}</p>
            <button className="btn-add" onClick={() => tambahKeKeranjang(item)} disabled={item.stok <= 0}>
              {item.stok > 0 ? '+ Tambah' : 'Kosong'}
            </button>
          </div>
        ))}
      </div>

      {keranjang.length > 0 && (
        <div className="floating-cart">
          <div className="cart-info">
            <p>Item: <strong>{keranjang.length}</strong> | Total: <strong>Rp {totalHarga.toLocaleString()}</strong></p>
          </div>
          <button className="btn-checkout" onClick={() => setShowBayar(true)}>Bayar</button>
        </div>
      )}

      {showBayar && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Konfirmasi Pesanan</h2>
            
            {/* Tampilan Daftar Belanja yang bisa dihapus */}
            <div style={{maxHeight: '150px', overflowY: 'auto', background: '#111', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'left'}}>
              {keranjang.map((item, index) => (
                <div key={index} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #222'}}>
                  <span style={{fontSize: '0.9rem'}}>{item.nama_teh}</span>
                  <button onClick={() => hapusDariKeranjang(index)} style={{background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '0.8rem'}}>Hapus</button>
                </div>
              ))}
            </div>

            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TeaKita" alt="QR" />
            
            <div className="form-group" style={{margin: '20px 0'}}>
              <input type="text" placeholder="Nama Anda" className="login-input" onChange={(e) => setNamaPembeli(e.target.value)} />
              <input type="file" style={{marginTop: '10px'}} onChange={(e) => setFile(e.target.files[0])} />
            </div>
            <button className="btn-confirm" onClick={konfirmasiBayar}>Kirim Bukti (Rp {totalHarga.toLocaleString()})</button>
            <button className="btn-cancel" onClick={() => setShowBayar(false)}>Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Ganti komponen OwnerDashboard lama kamu dengan ini di App.jsx
function OwnerDashboard({ setMode, user }) {
  const [cabangBaru, setCabangBaru] = useState("");
  
  // 1. Ubah state cabang menjadi array kosong dulu
  const [cabang, setCabang] = useState([]);
  const [karyawan, setKaryawan] = useState([{id: 101, nama: 'Budi', cabang: 'Jakal'}]);

  // 2. Fungsi untuk mengambil data cabang asli dari Database
  const ambilCabang = async () => {
    try {
      const res = await fetch('airy-reverence-production.up.railway.app/api/admin/daftar-cabang');
      const data = await res.json();
      setCabang(data);
    } catch (err) {
      console.error("Gagal ambil cabang:", err);
    }
  };

  // 3. Jalankan ambilCabang saat pertama kali buka Dashboard
  useEffect(() => {
    ambilCabang();
  }, []);

  const handleTambahCabang = async () => {
    if (!cabangBaru) return alert("Isi nama cabang dulu!");
    try {
      const response = await fetch('airy-reverence-production.up.railway.app/api/admin/cabang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_cabang: cabangBaru })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Berhasil mendaftarkan cabang ${cabangBaru}!`);
        setCabangBaru(""); 
        ambilCabang(); // <--- 4. Panggil lagi agar dropdown otomatis terupdate
      }
    } catch (err) {
      alert("Gagal terhubung ke server.");
    }
  };

  return (
    <div className="admin-container" style={{padding: '20px'}}>
      <h1 className="logo-neon" style={{textAlign: 'center'}}>OWNER CENTRAL</h1>
      <p style={{textAlign: 'center', color: '#888'}}>Halo, {user?.nama || 'Owner'}</p>
      
      <div className="admin-nav">
        <button onClick={() => setMode('welcome')} style={{background: '#ff4d4d'}}>Log Out</button>
      </div>

      <div className="menu-grid" style={{marginTop: '20px'}}>
        <div className="menu-card" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '10px'}}>
          <h3 style={{color: 'var(--neon)'}}>➕ Tambah Cabang Baru</h3>
          <input 
            className="login-input" 
            placeholder="Nama Cabang" 
            style={{textAlign: 'left'}} 
            value={cabangBaru}
            onChange={(e) => setCabangBaru(e.target.value)}
          />
          <button className="btn-confirm" onClick={handleTambahCabang}>Daftarkan Cabang</button>
        </div>
      </div>

      <h3 style={{color: 'var(--neon)', marginTop: '30px'}}>👥 Kelola Penempatan Karyawan</h3>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Nama Karyawan</th>
            <th>Cabang Saat Ini</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {karyawan.map(k => (
            <tr key={k.id}>
              <td>{k.nama}</td>
              <td>{k.cabang}</td>
              <td>
                <select className="input-stok" style={{width: 'auto'}}>
                  {/* Sekarang ini akan looping dari data Database */}
                  {cabang.map(c => <option key={c.id} value={c.id}>{c.nama_cabang}</option>)}
                </select>
                <button className="btn-confirm" style={{marginLeft: '10px', padding: '5px'}}>Pindah</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// LoginPage & AdminDashboard tetap seperti sebelumnya, 
// pastikan AdminDashboard menerima props 'user' jika ingin menampilkan nama cabangnya.
function LoginPage({ onLogin, onCancel }) {
    const [password, setPassword] = useState("");
    return (
      <div className="login-container">
        <div className="login-box">
          <h1 className="logo-neon">Internal Access</h1>
          <p style={{color: '#888', marginBottom: '20px'}}>Satu Kunci untuk Semua Role</p>
          <input type="password" placeholder="Password" className="login-input" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLogin(password)} />
          <button className="btn-confirm" style={{width: '100%'}} onClick={() => onLogin(password)}>VERIFIKASI</button>
          <button className="btn-cancel" style={{width: '100%', marginTop: '10px'}} onClick={onCancel}>KEMBALI</button>
        </div>
      </div>
    );
  }

function AdminDashboard({ setMode, user }) {
  const [pesanan, setPesanan] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [view, setView] = useState('pesanan');

  const ambilData = () => {
    fetch('airy-reverence-production.up.railway.app/api/admin/pesanan').then(res => res.json()).then(setPesanan);
    fetch('airy-reverence-production.up.railway.app/api/admin/inventory').then(res => res.json()).then(setInventory);
  };

  useEffect(() => {
    ambilData();
    const interval = setInterval(ambilData, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleSelesai = async (id) => {
    if (!window.confirm("Yakin pesanan ini sudah selesai dan ingin dihapus?")) return;
    try {
      const response = await fetch(`airy-reverence-production.up.railway.app/api/admin/pesanan/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert("Pesanan diselesaikan!");
        ambilData();
      }
    } catch (err) {
      console.error("Gagal hapus:", err);
    }
  };

  const handleUpdateStok = async (id, nilaiBaru) => {
    try {
      const response = await fetch(`airy-reverence-production.up.railway.app/api/admin/update-stok/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jumlah: nilaiBaru })
      });
      if (response.ok) {
        alert("Stok berhasil diupdate!");
        ambilData();
      }
    } catch (err) {
      console.error("Gagal update stok:", err);
    }
  };

  return (
    <div className="admin-container" style={{ padding: '20px' }}>
      <div className="admin-nav">
        <button onClick={() => setMode('welcome')} style={{ background: '#ff4d4d', color: 'white' }}>Log Out</button>
        <button onClick={() => setView('pesanan')} className={view === 'pesanan' ? 'active' : ''}>Pesanan</button>
        <button onClick={() => setView('stok')} className={view === 'stok' ? 'active' : ''}>Stok</button>
      </div>
      
      <h2 style={{ textAlign: 'center', color: 'var(--neon)', margin: '20px 0' }}>
        Dashboard: {view === 'pesanan' ? 'Daftar Pesanan' : 'Manajemen Stok'}
      </h2>

      <div className="table-wrapper">
        <table className="admin-table">
          {view === 'pesanan' ? (
            <>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pembeli</th>
                  <th>Detail</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pesanan.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.waktu_pesan).toLocaleTimeString()}</td>
                    <td>{p.nama_pembeli}</td>
                    <td>{p.detail_pesanan}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {/* TOMBOL LIHAT BUKTI BARU */}
                        {p.bukti_transfer ? (
                          <button 
                            className="btn-add" 
                            style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#444' }}
                            onClick={() => window.open(`airy-reverence-production.up.railway.app/uploads/${p.bukti_transfer}`, '_blank')}
                          >
                            🖼️ Bukti
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#666' }}>No Pic</span>
                        )}

                        <button className="btn-confirm" style={{ padding: '5px 10px' }} onClick={() => handleSelesai(p.id)}>
                          Selesai
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Nama Teh</th>
                  <th>Stok Sekarang</th>
                  <th>Update Stok</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => (
                  <tr key={item.id}>
                    <td>{item.nama_teh}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--neon)' }}>{item.stok}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input 
                          type="number" 
                          className="input-stok" 
                          defaultValue={item.stok} 
                          id={`input-stok-${item.id}`} 
                        />
                        <button 
                          className="btn-confirm" 
                          style={{ padding: '5px 10px' }}
                          onClick={() => {
                            const inputVal = document.getElementById(`input-stok-${item.id}`).value;
                            handleUpdateStok(item.id, inputVal);
                          }}
                        >
                          Simpan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}
export default App;