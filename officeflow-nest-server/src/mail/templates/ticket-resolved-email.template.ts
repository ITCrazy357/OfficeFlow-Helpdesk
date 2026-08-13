import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type TicketResolvedEmailTemplateParams = {
  requesterName: string;
  ticketId: number;
  ticketTitle: string;
  ticketUrl: string;
  resolvedByName: string;
};

export function ticketResolvedEmailTemplate(
  params: TicketResolvedEmailTemplateParams,
) {
  const requesterName = escapeHtml(params.requesterName);
  const ticketTitle = escapeHtml(params.ticketTitle);
  const ticketUrl = escapeHtml(params.ticketUrl);
  const resolvedByName = escapeHtml(params.resolvedByName);

  const subject = `[OfficeFlow] Ticket #${params.ticketId} has been resolved`;

  const text = [
    `Hello ${params.requesterName},`,
    '',
    `Your support ticket #${params.ticketId} has been resolved.`,
    `Title: ${params.ticketTitle}`,
    `Resolved by: ${params.resolvedByName}`,
    '',
    `View ticket: ${params.ticketUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Ticket resolved',
    content: `
      <p>Hello ${requesterName},</p>

      <p>Your support ticket has been resolved.</p>

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

        <p style="margin: 0 0 8px 0;">
          <strong>Title:</strong>
          ${ticketTitle}
        </p>

        <p style="margin: 0;">
          <strong>Resolved by:</strong>
          ${resolvedByName}
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
