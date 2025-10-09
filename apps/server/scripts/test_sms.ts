import dotenv from 'dotenv';
dotenv.config();

import { sendSms } from '../src/services/smsProvider';

async function main() {
  const to = process.argv[2] || process.env.TEST_SMS_TO || '';
  const text = process.argv.slice(3).join(' ') || `ADTV test message ${new Date().toISOString()}`;

  if (!to) {
    console.error('Usage: pnpm exec ts-node scripts/test_sms.ts +1XXXXXXXXXX "message"');
    process.exit(1);
  }

  try {
    const result = await sendSms({ to, text });
    // Print full result for debugging (including provider/raw)
    console.log(JSON.stringify({ to, text, result }, null, 2));
    process.exit(result.sent ? 0 : 2);
  } catch (e: any) {
    console.error('Error invoking sendSms:', e?.message || e);
    process.exit(1);
  }
}

main();



