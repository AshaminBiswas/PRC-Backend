declare module 'razorpay' {
  interface RazorpayOrderOptions {
    amount: number;
    currency: string;
    receipt?: string;
    notes?: Record<string, string | number>;
    partial_payment?: boolean;
  }

  interface RazorpayOrder {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt?: string;
    status: string;
    attempts: number;
    notes?: Record<string, string | number>;
    created_at: number;
  }

  interface RazorpayRefundOptions {
    amount?: number;
    speed?: 'normal' | 'optimum';
    notes?: Record<string, string | number>;
    receipt?: string;
  }

  interface RazorpayRefund {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    payment_id: string;
    notes?: Record<string, string | number>;
    receipt?: string;
    acquirer_data?: Record<string, unknown>;
    created_at: number;
    batch_id?: string;
    status: string;
  }

  class Razorpay {
    constructor(options: { key_id: string; key_secret: string });
    orders: {
      create(options: RazorpayOrderOptions): Promise<RazorpayOrder>;
      fetch(orderId: string): Promise<RazorpayOrder>;
    };
    payments: {
      fetch(paymentId: string): Promise<unknown>;
      refund(paymentId: string, options?: RazorpayRefundOptions): Promise<RazorpayRefund>;
    };
  }

  export default Razorpay;
}
