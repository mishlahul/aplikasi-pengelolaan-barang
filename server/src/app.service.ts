import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { AuthenticatedUser, AuthService } from './auth.service';
import { DatabaseService } from './database.service';

type Input = Record<string, unknown>;
type Query = Record<string, string | undefined>;
type ItemInput = {
  id?: number;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  expiresAt: Date | null;
};
type UploadedFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

const pageSize = 10;

@Injectable()
export class AppService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async login(body: Input) {
    const username = this.text(body.username, 'Username', 1, 100);
    const password = this.text(body.password, 'Password', 1, 100);
    const user = await this.database.user.findUnique({ where: { username } });
    if (
      !user ||
      !this.auth.verifyPassword(password, user.password) ||
      user.isLocked
    ) {
      throw new UnauthorizedException('Username atau password tidak valid');
    }
    const publicUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
    return { accessToken: this.auth.createToken(publicUser), user: publicUser };
  }

  async getProfile(user: AuthenticatedUser) {
    const record = await this.database.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isLocked: true,
        createdAt: true,
      },
    });
    if (!record || record.isLocked) throw new UnauthorizedException('Akun tidak aktif');
    return record;
  }

  async listUsers(query: Query) {
    const { page, skip } = this.pagination(query.page);
    const where: Prisma.UserWhereInput = {};
    if (query.role && Object.values(Role).includes(query.role as Role)) {
      where.role = query.role as Role;
    }
    if (query.q?.trim()) {
      where.OR = [
        { username: { contains: query.q.trim(), mode: 'insensitive' } },
        { name: { contains: query.q.trim(), mode: 'insensitive' } },
      ];
    }
    const [total, users] = await this.database.$transaction([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          isLocked: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return this.pageResult(users, page, total);
  }

  async createUser(body: Input) {
    const role = this.role(body.role);
    const username = this.text(body.username, 'Username', 8, 100);
    const password = this.password(body.password);
    const name = this.text(body.name, 'Nama', 8, 100);
    const email = this.email(body.email);
    try {
      return await this.database.user.create({
        data: {
          role,
          username,
          password: this.auth.hashPassword(password),
          name,
          email,
        },
        select: {
          id: true,
          role: true,
          username: true,
          name: true,
          email: true,
          isLocked: true,
        },
      });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async updateUser(id: number, body: Input, currentUser: AuthenticatedUser) {
    if (currentUser.id === id && body.role !== undefined && body.role !== currentUser.role) {
      throw new ForbiddenException('Tidak dapat mengubah role akun sendiri');
    }
    const current = await this.database.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('User tidak ditemukan');
    const data: Prisma.UserUpdateInput = {};
    if (body.role !== undefined) data.role = this.role(body.role);
    if (body.username !== undefined) data.username = this.text(body.username, 'Username', 8, 100);
    if (body.name !== undefined) data.name = this.text(body.name, 'Nama', 8, 100);
    if (body.email !== undefined) data.email = this.email(body.email);
    if (body.password !== undefined) data.password = this.auth.hashPassword(this.password(body.password));
    try {
      return await this.database.user.update({
        where: { id },
        data,
        select: {
          id: true,
          role: true,
          username: true,
          name: true,
          email: true,
          isLocked: true,
        },
      });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async deleteUser(id: number, currentUser: AuthenticatedUser) {
    if (currentUser.id === id) {
      throw new ForbiddenException('Tidak dapat menghapus akun sendiri');
    }
    try {
      await this.database.user.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async setUserLock(id: number, isLocked: unknown, currentUser: AuthenticatedUser) {
    if (currentUser.id === id) {
      throw new ForbiddenException('Tidak dapat mengunci atau membuka akun sendiri');
    }
    if (typeof isLocked !== 'boolean') {
      throw new BadRequestException('isLocked harus berupa boolean');
    }
    try {
      return await this.database.user.update({
        where: { id },
        data: { isLocked },
        select: { id: true, isLocked: true },
      });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async listCategories(query: Query) {
    const { page, skip } = this.pagination(query.page);
    const where: Prisma.CategoryWhereInput = query.q?.trim()
      ? {
          OR: [
            { categoryCode: { contains: query.q.trim(), mode: 'insensitive' } },
            { categoryName: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, data] = await this.database.$transaction([
      this.database.category.count({ where }),
      this.database.category.findMany({
        where,
        orderBy: { categoryCode: 'asc' },
        skip,
        take: pageSize,
      }),
    ]);
    return this.pageResult(data, page, total);
  }

  async createCategory(body: Input) {
    const categoryCode = this.text(body.code, 'Kode kategori', 1, 10);
    const categoryName = this.text(body.name, 'Nama kategori', 1, 100);
    try {
      return await this.database.category.create({
        data: { categoryCode, categoryName },
      });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async updateCategory(id: number, body: Input) {
    const category = await this.database.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');
    const data: Prisma.CategoryUpdateInput = {};
    if (body.code !== undefined) data.categoryCode = this.text(body.code, 'Kode kategori', 1, 10);
    if (body.name !== undefined) data.categoryName = this.text(body.name, 'Nama kategori', 1, 100);
    try {
      return await this.database.category.update({ where: { id }, data });
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async deleteCategory(id: number) {
    try {
      await this.database.category.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async listSubCategories(query: Query) {
    const { page, skip } = this.pagination(query.page);
    const where: Prisma.SubCategoryWhereInput = {};
    if (query.categoryId) where.categoryId = this.numericId(query.categoryId, 'Kategori');
    if (query.q?.trim()) {
      where.OR = [
        { subCategoryName: { contains: query.q.trim(), mode: 'insensitive' } },
        { category: { categoryName: { contains: query.q.trim(), mode: 'insensitive' } } },
      ];
    }
    const [total, data] = await this.database.$transaction([
      this.database.subCategory.count({ where }),
      this.database.subCategory.findMany({
        where,
        include: { category: true },
        orderBy: [{ category: { categoryName: 'asc' } }, { subCategoryName: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);
    return this.pageResult(data.map((row) => this.subCategoryView(row)), page, total);
  }

  async createSubCategory(body: Input) {
    const categoryId = this.numericId(body.categoryId, 'Kategori');
    const subCategoryName = this.text(body.name, 'Nama sub kategori', 1, 100);
    const priceLimit = this.money(body.priceLimit, 'Batas harga');
    try {
      return await this.database.subCategory.create({
        data: { categoryId, subCategoryName, priceLimit: new Prisma.Decimal(priceLimit) },
        include: { category: true },
      }).then((row) => this.subCategoryView(row));
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async updateSubCategory(id: number, body: Input) {
    const current = await this.database.subCategory.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Sub kategori tidak ditemukan');
    const data: Prisma.SubCategoryUpdateInput = {};
    if (body.categoryId !== undefined) {
      data.category = { connect: { id: this.numericId(body.categoryId, 'Kategori') } };
    }
    if (body.name !== undefined) data.subCategoryName = this.text(body.name, 'Nama sub kategori', 1, 100);
    if (body.priceLimit !== undefined) {
      data.priceLimit = new Prisma.Decimal(this.money(body.priceLimit, 'Batas harga'));
    }
    try {
      return await this.database.subCategory.update({
        where: { id },
        data,
        include: { category: true },
      }).then((row) => this.subCategoryView(row));
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async deleteSubCategory(id: number) {
    try {
      await this.database.subCategory.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async listIncoming(query: Query, user: AuthenticatedUser, exportAll = false) {
    const { page, skip } = this.pagination(query.page);
    const where: Prisma.IncomingItemWhereInput = {};
    if (user.role === Role.OPERATOR) where.userId = user.id;
    else if (query.operatorId) where.userId = this.numericId(query.operatorId, 'Operator');
    if (query.categoryId) where.categoryId = this.numericId(query.categoryId, 'Kategori');
    if (query.subCategoryId) where.subCategoryId = this.numericId(query.subCategoryId, 'Sub kategori');
    if (query.year && /^\d{4}$/.test(query.year)) {
      where.createdAt = {
        gte: new Date(`${query.year}-01-01T00:00:00.000+07:00`),
        lt: new Date(`${Number(query.year) + 1}-01-01T00:00:00.000+07:00`),
      };
    }
    if (query.q?.trim()) {
      where.OR = [
        { origin: { contains: query.q.trim(), mode: 'insensitive' } },
        { subCategory: { subCategoryName: { contains: query.q.trim(), mode: 'insensitive' } } },
      ];
    }
    const include = {
      user: { select: { id: true, name: true, username: true } },
      category: true,
      subCategory: true,
      details: { orderBy: { id: 'asc' as const } },
    };
    const total = await this.database.incomingItem.count({ where });
    if (exportAll || query.sortBy === 'total') {
      const rows = await this.database.incomingItem.findMany({ where, include });
      const data = rows.map((row) => this.incomingView(row));
      const factor = query.sortOrder?.toLowerCase() === 'asc' ? 1 : -1;
      if (query.sortBy === 'total') data.sort((left, right) => factor * (left.total - right.total));
      else if (query.sortBy === 'source' || query.sortBy === 'origin') {
        data.sort((left, right) => factor * left.source.localeCompare(right.source));
      } else data.sort((left, right) => factor * left.createdAt.getTime() - factor * right.createdAt.getTime());
      return exportAll ? data : this.pageResult(data.slice(skip, skip + pageSize), page, total);
    }
    const orderBy = query.sortBy === 'origin' || query.sortBy === 'source'
      ? { origin: query.sortOrder?.toLowerCase() === 'asc' ? 'asc' as const : 'desc' as const }
      : { createdAt: query.sortOrder?.toLowerCase() === 'asc' ? 'asc' as const : 'desc' as const };
    const rows = await this.database.incomingItem.findMany({
      where,
      include,
      orderBy,
      skip,
      take: pageSize,
    });
    const data = rows.map((row) => this.incomingView(row));
    return exportAll ? data : this.pageResult(data, page, total);
  }

  async getIncoming(id: number, user: AuthenticatedUser) {
    const record = await this.database.incomingItem.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, username: true } },
        category: true,
        subCategory: true,
        details: { orderBy: { id: 'asc' } },
      },
    });
    if (!record) throw new NotFoundException('Barang masuk tidak ditemukan');
    if (user.role === Role.OPERATOR && record.userId !== user.id) {
      throw new ForbiddenException('Tidak dapat mengakses barang masuk milik operator lain');
    }
    return this.incomingView(record);
  }

  async createIncoming(body: Input, user: AuthenticatedUser) {
    const userId = user.role === Role.ADMIN
      ? this.numericId(body.operatorId, 'Operator')
      : user.id;
    if (user.role === Role.ADMIN) await this.assertActiveOperator(userId);
    const categoryId = this.numericId(body.categoryId, 'Kategori');
    const subCategoryId = this.numericId(body.subCategoryId, 'Sub kategori');
    const subCategory = await this.database.subCategory.findUnique({ where: { id: subCategoryId } });
    if (!subCategory || subCategory.categoryId !== categoryId) {
      throw new BadRequestException('Sub kategori tidak termasuk dalam kategori yang dipilih');
    }
    const details = this.items(body.items);
    this.assertPriceLimit(details, subCategory.priceLimit);
    const origin = this.text(body.source, 'Asal barang', 1, 200);
    const letterNumber = body.letterNumber === undefined || body.letterNumber === ''
      ? null
      : this.text(body.letterNumber, 'Nomor surat', 1, 100);
    try {
      const record = await this.database.incomingItem.create({
        data: {
          userId,
          categoryId,
          subCategoryId,
          origin,
          letterNumber,
          details: {
            create: details.map((item) => this.detailData(item)),
          },
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
          category: true,
          subCategory: true,
          details: { orderBy: { id: 'asc' } },
        },
      });
      return this.incomingView(record);
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async updateIncoming(id: number, body: Input, user: AuthenticatedUser) {
    const current = await this.database.incomingItem.findUnique({
      where: { id },
      include: { details: true },
    });
    if (!current) throw new NotFoundException('Barang masuk tidak ditemukan');
    if (user.role === Role.OPERATOR && current.userId !== user.id) {
      throw new ForbiddenException('Tidak dapat mengubah barang masuk milik operator lain');
    }
    const userId = user.role === Role.ADMIN && body.operatorId !== undefined
      ? this.numericId(body.operatorId, 'Operator')
      : current.userId;
    if (user.role === Role.ADMIN && body.operatorId !== undefined && userId !== current.userId) {
      await this.assertActiveOperator(userId);
    }
    const categoryId = body.categoryId === undefined
      ? current.categoryId
      : this.numericId(body.categoryId, 'Kategori');
    const subCategoryId = body.subCategoryId === undefined
      ? current.subCategoryId
      : this.numericId(body.subCategoryId, 'Sub kategori');
    const subCategory = await this.database.subCategory.findUnique({ where: { id: subCategoryId } });
    if (!subCategory || subCategory.categoryId !== categoryId) {
      throw new BadRequestException('Sub kategori tidak termasuk dalam kategori yang dipilih');
    }
    const details = body.items === undefined
      ? current.details.map((item) => ({
          id: item.id,
          name: item.itemName,
          price: item.price.toNumber(),
          quantity: item.quantity,
          unit: item.unit,
          expiresAt: item.expiryDate,
        }))
      : this.items(body.items);
    const existingDetails = new Map(current.details.map((item) => [item.id, item]));
    const submittedIds = details.flatMap((item) => item.id === undefined ? [] : [item.id]);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException('Detail barang tidak boleh duplikat');
    }
    for (const item of details) {
      if (item.id !== undefined && !existingDetails.has(item.id)) {
        throw new BadRequestException('Detail barang tidak termasuk dalam barang masuk ini');
      }
    }
    this.assertPriceLimit(details, subCategory.priceLimit);
    const data: Prisma.IncomingItemUpdateInput = {
      user: { connect: { id: userId } },
      category: { connect: { id: categoryId } },
      subCategory: { connect: { id: subCategoryId } },
    };
    if (body.source !== undefined) data.origin = this.text(body.source, 'Asal barang', 1, 200);
    if (body.letterNumber !== undefined) {
      data.letterNumber = body.letterNumber === ''
        ? null
        : this.text(body.letterNumber, 'Nomor surat', 1, 100);
    }
    try {
      const record = await this.database.$transaction(async (transaction) => {
        if (body.items !== undefined) {
          const retainedIds: number[] = [];
          for (const item of details) {
            if (item.id !== undefined) {
              await transaction.incomingItemDetail.update({
                where: { id: item.id },
                data: this.detailData(item),
              });
              retainedIds.push(item.id);
            } else {
              const created = await transaction.incomingItemDetail.create({
                data: { incomingItemId: id, ...this.detailData(item) },
                select: { id: true },
              });
              retainedIds.push(created.id);
            }
          }
          await transaction.incomingItemDetail.deleteMany({
            where: {
              incomingItemId: id,
              ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
            },
          });
        }
        await transaction.incomingItem.update({ where: { id }, data });
        return transaction.incomingItem.findUniqueOrThrow({
          where: { id },
          include: {
            user: { select: { id: true, name: true, username: true } },
            category: true,
            subCategory: true,
            details: { orderBy: { id: 'asc' } },
          },
        });
      });
      return this.incomingView(record);
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async deleteIncoming(id: number, user: AuthenticatedUser) {
    const incoming = await this.getIncoming(id, user);
    await this.database.incomingItem.delete({ where: { id } });
    if (incoming.attachmentUrl) {
      await rm(this.uploadPath(incoming.attachmentUrl), { force: true });
    }
    return { success: true };
  }

  async setIncomingDetailVerification(id: number, detailId: number, isVerified: unknown) {
    if (typeof isVerified !== 'boolean') {
      throw new BadRequestException('isVerified harus berupa boolean');
    }
    const incomingId = id;
    const incomingDetailId = this.numericId(detailId, 'Detail barang');
    try {
      const result = await this.database.incomingItemDetail.updateMany({
        where: { id: incomingDetailId, incomingItemId: incomingId },
        data: { isVerified },
      });
      if (result.count === 0) throw new NotFoundException('Detail barang tidak ditemukan');
      return { id: incomingDetailId, incomingId, isVerified };
    } catch (error) {
      this.throwDatabaseError(error);
    }
  }

  async uploadIncomingAttachment(
    id: number,
    file: UploadedFile | undefined,
    user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Lampiran file wajib disertakan');
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Ukuran lampiran maksimal 10 MB');
    }
    const extension = extname(file.originalname).toLowerCase();
    if (!['.doc', '.docx', '.zip'].includes(extension)) {
      throw new BadRequestException('Lampiran hanya boleh berformat doc, docx, atau zip');
    }
    const incoming = await this.getIncoming(id, user);
    const filename = `${randomUUID()}${extension}`;
    const path = this.uploadPath(filename);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, file.buffer, { flag: 'wx' });
    try {
      await this.database.incomingItem.update({
        where: { id},
        data: { attachmentUrl: filename },
      });
    } catch (error) {
      await rm(path, { force: true });
      this.throwDatabaseError(error);
    }
    if (incoming.attachmentUrl) {
      await rm(this.uploadPath(incoming.attachmentUrl), { force: true });
    }
    return { id: Number(id), attachmentUrl: filename };
  }

  async getIncomingAttachment(id: number, user: AuthenticatedUser) {
    const incoming = await this.getIncoming(id, user);
    if (!incoming.attachmentUrl) throw new NotFoundException('Lampiran tidak ditemukan');
    const filename = incoming.attachmentUrl;
    const extension = extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.zip': 'application/zip',
    };
    if (!contentTypes[extension] || !/^[0-9a-f-]+\.(doc|docx|zip)$/i.test(filename)) {
      throw new NotFoundException('Lampiran tidak ditemukan');
    }
    try {
      return {
        filename,
        contentType: contentTypes[extension],
        buffer: await readFile(this.uploadPath(filename)),
      };
    } catch {
      throw new NotFoundException('File lampiran tidak ditemukan di penyimpanan');
    }
  }

  private uploadPath(filename: string) {
    const directory = resolve(process.env.UPLOAD_DIR ?? 'uploads');
    return resolve(directory, filename);
  }

  private incomingView(row: {
    id: number;
    userId: number;
    categoryId: number;
    subCategoryId: number;
    origin: string;
    letterNumber: string | null;
    attachmentUrl: string | null;
    createdAt: Date;
    user: { id: number; username: string; name: string };
    category: { categoryCode: string; categoryName: string };
    subCategory: { subCategoryName: string; priceLimit: Prisma.Decimal };
    details: {
      id: number;
      itemName: string;
      price: Prisma.Decimal;
      quantity: number;
      total: Prisma.Decimal;
      unit: string;
      isVerified: boolean;
      expiryDate: Date | null;
    }[];
  }) {
    const total = row.details.reduce(
      (sum, detail) => sum.plus(detail.total),
      new Prisma.Decimal(0),
    );
    return {
      id: row.id,
      operatorId: row.userId,
      operatorName: row.user.name,
      categoryId: row.categoryId,
      categoryCode: row.category.categoryCode,
      categoryName: row.category.categoryName,
      subCategoryId: row.subCategoryId,
      subCategoryName: row.subCategory.subCategoryName,
      priceLimit: row.subCategory.priceLimit.toNumber(),
      source: row.origin,
      letterNumber: row.letterNumber,
      attachmentUrl: row.attachmentUrl,
      createdAt: row.createdAt,
      total: total.toNumber(),
      items: row.details.map((detail) => ({
        id: detail.id,
        name: detail.itemName,
        price: detail.price.toNumber(),
        quantity: detail.quantity,
        total: detail.total.toNumber(),
        unit: detail.unit,
        verified: detail.isVerified,
        expiresAt: detail.expiryDate,
      })),
    };
  }

  private subCategoryView(row: {
    id: number;
    categoryId: number;
    subCategoryName: string;
    priceLimit: Prisma.Decimal;
    category: { categoryName: string; categoryCode: string };
  }) {
    return {
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.category.categoryName,
      categoryCode: row.category.categoryCode,
      name: row.subCategoryName,
      priceLimit: row.priceLimit.toNumber(),
    };
  }

  private items(input: unknown): ItemInput[] {
    if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
      throw new BadRequestException('Barang masuk harus memiliki 1 sampai 100 item');
    }
    return input.map((value, index) => {
      if (!value || typeof value !== 'object') throw new BadRequestException(`Item ${index + 1} tidak valid`);
      const item = value as Input;
      const id = item.id === undefined ? undefined : this.numericId(item.id, `ID item ${index + 1}`);
      const name = this.text(item.name, 'Nama barang', 1, 200);
      const price = this.money(item.price, 'Harga');
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new BadRequestException('Jumlah barang harus berupa angka positif');
      }
      const unit = this.text(item.unit, 'Satuan', 1, 40);
      let expiresAt: Date | null = null;
      if (item.expiresAt !== undefined && item.expiresAt !== null && item.expiresAt !== '') {
        const dateText = String(item.expiresAt);
        const date = new Date(`${dateText.slice(0, 10)}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) throw new BadRequestException('Tanggal expired tidak valid');
        expiresAt = date;
      }
      return { id, name, price, quantity, unit, expiresAt };
    });
  }

  private async assertActiveOperator(id: number) {
    const operator = await this.database.user.findUnique({
      where: { id },
      select: { role: true, isLocked: true },
    });
    if (!operator || operator.role !== Role.OPERATOR || operator.isLocked) {
      throw new BadRequestException('Operator tidak ditemukan atau tidak aktif');
    }
  }

  private detailData(item: ItemInput) {
    const total = BigInt(item.price) * BigInt(item.quantity);
    return {
      itemName: item.name,
      price: new Prisma.Decimal(item.price),
      quantity: item.quantity,
      total: new Prisma.Decimal(total.toString()),
      unit: item.unit,
      expiryDate: item.expiresAt,
    };
  }

  private assertPriceLimit(items: ItemInput[], priceLimit: Prisma.Decimal) {
    const total = items.reduce(
      (sum, item) => sum + BigInt(item.price) * BigInt(item.quantity),
      0n,
    );
    if (total > BigInt(priceLimit.toFixed(0))) {
      throw new BadRequestException('Total harga barang melebihi batas harga sub kategori');
    }
  }

  private pagination(rawPage?: string) {
    const requestedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
    const page = Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
    return { page, skip: (page - 1) * pageSize };
  }

  private pageResult<T>(data: T[], page: number, total: number) {
    return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private numericId(value: unknown, label: string): number {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException(`${label} tidak valid`);
    return id;
  }

  private text(value: unknown, label: string, min: number, max: number): string {
    if (typeof value !== 'string') throw new BadRequestException(`${label} wajib diisi`);
    const result = value.trim();
    if (result.length < min || result.length > max) {
      throw new BadRequestException(`${label} harus memiliki ${min}-${max} karakter`);
    }
    return result;
  }

  private password(value: unknown): string {
    const password = this.text(value, 'Password', 8, 100);
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('Password harus mengandung huruf besar, huruf kecil, dan angka');
    }
    return password;
  }

  private email(value: unknown): string {
    const email = this.text(value, 'Email', 8, 100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Format email tidak valid');
    return email.toLowerCase();
  }

  private role(value: unknown): Role {
    if (value !== Role.ADMIN && value !== Role.OPERATOR) {
      throw new BadRequestException('Role harus ADMIN atau OPERATOR');
    }
    return value;
  }

  private money(value: unknown, label: string): number {
    const text = typeof value === 'number' ? String(value) : String(value ?? '');
    if (!/^\d+$/.test(text)) throw new BadRequestException(`${label} harus berupa angka rupiah`);
    const amount = Number(text);
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new BadRequestException(`${label} di luar rentang yang didukung`);
    }
    return amount;
  }

  private throwDatabaseError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Data dengan kode, username, email, atau nama tersebut sudah ada');
      }
      if (error.code === 'P2003') {
        throw new ConflictException('Data masih digunakan oleh relasi lain');
      }
      if (error.code === 'P2025') throw new NotFoundException('Data tidak ditemukan');
    }
    throw error;
  }
}