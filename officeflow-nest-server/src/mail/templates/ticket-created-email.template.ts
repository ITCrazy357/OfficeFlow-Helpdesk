import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type TicketCreatedEmailTemplateParams = {
  requesterName: string;
  ticketId: number;
  ticketTitle: string;
  ticketUrl: string;
};

export function ticketCreatedEmailTemplate(
  params: TicketCreatedEmailTemplateParams,
) {
  const requesterName = escapeHtml(params.requesterName);
  const ticketTitle = escapeHtml(params.ticketTitle);
  const ticketUrl = escapeHtml(params.ticketUrl);

  const subject = `[OfficeFlow] Ticket #${params.ticketId} has been created`;

  const text = [
    `Hello ${params.requesterName},`,
    '',
    `Your ticket #${params.ticketId} has been created successfully.`,
    `Title: ${params.ticketTitle}`,
    '',
    `View ticket: ${params.ticketUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Ticket created successfully',
    content: `
      <p>Hello ${requesterName},</p>

      <p>
        Your support ticket has been created successfully.
      </p>

      <div
        style="
          padding: 16px;
          background-color: #f9fafb;
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
