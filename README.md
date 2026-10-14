# Aplikasi Pengelolaan Barang

## Informasi Aplikasi

Aplikasi ini membantu mencatat dan mengelola penerimaan barang gudang. Admin dapat mengelola kategori, subkategori beserta batas harga, dan akun pengguna, sedangkan Operator dapat mencatat barang masuk beserta rincian itemnya. Setiap detail barang dapat diverifikasi secara terpisah; catatan juga mendukung lampiran surat dan validasi agar total harga tidak melebihi batas subkategori. Data barang masuk dapat dicari, difilter, diurutkan, diekspor, dan dicetak sebagai surat.

## Link Project

1. **Link Deployment (Live App):** [BarangIn](https://barangin.ishlahmuzakki.workers.dev/)
2. **Link Video Demo:** [BarangIn Demo](https://drive.google.com/drive/folders/1YrtAykgqTFnqizdCgJkQOhtw-S2pNiWb?usp=sharing).

## Tech Stack

1. **Frontend:** React, TypeScript, Vite
2. **Backend:** NestJS, TypeScript, Prisma ORM
3. **Database:** PostgreSQL di Supabase

## Petunjuk Instalasi Lokal

### Node.js dan Yarn

1. Gunakan Node.js 22 LTS (Jod) versi `22.23.3`. Jika memakai NVM, jalankan:

   ```sh
   nvm install 22.23.3
   nvm use 22.23.3
   ```

   Jika belum memakai NVM, pasang Node.js `v22.23.3` dari [nodejs.org](https://nodejs.org/en/download).

2. Pastikan `node --version` menampilkan `v22.23.3` dan Corepack tersedia:

   ```sh
   node --version
   corepack --version
   ```

3. Aktifkan Corepack dan siapkan Yarn versi `1.22.22` sesuai pin project:

   ```sh
   corepack enable
   corepack prepare yarn@1.22.22 --activate
   corepack yarn --version
   ```

   Perintah terakhir harus menampilkan `1.22.22`. Jalankan instalasi dependency dari folder `client` atau `server` menggunakan `corepack yarn install --frozen-lockfile`.

### Backend dan Database

1. Buat project PostgreSQL di Supabase, lalu dari root repository jalankan:

   ```sh
   cd server
   cp .env.example .env
   ```

2. Isi `DATABASE_URL` di `server/.env` dengan connection string PostgreSQL Supabase. Isi juga `JWT_SECRET` dengan string rahasia minimal 32 karakter.
3. Pasang dependency, terapkan schema, dan masukkan data dummy:

   ```sh
   corepack yarn install --frozen-lockfile
   corepack yarn db:push
   corepack yarn db:seed
   ```

4. Jalankan API:

   ```sh
   corepack yarn start:dev
   ```

   API berjalan di `http://localhost:3000`.

### Frontend

Buka terminal baru dari root repository:

```sh
cd client
corepack yarn install --frozen-lockfile
corepack yarn dev
```

Frontend berjalan di `http://localhost:5173` dan secara default memakai API `http://localhost:3000`. Jika alamat API berbeda, buat `client/.env` dengan `VITE_API_URL=http://localhost:3000` lalu sesuaikan nilainya.

## Akun Pengujian

Akun berikut tersedia setelah `corepack yarn db:seed` berhasil. Password seed hanya untuk development.

| Role     | Username     | Password      |
| -------- | ------------ | ------------- |
| Admin    | `admin001`   | `Admin1234`   |
| Operator | `operator01` | `Operator123` |
| Operator | `operator02` | `Operator123` |

Jangan gunakan akun atau seed dummy pada environment production. Detail endpoint backend tersedia di [server/README.md](server/README.md).
