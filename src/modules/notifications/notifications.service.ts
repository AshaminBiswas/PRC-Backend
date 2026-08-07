import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { UserStatus, Prisma } from '@prisma/client';
import type {
  ListNotificationsQuery,
  SendNotificationInput,
} from './notifications.schema';

export const getUserNotifications = async (userId: string, query: ListNotificationsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Prisma.NotificationWhereInput = { userId };
  if (query.isRead !== undefined) {
    where.isRead = query.isRead;
  }

  const [unreadCount, totalItems, notifications] = await Promise.all([
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return {
    data: notifications,
    unreadCount,
    pagination,
  };
};

export const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError('NOT_FOUND', 'Notification not found', 404);
  }

  if (notification.isRead) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

export const markAllAsRead = async (userId: string) => {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: now,
    },
  });

  return { count: result.count };
};

export const sendNotification = async (input: SendNotificationInput) => {
  const rawOrderId = input.orderId || (input.data as any)?.orderId || (input.data as any)?.order_id;
  let targetOrder: any = null;

  if (rawOrderId) {
    targetOrder = await prisma.order.findFirst({
      where: {
        OR: [{ id: rawOrderId }, { orderNumber: rawOrderId }],
      },
      select: { id: true, orderNumber: true, userId: true, status: true },
    });

    if (!targetOrder) {
      throw new AppError('NOT_FOUND', `Order '${rawOrderId}' not found in database`, 404);
    }
  } else if (input.type === 'ORDER' || input.type === 'ORDER_STATUS') {
    throw new AppError('BAD_REQUEST', 'orderId is required for order-related notifications', 400);
  }

  // Merge order details into notification data payload
  const notificationDataPayload = {
    ...(input.data || {}),
    ...(targetOrder && {
      orderId: targetOrder.id,
      orderNumber: targetOrder.orderNumber,
      orderStatus: targetOrder.status,
    }),
  };

  if (input.broadcast) {
    const users = await prisma.user.findMany({
      where: { status: UserStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });

    if (users.length === 0) {
      return { count: 0, broadcast: true };
    }

    const notificationsData = users.map((u) => ({
      userId: u.id,
      type: input.type,
      title: input.title,
      message: input.message,
      data: Object.keys(notificationDataPayload).length > 0 ? (notificationDataPayload as any) : undefined,
    }));

    const result = await prisma.notification.createMany({
      data: notificationsData,
    });

    return { count: result.count, broadcast: true };
  }

  // Determine target user ID (from input or automatically inferred from order)
  const targetUserId = input.userId || targetOrder?.userId;

  if (!targetUserId) {
    throw new AppError(
      'BAD_REQUEST',
      'Recipient required: specify userId, valid orderId, or set broadcast to true',
      400
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId, deletedAt: null },
  });

  if (!targetUser) {
    throw new AppError('NOT_FOUND', 'Target user not found', 404);
  }

  const notification = await prisma.notification.create({
    data: {
      userId: targetUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: Object.keys(notificationDataPayload).length > 0 ? (notificationDataPayload as any) : undefined,
    },
  });

  return notification;
};
