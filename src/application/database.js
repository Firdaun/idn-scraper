import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/index.js'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'test' ? ['error', 'warn'] : ['query', 'error', 'warn'],
    adapter
})