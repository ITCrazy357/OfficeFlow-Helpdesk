import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type AssetReturnedEmailTemplateParams = {
  recipientName: string;
  assetTag: string;
  assetName: string;
  returnedByName: string;
  assetsUrl: string;
};

export function assetReturnedEmailTemplate(
  params: AssetReturnedEmailTemplateParams,
) {
  const recipientName = escapeHtml(params.recipientName);
  const assetTag = escapeHtml(params.assetTag);
  const assetName = escapeHtml(params.assetName);
  const returnedByName = escapeHtml(params.returnedByName);
  const assetsUrl = escapeHtml(params.assetsUrl);

  const subject = `[OfficeFlow] Asset ${params.assetTag} has been returned`;

  const text = [
    `Hello ${params.recipientName},`,
    '',
    `${params.returnedByName} recorded the return of your assigned asset.`,
    `Asset: ${params.assetName} (${params.assetTag})`,
    '',
    `View assets: ${params.assetsUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Asset returned',
    content: `
      <p>Hello ${recipientName},</p>

      <p>${returnedByName} recorded the return of your assigned asset.</p>

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
        href="${assetsUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background-color: #111827;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        View assets
      </a>
    `,
  });

  return {
    subject,
    text,
    html,
  };
}
