import prisma from '../../config/database';
import { sendMail } from '../../utils/email.utils';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

export const notifyAdmins = async (
  title: string,
  message: string,
  type: string = 'ADMIN_ALERT',
  data?: any
) => {
  try {
    // 1. Get all active admins and super admins
    const admins = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              slug: { in: ['admin', 'super-admin', 'super_admin'] }
            }
          }
        },
        status: 'ACTIVE',
        deletedAt: null
      },
      select: { id: true, email: true, firstName: true }
    });

    if (!admins || admins.length === 0) {
      logger.warn('[Admin Notification] No admin users found to notify');
      return;
    }

    // 2. Create in-app notifications in bulk
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type,
        title,
        message,
        data: data ? (data as any) : undefined
      }))
    });

    // 3. Dispatch Emails
    const adminUrl = env.frontend.adminUrl || 'https://admin.pacifichardware.com';
    const emailPromises = admins.map((admin) => {
      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #34150F; padding: 20px; text-align: center; border-bottom: 4px solid #D39858;">
            <h2 style="color: #EACEAA; margin: 0; font-size: 22px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Admin Alert</h2>
          </div>
          <div style="padding: 30px; color: #333333;">
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 10px;">Hi <strong>${admin.firstName}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">An important system event has occurred that requires your attention:</p>
            
            <div style="background-color: #fcf9f6; border-left: 4px solid #85431E; padding: 15px; margin-bottom: 25px; border-radius: 0 4px 4px 0;">
              <h3 style="margin: 0 0 10px 0; color: #85431E; font-size: 18px;">${title}</h3>
              <p style="margin: 0; font-size: 15px; line-height: 1.5;">${message}</p>
            </div>
            
            ${data ? `
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin-bottom: 25px; overflow-x: auto;">
                <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #555;">Event Details:</p>
                <pre style="margin: 0; font-family: monospace; font-size: 13px; color: #333;">${JSON.stringify(data, null, 2)}</pre>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${adminUrl}" style="display: inline-block; padding: 12px 24px; background-color: #85431E; color: #EACEAA; text-decoration: none; font-weight: bold; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Open Admin Panel</a>
            </div>
          </div>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888;">
            <p style="margin: 0;">This is an automated system alert from PRC Hardware.</p>
          </div>
        </div>
      `;

      return sendMail({
        to: admin.email,
        subject: `[PRC Admin Alert] ${title}`,
        html: emailHtml
      }).catch(err => logger.error(`[Admin Notification] Failed to send email to ${admin.email}`, err));
    });

    await Promise.all(emailPromises);
    logger.info(`[Admin Notification] Alert "${title}" dispatched to ${admins.length} admins.`);
    
  } catch (error) {
    logger.error('[Admin Notification] Critical failure while notifying admins', error);
  }
};
