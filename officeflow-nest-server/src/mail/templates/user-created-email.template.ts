import { emailLayoutTemplate, escapeHtml } from './email-layout.template';

type UserCreatedEmailTemplateParams = {
  userName: string;
  loginUrl: string;
};

export function userCreatedEmailTemplate(
  params: UserCreatedEmailTemplateParams,
) {
  const userName = escapeHtml(params.userName);
  const loginUrl = escapeHtml(params.loginUrl);

  const subject = '[OfficeFlow] Your account has been created';

  const text = [
    `Hello ${params.userName},`,
    '',
    'Your OfficeFlow Helpdesk account has been created.',
    'Use the credentials provided by your administrator to sign in.',
    '',
    `Sign in: ${params.loginUrl}`,
  ].join('\n');

  const html = emailLayoutTemplate({
    heading: 'Your account has been created',
    content: `
      <p>Hello ${userName},</p>

      <p>Your OfficeFlow Helpdesk account has been created.</p>

      <p>
        Use the credentials provided by your administrator to sign in.
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
