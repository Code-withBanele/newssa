export async function sendVerificationCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  const templateId = process.env.RESEND_TEMPLATE_ID;
  if (!apiKey || !from || !templateId) throw new Error("Email delivery is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      template: {
        id: templateId,
        variables: { OTP_CODE: code },
      },
    }),
  });
  if (!response.ok) throw new Error("Email delivery failed.");
}