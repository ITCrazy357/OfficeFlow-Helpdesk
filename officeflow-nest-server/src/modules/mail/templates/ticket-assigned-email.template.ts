import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type TicketAssignedEmailTemplateParams = {
  assigneeName: string;
  ticketId: number;
  ticketTitle: string;
  assignedByName: string;
  ticketUrl: string;
};

export function ticketAssignedEmailTemplate(
  params: TicketAssignedEmailTemplateParams,
) {
  const assigneeName = escapeHtml(params.assigneeName);
  const ticketTitle = escapeHtml(params.ticketTitle);
  const assignedByName = escapeHtml(params.assignedByName);
  const ticketUrl = escapeHtml(params.ticketUrl);

  const subject = `[OfficeFlow] Ticket #${params.ticketId} has been assigned to you`;

  const text = [
    `Hello ${params.assigneeName},`,
    '',
    `${params.assignedByName} assigned ticket #${params.ticketId} to you.`,
    `Title: ${params.ticketTitle}`,
    '',
    `View ticket: ${params.ticketUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'New ticket assigned',
    content: `
      <p>Hello ${assigneeName},</p>

      <p>${assignedByName} assigned a support ticket to you.</p>

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
