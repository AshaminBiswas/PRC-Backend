const fs = require('fs');
const file = 'src/modules/payments/webhook.routes.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /logger\.warn\(`\[Webhook\] payment\.failed.*?order \$\{payment\.orderId\}`\);/;

const replacement = `logger.warn(\`[Webhook] payment.failed - order \${payment.orderId}\`);
              
              try {
                const { eventBus } = await import('../../events/eventBus');
                eventBus.emitEvent('payment.failed', {
                  orderId: updatedOrder.id,
                  orderNumber: updatedOrder.orderNumber,
                  amount: Number(payment.amount),
                  reason: errorDesc ?? "Payment failed",
                });
              } catch (err) {
                logger.error('[Webhook] Failed to emit payment.failed event', err);
              }`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('done regex dash fix');
