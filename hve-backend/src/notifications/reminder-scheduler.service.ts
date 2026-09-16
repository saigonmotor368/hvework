import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledReminders() {
    this.logger.log('Running scheduled reminder scan...');
    try {
      const result = await this.notificationsService.triggerScheduledReminders();
      this.logger.log(`Scheduled reminder scan completed: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error(`Scheduled reminder scan failed: ${err}`);
    }
  }
}
