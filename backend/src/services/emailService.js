import nodemailer from "nodemailer";
import redisClient from "../config/redis.js";

// In-memory email OTP storage for development
const inMemoryEmailOTP = new Map();

const isEmailOtpFallbackEnabled = () =>
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_EMAIL_OTP_FALLBACK === "true";

/** Cached Ethereal test account (free SMTP + web preview — no API keys). */
let etherealAccountPromise = null;

function getEtherealAccount() {
  if (!etherealAccountPromise) {
    etherealAccountPromise = nodemailer.createTestAccount();
  }
  return etherealAccountPromise;
}

/**
 * ethereal — Nodemailer Ethereal (free, preview URL for demos).
 * gmail — real Gmail / App Password.
 * auto — Ethereal if EMAIL_* look unset or placeholder; else Gmail.
 */
function resolveOtpMailMode() {
  const explicit = (process.env.OTP_MAIL_MODE || "").trim().toLowerCase();
  if (explicit === "ethereal" || explicit === "gmail") return explicit;
  if (explicit === "auto" || explicit === "") {
    const user = (process.env.EMAIL_USER || "").trim();
    const pass = (process.env.EMAIL_PASSWORD || "").trim();
    const placeholder =
      !user ||
      !pass ||
      user.startsWith("your_") ||
      pass.startsWith("your_") ||
      user.includes("example.com");
    return placeholder ? "ethereal" : "gmail";
  }
  return "gmail";
}

async function createOtpTransport(mode) {
  if (mode === "ethereal") {
    const account = await getEtherealAccount();
    return {
      mode,
      transport: nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      }),
      fromAddress: `"Barclays Credit" <${account.user}>`,
    };
  }

  if (!process.env.EMAIL_USER?.trim() || !process.env.EMAIL_PASSWORD?.trim()) {
    throw new Error(
      "EMAIL_USER and EMAIL_PASSWORD are required when OTP_MAIL_MODE is gmail (or set OTP_MAIL_MODE=auto with placeholders to use free Ethereal)."
    );
  }

  return {
    mode,
    transport: nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    }),
    fromAddress: process.env.EMAIL_USER,
  };
}

