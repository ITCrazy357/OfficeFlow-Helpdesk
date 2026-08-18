import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type LeaveRequestEmailTemplateParams = {
  recipientName: string;
  subject: string;
  heading: string;
  message: string;
  leaveRequestId: number;
  startDate: string;
  endDate: string;
  leaveRequestUrl: string;
  actionLabel: string;
};

export function leaveRequestEmailTemplate(
  params: LeaveRequestEmailTemplateParams,
) {
  const recipientName = escapeHtml(params.recipientName);
  const heading = escapeHtml(params.heading);
  const message = escapeHtml(params.message);
  const startDate = escapeHtml(params.startDate);
  const endDate = escapeHtml(params.endDate);
  const leaveRequestUrl = escapeHtml(params.leaveRequestUrl);
  const actionLabel = escapeHtml(params.actionLabel);

  const text = [
    `Hello ${params.recipientName},`,
    '',
    params.message,
    `Leave request: #${params.leaveRequestId}`,
    `Dates: ${params.startDate} to ${params.endDate}`,
    '',
    `${params.actionLabel}: ${params.leaveRequestUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading,
    content: `
      <p>Hello ${recipientName},</p>

      <p>${message}</p>

      <div
        style="
          padding: 16px;
          background-color: #f9fafb;
          border-radius: 6px;
          margin: 20px 0;
        "
      >
        <p style="margin: 0 0 8px 0;">
          <strong>Leave request:</strong>
          #${params.leaveRequestId}
        </p>

        <p style="margin: 0;">
          <strong>Dates:</strong>
          ${startDate} to ${endDate}
        </p>
      </div>

      <a
        href="${leaveRequestUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background-color: #111827;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        ${actionLabel}
      </a>
    `,
  });

  return {
    subject: params.subject,
    text,
    html,
  };
}
