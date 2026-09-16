import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  private readonly vapidPublicKey =
    process.env.VAPID_PUBLIC_KEY ||
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  private readonly vapidPrivateKey =
    process.env.VAPID_PRIVATE_KEY || 'UUxI4g7-2N8XkP_W4L3w_R7O3jB-8Y8bI8nB7I0nJ5c';
  private readonly vapidSubject =
    process.env.VAPID_SUBJECT || 'mailto:admin@huyvoeducation.vn';

  constructor(private readonly prisma: PrismaService) {
    try {
      webpush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
    } catch (err) {
      this.logger.warn(`Failed to initialize VAPID details: ${err}`);
    }
  }

  getPublicKey(): string {
    return this.vapidPublicKey;
  }

  async saveSubscription(
    userId: number,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    if (!sub || !sub.endpoint) return null;

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh || '',
        auth: sub.keys?.auth || '',
      },
      update: {
        userId,
        p256dh: sub.keys?.p256dh || '',
        auth: sub.keys?.auth || '',
      },
    });
  }

  async sendNotification(
    userId: number,
    payload: { title: string; body: string; url?: string; icon?: string },
  ) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      icon: payload.icon || '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      timestamp: Date.now(),
    });

    for (const sub of subscriptions) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, payloadString);
      } catch (error: any) {
        // HTTP 404 or 410 means subscription is expired or revoked
        if (error.statusCode === 404 || error.statusCode === 410) {
          this.logger.log(`Removing expired Web Push subscription #${sub.id}`);
          await this.prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        } else {
          this.logger.warn(
            `Failed to send Web Push to user #${userId}: ${error.message || error}`,
          );
        }
      }
    }
  }
}
