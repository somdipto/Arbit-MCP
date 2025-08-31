import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { 
  NotificationConfig, 
  NotificationType, 
  NotificationPriority,
  NotificationChannel 
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { MetricsService } from './MetricsService';

export class NotificationService extends EventEmitter {
  private database: DatabaseService;
  private metrics: MetricsService;
  private notificationQueue: Map<string, any[]> = new Map();
  private notificationHistory: Map<string, any[]> = new Map();
  private config: NotificationConfig;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(database: DatabaseService, metrics: MetricsService) {
    super();
    
    this.database = database;
    this.metrics = metrics;
    
    // Initialize notification configuration
    this.config = {
      email: {
        enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
        fromEmail: process.env.FROM_EMAIL || 'noreply@csab.com',
        toEmails: (process.env.TO_EMAILS || '').split(',').filter(Boolean)
      },
      telegram: {
        enabled: process.env.TELEGRAM_NOTIFICATIONS === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || ''
      },
      slack: {
        enabled: process.env.SLACK_NOTIFICATIONS === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#arbitrage-alerts'
      },
      webhook: {
        enabled: process.env.WEBHOOK_NOTIFICATIONS === 'true',
        url: process.env.WEBHOOK_URL || '',
        headers: JSON.parse(process.env.WEBHOOK_HEADERS || '{}')
      }
    };
  }

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing notification service...');
      
      // Validate configuration
      this.validateConfig();
      
      // Start notification processing
      this.startNotificationProcessing();
      
      this.isRunning = true;
      logger.info('Notification service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize notification service:', error);
      throw error;
    }
  }

  /**
   * Validate notification configuration
   */
  private validateConfig(): void {
    try {
      if (this.config.email.enabled) {
        if (!this.config.email.smtpUser || !this.config.email.smtpPass) {
          throw new Error('Email notifications enabled but SMTP credentials missing');
        }
        if (this.config.email.toEmails.length === 0) {
          throw new Error('Email notifications enabled but no recipient emails configured');
        }
      }

      if (this.config.telegram.enabled) {
        if (!this.config.telegram.botToken || !this.config.telegram.chatId) {
          throw new Error('Telegram notifications enabled but bot token or chat ID missing');
        }
      }

      if (this.config.slack.enabled) {
        if (!this.config.slack.webhookUrl) {
          throw new Error('Slack notifications enabled but webhook URL missing');
        }
      }

      if (this.config.webhook.enabled) {
        if (!this.config.webhook.url) {
          throw new Error('Webhook notifications enabled but URL missing');
        }
      }

      logger.info('Notification configuration validated successfully');
      
    } catch (error) {
      logger.error('Notification configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Start notification processing
   */
  private startNotificationProcessing(): void {
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNotificationQueue();
      } catch (error) {
        logger.error('Error processing notification queue:', error);
      }
    }, parseInt(process.env.NOTIFICATION_PROCESSING_INTERVAL || '5000')); // 5 seconds
  }

  /**
   * Process notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    try {
      for (const [priority, notifications] of this.notificationQueue) {
        if (notifications.length > 0) {
          // Process notifications by priority
          const notification = notifications.shift();
          if (notification) {
            await this.sendNotification(notification);
            
            // Store in history
            this.storeNotificationHistory(notification);
          }
        }
      }
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: any): Promise<void> {
    try {
      logger.info(`Sending notification: ${notification.type} - ${notification.message}`);
      
      // Send to all enabled channels
      const promises: Promise<void>[] = [];
      
      if (this.config.email.enabled) {
        promises.push(this.sendEmailNotification(notification));
      }
      
      if (this.config.telegram.enabled) {
        promises.push(this.sendTelegramNotification(notification));
      }
      
      if (this.config.slack.enabled) {
        promises.push(this.sendSlackNotification(notification));
      }
      
      if (this.config.webhook.enabled) {
        promises.push(this.sendWebhookNotification(notification));
      }
      
      // Wait for all notifications to be sent
      await Promise.allSettled(promises);
      
      // Emit notification sent event
      this.emit('notificationSent', notification);
      
      logger.info(`Notification sent successfully: ${notification.type}`);
      
    } catch (error) {
      logger.error(`Error sending notification ${notification.type}:`, error);
      this.emit('notificationError', { notification, error });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any): Promise<void> {
    try {
      // This would implement actual email sending
      // For now, just log the attempt
      logger.debug(`Email notification would be sent: ${notification.subject || notification.message}`);
      
      // In production, you'd use a library like nodemailer
      // const transporter = nodemailer.createTransporter({
      //   host: this.config.email.smtpHost,
      //   port: this.config.email.smtpPort,
      //   secure: false,
      //   auth: {
      //     user: this.config.email.smtpUser,
      //     pass: this.config.email.smtpPass
      //   }
      // });
      
      // await transporter.sendMail({
      //   from: this.config.email.fromEmail,
      //   to: this.config.email.toEmails.join(','),
      //   subject: notification.subject || 'CSAB Notification',
      //   text: notification.message,
      //   html: this.formatEmailHTML(notification)
      // });
      
    } catch (error) {
      logger.error('Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegramNotification(notification: any): Promise<void> {
    try {
      const message = this.formatTelegramMessage(notification);
      const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
      }
      
      logger.debug('Telegram notification sent successfully');
      
    } catch (error) {
      logger.error('Error sending Telegram notification:', error);
      throw error;
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: any): Promise<void> {
    try {
      const payload = this.formatSlackPayload(notification);
      
      const response = await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Slack webhook error: ${response.status} ${response.statusText}`);
      }
      
      logger.debug('Slack notification sent successfully');
      
    } catch (error) {
      logger.error('Error sending Slack notification:', error);
      throw error;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: any): Promise<void> {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        type: notification.type,
        priority: notification.priority,
        message: notification.message,
        data: notification.data || {}
      };
      
      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }
      
      logger.debug('Webhook notification sent successfully');
      
    } catch (error) {
      logger.error('Error sending webhook notification:', error);
      throw error;
    }
  }

  /**
   * Format Telegram message
   */
  private formatTelegramMessage(notification: any): string {
    const priorityEmoji = this.getPriorityEmoji(notification.priority);
    const typeEmoji = this.getTypeEmoji(notification.type);
    
    return `
<b>${priorityEmoji} ${typeEmoji} CSAB Notification</b>

<b>Type:</b> ${notification.type}
<b>Priority:</b> ${notification.priority}
<b>Time:</b> ${new Date().toLocaleString()}

${notification.message}

${notification.data ? `<b>Details:</b>\n${JSON.stringify(notification.data, null, 2)}` : ''}
    `.trim();
  }

  /**
   * Format Slack payload
   */
  private formatSlackPayload(notification: any): any {
    const priorityColor = this.getPriorityColor(notification.priority);
    const priorityEmoji = this.getPriorityEmoji(notification.priority);
    const typeEmoji = this.getTypeEmoji(notification.type);
    
    return {
      channel: this.config.slack.channel,
      attachments: [
        {
          color: priorityColor,
          title: `${priorityEmoji} ${typeEmoji} CSAB Notification`,
          fields: [
            {
              title: 'Type',
              value: notification.type,
              short: true
            },
            {
              title: 'Priority',
              value: notification.priority,
              short: true
            },
            {
              title: 'Time',
              value: new Date().toLocaleString(),
              short: true
            },
            {
              title: 'Message',
              value: notification.message,
              short: false
            }
          ],
          footer: 'CSAB Arbitrage Bot',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Format email HTML
   */
  private formatEmailHTML(notification: any): string {
    const priorityColor = this.getPriorityColor(notification.priority);
    const priorityEmoji = this.getPriorityEmoji(notification.priority);
    const typeEmoji = this.getTypeEmoji(notification.type);
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: ${priorityColor}; color: white; padding: 20px; border-radius: 5px; }
            .content { margin: 20px 0; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${priorityEmoji} ${typeEmoji} CSAB Notification</h1>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Type:</span> ${notification.type}
            </div>
            <div class="field">
              <span class="label">Priority:</span> ${notification.priority}
            </div>
            <div class="field">
              <span class="label">Time:</span> ${new Date().toLocaleString()}
            </div>
            <div class="field">
              <span class="label">Message:</span><br>
              ${notification.message}
            </div>
            ${notification.data ? `
            <div class="field">
              <span class="label">Details:</span><br>
              <pre>${JSON.stringify(notification.data, null, 2)}</pre>
            </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>This is an automated notification from the CSAB Arbitrage Bot.</p>
            <p>Time: ${new Date().toISOString()}</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      'low': '🟢',
      'medium': '🟡',
      'high': '🟠',
      'critical': '🔴'
    };
    return emojis[priority] || '⚪';
  }

  /**
   * Get type emoji
   */
  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'opportunity': '💰',
      'trade': '📈',
      'risk': '⚠️',
      'error': '❌',
      'system': '⚙️',
      'profit': '✅',
      'loss': '💸'
    };
    return emojis[type] || '📢';
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'low': '#36a64f',
      'medium': '#ffcc00',
      'high': '#ff8c00',
      'critical': '#ff0000'
    };
    return colors[priority] || '#666666';
  }

  /**
   * Queue notification
   */
  queueNotification(
    type: NotificationType,
    message: string,
    priority: NotificationPriority = 'medium',
    data?: any,
    channels?: NotificationChannel[]
  ): void {
    try {
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        priority,
        data,
        channels: channels || ['all'],
        timestamp: new Date(),
        attempts: 0,
        maxAttempts: 3
      };
      
      // Add to appropriate priority queue
      if (!this.notificationQueue.has(priority)) {
        this.notificationQueue.set(priority, []);
      }
      
      this.notificationQueue.get(priority)!.push(notification);
      
      // Emit notification queued event
      this.emit('notificationQueued', notification);
      
      logger.debug(`Notification queued: ${type} - ${priority}`);
      
    } catch (error) {
      logger.error('Error queuing notification:', error);
    }
  }

  /**
   * Send immediate notification (bypasses queue)
   */
  async sendImmediateNotification(
    type: NotificationType,
    message: string,
    priority: NotificationPriority = 'medium',
    data?: any,
    channels?: NotificationChannel[]
  ): Promise<void> {
    try {
      const notification = {
        id: `immediate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        priority,
        data,
        channels: channels || ['all'],
        timestamp: new Date(),
        attempts: 0,
        maxAttempts: 3
      };
      
      // Send immediately
      await this.sendNotification(notification);
      
      // Store in history
      this.storeNotificationHistory(notification);
      
    } catch (error) {
      logger.error('Error sending immediate notification:', error);
      throw error;
    }
  }

  /**
   * Store notification in history
   */
  private storeNotificationHistory(notification: any): void {
    try {
      const key = `history_${new Date().toISOString().split('T')[0]}`;
      
      if (!this.notificationHistory.has(key)) {
        this.notificationHistory.set(key, []);
      }
      
      this.notificationHistory.get(key)!.push(notification);
      
      // Keep only last 1000 notifications per day
      const dailyNotifications = this.notificationHistory.get(key)!;
      if (dailyNotifications.length > 1000) {
        dailyNotifications.splice(0, dailyNotifications.length - 1000);
      }
      
    } catch (error) {
      logger.error('Error storing notification history:', error);
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(days: number = 7): any[] {
    try {
      const allNotifications: any[] = [];
      
      for (const [key, notifications] of this.notificationHistory) {
        const date = new Date(key.replace('history_', ''));
        const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= days) {
          allNotifications.push(...notifications);
        }
      }
      
      // Sort by timestamp (newest first)
      return allNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
    } catch (error) {
      logger.error('Error getting notification history:', error);
      return [];
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): any {
    try {
      const stats = {
        totalQueued: 0,
        totalSent: 0,
        totalFailed: 0,
        byPriority: {},
        byType: {},
        byChannel: {}
      };
      
      // Count queued notifications
      for (const [priority, notifications] of this.notificationQueue) {
        stats.totalQueued += notifications.length;
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + notifications.length;
      }
      
      // Count sent notifications from history
      const history = this.getNotificationHistory(1); // Last 24 hours
      stats.totalSent = history.length;
      
      // Count by type and channel
      history.forEach(notification => {
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
        notification.channels.forEach((channel: string) => {
          stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
        });
      });
      
      return stats;
      
    } catch (error) {
      logger.error('Error getting notification statistics:', error);
      return {};
    }
  }

  /**
   * Clear notification queue
   */
  clearNotificationQueue(): void {
    try {
      this.notificationQueue.clear();
      logger.info('Notification queue cleared');
      
    } catch (error) {
      logger.error('Error clearing notification queue:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      config: {
        email: this.config.email.enabled,
        telegram: this.config.telegram.enabled,
        slack: this.config.slack.enabled,
        webhook: this.config.webhook.enabled
      },
      queueSize: Array.from(this.notificationQueue.values()).reduce((sum, notifications) => sum + notifications.length, 0),
      historySize: Array.from(this.notificationHistory.values()).reduce((sum, notifications) => sum + notifications.length, 0)
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop notification processing
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
      
      // Process remaining notifications
      await this.processNotificationQueue();
      
      // Clear queues and history
      this.notificationQueue.clear();
      this.notificationHistory.clear();
      
      this.isRunning = false;
      logger.info('Notification service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up notification service:', error);
    }
  }
}
