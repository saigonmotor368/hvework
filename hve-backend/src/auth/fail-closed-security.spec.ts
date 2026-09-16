import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JwtStrategy } from './jwt.strategy.js';
import { WebPushService } from '../notifications/web-push.service.js';

describe('Fail-Closed Security Hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('JWT_SECRET Fail-Closed Protection', () => {
    it('should throw fatal error on JwtStrategy instantiation if JWT_SECRET is undefined', () => {
      delete process.env.JWT_SECRET;
      expect(() => {
        new JwtStrategy({} as any);
      }).toThrowError(/FATAL SECURITY ERROR: JWT_SECRET/);
    });

    it('should throw fatal error on JwtStrategy instantiation if JWT_SECRET is empty string', () => {
      process.env.JWT_SECRET = '';
      expect(() => {
        new JwtStrategy({} as any);
      }).toThrowError(/FATAL SECURITY ERROR: JWT_SECRET/);
    });
  });

  describe('VAPID Web Push Keys Fail-Closed Protection', () => {
    it('should throw fatal error on WebPushService instantiation if VAPID keys are missing', () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      expect(() => {
        new WebPushService({} as any);
      }).toThrowError(/FATAL SECURITY ERROR: VAPID_PUBLIC_KEY/);
    });

    it('should throw fatal error if only VAPID_PUBLIC_KEY is provided without VAPID_PRIVATE_KEY', () => {
      process.env.VAPID_PUBLIC_KEY = 'some-public-key';
      delete process.env.VAPID_PRIVATE_KEY;
      expect(() => {
        new WebPushService({} as any);
      }).toThrowError(/FATAL SECURITY ERROR: VAPID_PUBLIC_KEY/);
    });
  });
});
