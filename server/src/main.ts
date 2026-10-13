import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL wajib diisi dengan connection string PostgreSQL Supabase');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET wajib diisi dan minimal 32 karakter');
  }

  const app = await NestFactory.create(AppModule);
  const allowedOrigins = [
    'https://workers.dev',
    'http://localhost:5173',
  ];
  const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.workers.dev')) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS'));
      }
    }
  };

  app.enableCors(corsOptions);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
