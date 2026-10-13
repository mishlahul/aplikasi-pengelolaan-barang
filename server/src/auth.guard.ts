import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser, AuthService } from './auth.service';
import { DatabaseService } from './database.service';

const publicRoute = 'isPublic';
const requiredRoles = 'requiredRoles';

export const Public = () => SetMetadata(publicRoute, true);
export const Roles = (...roles: AuthenticatedUser['role'][]) =>
  SetMetadata(requiredRoles, roles);

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(publicRoute, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token diperlukan');
    }
    const tokenUser = this.auth.verifyToken(authorization.slice(7));
    const currentUser = await this.database.user.findUnique({
      where: { id: tokenUser.id },
      select: { id: true, username: true, name: true, role: true, isLocked: true },
    });
    if (!currentUser || currentUser.isLocked) {
      throw new UnauthorizedException('Akun tidak aktif');
    }
    request.user = {
      id: currentUser.id,
      username: currentUser.username,
      name: currentUser.name,
      role: currentUser.role,
    };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AuthenticatedUser['role'][]>(
      requiredRoles,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return roles.includes(request.user.role);
  }
}