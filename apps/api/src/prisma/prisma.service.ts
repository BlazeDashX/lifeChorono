import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Read the database URL directly from the environment
    const connectionString = process.env.DATABASE_URL;
    
    // Initialize the pg connection pool
    const pool = new Pool({ connectionString });
    
    // Wrap the pool in Prisma's adapter
    const adapter = new PrismaPg(pool);
    
    // Pass the adapter to the PrismaClient constructor
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
