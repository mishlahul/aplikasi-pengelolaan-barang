import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'OPERATOR';
  name: string;
}

interface TokenPayload extends AuthenticatedUser {
  exp: number;
}

@Injectable()
export class AuthService {
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expectedHex] = storedHash.split(':');
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  createToken(user: AuthenticatedUser): string {
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode({ ...user, exp: Math.floor(Date.now() / 1000) + 28800 });
    const input = `${header}.${payload}`;
    const signature = this.sign(input);
    return `${input}.${signature}`;
  }

  verifyToken(token: string): AuthenticatedUser {
    const [header, payload, signature, extra] = token.split('.');
    if (!header || !payload || !signature || extra) {
      throw new UnauthorizedException('Token tidak valid');
    }
    const input = `${header}.${payload}`;
    const expected = Buffer.from(this.sign(input));
    const actual = Buffer.from(signature);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException('Token tidak valid');
    }
    try {
      const data = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as TokenPayload;
      if (
        data.exp <= Math.floor(Date.now() / 1000) ||
        !data.id ||
        !['ADMIN', 'OPERATOR'].includes(data.role)
      ) {
        throw new Error('Invalid claims');
      }
      return { id: data.id, username: data.username, role: data.role, name: data.name };
    } catch {
      throw new UnauthorizedException('Token tidak valid atau sudah kedaluwarsa');
    }
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private sign(value: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET wajib diisi dan minimal 32 karakter');
    }
    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}