import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly vapidSubject: string;

  constructor(private readonly prisma: PrismaService) {
    const pubKey = process.env.VAPID_PUBLIC_KEY;
    const privKey = process.env.VAPID_PRIVATE_KEY;
    if (!pubKey || !privKey) {
      throw new Error(
        'FATAL SECURITY ERROR: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are missing or empty! Hardcoded demo keys are strictly forbidden. Startup aborted.',
      );
    }

    this.vapidPublicKey = pubKey;
    this.vapidPrivateKey = privKey;
    this.vapidSubject =
      process.env.VAPID_SUBJECT || 'mailto:admin@huyvoeducation.vn';

    try {
      webpush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
    } catch (err) {
      this.logger.error(`Failed to initialize VAPID details: ${err}`);
      throw err;
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
