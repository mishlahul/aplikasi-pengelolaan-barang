import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DUMMY_SEED !== 'true') {
  throw new Error('Seed dummy diblokir di production. Set ALLOW_DUMMY_SEED=true hanya jika memang diperlukan.');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diatur. Isi server/.env terlebih dahulu.');
}

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

async function upsertUser({ username, password, name, email, role }) {
  return prisma.user.upsert({
    where: { username },
    update: {
      password: hashPassword(password),
      name,
      email,
      role,
      isLocked: false,
    },
    create: {
      username,
      password: hashPassword(password),
      name,
      email,
      role,
    },
  });
}

async function upsertSubCategory(categoryId, subCategoryName, priceLimit) {
  const existing = await prisma.subCategory.findFirst({
    where: { categoryId, subCategoryName },
  });
  if (existing) {
    return prisma.subCategory.update({
      where: { id: existing.id },
      data: { priceLimit },
    });
  }
  return prisma.subCategory.create({
    data: { categoryId, subCategoryName, priceLimit },
  });
}

async function main() {
  const admin = await upsertUser({
    username: 'admin001',
    password: 'Admin1234',
    name: 'Administrator',
    email: 'admin@inventaris.local',
    role: 'ADMIN',
  });
  const operatorSari = await upsertUser({
    username: 'operator01',
    password: 'Operator123',
    name: 'Sari Puspitasari',
    email: 'sari@inventaris.local',
    role: 'OPERATOR',
  });
  const operatorBudi = await upsertUser({
    username: 'operator02',
    password: 'Operator123',
    name: 'Budi Santoso',
    email: 'budi@inventaris.local',
    role: 'OPERATOR',
  });

  const categoryMap = new Map();
  for (const category of [
    { categoryCode: 'ATK', categoryName: 'Alat Tulis Kantor' },
    { categoryCode: 'ELK', categoryName: 'Peralatan Elektronik' },
    { categoryCode: 'KBR', categoryName: 'Kebersihan dan Rumah Tangga' },
    { categoryCode: 'PRB', categoryName: 'Perabot Kantor' },
    { categoryCode: 'BHP', categoryName: 'Bahan Habis Pakai' },
    { categoryCode: 'KSN', categoryName: 'Konsumsi dan Rapat' },
  ]) {
    const saved = await prisma.category.upsert({
      where: { categoryCode: category.categoryCode },
      update: { categoryName: category.categoryName },
      create: category,
    });
    categoryMap.set(category.categoryCode, saved);
  }

  const subCategoryMap = new Map();
  for (const subCategory of [
    { code: 'ATK', name: 'Kertas dan Buku', limit: '5000000' },
    { code: 'ATK', name: 'Alat Tulis', limit: '3000000' },
    { code: 'ELK', name: 'Komputer dan Aksesori', limit: '25000000' },
    { code: 'ELK', name: 'Perangkat Jaringan', limit: '10000000' },
    { code: 'KBR', name: 'Perlengkapan Kebersihan', limit: '4000000' },
    { code: 'PRB', name: 'Meja dan Kursi', limit: '15000000' },
    { code: 'PRB', name: 'Lemari Arsip', limit: '10000000' },
    { code: 'BHP', name: 'Bahan Pembersih', limit: '5000000' },
    { code: 'KSN', name: 'Makanan dan Minuman', limit: '4000000' },
  ]) {
    const saved = await upsertSubCategory(
      categoryMap.get(subCategory.code).id,
      subCategory.name,
      subCategory.limit,
    );
    subCategoryMap.set(subCategory.name, saved);
  }

  const records = [
      {
        user: operatorSari,
        category: categoryMap.get('ATK'),
        subCategory: subCategoryMap.get('Kertas dan Buku'),
        letterNumber: 'DUMMY-2026-001',
        origin: 'Toko Sumber Makmur, Bandung',
        items: [
          { name: 'Kertas HVS A4 80 gsm', price: 65000, quantity: 20, unit: 'rim' },
          { name: 'Buku tulis 58 lembar', price: 5000, quantity: 50, unit: 'buah' },
        ],
      },
      {
        user: operatorBudi,
        category: categoryMap.get('ELK'),
        subCategory: subCategoryMap.get('Komputer dan Aksesori'),
        letterNumber: 'DUMMY-2026-002',
        origin: 'CV Teknologi Nusantara, Jakarta',
        items: [
          { name: 'Monitor LED 24 inci', price: 1850000, quantity: 2, unit: 'unit' },
          { name: 'Kabel HDMI 2 meter', price: 85000, quantity: 4, unit: 'buah' },
        ],
      },
      {
        user: operatorSari,
        category: categoryMap.get('KBR'),
        subCategory: subCategoryMap.get('Perlengkapan Kebersihan'),
        letterNumber: 'DUMMY-2026-003',
        origin: 'Koperasi Sejahtera, Yogyakarta',
        items: [
          { name: 'Cairan pembersih lantai 1 liter', price: 28000, quantity: 24, unit: 'botol' },
          { name: 'Sapu ijuk', price: 22000, quantity: 10, unit: 'buah' },
        ],
      },
      {
        user: operatorBudi,
        category: categoryMap.get('PRB'),
        subCategory: subCategoryMap.get('Meja dan Kursi'),
        letterNumber: 'DUMMY-2026-004',
        origin: 'CV Mebel Karya, Semarang',
        items: [
          { name: 'Meja kerja kayu', price: 2450000, quantity: 2, unit: 'unit', isVerified: true, },
          { name: 'Kursi kerja ergonomis', price: 1350000, quantity: 4, unit: 'unit', isVerified: true },
          { name: 'Laci arsip bergerak', price: 850000, quantity: 2, unit: 'unit', isVerified: true },
        ],
      },
      {
        user: operatorSari,
        category: categoryMap.get('BHP'),
        subCategory: subCategoryMap.get('Bahan Pembersih'),
        letterNumber: 'DUMMY-2026-005',
        origin: 'Toko Bersih Jaya, Surabaya',
        items: [
          { name: 'Pembersih lantai 1 liter', price: 32000, quantity: 30, unit: 'botol' },
          { name: 'Sabun cuci tangan 500 ml', price: 24000, quantity: 40, unit: 'botol' },
          { name: 'Kantong sampah besar', price: 15000, quantity: 50, unit: 'pak' },
        ],
      },
      {
        user: operatorBudi,
        category: categoryMap.get('KSN'),
        subCategory: subCategoryMap.get('Makanan dan Minuman'),
        letterNumber: 'DUMMY-2026-006',
        origin: 'Dapur Rasa Nusantara, Depok',
        items: [
          { name: 'Kotak kudapan rapat', price: 35000, quantity: 40, unit: 'kotak', expiryDate: '2026-11-15' },
          { name: 'Air mineral 600 ml', price: 5000, quantity: 48, unit: 'botol', expiryDate: '2027-05-30' },
          { name: 'Kopi bubuk lokal 250 gram', price: 85000, quantity: 10, unit: 'pak', expiryDate: '2027-03-01' },
        ],
      },
      {
        user: operatorSari,
        category: categoryMap.get('ATK'),
        subCategory: subCategoryMap.get('Kertas dan Buku'),
        letterNumber: 'DUMMY-2026-007',
        origin: 'Toko Sumber Makmur, Bandung',
        items: [
          { name: 'Kertas HVS A4 80 gsm', price: 65000, quantity: 20, unit: 'rim' },
          { name: 'Buku tulis 58 lembar', price: 5000, quantity: 50, unit: 'buah' },
        ],
      },
      {
        user: operatorBudi,
        category: categoryMap.get('ELK'),
        subCategory: subCategoryMap.get('Komputer dan Aksesori'),
        letterNumber: 'DUMMY-2026-008',
        origin: 'CV Teknologi Nusantara, Jakarta',
        items: [
          { name: 'Monitor LED 24 inci', price: 1850000, quantity: 2, unit: 'unit' },
          { name: 'Kabel HDMI 2 meter', price: 85000, quantity: 4, unit: 'buah' },
        ],
      },
      {
        user: operatorSari,
        category: categoryMap.get('KBR'),
        subCategory: subCategoryMap.get('Perlengkapan Kebersihan'),
        letterNumber: 'DUMMY-2026-009',
        origin: 'Koperasi Sejahtera, Yogyakarta',
        items: [
          { name: 'Cairan pembersih lantai 1 liter', price: 28000, quantity: 24, unit: 'botol' },
          { name: 'Sapu ijuk', price: 22000, quantity: 10, unit: 'buah' },
        ],
      },
      {
        user: operatorBudi,
        category: categoryMap.get('PRB'),
        subCategory: subCategoryMap.get('Meja dan Kursi'),
        letterNumber: 'DUMMY-2026-010',
        origin: 'CV Mebel Karya, Semarang',
        items: [
          { name: 'Meja kerja kayu', price: 2450000, quantity: 2, unit: 'unit', isVerified: true, },
          { name: 'Kursi kerja ergonomis', price: 1350000, quantity: 4, unit: 'unit', isVerified: true },
          { name: 'Laci arsip bergerak', price: 850000, quantity: 2, unit: 'unit', isVerified: true },
        ],
      },
      {
        user: operatorSari,
        category: categoryMap.get('BHP'),
        subCategory: subCategoryMap.get('Bahan Pembersih'),
        letterNumber: 'DUMMY-2026-011',
        origin: 'Toko Bersih Jaya, Surabaya',
        items: [
          { name: 'Pembersih lantai 1 liter', price: 32000, quantity: 30, unit: 'botol' },
          { name: 'Sabun cuci tangan 500 ml', price: 24000, quantity: 40, unit: 'botol' },
          { name: 'Kantong sampah besar', price: 15000, quantity: 50, unit: 'pak' },
        ],
      }
  ];

  for (const record of records) {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.incomingItem.findFirst({
        where: { letterNumber: record.letterNumber },
        select: { id: true },
      });
      if (existing) {
        await transaction.incomingItem.delete({ where: { id: existing.id } });
      }
      await transaction.incomingItem.create({
        data: {
          userId: record.user.id,
          categoryId: record.category.id,
          subCategoryId: record.subCategory.id,
          origin: record.origin,
          letterNumber: record.letterNumber,
          details: {
            create: record.items.map((item) => ({
              itemName: item.name,
              price: String(item.price),
              quantity: item.quantity,
              unit: item.unit,
              total: String(item.price * item.quantity),
              isVerified: item.isVerified || false,
              expiryDate: item.expiryDate
                ? new Date(`${item.expiryDate}T00:00:00.000Z`)
                : null,
            })),
          },
        },
      });
    }, { maxWait: 10000, timeout: 15000 });
  }

  console.log('Seed selesai: 3 user, 6 kategori, 9 subkategori, 11 barang masuk, dan 27 detail barang.');
  console.log('Akun dummy: admin001 / Admin1234, operator01 / Operator123, operator02 / Operator123');
  console.log(`Admin ID: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });