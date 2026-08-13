import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type UserPasswordResetEmailTemplateParams = {
  userName: string;
  loginUrl: string;
};

export function userPasswordResetEmailTemplate(
  params: UserPasswordResetEmailTemplateParams,
) {
  const userName = escapeHtml(params.userName);
  const loginUrl = escapeHtml(params.loginUrl);

  const subject = '[OfficeFlow] Your password has been reset';

  const text = [
    `Hello ${params.userName},`,
    '',
    'Your OfficeFlow Helpdesk password has been reset by an administrator.',
    'All existing sessions have been signed out.',
    'Use the new password provided through your approved internal channel.',
    '',
    `Sign in: ${params.loginUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Your password has been reset',
    content: `
      <p>Hello ${userName},</p>

      <p>
        Your OfficeFlow Helpdesk password has been reset by an administrator.
        All existing sessions have been signed out.
      </p>

      <p>
        Use the new password provided through your approved internal channel.
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
