import { ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { jest } from '@jest/globals';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { AppService } from './app.service';

describe('AppService', () => {
  it('does not allow an administrator to delete their own account', async () => {
    const deleteUser = jest.fn();
    const service = new AppService(
      { user: { delete: deleteUser } } as unknown as DatabaseService,
      {} as AuthService,
    );

    await expect(
      service.deleteUser(1, { id: 1, username: 'admin', name: 'Admin', role: Role.ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('preserves a detail verification state when updating its fields', async () => {
    const savedRecord = {
      id: 5,
      userId: 7,
      categoryId: 1,
      subCategoryId: 2,
      origin: 'Office',
      letterNumber: null,
      attachmentUrl: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { id: 7, name: 'Operator', username: 'operator' },
      category: { categoryCode: 'ATK', categoryName: 'Stationery' },
      subCategory: { subCategoryName: 'Writing', priceLimit: new Prisma.Decimal(1000) },
      details: [{
        id: 9,
        itemName: 'Pen',
        price: new Prisma.Decimal(10),
        quantity: 1,
        total: new Prisma.Decimal(10),
        unit: 'piece',
        isVerified: true,
        expiryDate: null,
      }],
    };
    const updateDetail = jest.fn();
    const transaction = {
      incomingItemDetail: {
        update: updateDetail.mockResolvedValue({ id: 9 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      incomingItem: {
        update: jest.fn().mockResolvedValue(savedRecord),
        findUniqueOrThrow: jest.fn().mockResolvedValue(savedRecord),
      },
    };
    const database = {
      incomingItem: { findUnique: jest.fn().mockResolvedValue(savedRecord) },
      subCategory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 2,
          categoryId: 1,
          priceLimit: new Prisma.Decimal(1000),
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.OPERATOR, isLocked: false }),
      },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    const service = new AppService(
      database as unknown as DatabaseService,
      {} as AuthService,
    );

    await service.updateIncoming(5, {
      operatorId: '7',
      items: [{ id: 9, name: 'Pen', price: 12, quantity: 1, unit: 'piece' }],
    }, { id: 1, username: 'admin', name: 'Admin', role: Role.ADMIN });

    expect(updateDetail).toHaveBeenCalledWith({
      where: { id: 9 },
      data: expect.not.objectContaining({ isVerified: expect.anything() }),
    });
    expect(transaction.incomingItemDetail.deleteMany).toHaveBeenCalledWith({
      where: { incomingItemId: 5, id: { notIn: [9] } },
    });
  });
});
