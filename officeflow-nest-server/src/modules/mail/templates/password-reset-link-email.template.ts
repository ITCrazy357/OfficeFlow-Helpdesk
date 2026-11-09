import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type PasswordResetLinkEmailTemplateParams = {
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export function passwordResetLinkEmailTemplate(
  params: PasswordResetLinkEmailTemplateParams,
) {
  const userName = escapeHtml(params.userName);
  const resetUrl = escapeHtml(params.resetUrl);
  const subject = '[OfficeFlow] Reset your password';
  const text = [
    `Hello ${params.userName},`,
    '',
    'We received a request to reset your OfficeFlow Helpdesk password.',
    `This link expires in ${params.expiresInMinutes} minutes and can only be used once.`,
    '',
    `Reset password: ${params.resetUrl}`,
    '',
    'If you did not request this change, you can ignore this email.',
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Reset your password',
    content: `
      <p>Hello ${userName},</p>

      <p>
        We received a request to reset your OfficeFlow Helpdesk password.
        This link expires in ${params.expiresInMinutes} minutes and can only be used once.
      </p>

      <a
        href="${resetUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background-color: #111827;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        Reset password
      </a>

      <p>
        If you did not request this change, you can ignore this email.
      </p>
    `,
  });

  return {
    subject,
    text,
    html,
  };
}
