import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type PasswordRecoveryCompletedEmailTemplateParams = {
  userName: string;
  loginUrl: string;
};

export function passwordRecoveryCompletedEmailTemplate(
  params: PasswordRecoveryCompletedEmailTemplateParams,
) {
  const userName = escapeHtml(params.userName);
  const loginUrl = escapeHtml(params.loginUrl);
  const subject = '[OfficeFlow] Your password was changed';
  const text = [
    `Hello ${params.userName},`,
    '',
    'Your OfficeFlow Helpdesk password was changed using a recovery link.',
    'All existing sessions have been signed out.',
    '',
    `Sign in: ${params.loginUrl}`,
    '',
    'If you did not make this change, contact your IT team immediately.',
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Your password was changed',
    content: `
      <p>Hello ${userName},</p>

      <p>
        Your OfficeFlow Helpdesk password was changed using a recovery link.
        All existing sessions have been signed out.
      </p>

      <p>
        If you did not make this change, contact your IT team immediately.
      </p>

      <a
        href="${loginUrl}"
        style="
          display: inline-block;
          padding: 12px 18px;
          background-color: #111827;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
        "
      >
        Sign in
      </a>
    `,
  });

  return {
    subject,
    text,
    html,
  };
}
