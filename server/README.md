<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Logo NestJS" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">Framework <a href="http://nodejs.org" target="_blank">Node.js</a> yang progresif untuk membangun aplikasi server yang efisien dan mudah dikembangkan.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="Versi NPM" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Lisensi paket" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="Unduhan NPM" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="Build CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Komunitas Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Pendukung di Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsor di Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donasi"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Dukung project ini"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Ikuti di Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## API Pengelolaan Barang

API REST berbasis NestJS untuk pengelolaan barang. PostgreSQL disediakan
oleh Supabase dan struktur database didefinisikan di `prisma/schema.prisma`.

### Menyiapkan Supabase

1. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` dengan
  connection string PostgreSQL dari Supabase. Isi `JWT_SECRET` dengan nilai
  acak yang bersifat rahasia.
2. Pasang dependency dengan `corepack yarn install --frozen-lockfile`.
3. Terapkan schema dengan `corepack yarn db:push`.
4. Masukkan data dummy untuk development dengan `corepack yarn db:seed`.
5. Jalankan API dengan `corepack yarn start:dev`.

Seed membuat akun development berikut: `admin001` / `Admin1234`, `operator01` /
`Operator123`, dan `operator02` / `Operator123`. Seed juga memasukkan kategori,
subkategori, dan data barang masuk berbahasa Indonesia. Jangan jalankan seed
dummy di production.

Secara default, server berjalan di port `3000`. Route yang dilindungi
menggunakan header `Authorization: Bearer <accessToken>` yang diperoleh dari
`POST /auth/login`.

### Daftar endpoint API

- `POST /auth/login`, `GET /auth/me`
- `GET/POST/PATCH/DELETE /categories`
- `GET/POST/PATCH/DELETE /sub-categories`
- `GET/POST/PATCH/DELETE /users`, `PATCH /users/:id/lock`
- `GET/POST/PATCH/DELETE /incoming`
- `POST/GET /incoming/:id/attachment` (field multipart `file`; doc/docx/zip, maksimal 10 MB)
- `PATCH /incoming/:id/details/:detailId/verification` (Admin; status verifikasi per detail barang), `GET /incoming/:id/letter`
- `GET /incoming/export.csv`

Endpoint daftar menggunakan parameter `page` dengan 10 data per halaman. Filter
daftar barang masuk menggunakan `categoryId`, `subCategoryId`, `year`, `q`,
`operatorId`, `sortBy`, dan `sortOrder`. `sortBy` menerima `date`, `source`, atau
`total`, sedangkan `sortOrder` menerima `asc` atau `desc`. Akun Operator hanya
dapat melihat catatan barang masuk miliknya. Pengelolaan data master dan user
hanya tersedia untuk Admin.

Nilai uang dikirim sebagai bilangan bulat dalam rupiah. Request barang masuk
menggunakan `source`, `categoryId`, `subCategoryId`, `operatorId` (opsional untuk
Admin), `letterNumber` (opsional), serta array `items` yang berisi `name`,
`price`, `quantity`, `unit`, dan `expiresAt` (opsional). Lampiran diunggah
terpisah ke `POST /incoming/:id/attachment` sebagai data multipart dengan key
`file`. File disimpan di `UPLOAD_DIR` (default: `server/uploads`).

## Instalasi project

```bash
$ corepack yarn install --frozen-lockfile
```

## Kompilasi dan menjalankan project

```bash
# mode pengembangan
$ corepack yarn start

# mode watch
$ corepack yarn start:dev

# mode production
$ corepack yarn start:prod
```

## Menjalankan test

```bash
# unit test
$ corepack yarn test

# test e2e
$ corepack yarn test:e2e

# cakupan test
$ corepack yarn test:cov
```

## Deployment

Saat siap men-deploy aplikasi NestJS ke production, lakukan langkah-langkah
yang diperlukan agar aplikasi berjalan secara efisien. Informasi lebih lanjut
tersedia di [dokumentasi deployment](https://docs.nestjs.com/deployment).

Jika membutuhkan platform cloud untuk men-deploy aplikasi NestJS, lihat
[Mau](https://mau.nestjs.com), platform resmi untuk deployment aplikasi NestJS
di AWS. Deployment dapat dilakukan dengan beberapa langkah berikut:

```bash
$ corepack yarn global add @nestjs/mau
$ mau deploy
```

Dengan Mau, aplikasi dapat di-deploy dalam beberapa langkah sehingga Anda dapat
berfokus pada pengembangan fitur, bukan pengelolaan infrastruktur.

## Observabilitas

Pada aplikasi production, observabilitas penting untuk memahami perilaku
sistem, mendeteksi masalah lebih awal, dan menjaga kinerjanya tetap andal.

[NestJS Observe](https://observe.nestjs.com) menginstrumentasi aplikasi NestJS
secara otomatis agar kinerja sistem dapat dipantau dengan konfigurasi minimal:

- **Distributed tracing:** Melacak request antarservice dan memahami alurnya di dalam sistem.
- **Analisis waterfall:** Memvisualisasikan eksekusi request dan menemukan proses lambat, hambatan, atau keterlambatan.
- **Analisis kinerja:** Menganalisis kinerja aplikasi secara real time dan menemukan bagian yang perlu dioptimalkan.
- **Metrik:** Memantau metrik aplikasi dan infrastruktur untuk mengetahui kesehatan serta tren kinerja sistem.
- **Logging:** Memusatkan dan menghubungkan log dengan trace serta data telemetri lainnya.
- **Pelacakan error:** Mendeteksi error dan menyelidiki penyebabnya beserta konteks terkait.
- **Pemantauan SLA:** Memantau target layanan dan mendeteksi saat nilainya mendekati atau melewati batas.
- **Alarm dan notifikasi:** Mengirim peringatan untuk error kritis, penurunan kinerja, pelanggaran SLA, dan anomali lainnya.

## Sumber daya

Berikut beberapa sumber daya yang dapat membantu saat menggunakan NestJS:

- Pelajari framework ini melalui [dokumentasi NestJS](https://docs.nestjs.com).
- Ajukan pertanyaan dan dapatkan bantuan di [kanal Discord](https://discord.gg/G7Qnnhy).
- Dapatkan pengalaman praktik melalui [kursus video resmi](https://courses.nestjs.com/).
- Deploy aplikasi ke AWS dengan [NestJS Mau](https://mau.nestjs.com).
- Instrumentasi aplikasi dengan [NestJS Observe](https://observe.nestjs.com) untuk memantau trace, metrik, log, error, dan kinerja.
- Visualisasikan dan jelajahi aplikasi melalui [NestJS Devtools](https://devtools.nestjs.com).
- Dapatkan bantuan project melalui [dukungan enterprise](https://enterprise.nestjs.com).
- Ikuti kabar terbaru di [X](https://x.com/nestframework) dan [LinkedIn](https://linkedin.com/company/nestjs).
- Cari lowongan atau kandidat melalui [papan lowongan NestJS](https://jobs.nestjs.com).

## Dukungan

NestJS adalah project open source berlisensi MIT yang berkembang berkat sponsor
dan dukungan para kontributor. Untuk ikut mendukungnya, [baca informasi lebih lanjut](https://docs.nestjs.com/support).

## Tetap terhubung

- Pembuat - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Situs web - [NestJS](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## Lisensi

NestJS menggunakan [lisensi MIT](https://github.com/nestjs/nest/blob/master/LICENSE).
