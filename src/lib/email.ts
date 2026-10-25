"use server";

import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/** Resend API client for sending transactional emails */
const Resend = require("resend");

export interface EmailSentResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email through Resend.
 * 
 * @param senderName - From name (from business settings)
 * @param senderAddress - From email address (from business settings)
 * @param recipient - Recipient email address
 * @param subject - Email subject
 * @param html - HTML email body
 * @param text - Plain text email body (optional)
 * @returns Result with success status and message ID or error
 */
export async function sendEmailviaResend(
  senderName: string,
  senderAddress: string,
  recipient: string,
  subject: string,
  html: string,
  text?: string
): Promise<EmailSentResult> {
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "Resend API key not configured" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: `${senderName} <${senderAddress}>`,
      to: recipient,
      subject: subject,
      html: html,
      ...(text && { text }),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Log the email to the database
    await db.insert(emailLogs).values({
      id: randomUUID(),
      companyId: "", // Will be set by caller if needed
      documentType: "quotation" as const, // Will be overridden by caller
      documentId: "", // Will be overridden by caller
      recipient: recipient,
      subject: subject,
      status: "sent" as const,
      provider: "resend",
      providerMessageId: data?.id || undefined,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[email/send] failed", err);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Log an email attempt (for failed sends or auditing)
 */
export async function logEmailAttempt(
  companyId: string,
  documentType: "quotation" | "invoice" | "receipt" | "credit_note",
  documentId: string,
  recipient: string,
  subject: string,
  status: "pending" | "sent" | "failed",
  error?: string
) {
  await db.insert(emailLogs).values({
    id: randomUUID(),
    companyId: companyId,
    documentType: documentType,
    documentId: documentId,
    recipient: recipient,
    subject: subject,
    status: status,
    provider: "resend",
    error: error,
    attemptCount: 1,
  });
}

/**
 * Get email sending configuration from environment variables.
 */
export function getEmailConfig() {
  return {
    senderName: process.env.EMAIL_SENDER_NAME || "Quotation & Invoicing System",
    senderAddress: process.env.EMAIL_SENDER_ADDRESS || "no-reply@yourdomain.com",
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
  };
}

/**
 * Send quotation email
 */
export async function sendQuotationEmail(
  quotationId: string,
  recipientEmail: string,
  companyId: string
): Promise<EmailSentResult> {
  const result = await sendEmailviaResend(
    getEmailConfig().senderName,
    getEmailConfig().senderAddress,
    recipientEmail,
    `Quotation ${quotationId} - Your Custom Quote`,
    `<p>Quotation ${quotationId} has been generated for you.</p>`
  );

  // Log the attempt
  await logEmailAttempt(
    companyId,
    "quotation",
    quotationId,
    recipientEmail,
    `Quotation ${quotationId} - Your Custom Quote`,
    result.success ? "sent" : "failed",
    result.error
  );

  return result;
}

/**
 * Send invoice email
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  recipientEmail: string,
  companyId: string
): Promise<EmailSentResult> {
  const result = await sendEmailviaResend(
    getEmailConfig().senderName,
    getEmailConfig().senderAddress,
    recipientEmail,
    `Invoice ${invoiceId} - Your Invoice`,
    `<p>Invoice ${invoiceId} has been generated for you.</p>`
  );

  // Log the attempt
  await logEmailAttempt(
    companyId,
    "invoice",
    invoiceId,
    recipientEmail,
    `Invoice ${invoiceId} - Your Invoice`,
    result.success ? "sent" : "failed",
    result.error
  );

  return result;
}

/**
 * Send receipt email
 */
export async function sendReceiptEmail(
  receiptId: string,
  recipientEmail: string,
  companyId: string
): Promise<EmailSentResult> {
  const result = await sendEmailviaResend(
    getEmailConfig().senderName,
    getEmailConfig().senderAddress,
    recipientEmail,
    `Receipt ${receiptId} - Payment Receipt`,
    `<p>Receipt ${receiptId} has been generated for your payment.</p>`
  );

  // Log the attempt
  await logEmailAttempt(
    companyId,
    "receipt",
    receiptId,
    recipientEmail,
    `Receipt ${receiptId} - Payment Receipt`,
    result.success ? "sent" : "failed",
    result.error
  );

  return result;
}

/**
 * Send credit note email
 */
export async function sendCreditNoteEmail(
  creditNoteId: string,
  recipientEmail: string,
  companyId: string
): Promise<EmailSentResult> {
  const result = await sendEmailviaResend(
    getEmailConfig().senderName,
    getEmailConfig().senderAddress,
    recipientEmail,
    `Credit Note ${creditNoteId} - Credit Adjustment`,
    `<p>Credit Note ${creditNoteId} has been generated for you.</p>`
  );

  // Log the attempt
  await logEmailAttempt(
    companyId,
    "credit_note",
    creditNoteId,
    recipientEmail,
    `Credit Note ${creditNoteId} - Credit Adjustment`,
    result.success ? "sent" : "failed",
    result.error
  );

  return result;
}