import imaps from 'imap-simple';
import { env } from '../config/env';
import { syncInboundEmails } from '../modules/po-management/po-sync.service';

async function diagnoseImap() {
  console.log('🔍 Starting IMAP Sync Diagnostic...\n');

  console.log('📋 Loaded Configuration from .env:');
  console.log('  IMAP_HOST:', env.imap.host || '(EMPTY - Not set!)');
  console.log('  IMAP_PORT:', env.imap.port || '(Default: 993)');
  console.log('  IMAP_TLS:', env.imap.tls);
  console.log('  IMAP_USER:', env.imap.user || '(EMPTY - Not set!)');
  console.log('  IMAP_PASS:', env.imap.pass ? `****** (${env.imap.pass.length} chars)` : '(EMPTY - Not set!)');
  console.log('  IMAP_MAILBOX:', env.imap.mailbox || 'INBOX');
  console.log('--------------------------------------------------\n');

  if (!env.imap.host || !env.imap.user || !env.imap.pass) {
    console.error('❌ Configuration Issue: Missing required IMAP credentials in .env!');
    console.error('Please ensure IMAP_HOST, IMAP_USER, and IMAP_PASS are defined in your .env file.');
    process.exit(1);
  }

  console.log(`🔌 Attempting test connection to ${env.imap.host}:${env.imap.port} for user "${env.imap.user}"...`);

  try {
    const config: imaps.ImapSimpleOptions = {
      imap: {
        user: env.imap.user,
        password: env.imap.pass,
        host: env.imap.host,
        port: env.imap.port,
        tls: env.imap.tls,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
      },
    };

    const connection = await imaps.connect(config);
    console.log('✅ Connection established successfully!');

    console.log(`📬 Opening mailbox "${env.imap.mailbox}"...`);
    const box: any = await connection.openBox(env.imap.mailbox);
    console.log(`✅ Mailbox opened!`);

    console.log('🔍 Searching for unread messages (UNSEEN)...');
    const unseen = await connection.search(['UNSEEN'], { bodies: ['HEADER'], markSeen: false });
    console.log(`📨 Found ${unseen.length} unread message(s).`);

    console.log('🔍 Searching for ALL recent messages (last 5)...');
    const allRecent = await connection.search(['ALL'], { bodies: ['HEADER'], markSeen: false });
    console.log(`📨 Found ${allRecent.length} total message(s) in inbox.`);

    connection.end();

    console.log('\n🚀 Now executing full syncInboundEmails() pipeline...');
    const syncRes = await syncInboundEmails();
    console.log('✅ syncInboundEmails result:', syncRes);

    console.log('\n🎉 IMAP SYNC IS 100% OPERATIONAL!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Connection Failed with Error:', error.message || error);
    console.error('Stack:', error.stack);

    console.log('\n💡 Diagnostic Troubleshooting Tips:');
    if (error.message?.includes('Invalid credentials') || error.message?.includes('AUTHENTICATIONFAILED')) {
      console.log('  1. If using Gmail:');
      console.log('     - Normal Gmail passwords DO NOT WORK. You MUST use a 16-character "Google App Password".');
      console.log('     - Visit: https://myaccount.google.com/apppasswords');
      console.log('     - Generate an app password for "Mail" and put that in IMAP_PASS.');
      console.log('     - Make sure 2-Step Verification is enabled on your Google Account.');
      console.log('  2. Enable IMAP in Gmail:');
      console.log('     - Go to Gmail Settings -> "Forwarding and POP/IMAP" -> Enable "IMAP Access" -> Save Changes.');
    } else if (error.message?.includes('ETIMEDOUT') || error.message?.includes('ENOTFOUND')) {
      console.log('  - Hostname or network error. Verify IMAP_HOST (e.g. imap.gmail.com).');
    }
    process.exit(1);
  }
}

diagnoseImap();
