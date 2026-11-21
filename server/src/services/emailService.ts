import nodemailer from 'nodemailer';

// In-memory log of recent sent emails for easy inspection and UI notifications
export interface SentEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  previewUrl?: string | false;
  timestamp: number;
}

export const emailHistory: SentEmail[] = [];

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  // 1. Gmail SMTP (Native Service via Google Account App Password)
  const gmailUser = process.env.GMAIL_USER || process.env.EMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.EMAIL_PASS;

  if (gmailUser && gmailPass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
    return transporter;
  }

  // 2. Custom SMTP Provider (SendGrid, Mailgun, Postmark, AWS SES, or custom VPS)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // 3. Development / Sandbox fallback using Ethereal email
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch {
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return transporter;
}

export async function sendPasswordResetEmail(email: string, resetToken: string, name: string): Promise<string> {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const subject = 'Reset your password - Collaborative Code & Whiteboard';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5; margin-top: 0;">Password Reset Request</h2>
      <p>Hello ${name},</p>
      <p>You requested to reset your password for your Collaborative Code & Whiteboard Editor account.</p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    </div>
  `;

  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: '"Collaborative Workspace" <no-reply@collab-editor.local>',
      to: email,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const emailRecord: SentEmail = {
      id: Math.random().toString(36).substring(2, 9),
      to: email,
      subject,
      body: `Reset link: ${resetUrl}`,
      previewUrl,
      timestamp: Date.now(),
    };
    emailHistory.unshift(emailRecord);
    if (emailHistory.length > 50) emailHistory.pop();

    console.log(`[Email] Password reset sent to ${email}. Link: ${resetUrl}`);
    if (previewUrl) {
      console.log(`[Email Preview]: ${previewUrl}`);
    }
    return resetUrl;
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return resetUrl;
  }
}

export async function sendDocumentInviteEmail(
  toEmail: string,
  inviterName: string,
  docTitle: string,
  docId: string,
  role: string,
  clientOrigin?: string
): Promise<string> {
  const baseUrl = clientOrigin || process.env.CLIENT_URL || 'http://localhost:5173';
  const docUrl = `${baseUrl}/workspace/${docId}`;
  const subject = `${inviterName} invited you to collaborate on "${docTitle}"`;
  const fromAddress = process.env.GMAIL_USER ? `"Collaborative Workspace" <${process.env.GMAIL_USER}>` : '"Collaborative Workspace" <no-reply@collab-editor.local>';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
        <span style="background: #eef2ff; color: #4f46e5; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px;">
          Workspace Invitation
        </span>
      </div>
      <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">
        Collaborate on "${docTitle}"
      </h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        <strong>${inviterName}</strong> has invited you to collaborate in real-time as an 
        <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 6px; font-weight: 600; text-transform: uppercase; font-size: 12px;">
          ${role}
        </span>.
      </p>
      <div style="margin: 28px 0;">
        <a href="${docUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
          Open Workspace
        </a>
      </div>
      <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; color: #64748b; font-size: 12px;">
        <p style="margin: 0 0 6px 0;">Or copy and paste this direct workspace link into your browser:</p>
        <a href="${docUrl}" style="color: #4f46e5; word-break: break-all;">${docUrl}</a>
      </div>
    </div>
  `;

  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const emailRecord: SentEmail = {
      id: Math.random().toString(36).substring(2, 9),
      to: toEmail,
      subject,
      body: `Invited to ${docTitle} as ${role}: ${docUrl}`,
      previewUrl,
      timestamp: Date.now(),
    };
    emailHistory.unshift(emailRecord);
    if (emailHistory.length > 50) emailHistory.pop();

    console.log(`[Email] Document invite sent to ${toEmail} for doc ${docId}`);
    return docUrl;
  } catch (error) {
    console.error('[Email] Failed to send invite email:', error);
    return docUrl;
  }
}
