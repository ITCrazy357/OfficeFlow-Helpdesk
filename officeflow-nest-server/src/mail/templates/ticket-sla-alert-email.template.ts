import {
  formatSlaDeadline,
  type TicketSlaAlertEvent,
} from '../../notifications/events/ticket-sla-alert.event';
import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

export function ticketSlaAlertEmailTemplate(
  event: TicketSlaAlertEvent,
  recipientName: string,
  ticketUrl: string,
) {
  const milestone =
    event.milestone === 'RESPONSE' ? 'phản hồi đầu tiên' : 'xử lý';
  const action =
    event.kind === 'WARNING'
      ? 'Sắp quá hạn'
      : event.kind === 'ESCALATED'
        ? 'Cần quản lý hỗ trợ'
        : 'Đã quá hạn';
  const subject = `[OfficeFlow] ${action}: ticket #${event.ticketId}`;
  const deadline = `${formatSlaDeadline(event.dueAt)} giờ Việt Nam`;
  const text = `Xin chào ${recipientName},\n\n${action}: ${event.ticketTitle}\nHạn ${milestone}: ${deadline}\n${ticketUrl}`;
  const html = emailLayoutTemplate({
    heading: action,
    content: `<p>Xin chào ${escapeHtml(recipientName)},</p><p>${escapeHtml(action)}: ${escapeHtml(event.ticketTitle)}</p><p>Hạn ${milestone}: ${escapeHtml(deadline)}</p><p><a href="${escapeHtml(ticketUrl)}">Xem ticket #${event.ticketId}</a></p>`,
  });
  return { subject, text, html };
}
