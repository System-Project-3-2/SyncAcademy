import nodemailer from "nodemailer";

/**
 * Build a branded HTML email with an optional "See Details" button.
 */
const buildHtml = (name, message, link) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const fullLink = link ? (link.startsWith("http") ? link : `${baseUrl}${link}`) : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Student Aid System</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);padding:28px 36px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">&#127979; Student Aid System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              ${name ? `<p style="margin:0 0 16px;font-size:15px;color:#374151;">Dear <strong>${name}</strong>,</p>` : ""}
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;white-space:pre-line;">${message}</p>
              ${fullLink
                ? `<a href="${fullLink}" target="_blank"
                     style="display:inline-block;padding:12px 28px;background:#1e3a8a;
                            color:#ffffff;text-decoration:none;border-radius:8px;
                            font-size:14px;font-weight:700;letter-spacing:0.02em;">
                     See Details &rarr;
                   </a>`
                : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated notification from Student Aid System. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Send an email.
 * @param {string} to - Recipient address
 * @param {string} subject - Email subject
 * @param {string} text - Plain-text body
 * @param {object} [options] - Optional extras: { name, link } for HTML notification emails
 */
export const sendEmail = async (to, subject, text, options = {}) => {
  const { name, link } = options;

  // Always log content for development purposes
  console.log(`\n========== EMAIL DEBUG ==========`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content: ${text}`);
  if (link) console.log(`Link: ${link}`);
  console.log(`=================================\n`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email credentials not configured. Email not sent, but content logged above.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Student Aid System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      // Only include HTML when link or name is present (notification emails)
      ...(link || name ? { html: buildHtml(name, text, link) } : {}),
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error.message);
  }
};
