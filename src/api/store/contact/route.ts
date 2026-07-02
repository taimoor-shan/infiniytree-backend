import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);

export const ContactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email({ error: "Invalid email address" }),
  subject: z.string().min(5, "Subject is required"),
  message: z.string().min(10, "Message is too short"),
});

export async function POST(
  req: MedusaRequest<z.infer<typeof ContactSchema>>,
  res: MedusaResponse
) {
  try {
    const { name, email, subject, message } = req.validatedBody;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || process.env.SENDGRID_FROM || "onboarding@resend.dev",
      to: process.env.CONTACT_EMAIL || "info@infinytree.com",
      subject: `New Contact Request: ${subject}`,
      replyTo: email,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    if (error) {
      return res.status(400).json({ ...error, message: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to send message" });
  }
}
