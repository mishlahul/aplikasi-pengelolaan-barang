import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppService } from './app.service';
import {
  Public,
  Roles,
} from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';

type RequestBody = Record<string, unknown>;
type RequestQuery = Record<string, string | undefined>;

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Post('auth/login')
  login(@Body() body: RequestBody) {
    return this.appService.login(body);
  }

  @Get('auth/me')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.appService.getProfile(request.user);
  }

  @Get('categories')
  listCategories(@Query() query: RequestQuery) {
    return this.appService.listCategories(query);
  }

  @Roles('ADMIN')
  @Post('categories')
  createCategory(@Body() body: RequestBody) {
    return this.appService.createCategory(body);
  }

  @Roles('ADMIN')
  @Patch('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: RequestBody) {
    return this.appService.updateCategory(id, body);
  }

  @Roles('ADMIN')
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.appService.deleteCategory(id);
  }

  @Get('sub-categories')
  listSubCategories(@Query() query: RequestQuery) {
    return this.appService.listSubCategories(query);
  }

  @Roles('ADMIN')
  @Post('sub-categories')
  createSubCategory(@Body() body: RequestBody) {
    return this.appService.createSubCategory(body);
  }

  @Roles('ADMIN')
  @Patch('sub-categories/:id')
  updateSubCategory(@Param('id', ParseIntPipe) id: number, @Body() body: RequestBody) {
    return this.appService.updateSubCategory(id, body);
  }

  @Roles('ADMIN')
  @Delete('sub-categories/:id')
  deleteSubCategory(@Param('id', ParseIntPipe) id: number) {
    return this.appService.deleteSubCategory(id);
  }

  @Roles('ADMIN')
  @Get('users')
  listUsers(@Query() query: RequestQuery) {
    return this.appService.listUsers(query);
  }

  @Roles('ADMIN')
  @Post('users')
  createUser(@Body() body: RequestBody) {
    return this.appService.createUser(body);
  }

  @Roles('ADMIN')
  @Patch('users/:id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RequestBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.updateUser(id, body, request.user);
  }

  @Roles('ADMIN')
  @Delete('users/:id')
  deleteUser(@Param('id', ParseIntPipe) id: number, @Req() request: AuthenticatedRequest) {
    return this.appService.deleteUser(id, request.user);
  }

  @Roles('ADMIN')
  @Patch('users/:id/lock')
  setUserLock(@Param('id', ParseIntPipe) id: number, @Body() body: RequestBody, @Req() request: AuthenticatedRequest) {
    return this.appService.setUserLock(id, body.isLocked, request.user);
  }

  @Get('incoming')
  listIncoming(
    @Query() query: RequestQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.listIncoming(query, request.user);
  }

  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="barang-masuk.csv"')
  @Get('incoming/export.csv')
  exportIncoming(
    @Query() query: RequestQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    const entries = this.appService.listIncoming(query, request.user, true) as Promise<
      Record<string, unknown>[]
    >;
    return entries.then((data) => {
      const columns = [
        'Tanggal',
        'Operator',
        'Kategori',
        'Sub Kategori',
        'Asal Barang',
        'Nomor Surat',
        'Kode Barang',
        'Nama Barang',
        'Harga (Rp)',
        'Jumlah',
        'Total (Rp)',
        'Verifikasi',
      ];
      const rows = data.flatMap((entry) => {
        const items = entry.items as Record<string, unknown>[];
        return items.map((item) => [
          entry.createdAt,
          entry.operatorName,
          entry.categoryName,
          entry.subCategoryName,
          entry.source,
          entry.letterNumber,
          `${entry.categoryCode}-${item.id}`,
          item.name,
          this.formatRupiah(item.price),
          `${item.quantity} ${item.unit}`,
          this.formatRupiah(item.total),
          item.verified ? 'Terverifikasi' : 'Belum diverifikasi',
        ]);
      });
      return [columns, ...rows]
        .map((row) => row.map((value) => this.csvCell(value)).join(','))
        .join('\r\n');
    });
  }

  @Get('incoming/:id/letter')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async printIncomingLetter(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const entry = await this.appService.getIncoming(id, request.user);
    const escape = (value: unknown) =>
      String(value ?? '').replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        };
        return entities[character];
      });
    const localDate = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(entry.createdAt));
    const itemRows = entry.items
      .map(
        (item) =>
          `<tr><td>${escape(item.name)}</td><td>${escape(item.quantity)} ${escape(item.unit)}</td><td class="numeric">Rp ${escape(this.formatRupiah(item.price))}</td><td class="numeric">Rp ${escape(this.formatRupiah(item.total))}</td></tr>`,
      )
      .join('');
    const placeholders: Record<string, string> = {
      LETTER_NUMBER: entry.letterNumber || '-',
      LOCAL_DATE: localDate,
      SOURCE: entry.source,
      CATEGORY: entry.categoryName,
      SUB_CATEGORY: entry.subCategoryName,
      OPERATOR: entry.operatorName,
      ITEM_ROWS: itemRows,
      TOTAL: this.formatRupiah(entry.total),
    };
    let html = await readFile(
      resolve(__dirname, 'templates/incoming-letter.html'),
      'utf8',
    );
    for (const [key, value] of Object.entries(placeholders)) {
      html = html.replaceAll(
        `{{${key}}}`,
        key === 'ITEM_ROWS' ? value : escape(value),
      );
    }
    return html;
  }

  @Post('incoming')
  createIncoming(
    @Body() body: RequestBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.createIncoming(body, request.user);
  }

  @Get('incoming/:id')
  getIncoming(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.getIncoming(id, request.user);
  }

  @Post('incoming/:id/attachment')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadIncomingAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile()
    file: { originalname: string; buffer: Buffer; size: number } | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.uploadIncomingAttachment(id, file, request.user);
  }

  @Get('incoming/:id/attachment')
  @Header('Access-Control-Expose-Headers', 'Content-Disposition')
  async getIncomingAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const file = await this.appService.getIncomingAttachment(id, request.user);
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  @Patch('incoming/:id')
  updateIncoming(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RequestBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.updateIncoming(id, body, request.user);
  }

  @Delete('incoming/:id')
  deleteIncoming(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.deleteIncoming(id, request.user);
  }

  @Roles('ADMIN')
  @Patch('incoming/:id/details/:detailId/verification')
  setIncomingDetailVerification(
    @Param('id', ParseIntPipe) id: number,
    @Param('detailId') detailId: number,
    @Body() body: RequestBody,
  ) {
    return this.appService.setIncomingDetailVerification(id, detailId, body.isVerified);
  }

  private csvCell(value: unknown): string {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  private formatRupiah(value: unknown): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new TypeError('Nilai harga tidak valid');
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount);
  }
}
