import { AsyncJob } from '@prisma/client';
import { sendMail } from '../utils/email.utils';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

const isEmailPayload = (payload: unknown): payload is EmailPayload => {
  const value = payload as Partial<EmailPayload>;
  return Boolean(value?.to && value?.subject && value?.html);
};

export const handleJob = async (job: AsyncJob): Promise<void> => {
  if (job.type === 'email.send') {
    if (!isEmailPayload(job.payload)) {
      throw new Error('Invalid email job payload');
    }

    await sendMail(job.payload);
    return;
  }

  throw new Error(`Unknown async job type: ${job.type}`);
};
