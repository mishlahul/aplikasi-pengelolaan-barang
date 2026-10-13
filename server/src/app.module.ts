import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard, RolesGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    AuthService,
    DatabaseService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