export const sendEmailOTP = async (email) => {
  console.log(` sendEmailOTP called with email: ${email}`);

  const mode = resolveOtpMailMode();
  const { transport, fromAddress } = await createOtpTransport(mode);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`🔐 Generated Email OTP: ${otp}`);

  try {
    // Try to store in Redis first
    await redisClient.setex(`emailotp:${email}`, 300, otp); // 5 minutes
    console.log(` Email OTP stored in Redis`);
  } catch (error) {
    // Fallback to in-memory storage when Redis is unavailable.
    console.log(`⚠️ Redis error: ${error.message}`);
    console.warn("Redis not available, using in-memory email OTP storage");
    inMemoryEmailOTP.set(`emailotp:${email}`, otp);
    setTimeout(() => {
      inMemoryEmailOTP.delete(`emailotp:${email}`);
    }, 300000);
    console.log(` Email OTP stored in-memory`);
  }

  // Send email (always send, even in development)
  try {
    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: "🔐 Barclays Credit - Email Verification OTP",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; color: #1e40af; margin-bottom: 20px; }
            .otp-box { background: #f0f9ff; border: 2px solid #0284c7; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #0284c7; letter-spacing: 5px; }
            .warning { color: #d97706; font-size: 12px; margin-top: 10px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Barclays Credit Loan Platform</h2>
            </div>
            <p>Hello,</p>
            <p>Thank you for signing up with Barclays Credit. To complete your registration, please verify your email address using the OTP below:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p style="color: #666; margin: 10px 0;">This OTP is valid for 5 minutes</p>
            </div>
            <p><strong>Important:</strong></p>
            <ul>
              <li>Never share this OTP with anyone</li>
              <li>Barclays will never ask for your OTP via email or phone</li>
              <li>Do not share this code with anyone else</li>
            </ul>
            <div class="footer">
              <p>If you didn't sign up, please ignore this email.</p>
              <p>&copy; 2024 Barclays Credit. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log(` Sending email OTP to: ${email} (via ${mode})`);
    const info = await transport.sendMail(mailOptions);
    console.log(` Email sent successfully to ${email}`);

    let otpPreviewUrl;
    if (mode === "ethereal") {
      otpPreviewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      if (otpPreviewUrl) {
        console.log(`📬 Open demo inbox to view OTP: ${otpPreviewUrl}`);
      }
    }

    return {
      message: "OTP sent to email",
      emailDelivery: mode,
      ...(otpPreviewUrl ? { otpPreviewUrl } : {}),
      ...(isEmailOtpFallbackEnabled() ? { otp } : {}),
    };
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    if (isEmailOtpFallbackEnabled()) {
      console.warn(
        "Email delivery failed; continuing with debug OTP fallback"
      );
      return {
        message: "OTP generated (email delivery failed; fallback enabled)",
        otp,
        emailDelivery: "failed",
      };
    }
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

export const verifyEmailOTP = async (email, otp) => {
  console.log(` Verifying email OTP for: ${email}`);

  let storedOTP = null;

  try {
    // Try to get from Redis
    storedOTP = await redisClient.get(`emailotp:${email}`);
    console.log(` Retrieved email OTP from Redis`);
  } catch (error) {
    // Fallback to in-memory storage
    console.warn("Redis error, using in-memory email OTP");
    storedOTP = inMemoryEmailOTP.get(`emailotp:${email}`);
  }

  if (!storedOTP) {
    console.error(`Email OTP not found or expired for: ${email}`);
    throw new Error(
      "Email OTP expired or not found. Please request a new OTP."
    );
  }

  if (storedOTP !== otp) {
    console.error(`Email OTP mismatch: expected ${storedOTP}, got ${otp}`);
    throw new Error("Invalid email OTP");
  }

  // Delete the OTP after successful verification
  try {
    await redisClient.del(`emailotp:${email}`);
  } catch {
    inMemoryEmailOTP.delete(`emailotp:${email}`);
  }

  console.log(` Email OTP verified successfully for: ${email}`);
  return { message: "Email verified successfully" };
};

// ==================== LOAN NOTIFICATION EMAILS ====================

export const sendLoanSubmittedEmail = async (
  userEmail,
  userName,
  loanDetails
) => {
  console.log(` Sending loan submission confirmation to: ${userEmail}`);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject:
      " Barclays Credit - Your Loan Application Submitted Successfully",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; color: #1e40af; margin-bottom: 20px; }
          .success-badge { background: #10b981; color: white; padding: 10px 20px; border-radius: 4px; display: inline-block; margin-bottom: 20px; }
          .details-box { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #666; }
          .value { color: #1f2937; }
          .status-pending { background: #fef3c7; color: #92400e; padding: 10px; border-radius: 4px; margin: 15px 0; font-weight: bold; text-align: center; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Barclays Credit Loan Platform</h2>
          </div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div class="success-badge"> APPLICATION SUBMITTED</div>
          </div>
          <p>Dear ${userName},</p>
          <p>Great news! Your loan application has been successfully submitted to Barclays Credit. We are reviewing your application and will get back to you soon.</p>
          
          <div class="details-box">
            <h3 style="margin-top: 0; color: #1f2937;">Application Details:</h3>
            <div class="details-row">
              <span class="label">Application ID:</span>
              <span class="value">${loanDetails.loanId}</span>
            </div>
            <div class="details-row">
              <span class="label">Loan Type:</span>
              <span class="value" style="text-transform: uppercase;">${loanDetails.loanType}</span>
            </div>
            <div class="details-row">
              <span class="label">Requested Amount:</span>
              <span class="value">₹${loanDetails.requestedAmount?.toLocaleString("en-IN") || "N/A"}</span>
            </div>
            <div class="details-row">
              <span class="label">Tenure:</span>
              <span class="value">${loanDetails.requestedTenure} months</span>
            </div>
            <div class="details-row">
              <span class="label">Application Date:</span>
              <span class="value">${new Date(loanDetails.submittedAt).toLocaleDateString("en-IN")}</span>
            </div>
            <div class="details-row">
              <span class="label">Current Status:</span>
              <span class="value" style="color: #f59e0b; font-weight: bold;">${loanDetails.status?.toUpperCase() || "PENDING"}</span>
            </div>
          </div>

          <div class="status-pending">
            ⏳ Your application is currently under review. Our team will evaluate your details and contact you shortly.
          </div>

          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our credit team will analyze your application (usually within 24-48 hours)</li>
            <li>You will receive a notification once a decision is made</li>
            <li>If approved, you can accept the terms and proceed with disbursement</li>
            <li>You can track your application status in your Barclays Credit dashboard</li>
          </ul>

          <p>If you have any questions, please reach out to our support team or log in to your dashboard to check your application status.</p>

          <div class="footer">
            <p>Thank you for choosing Barclays Credit!</p>
            <p>&copy; 2024 Barclays Credit. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this address.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(` Loan submission email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending loan submission email:", error.message);
    // Don't throw - email failure shouldn't block the loan submission
  }
};

export const sendLoanApprovedEmail = async (
  userEmail,
  userName,
  loanDetails
) => {
  console.log(` Sending loan approval email to: ${userEmail}`);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "🎉 Barclays Credit - Your Loan Application Approved!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; color: #1e40af; margin-bottom: 20px; }
          .approval-badge { background: #10b981; color: white; padding: 15px 30px; border-radius: 4px; display: inline-block; margin-bottom: 20px; font-size: 18px; font-weight: bold; }
          .details-box { background: #f0f9ff; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #666; }
          .value { color: #1f2937; font-weight: 600; }
          .highlight { background: #fef3c7; color: #92400e; padding: 12px; border-radius: 4px; margin: 15px 0; text-align: center; font-weight: bold; }
          .cta-button { background: #10b981; color: white; padding: 12px 30px; border-radius: 4px; text-align: center; text-decoration: none; display: inline-block; margin: 15px 0; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Barclays Credit Loan Platform</h2>
          </div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div class="approval-badge">🎉 APPROVED 🎉</div>
          </div>
          <p>Dear ${userName},</p>
          <p style="font-size: 18px; color: #10b981; font-weight: bold;">Congratulations! Your loan application has been approved!</p>
          
          <div class="details-box">
            <h3 style="margin-top: 0; color: #1f2937;">Approval Details:</h3>
            <div class="details-row">
              <span class="label">Application ID:</span>
              <span class="value">${loanDetails.loanId}</span>
            </div>
            <div class="details-row">
              <span class="label">Loan Type:</span>
              <span class="value" style="text-transform: uppercase;">${loanDetails.loanType}</span>
            </div>
            <div class="details-row">
              <span class="label">Requested Amount:</span>
              <span class="value">₹${loanDetails.requestedAmount?.toLocaleString("en-IN") || "N/A"}</span>
            </div>
            <div class="details-row">
              <span class="label">Approved Amount:</span>
              <span class="value" style="color: #10b981;">₹${loanDetails.approvedAmount?.toLocaleString("en-IN") || "N/A"}</span>
            </div>
            <div class="details-row">
              <span class="label">Interest Rate:</span>
              <span class="value">${loanDetails.interestRate}% p.a.</span>
            </div>
            <div class="details-row">
              <span class="label">Tenure:</span>
              <span class="value">${loanDetails.tenure} months</span>
            </div>
            <div class="details-row">
              <span class="label">Status:</span>
              <span class="value" style="color: #10b981; font-weight: bold;"> APPROVED</span>
            </div>
          </div>

          <div class="highlight">
            Your funds will be disbursed within 2-3 business days after acceptance.
          </div>

          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Log in to your Barclays Credit dashboard</li>
            <li>Review the complete loan agreement and terms</li>
            <li>Accept the loan terms to proceed with disbursement</li>
            <li>Wait for the funds to be transferred to your account</li>
          </ul>

          ${loanDetails.notes ? `<p><strong>Approval Notes:</strong> "${loanDetails.notes}"</p>` : ""}

          <div style="text-align: center;">
            <a href="https://barclays-credit.com/dashboard" style="background: #0284c7; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; font-weight: bold; display: inline-block;">Go to Dashboard</a>
          </div>

          <div class="footer">
            <p>Thank you for choosing Barclays Credit!</p>
            <p>&copy; 2024 Barclays Credit. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(` Loan approval email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending loan approval email:", error.message);
    // Don't throw - email failure shouldn't block the approval
  }
};

export const sendLoanRejectedEmail = async (
  userEmail,
  userName,
  loanDetails
) => {
  console.log(` Sending loan rejection email to: ${userEmail}`);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "📋 Barclays Credit - Your Loan Application Status Update",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; color: #1e40af; margin-bottom: 20px; }
          .rejection-badge { background: #ef4444; color: white; padding: 15px 30px; border-radius: 4px; display: inline-block; margin-bottom: 20px; font-size: 18px; font-weight: bold; }
          .details-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #fee2e2; }
          .details-row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #666; }
          .value { color: #1f2937; }
          .reason-box { background: #fff5f5; border: 1px solid #fecaca; padding: 12px; border-radius: 4px; margin: 15px 0; }
          .next-steps { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Barclays Credit Loan Platform</h2>
          </div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div class="rejection-badge">📋 APPLICATION STATUS</div>
          </div>
          <p>Dear ${userName},</p>
          <p>Thank you for applying for a loan with Barclays Credit. We have reviewed your application carefully.</p>
          
          <div class="details-box">
            <h3 style="margin-top: 0; color: #1f2937;">Application Details:</h3>
            <div class="details-row">
              <span class="label">Application ID:</span>
              <span class="value">${loanDetails.loanId}</span>
            </div>
            <div class="details-row">
              <span class="label">Loan Type:</span>
              <span class="value" style="text-transform: uppercase;">${loanDetails.loanType}</span>
            </div>
            <div class="details-row">
              <span class="label">Requested Amount:</span>
              <span class="value">₹${loanDetails.requestedAmount?.toLocaleString("en-IN") || "N/A"}</span>
            </div>
            <div class="details-row">
              <span class="label">Status:</span>
              <span class="value" style="color: #ef4444; font-weight: bold;">NOT APPROVED</span>
            </div>
          </div>

          ${loanDetails.rejectionReason
        ? `
            <div class="reason-box">
              <p style="margin: 0; font-weight: bold; color: #7f1d1d;">Reason for Non-Approval:</p>
              <p style="margin: 10px 0 0 0; color: #1f2937;">${loanDetails.rejectionReason}</p>
            </div>
          `
        : ""
      }

          <div class="next-steps">
            <h4 style="margin-top: 0; color: #0284c7;">What Can You Do?</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Review the reason for non-approval</li>
              <li>Work on improving your credit profile</li>
              <li>Reapply after addressing the concerns mentioned</li>
              <li>Contact our support team for guidance on your application</li>
            </ul>
          </div>

          <p><strong>Don't Give Up!</strong> Many applicants improve their profile and successfully get approved on subsequent applications. We're here to help you improve your credit journey.</p>

          <p>For assistance or to discuss your application, please contact our support team or visit your Barclays Credit dashboard.</p>

          <div class="footer">
            <p>Thank you for your interest in Barclays Credit!</p>
            <p>&copy; 2024 Barclays Credit. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(` Loan rejection email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending loan rejection email:", error.message);
    // Don't throw - email failure shouldn't block the rejection
  }
};