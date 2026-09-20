import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller.js';

describe('UsersController avatar ownership', () => {
  it('always updates the authenticated user instead of accepting a target user id', async () => {
    const usersService = {
      updateAvatar: vi.fn().mockResolvedValue({
        id: 12,
        avatarUrl: '/users/12/avatar?v=1',
      }),
    };
    const controller = new UsersController(usersService as any);
    const file = { buffer: Buffer.from('image') };

    await controller.updateMyAvatar(file, {
      user: { id: 12, roles: ['it_admin'] },
      ip: '127.0.0.1',
    });

    expect(usersService.updateAvatar).toHaveBeenCalledWith(
      12,
      file,
      '127.0.0.1',
    );
  });

  it('allows the authenticated avatar response to render across Vercel and Railway origins', async () => {
    const avatar = {
      data: Buffer.from('avatar'),
      mimeType: 'image/webp',
      size: 6,
    };
    const usersService = { getAvatar: vi.fn().mockResolvedValue(avatar) };
    const controller = new UsersController(usersService as any);
    const response = {
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await controller.getAvatar(12, response as any);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Resource-Policy',
      'cross-origin',
    );
    expect(response.send).toHaveBeenCalledWith(avatar.data);
  });

  it('uses the JWT user id when updating a phone number', async () => {
    const usersService = {
      updateMyPhone: vi.fn().mockResolvedValue({
        id: 12,
        phone: '0901 234 567',
      }),
    };
    const controller = new UsersController(usersService as any);

    await controller.updateMyProfile(
      { phone: '0901 234 567' },
      { user: { id: 12 }, ip: '127.0.0.1' },
    );

    expect(usersService.updateMyPhone).toHaveBeenCalledWith(
      12,
      '0901 234 567',
      '127.0.0.1',
    );
  });
});
