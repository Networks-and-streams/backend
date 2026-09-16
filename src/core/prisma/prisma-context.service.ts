import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';

export const PRISMA_TX_KEY = 'prisma:tx' as const;

@Injectable()
export class PrismaContextService {
  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  get client(): PrismaService {
    return this.cls.get<PrismaService>(PRISMA_TX_KEY) ?? this.prisma;
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const existingTx = this.cls.get<PrismaService>(PRISMA_TX_KEY);

    if (existingTx) {
      return callback();
    }

    return this.prisma.$transaction(async (tx) => {
      this.cls.set(PRISMA_TX_KEY, tx);
      return callback();
    });
  }
}
