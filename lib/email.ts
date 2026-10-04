import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "TicketGestion <equipo@example.com>";
  if (!key || key.includes("replace_me")) {
    console.log(`[email:mock] to=${to} subject=${subject}`);
    return { mocked: true };
  }
  try {
    const resend = new Resend(key);
    return await resend.emails.send({ from, to, subject, html });
  } catch (e) {
    console.log("[email:fail-mock]", e instanceof Error ? e.message : e);
    return { mocked: true };
  }
}
