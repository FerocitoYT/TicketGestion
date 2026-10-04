import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "TicketGestion <equipo@example.com>";
  if (!key) {
    console.log(`[email:mock] to=${to} subject=${subject}`);
    return { mocked: true };
  }
  const resend = new Resend(key);
  return resend.emails.send({ from, to, subject, html });
}
