import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Rate limiting: simple in-memory store (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // Max 5 submissions per hour per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { firstName, lastName, email, message } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Sanitize inputs (basic XSS prevention)
    const sanitize = (str: string) =>
      str.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const sanitizedData = {
      firstName: sanitize(firstName.trim()),
      lastName: sanitize(lastName.trim()),
      email: sanitize(email.trim().toLowerCase()),
      message: sanitize(message.trim()),
    };

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('[Contact] RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 500 }
      );
    }

    // Send email notification
    const { error: sendError } = await resend.emails.send({
      from: 'SnipIt Contact Form <nofluff@newsletter.snipit.news>',
      to: ['naumaan.hussain111@gmail.com'],
      cc: ['haseebbakali@gmail.com'],
      replyTo: sanitizedData.email,
      subject: `New Contact Form Submission from ${sanitizedData.firstName} ${sanitizedData.lastName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 40px 20px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #2a2a2a; border-radius: 12px; padding: 32px; border: 1px solid rgba(255, 165, 0, 0.2);">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #FFA500; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
                <p style="color: #999; margin: 8px 0 0 0; font-size: 14px;">Someone reached out via the SnipIt contact form</p>
              </div>

              <div style="background-color: #333; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #999; font-size: 14px; width: 100px;">Name:</td>
                    <td style="padding: 8px 0; color: #fff; font-size: 14px;">${sanitizedData.firstName} ${sanitizedData.lastName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #999; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #FFA500; font-size: 14px;">
                      <a href="mailto:${sanitizedData.email}" style="color: #FFA500; text-decoration: none;">${sanitizedData.email}</a>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #333; border-radius: 8px; padding: 24px;">
                <h3 style="color: #FFA500; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Message</h3>
                <p style="color: #fff; margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${sanitizedData.message}</p>
              </div>

              <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255, 165, 0, 0.2);">
                <p style="color: #666; font-size: 12px; margin: 0;">
                  This email was sent from the SnipIt contact form.<br>
                  Reply directly to this email to respond to the sender.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (sendError) {
      console.error('[Contact] Failed to send email:', sendError);
      return NextResponse.json(
        { error: 'Failed to send message. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[Contact] Message sent from ${sanitizedData.email}`);

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully!',
    });
  } catch (error) {
    console.error('[Contact] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
