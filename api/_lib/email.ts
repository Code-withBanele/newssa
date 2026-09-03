export class EmailDeliveryError extends Error {
  constructor(message = "Email delivery failed.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export function requireEmailConfig(templateId = process.env.RESEND_TEMPLATE_ID) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from || !templateId) throw new EmailDeliveryError("Email delivery is not configured.");
}

export async function sendVerificationCode(email: string, code: string, templateId = process.env.RESEND_TEMPLATE_ID) {
  requireEmailConfig(templateId);
  const apiKey = process.env.RESEND_API_KEY as string;
  const from = process.env.AUTH_EMAIL_FROM as string;
  const selectedTemplateId = templateId as string;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      template: {
        id: selectedTemplateId,
        variables: { OTP_CODE: code },
      },
    }),
  });
  if (!response.ok) throw new EmailDeliveryError();
}