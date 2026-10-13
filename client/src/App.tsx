import { FormEvent, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import homeImage from './assets/home.jpg';
import jmcLogo from './assets/logo-jmc.png';
import jmcLogoDark from './assets/logo-jmc-dark.png';
import {
  api,
  Category,
  downloadIncomingAttachment,
  fetchAll,
  getHttpError,
  Incoming,
  IncomingItem,
  money,
  PageResult,
  queryString,
  Role,
  SessionUser,
  SubCategory,
  User,
} from './api';

type Section = 'incoming' | 'categories' | 'sub-categories' | 'users';
type Notice = { type: 'success' | 'error'; text: string };
type ItemForm = { id?: number; name: string; price: string; quantity: string; unit: string; expiresAt: string };
const emptyItem = (): ItemForm => ({ name: '', price: '', quantity: '', unit: 'Buah', expiresAt: '' });
const incomingDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Jakarta',
});
function loadSavedUser(): SessionUser | null {
  const saved = localStorage.getItem('inventory-user');
  const token = localStorage.getItem('inventory-token');
  if (!saved || !token) {
    localStorage.removeItem('inventory-user');
    localStorage.removeItem('inventory-token');
    return null;
  }
  try {
    const user = JSON.parse(saved) as Partial<SessionUser>;
    if (
      typeof user.id === 'number' &&
      Number.isSafeInteger(user.id) &&
      typeof user.username === 'string' &&
      typeof user.name === 'string' &&
      (user.role === 'ADMIN' || user.role === 'OPERATOR')
    ) {
      return user as SessionUser;
    }
  } catch {
    localStorage.removeItem('inventory-user');
    localStorage.removeItem('inventory-token');
    return null;
  }
  localStorage.removeItem('inventory-user');
  localStorage.removeItem('inventory-token');
  return null;
}
const formatIncomingDateTime = (value: string) => {
  const parts = Object.fromEntries(
    incomingDateTimeFormatter.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
};

function App() {
  const [user, setUser] = useState<SessionUser | null>(loadSavedUser);
  const [section, setSection] = useState<Section>('incoming');
  const [masterDataOpen, setMasterDataOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);

  const notify = useCallback((text: string, type: Notice['type'] = 'success') => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice({ text, type });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 4000);
  }, []);

  const signOut = () => {
    localStorage.removeItem('inventory-token');
    localStorage.removeItem('inventory-user');
    setProfileOpen(false);
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={(nextUser) => setUser(nextUser)} notify={notify} notice={notice} />;
  }

  const masterDataActive = section === 'categories' || section === 'sub-categories';
  const navigation: { key: 'incoming' | 'master-data' | 'users'; label: string; icon: string }[] = [
    { key: 'incoming', label: 'Barang Masuk', icon: '▤' },
    ...(user.role === 'ADMIN'
      ? [
        { key: 'master-data' as const, label: 'Master Data', icon: '◈' },
        { key: 'users' as const, label: 'Manajemen User', icon: '♙' },
      ]
      : []),
  ];

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
        <div className="brand"><img src={jmcLogo} alt="Logo JMC" /><span>Aplikasi Pengelolaan Barang</span></div>
        <nav className="side-nav" aria-label="Navigasi utama">
          {navigation.map((item) => (
            <div className="nav-group" key={item.key}>
              <button
                className={`nav-item ${item.key === 'master-data' ? masterDataActive : section === item.key ? 'active' : ''}`}
                aria-expanded={item.key === 'master-data' ? masterDataOpen || masterDataActive : undefined}
                onClick={() => {
                  if (item.key === 'master-data') setMasterDataOpen((open) => !open);
                  else setSection(item.key);
                }}
              >
                <span className="nav-icon">{item.icon}</span>{item.label}
              </button>
              {item.key === 'master-data' && (masterDataOpen || masterDataActive) && (
                <div className="nav-submenu">
                  <button className={`nav-subitem ${section === 'categories' ? 'active' : ''}`} title="Kategori" onClick={() => setSection('categories')}>
                    <span className="nav-subicon">◈</span>Kategori
                  </button>
                  <button className={`nav-subitem ${section === 'sub-categories' ? 'active' : ''}`} title="Sub Kategori" onClick={() => setSection('sub-categories')}>
                    <span className="nav-subicon">◇</span>Sub Kategori
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <main className={`main-area ${sidebarOpen ? '' : 'main-expanded'}`}>
        <header className="topbar">
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarOpen ? 'Sembunyikan menu samping' : 'Tampilkan menu samping'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Sembunyikan menu samping' : 'Tampilkan menu samping'}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="topbar-right">
            <button className="notification-button" type="button" aria-label="Notifikasi" title="Notifikasi">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
            </button>
            <div className="profile-menu" ref={profileMenuRef}>
              <button
                className="profile-trigger"
                aria-label={`Profil ${user.name}`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                title="Profil"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <span className="topbar-avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
                <span className="profile-trigger-info">
                  <strong>{user.name}</strong>
                  <small>{user.role === 'ADMIN' ? 'Administrator' : 'Operator'}</small>
                </span>
                <svg className="profile-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m6 8 4 4 4-4" />
                </svg>
              </button>
              {profileOpen && (
                <div className="profile-dropdown" role="menu">
                  <button className="profile-logout" role="menuitem" onClick={signOut}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                      <path d="M10 17l5-5-5-5M15 12H3m9-7h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-content">
          {section === 'incoming' && <IncomingPage user={user} refreshKey={refreshKey} refresh={() => setRefreshKey((value) => value + 1)} notify={notify} />}
          {section === 'categories' && <CategoriesPage refreshKey={refreshKey} refresh={() => setRefreshKey((value) => value + 1)} notify={notify} />}
          {section === 'sub-categories' && <SubCategoriesPage refreshKey={refreshKey} refresh={() => setRefreshKey((value) => value + 1)} notify={notify} />}
          {section === 'users' && <UsersPage refreshKey={refreshKey} refresh={() => setRefreshKey((value) => value + 1)} notify={notify} />}
        </div>
      </main>
      {notice && <div role="status" className={`toast ${notice.type}`}>{notice.text}</div>}
    </div>
  );
}

function Login({ onLogin, notify, notice }: { onLogin: (user: SessionUser) => void; notify: (text: string, type?: Notice['type']) => void; notice: Notice | null }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ accessToken: string; user: SessionUser }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(form),
      });
      localStorage.setItem('inventory-token', result.accessToken);
      localStorage.setItem('inventory-user', JSON.stringify(result.user));
      onLogin(result.user);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Tidak dapat terhubung ke server', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-content">
        <section className="login-card">
          <div className="login-brand"><img src={jmcLogoDark} alt="Logo JMC" /><span>Aplikasi Pengelolaan Barang</span></div>
          <p className="eyebrow">PT. JMC Indonesia</p>
          <h1>LOGIN</h1>
          <p className="muted">Selamat Datang, silahkan masukkan username dan password.</p>
          <form onSubmit={submit} className="login-form">
            <Field label="Username" className="visually-hidden-label"><input required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Username" /></Field>
            <Field label="Password" className="visually-hidden-label"><input required type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" /></Field>
            <button className="button primary login-submit" disabled={busy}>{busy ? 'Memproses...' : 'Masuk'} <span>→</span></button>
          </form>
        </section>
        <div className="login-image">
          <img src={homeImage} alt="Ilustrasi pengelolaan barang JMC" />
        </div>
      </div>
      <p className="login-footer">Created by Muhammad Ishlahul M.</p>
      {notice && <div role="alert" className={`toast ${notice.type}`}> {notice.text}</div>}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

function PageHeading({ title, action, branch }: { title: string; action?: React.ReactNode; branch?: string; }) {
  return <div className="page-heading"><div>
    <span className="crumb-separator"><strong>Home / {branch ? `${branch} / ` : ''}{title}</strong></span>
    <h1>{title}</h1>
  </div>{action}</div>;
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  const pages = Array.from(
    { length: Math.max(0, Math.min(4, totalPages - page + 1)) },
    (_, index) => page + index,
  );

  return (
    <nav className="pager" aria-label="Navigasi halaman">
      <div className="pager-actions">
        {page > 1 && <button className="pager-direction" onClick={() => onPage(page - 1)}>‹ prev</button>}
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            className={`pager-number ${pageNumber === page ? 'active' : ''}`}
            aria-current={pageNumber === page ? 'page' : undefined}
            aria-label={`Halaman ${pageNumber}`}
            onClick={() => onPage(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        {page < totalPages && <button className="pager-direction" onClick={() => onPage(page + 1)}>next ›</button>}
      </div>
    </nav>
  );
}

function EmptyState({ title = 'Belum ada data', detail = 'Data yang sesuai belum tersedia.' }: { title?: string; detail?: string }) {
  return <div className="empty-state"><span className="empty-icon">▤</span><strong>{title}</strong><span>{detail}</span></div>;
}

function Modal({ title, children, onClose, onSubmit, busy = false }: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: (event: FormEvent) => void; busy?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={onSubmit}><div className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Tutup" onClick={onClose}>×</button></div><div className="modal-body">{children}</div><div className="modal-footer"><button type="button" className="button outline" onClick={onClose}>Batal</button><button className="button primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</button></div></form></div>;
}

type PageProps = { refreshKey: number; refresh: () => void; notify: (text: string, type?: Notice['type']) => void };

function IncomingPage({ user, refreshKey, refresh, notify }: PageProps & { user: SessionUser }) {
  const [filter, setFilter] = useState({ categoryId: '', subCategoryId: '', year: '', q: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Incoming | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [records, setRecords] = useState<PageResult<Incoming>>({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operators, setOperators] = useState<User[]>([]);
  const query = queryString({ ...filter, page });
  const reload = useCallback(() => {
    setLoading(true);
    api<PageResult<Incoming>>(`/incoming${query}`)
      .then((data) => { setRecords(data); setError(''); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Gagal memuat barang masuk'))
      .finally(() => setLoading(false));
  }, [query]);
  useEffect(() => { reload(); }, [reload, refreshKey]);
  useEffect(() => {
    fetchAll<Category>('/categories').then(setCategories).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat kategori', 'error'));
    if (user.role === 'ADMIN') {
      fetchAll<User>('/users').then((rows) => setOperators(rows.filter((entry) => entry.role === 'OPERATOR'))).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat operator', 'error'));
    }
  }, [user.role, notify]);
  useEffect(() => {
    if (!filter.categoryId) { setSubCategories([]); return; }
    fetchAll<SubCategory>(`/sub-categories?categoryId=${filter.categoryId}`).then(setSubCategories).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat sub kategori', 'error'));
  }, [filter.categoryId, notify]);
  const setField = (key: keyof typeof filter, value: string) => {
    setFilter((current) => ({ ...current, [key]: value, ...(key === 'categoryId' ? { subCategoryId: '' } : {}) }));
    setPage(1);
  };
  const changeSort = (sortBy: string) => {
    setField('sortBy', sortBy);
    setFilter((current) => ({ ...current, sortBy, sortOrder: current.sortBy === sortBy && current.sortOrder === 'asc' ? 'desc' : 'asc' }));
  };
  const exportExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = await import('exceljs');
      const entries = await fetchAll<Incoming>(`/incoming${queryString(filter)}`);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Inventaris';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Barang Masuk');
      sheet.columns = [
        { header: 'Tanggal', key: 'date', width: 22 },
        { header: 'Asal Barang', key: 'source', width: 30 },
        { header: 'Operator', key: 'operator', width: 24 },
        { header: 'Kategori', key: 'category', width: 24 },
        { header: 'Sub Kategori', key: 'subCategory', width: 24 },
        { header: 'Nomor Surat', key: 'letterNumber', width: 22 },
        { header: 'Kode Barang', key: 'itemCode', width: 20 },
        { header: 'Nama Barang', key: 'itemName', width: 30 },
        { header: 'Harga (Rp)', key: 'price', width: 18 },
        { header: 'Jumlah', key: 'quantity', width: 14 },
        { header: 'Total (Rp)', key: 'total', width: 20 },
        { header: 'Verifikasi', key: 'verification', width: 20 },
      ];
      entries.forEach((entry) => {
        entry.items.forEach((item) => sheet.addRow({
          date: new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta',
          }).format(new Date(entry.createdAt)),
          source: entry.source,
          operator: entry.operatorName,
          category: entry.categoryName,
          subCategory: entry.subCategoryName,
          letterNumber: entry.letterNumber ?? '',
          itemCode: `${entry.categoryCode}-${item.id}`,
          itemName: item.name,
          price: item.price,
          quantity: `${item.quantity} ${item.unit}`,
          total: item.total,
          verification: item.verified ? 'Terverifikasi' : 'Belum diverifikasi',
        }));
      });
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B5E' } };
      sheet.getColumn('price').numFmt = '"Rp" #,##0';
      sheet.getColumn('total').numFmt = '"Rp" #,##0';
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: 'A1', to: 'L1' };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'barang-masuk.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`${entries.reduce((count, entry) => count + entry.items.length, 0)} detail barang berhasil diekspor`);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Gagal mengekspor data', 'error');
    } finally {
      setExporting(false);
    }
  };
  const removeRecord = async (record: Incoming) => {
    if (!window.confirm(`Hapus barang masuk dari "${record.source}"?`)) return;
    try { await api(`/incoming/${record.id}`, { method: 'DELETE' }); notify('Data barang masuk berhasil dihapus'); refresh(); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menghapus data', 'error'); }
  };
  const toggleVerification = async (record: Incoming, item: IncomingItem) => {
    try { await api(`/incoming/${record.id}/details/${item.id}/verification`, { method: 'PATCH', body: JSON.stringify({ isVerified: !item.verified }) }); notify('Status verifikasi diperbarui'); refresh(); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal memperbarui verifikasi', 'error'); }
  };
  const printLetter = async (record: Incoming) => {
    const popup = window.open('', '_blank');
    if (!popup) {
      notify('Izinkan popup pada browser untuk mencetak surat', 'error');
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/incoming/${record.id}/letter`, { headers: { Authorization: `Bearer ${localStorage.getItem('inventory-token')}` } });
      if (!response.ok) throw await getHttpError(response);
      const html = await response.text();
      popup.document.write(html);
      popup.document.close();
    } catch (reason) {
      popup.close();
      notify(reason instanceof Error ? reason.message : 'Gagal membuka surat masuk', 'error');
    }
  };
  const saveIncoming = async (event: FormEvent, values: IncomingFormValues) => {
    event.preventDefault();
    const total = values.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const chosenSubCategory = subCategories.find((item) => item.id === Number(values.subCategoryId));
    if (chosenSubCategory && total > chosenSubCategory.priceLimit) {
      notify('Total harga barang melebihi batas harga sub kategori', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...(user.role === 'ADMIN' ? { operatorId: values.operatorId } : {}),
        categoryId: Number(values.categoryId),
        subCategoryId: Number(values.subCategoryId),
        source: values.source,
        letterNumber: values.letterNumber,
        items: values.items.map((item) => ({ ...(item.id === undefined ? {} : { id: item.id }), name: item.name, price: Number(item.price), quantity: Number(item.quantity), unit: item.unit, expiresAt: item.expiresAt || null })),
      };
      const saved = await api<Incoming>(editRecord ? `/incoming/${editRecord.id}` : '/incoming', { method: editRecord ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      if (values.file) {
        const fileBody = new FormData();
        fileBody.set('file', values.file);
        await api(`/incoming/${saved.id}/attachment`, { method: 'POST', body: fileBody });
      }
      notify(editRecord ? 'Barang masuk berhasil diperbarui' : 'Barang masuk berhasil ditambahkan');
      setOpen(false);
      setEditRecord(null);
      refresh();
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menyimpan barang masuk', 'error'); }
    finally { setSaving(false); }
  };
  const years = Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() - index));

  if (open) {
    return <IncomingFormPage
      categories={categories}
      operators={operators}
      user={user}
      record={editRecord}
      saving={saving}
      notify={notify}
      onClose={() => { setOpen(false); setEditRecord(null); }}
      onSave={saveIncoming}
    />;
  }

  return <>
    <PageHeading title="Barang Masuk" action={<div className="heading-actions"><button className="button outline" disabled={exporting} onClick={exportExcel}><span>↓</span> {exporting ? 'Mengekspor...' : 'Export Excel'}</button></div>} />
    <section className="panel">
      <div className="filters incoming-filters">
        <button className="button primary" onClick={() => { setEditRecord(null); setOpen(true); }}>＋ Tambah Data</button>
        <div className="incoming-filter-controls">
          <select aria-label="Filter kategori" value={filter.categoryId} onChange={(event) => setField('categoryId', event.target.value)}><option value="">Semua kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}</select>
          <select aria-label="Filter sub kategori" disabled={!filter.categoryId} value={filter.subCategoryId} onChange={(event) => setField('subCategoryId', event.target.value)}><option value="">Semua sub kategori</option>{subCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select aria-label="Filter tahun" value={filter.year} onChange={(event) => setField('year', event.target.value)}><option value="">Semua tahun</option>{years.map((year) => <option key={year}>{year}</option>)}</select>
          <label className="search-box"><input value={filter.q} placeholder="Cari data..." onChange={(event) => setField('q', event.target.value)} /><span>⌕</span></label>
        </div>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="table-wrap"><table className="incoming-items-table"><thead><tr>
        <th>NO</th>
        <th className="align-center">ACTION</th>
        <th>TANGGAL <button className="sort-button" onClick={() => changeSort('createdAt')}>↕</button></th>
        <th>ASAL BARANG <button className="sort-button" onClick={() => changeSort('source')}>↕</button></th>
        <th>PENERIMA</th>
        <th>KODE</th>
        <th>NAMA</th>
        <th>HARGA (RP)</th>
        <th>JUMLAH</th>
        <th>TOTAL <button className="sort-button" onClick={() => changeSort('total')}>↕</button></th>
        <th>STATUS</th>
      </tr></thead><tbody>
          {loading ? <tr><td colSpan={11} className="table-message">Memuat data...</td></tr> : records.data.length === 0 ? <tr><td colSpan={11}><EmptyState /></td></tr> : records.data.map((record, recordIndex) => (
            <Fragment key={record.id}>
              {record.items.map((item, index) => (
                <tr className={index % 2 === 0 ? 'item-row-even' : 'item-row-odd'} key={item.id}>
                  {index === 0 && <>
                    <td rowSpan={record.items.length}>{(records.page - 1) * records.pageSize + recordIndex + 1}</td>
                    <td rowSpan={record.items.length}>
                      <div className="row-actions">
                        <button title="Edit" onClick={() => { setEditRecord(record); setOpen(true); }}>✎</button>
                        <button title="Cetak surat" onClick={() => printLetter(record)}><FileIcon /></button>
                        <button title="Hapus" className="danger-text" onClick={() => removeRecord(record)}><TrashIcon /></button>
                      </div>
                    </td>
                    <td rowSpan={record.items.length}>{formatIncomingDateTime(record.createdAt)}</td>
                    <td rowSpan={record.items.length}>{record.source}</td>
                    <td rowSpan={record.items.length}>{record.operatorName}</td>
                  </>}
                  <td><span>{record.categoryCode}{item.id}</span></td>
                  <td>{item.name}</td>
                  <td>{money(item.price)}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>{money(item.total)}</td>
                  <td>{user.role === 'ADMIN' ? <button className={`verify-toggle ${item.verified ? 'verified' : ''}`} title={item.verified ? 'Terverifikasi' : 'Belum diverifikasi'} aria-label={`${item.verified ? 'Batalkan verifikasi' : 'Verifikasi'} ${item.name}`} onClick={() => toggleVerification(record, item)}>{item.verified ? '✓' : '○'}</button> : <span className={`status-pill ${item.verified ? 'success' : 'pending'}`}>{item.verified ? 'Terverifikasi' : 'Menunggu'}</span>}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody></table></div>
      <Pager page={page} totalPages={records.totalPages} onPage={setPage} />
    </section>
  </>;
}

type IncomingFormValues = { operatorId: string; categoryId: string; subCategoryId: string; source: string; letterNumber: string; items: ItemForm[]; file: File | null };
function IncomingFormPage({ categories, operators, user, record, saving, notify, onClose, onSave }: { categories: Category[]; operators: User[]; user: SessionUser; record: Incoming | null; saving: boolean; notify: (text: string, type?: Notice['type']) => void; onClose: () => void; onSave: (event: FormEvent, values: IncomingFormValues) => void }) {
  const [values, setValues] = useState<IncomingFormValues>({
    operatorId: String(record?.operatorId ?? (user.role === 'OPERATOR' ? user.id : '')),
    categoryId: String(record?.categoryId ?? ''),
    subCategoryId: String(record?.subCategoryId ?? ''),
    source: record?.source ?? '',
    letterNumber: record?.letterNumber ?? '',
    items: record?.items.map((item) => ({ id: item.id, name: item.name, price: String(item.price), quantity: String(item.quantity), unit: item.unit, expiresAt: item.expiresAt?.slice(0, 10) ?? '' })) ?? [emptyItem()],
    file: null,
  });
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  useEffect(() => {
    if (!values.categoryId) { setSubCategories([]); return; }
    fetchAll<SubCategory>(`/sub-categories?categoryId=${values.categoryId}`)
      .then(setSubCategories)
      .catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat sub kategori', 'error'));
  }, [values.categoryId, notify]);
  const selectedSubCategory = subCategories.find((item) => item.id === Number(values.subCategoryId));
  const updateItem = (index: number, key: keyof ItemForm, value: string) => setValues((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const formatPrice = (value: string) => value.replace(/\D/g, '');
  const downloadAttachment = async () => {
    if (!record) return;
    try {
      const { blob, filename } = await downloadIncomingAttachment(record.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Gagal mengunduh lampiran', 'error');
    }
  };
  return <>
    <form id="incoming-form" className="panel incoming-form-panel" onSubmit={(event) => onSave(event, values)}>
      <section className="incoming-form-section">
        <h2 className="incoming-section-heading">Informasi Umum</h2>
        <div className="incoming-general-content">
          <div className="incoming-general-stack">
            {user.role === 'ADMIN'
              ? <Field label="Operator"><select required value={values.operatorId} onChange={(event) => setValues({ ...values, operatorId: event.target.value })}><option value="">Pilih operator</option>{operators.filter((operator) => !operator.isLocked || operator.id === record?.operatorId).map((operator) => <option key={operator.id} value={operator.id}>{operator.name}{operator.isLocked ? ' (Terkunci)' : ''}</option>)}</select></Field>
              : <Field label="Operator"><input readOnly value={`${user.name} (Anda)`} /></Field>}
            <Field label="Kategori"><select required value={values.categoryId} onChange={(event) => setValues({ ...values, categoryId: event.target.value, subCategoryId: '' })}><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}</select></Field>
          </div>
          <div className="incoming-subcategory-fields">
            <Field label="Sub Kategori"><select required disabled={!values.categoryId} value={values.subCategoryId} onChange={(event) => setValues({ ...values, subCategoryId: event.target.value })}><option value="">Pilih sub kategori</option>{subCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
            <Field label="Batas Harga"><input readOnly value={selectedSubCategory ? money(selectedSubCategory.priceLimit) : ''} placeholder="Pilih sub kategori" /></Field>
          </div>
          <Field label="Asal Barang" className="incoming-source-field"><input required maxLength={200} value={values.source} onChange={(event) => setValues({ ...values, source: event.target.value })} /></Field>
          <div className="incoming-document-fields">
            <Field label="Nomor Surat"><input maxLength={100} value={values.letterNumber} onChange={(event) => setValues({ ...values, letterNumber: event.target.value })} /></Field>
            <Field label="Lampiran">
              <input type="file" accept=".doc,.docx,.zip" onChange={(event) => setValues({ ...values, file: event.target.files?.[0] ?? null })} />
              {values.file
                ? <small className="field-hint">File dipilih: {values.file.name}</small>
                : record?.attachmentUrl
                  ? <button className="attachment-link" type="button" onClick={downloadAttachment}>Unduh lampiran ({record.attachmentUrl.split('.').pop()?.toUpperCase()})</button>
                  : <small className="field-hint">DOC, DOCX, ZIP. Maks. 10 MB.</small>}
            </Field>
          </div>
        </div>
      </section>
      <section className="incoming-form-section incoming-items-form-section">
        <h2 className="incoming-section-heading">Informasi Barang</h2>
        <div className="incoming-items-grid incoming-items-header" aria-hidden="true">
          <span>Nama Barang</span><span>Harga (Rp.)</span><span>Jumlah</span><span>Satuan</span><span>Total</span><span>Tgl. Expired</span><span />
        </div>
        <div className="incoming-items-list">
          {values.items.map((item, index) => <div className="incoming-items-grid incoming-item-form-row" key={index}>
            <Field label="Nama Barang" className="visually-hidden-label"><input required maxLength={200} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} /></Field>
            <Field label="Harga (Rp.)" className="visually-hidden-label"><div className="money-input"><input required inputMode="numeric" value={item.price ? Number(item.price).toLocaleString('id-ID') : ''} onChange={(event) => updateItem(index, 'price', formatPrice(event.target.value))} /><span>Rp.</span></div></Field>
            <Field label="Jumlah" className="visually-hidden-label"><input required type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /></Field>
            <Field label="Satuan" className="visually-hidden-label"><input required maxLength={40} value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} /></Field>
            <Field label="Total" className="visually-hidden-label"><div className="money-input readonly"><input readOnly value={item.price && item.quantity ? (Number(item.price) * Number(item.quantity)).toLocaleString('id-ID') : ''} /><span>Rp.</span></div></Field>
            <Field label="Tgl. Expired" className="visually-hidden-label"><input type="date" value={item.expiresAt} onChange={(event) => updateItem(index, 'expiresAt', event.target.value)} /></Field>
            {index === 0
              ? <button className="item-row-action add" type="button" aria-label="Tambah barang" title="Tambah barang" onClick={() => setValues({ ...values, items: [...values.items, emptyItem()] })}>+</button>
              : <button className="item-row-action remove" type="button" aria-label={`Hapus barang ${index + 1}`} title="Hapus barang" onClick={() => setValues({ ...values, items: values.items.filter((_, itemIndex) => itemIndex !== index) })}>×</button>}
          </div>)}
        </div>
      </section>
    </form>
    <div className="incoming-form-actions">
      <button className="button outline" type="button" onClick={onClose}>← Kembali</button>
      <button className="button primary" type="submit" form="incoming-form" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
    </div>
  </>;
}

function CategoriesPage({ refreshKey, refresh, notify }: PageProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Category | null | false>(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: '', name: '' });
  const [result, setResult] = useState<PageResult<Category>>({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const path = `/categories${queryString({ q: search, page })}`;
  useEffect(() => { setLoading(true); api<PageResult<Category>>(path).then(setResult).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat kategori', 'error')).finally(() => setLoading(false)); }, [path, refreshKey, notify]);
  const openModal = (category: Category | null = null) => { setModal(category); setForm({ code: category?.categoryCode ?? '', name: category?.categoryName ?? '' }); };
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await api(modal ? `/categories/${modal.id}` : '/categories', { method: modal ? 'PATCH' : 'POST', body: JSON.stringify(form) }); notify(modal ? 'Kategori berhasil diperbarui' : 'Kategori berhasil ditambahkan'); setModal(false); refresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menyimpan kategori', 'error'); } finally { setBusy(false); } };
  const remove = async (category: Category) => { if (!window.confirm(`Hapus kategori "${category.categoryName}"?`)) return; try { await api(`/categories/${category.id}`, { method: 'DELETE' }); notify('Kategori berhasil dihapus'); refresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menghapus kategori', 'error'); } };
  return <>
    <PageHeading title="Kategori" branch="Master Data" />
    <section className="panel">
      <div className="filters incoming-filters">
        <button className="button primary" onClick={() => openModal()}>＋ Tambah Data</button>
        <div className="incoming-filter-controls">
          <label className="search-box"><input value={search} placeholder="Cari data..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><span>⌕</span></label>
        </div>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th>NO</th>
        <th className="align-center">ACTION</th>
        <th>KODE</th>
        <th>NAMA KATEGORI</th>
      </tr></thead><tbody>{loading ? <tr>
        <td colSpan={4} className="table-message">Memuat data...</td>
      </tr> : result.data.length ? result.data.map((category, index) => <tr key={category.id}>
        <td>{(page - 1) * result.pageSize + index + 1}</td>
        <td><RowActions onEdit={() => openModal(category)} onDelete={() => remove(category)} /></td>
        <td><span className="code-badge">{category.categoryCode}</span></td>
        <td><strong>{category.categoryName}</strong></td>
      </tr>) : <tr><td colSpan={4}><EmptyState title="Kategori tidak ditemukan" /></td></tr>}</tbody></table></div>
      <Pager page={page} totalPages={result.totalPages} onPage={setPage} />
    </section>
    {modal !== false && <Modal title={modal ? 'Edit Kategori' : 'Tambah Kategori'} onClose={() => setModal(false)} onSubmit={save} busy={busy}><div className="form-grid user-form-grid">
      <Field label="Kode Kategori"><input required maxLength={10} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Contoh: ATK" /></Field>
      <Field label="Nama Kategori"><input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama kategori" /></Field></div></Modal>}
  </>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="row-actions"><button title="Edit" onClick={onEdit}>✎</button><button title="Hapus" className="danger-text" onClick={onDelete}><TrashIcon /></button></div>;
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h8l5 5v13H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h7" />
    </svg>
  );
}

function SubCategoriesPage({ refreshKey, refresh, notify }: PageProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<SubCategory | null | false>(false);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ categoryId: '', name: '', priceLimit: '' });
  const [result, setResult] = useState<PageResult<SubCategory>>({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const path = `/sub-categories${queryString({ q: search, page })}`;
  useEffect(() => { setLoading(true); api<PageResult<SubCategory>>(path).then(setResult).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat sub kategori', 'error')).finally(() => setLoading(false)); }, [path, refreshKey, notify]);
  useEffect(() => { fetchAll<Category>('/categories').then(setCategories).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat kategori', 'error')); }, [notify]);
  const openModal = (category: SubCategory | null = null) => { setModal(category); setForm({ categoryId: String(category?.categoryId ?? ''), name: category?.name ?? '', priceLimit: category ? String(category.priceLimit) : '' }); };
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await api(modal ? `/sub-categories/${modal.id}` : '/sub-categories', { method: modal ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, categoryId: Number(form.categoryId), priceLimit: form.priceLimit.replace(/\D/g, '') }) }); notify(modal ? 'Sub kategori berhasil diperbarui' : 'Sub kategori berhasil ditambahkan'); setModal(false); refresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menyimpan sub kategori', 'error'); } finally { setBusy(false); } };
  const remove = async (category: SubCategory) => { if (!window.confirm(`Hapus sub kategori "${category.name}"?`)) return; try { await api(`/sub-categories/${category.id}`, { method: 'DELETE' }); notify('Sub kategori berhasil dihapus'); refresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menghapus sub kategori', 'error'); } };
  return <>
    <PageHeading title="Sub Kategori" branch="Master Data" />
    <section className="panel">
      <div className="filters incoming-filters">
        <button className="button primary" onClick={() => openModal()}>＋ Tambah Data</button>
        <div className="incoming-filter-controls">
          <label className="search-box"><input value={search} placeholder="Cari data..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><span>⌕</span></label></div>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th>NO</th>
        <th className="align-center">ACTION</th>
        <th>KATEGORI BARANG</th>
        <th>SUB KATEGORI BARANG</th>
        <th>BATAS HARGA (RP)</th>
      </tr></thead><tbody>{loading ? <tr><td colSpan={5} className="table-message">Memuat data...</td></tr> : result.data.length ? result.data.map((category, index) => <tr key={category.id}><td>{(page - 1) * result.pageSize + index + 1}</td>
        <td><RowActions onEdit={() => openModal(category)} onDelete={() => remove(category)} /></td>
        <td>{category.categoryName}</td>
        <td>{category.name}</td>
        <td>{money(category.priceLimit)}</td>
      </tr>) : <tr><td colSpan={5}><EmptyState title="Sub kategori tidak ditemukan" /></td></tr>}</tbody></table></div>
      <Pager page={page} totalPages={result.totalPages} onPage={setPage} />
    </section>
    {modal !== false && <Modal title={modal ? 'Edit Sub Kategori' : 'Tambah Sub Kategori'} onClose={() => setModal(false)} onSubmit={save} busy={busy}><div className="form-grid user-form-grid">
      <Field label="Kategori"><select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}</select></Field>
      <Field label="Nama Sub Kategori"><input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama sub kategori" /></Field>
      <Field label="Batas Harga (Rp)"><input required inputMode="numeric" value={form.priceLimit ? Number(form.priceLimit).toLocaleString('id-ID') : ''} onChange={(event) => setForm({ ...form, priceLimit: event.target.value.replace(/\D/g, '') })} placeholder="0" /></Field></div></Modal>}
  </>;
}

function UsersPage({ refreshKey, refresh, notify }: PageProps) {
  const [filter, setFilter] = useState({ q: '', role: '' });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<User | null | false>(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ role: 'OPERATOR' as Role, username: '', password: '', name: '', email: '' });
  const [result, setResult] = useState<PageResult<User>>({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const path = `/users${queryString({ ...filter, page })}`;
  useEffect(() => { setLoading(true); api<PageResult<User>>(path).then(setResult).catch((reason: unknown) => notify(reason instanceof Error ? reason.message : 'Gagal memuat pengguna', 'error')).finally(() => setLoading(false)); }, [path, refreshKey, notify]);
  const openModal = (entry: User | null = null) => { setModal(entry); setForm({ role: entry?.role ?? 'OPERATOR', username: entry?.username ?? '', password: '', name: entry?.name ?? '', email: entry?.email ?? '' }); };
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); const body = { ...form }; if (modal && !body.password) delete (body as Partial<typeof body>).password; try { await api(modal ? `/users/${modal.id}` : '/users', { method: modal ? 'PATCH' : 'POST', body: JSON.stringify(body) }); notify(modal ? 'Data pengguna berhasil diperbarui' : 'Pengguna berhasil ditambahkan'); setModal(false); refresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menyimpan pengguna', 'error'); } finally { setBusy(false); } };
  const removeRecord = async (record: User) => {
    if (!window.confirm(`Hapus pengguna "${record.name}"?`)) return;
    try { await api(`/users/${record.id}`, { method: 'DELETE' }); notify('Data pengguna berhasil dihapus'); refresh(); }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal menghapus data', 'error'); }
  };
  const toggleLock = async (entry: User) => { try { await api(`/users/${entry.id}/lock`, { method: 'PATCH', body: JSON.stringify({ isLocked: !entry.isLocked }) }); notify(entry.isLocked ? 'Pengguna berhasil dibuka' : 'Pengguna berhasil dikunci'); refresh(); } catch (reason) { notify(reason instanceof Error ? reason.message : 'Gagal mengubah status pengguna', 'error'); } };
  return <>
    <PageHeading title="Manajemen User" />
    <section className="panel">
      <div className="filters user-filters">
        <button className="button primary" onClick={() => openModal()}>＋ Tambah Data</button>
        <div className="incoming-filter-controls">
          <select value={filter.role} onChange={(event) => { setFilter({ ...filter, role: event.target.value }); setPage(1); }}><option value="">Semua role</option><option value="ADMIN">Admin</option><option value="OPERATOR">Operator</option></select>
          <label className="search-box"><input value={filter.q} placeholder="Cari data..." onChange={(event) => { setFilter({ ...filter, q: event.target.value }); setPage(1); }} /><span>⌕</span></label>
        </div>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th>NO</th>
        <th className="align-center">ACTION</th>
        <th>USERNAME</th>
        <th>NAMA</th>
        <th>EMAIL</th>
        <th>ROLE</th>
        <th>STATUS</th>
      </tr></thead><tbody>{loading ? <tr><td colSpan={7} className="table-message">Memuat data...</td></tr> : result.data.length ? result.data.map((entry, index) => <tr key={entry.id}>
        <td>{(page - 1) * result.pageSize + index + 1}</td>
        <td>
          <div className="row-actions">
            <button title="Edit" onClick={() => openModal(entry)}>✎</button>
            <button title={entry.isLocked ? 'Buka kunci user' : 'Kunci user'} onClick={() => toggleLock(entry)}>{entry.isLocked ? '🔒' : '♙'}</button>
            <button title="Hapus" className="danger-text" onClick={() => removeRecord(entry)}><TrashIcon /></button>
          </div>
        </td>
        <td>{entry.username}</td>
        <td>{entry.name}</td>
        <td>{entry.email}</td>
        <td><span className={`role-pill ${entry.role === 'ADMIN' ? 'admin' : 'operator'}`}>{entry.role === 'ADMIN' ? 'Admin' : 'Operator'}</span></td>
        <td><span className={`status-pill ${entry.isLocked ? 'pending' : 'success'}`}>{entry.isLocked ? 'Terkunci' : 'Aktif'}</span></td>
      </tr>) : <tr><td colSpan={7}><EmptyState title="Pengguna tidak ditemukan" /></td></tr>}</tbody></table></div>
      <Pager page={page} totalPages={result.totalPages} onPage={setPage} />
    </section>
    {modal !== false && <Modal title={modal ? 'Edit Pengguna' : 'Tambah Pengguna'} onClose={() => setModal(false)} onSubmit={save} busy={busy}><div className="form-grid user-form-grid">
      <Field label="Role"><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}><option value="ADMIN">Admin</option><option value="OPERATOR">Operator</option></select></Field>
      <Field label="Username"><input required minLength={8} maxLength={100} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Username" /></Field>
      <Field label="Password"><input required={!modal} type="password" minLength={8} maxLength={100} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Min. 8 karakter" /></Field>
      <Field label="Nama"><input required minLength={8} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama lengkap" /></Field>
      <Field label="Email"><input required type="email" minLength={8} maxLength={100} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com" /></Field>
      </div></Modal>}
  </>;
}

export default App;
