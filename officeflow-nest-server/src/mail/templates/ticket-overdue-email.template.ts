import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type TicketOverdueEmailTemplateParams = {
  recipientName: string;
  ticketId: number;
  ticketTitle: string;
  ticketUrl: string;
};

export function ticketOverdueEmailTemplate(
  params: TicketOverdueEmailTemplateParams,
) {
  const recipientName = escapeHtml(params.recipientName);
  const ticketTitle = escapeHtml(params.ticketTitle);
  const ticketUrl = escapeHtml(params.ticketUrl);

  const subject = `[OfficeFlow] Ticket #${params.ticketId} is overdue`;

  const text = [
    `Hello ${params.recipientName},`,
    '',
    `Ticket #${params.ticketId} has passed its SLA deadline.`,
    `Title: ${params.ticketTitle}`,
    '',
    `View ticket: ${params.ticketUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Ticket overdue',
    content: `
      <p>Hello ${recipientName},</p>

      <p>This ticket has passed its SLA deadline.</p>

      <div
        style="
          padding: 16px;
          background-color: #fef2f2;
          border-radius: 6px;
          margin: 20px 0;
        "
      >
        <p style="margin: 0 0 8px 0;">
          <strong>Ticket ID:</strong>
          #${params.ticketId}
        </p>

        <p style="margin: 0;">
          <strong>Title:</strong>
          ${ticketTitle}
        </p>
      </div>

      <a
        href="${ticketUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background-color: #111827;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        View ticket
      </a>
    `,
  });

  return {
    subject,
    text,
    html,
  };
}
