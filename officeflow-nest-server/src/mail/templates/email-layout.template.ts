export function escapeHtml(value: string) {
  const characters: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return value.replace(/[&<>"']/g, (character) => characters[character]);
}

type EmailLayoutParams = {
  heading: string;
  content: string;
};

export function emailLayoutTemplate(params: EmailLayoutParams) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
      </head>

      <body
        style="
          margin: 0;
          padding: 24px;
          background-color: #f4f6f8;
          font-family: Arial, sans-serif;
          color: #1f2937;
        "
      >
        <div
          style="
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            padding: 32px;
          "
        >
          <h1
            style="
              margin-top: 0;
              font-size: 24px;
            "
          >
            ${escapeHtml(params.heading)}
          </h1>

          ${params.content}

          <hr
            style="
              margin: 32px 0;
              border: 0;
              border-top: 1px solid #e5e7eb;
            "
          />

          <p
            style="
              margin-bottom: 0;
              color: #6b7280;
              font-size: 13px;
            "
          >
            This email was sent automatically by OfficeFlow Helpdesk.
          </p>
        </div>
      </body>
    </html>
  `;
}
