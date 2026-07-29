import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
  Logger,
} from "@medusajs/framework/types"
import { Resend } from "resend"
import type { CreateEmailOptions } from "resend"
import { renderToString } from "react-dom/server"
import React from "react"

// Email templates
import { OrderConfirmedEmail } from "./emails/OrderConfirmedEmail"
import { WelcomeEmail } from "./emails/WelcomeEmail"
import { PasswordResetEmail } from "./emails/PasswordResetEmail"
import { EmailVerificationEmail } from "./emails/EmailVerificationEmail"
import { ShippingUpdateEmail } from "./emails/ShippingUpdateEmail"
import { OrderTransferEmail } from "./emails/OrderTransferEmail"

export type ResendNotificationServiceOptions = {
  api_key: string
  from: string
  sendgrid_api_key?: string
  sendgrid_from?: string
  storefront_url?: string
}

type InjectedDependencies = {
  logger: Logger
}

/**
 * Map of template names to React Email components.
 */
const TEMPLATES: Record<string, React.ComponentType<any>> = {
  "order-confirmed": OrderConfirmedEmail,
  "welcome": WelcomeEmail,
  "password-reset": PasswordResetEmail,
  "email-verification": EmailVerificationEmail,
  "shipping-update": ShippingUpdateEmail,
  "order-transfer": OrderTransferEmail,
}

export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"

  private logger_: Logger
  private config_: { apiKey: string; from: string; storefrontUrl?: string }
  private resend_: Resend

  // SendGrid fallback
  private sendgridFallback_: boolean = false
  private sendgridConfig_: { apiKey: string; from: string } | null = null

  constructor(
    { logger }: InjectedDependencies,
    options: ResendNotificationServiceOptions
  ) {
    super()

    this.logger_ = logger
    this.config_ = {
      apiKey: options.api_key,
      from: options.from,
      storefrontUrl: options.storefront_url,
    }

    this.resend_ = new Resend(options.api_key)

    // Initialize SendGrid fallback if credentials are provided
    if (options.sendgrid_api_key && options.sendgrid_from) {
      this.sendgridFallback_ = true
      this.sendgridConfig_ = {
        apiKey: options.sendgrid_api_key,
        from: options.sendgrid_from,
      }
      this.logger_.info(
        "ResendNotificationService: SendGrid fallback configured"
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No notification information provided"
      )
    }

    const from = notification.from?.trim() || this.config_.from

    // Determine HTML content
    let html: string | undefined
    let subject: string | undefined

    if (notification.content?.html) {
      // Pre-rendered content passed directly
      html = notification.content.html
      subject = notification.content.subject
    } else if (notification.template && notification.data) {
      // Render React Email component to static HTML
      const Component = TEMPLATES[notification.template]
      if (!Component) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Unknown notification template: ${notification.template}`
        )
      }
      try {
        const props = {
          ...(notification.data as Record<string, unknown>),
          storefront_url: this.config_.storefrontUrl,
        }
        html = renderToString(React.createElement(Component, props))
        // Extract subject from data or use template name fallback
        subject =
          (notification.data as any)?.subject ||
          this.getDefaultSubject(notification.template)
      } catch (err: any) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Failed to render email template "${notification.template}": ${err.message}`
        )
      }
    } else {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Notification must have either content.html or template + data"
      )
    }

    // Build Resend payload
    const resendPayload: CreateEmailOptions = {
      from,
      to: notification.to,
      subject: subject || "No subject",
      html,
      ...(notification.provider_data?.cc
        ? { cc: notification.provider_data.cc as string }
        : {}),
      ...(notification.provider_data?.bcc
        ? { bcc: notification.provider_data.bcc as string }
        : {}),
      ...(notification.provider_data?.reply_to
        ? { replyTo: notification.provider_data.reply_to as string }
        : {}),
    }

    // Add attachments if present
    if (notification.attachments?.length) {
      resendPayload.attachments = notification.attachments.map((att) => ({
        content: att.content,
        filename: att.filename,
        ...(att.content_type ? { content_type: att.content_type } : {}),
      })) as any
    }

    // Try Resend first
    try {
      const result = await this.resend_.emails.send(resendPayload)
      if (result.error) {
        throw new Error(result.error.message)
      }
      this.logger_.info(
        `Email sent via Resend: ${notification.template} to ${notification.to}`
      )
      return { id: result.data?.id }
    } catch (resendError: any) {
      this.logger_.error(
        `Resend send failed for "${notification.template}": ${resendError.message}`
      )

      // SendGrid fallback
      if (this.sendgridFallback_ && this.sendgridConfig_) {
        try {
          const sgMail = require("@sendgrid/mail")
          sgMail.setApiKey(this.sendgridConfig_.apiKey)

          const sgPayload: any = {
            to: notification.to,
            from: notification.from?.trim() || this.sendgridConfig_.from,
            subject: subject || "No subject",
            html,
          }

          await sgMail.send(sgPayload)
          this.logger_.info(
            `Email sent via SendGrid fallback: ${notification.template} to ${notification.to}`
          )
          return {}
        } catch (sgError: any) {
          this.logger_.error(
            `SendGrid fallback also failed: ${sgError.message}`
          )
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            `Failed to send email via both Resend and SendGrid`
          )
        }
      }

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send email: ${resendError.message}`
      )
    }
  }

  private getDefaultSubject(template: string): string {
    const subjects: Record<string, string> = {
      "order-confirmed": "Your Infinytree Order is Confirmed! 🌿",
      "welcome": "Welcome to Infinytree! 🌱",
      "password-reset": "Reset Your Password — Infinytree",
      "email-verification": "Verify Your Email — Infinytree",
      "shipping-update": "Your Infinytree Order Has Shipped! 📦",
      "order-transfer": "Order Transfer Request — Infinytree",
    }
    return subjects[template] || "Infinytree"
  }
}
