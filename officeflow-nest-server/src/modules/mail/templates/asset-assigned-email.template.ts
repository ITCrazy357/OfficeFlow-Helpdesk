import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type AssetAssignedEmailTemplateParams = {
  recipientName: string;
  assetTag: string;
  assetName: string;
  assignedByName: string;
  assetUrl: string;
};

export function assetAssignedEmailTemplate(
  params: AssetAssignedEmailTemplateParams,
) {
  const recipientName = escapeHtml(params.recipientName);
  const assetTag = escapeHtml(params.assetTag);
  const assetName = escapeHtml(params.assetName);
  const assignedByName = escapeHtml(params.assignedByName);
  const assetUrl = escapeHtml(params.assetUrl);

  const subject = `[OfficeFlow] Asset ${params.assetTag} has been assigned to you`;

  const text = [
    `Hello ${params.recipientName},`,
    '',
    `${params.assignedByName} assigned an asset to you.`,
    `Asset: ${params.assetName} (${params.assetTag})`,
    '',
    `View asset: ${params.assetUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Asset assigned to you',
    content: `
      <p>Hello ${recipientName},</p>

      <p>${assignedByName} assigned an asset to you.</p>

      <div
        style="
          padding: 16px;
          background-color: #f9fafb;
          border-radius: 6px;
          margin: 20px 0;
        "
      >
        <p style="margin: 0 0 8px 0;">
          <strong>Asset tag:</strong>
          ${assetTag}
        </p>

        <p style="margin: 0;">
          <strong>Asset:</strong>
          ${assetName}
        </p>
      </div>

      <a
        href="${assetUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background-color: #111827;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        View asset
      </a>
    `,
  });

  return {
    subject,
    text,
    html,
  };
}
