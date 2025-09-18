import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
    });
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
