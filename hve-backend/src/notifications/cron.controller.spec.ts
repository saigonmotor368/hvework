import { Test, TestingModule } from '@nestjs/testing';
import { CronController } from './cron.controller.js';
import { NotificationsService } from './notifications.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('CronController', () => {
  let controller: CronController;
  let notificationsService: any;
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(async () => {
    notificationsService = {
      triggerScheduledReminders: vi.fn().mockResolvedValue({ sent: 3 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CronController],
      providers: [{ provide: NotificationsService, useValue: notificationsService }],
    }).compile();

    controller = module.get<CronController>(CronController);
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it('should reject when CRON_SECRET is not configured on the server', async () => {
    delete process.env.CRON_SECRET;
    await expect(controller.triggerReminders('Bearer whatever')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject when Authorization header does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'super-secret-value';
    await expect(controller.triggerReminders('Bearer wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(notificationsService.triggerScheduledReminders).not.toHaveBeenCalled();
  });

  it('should reject when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'super-secret-value';
    await expect(controller.triggerReminders(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('should trigger reminders when Authorization header matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'super-secret-value';
    const result = await controller.triggerReminders('Bearer super-secret-value');
    expect(result).toEqual({ sent: 3 });
    expect(notificationsService.triggerScheduledReminders).toHaveBeenCalled();
  });
});
