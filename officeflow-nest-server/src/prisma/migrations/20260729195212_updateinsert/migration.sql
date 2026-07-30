-- Rename tables to match the current Prisma mappings without losing data.
RENAME TABLE
    `departments` TO `Departments`,
    `users` TO `Users`,
    `ticket_categories` TO `Ticket_categories`,
    `tickets` TO `Tickets`,
    `ticket_comments` TO `Ticket_comments`,
    `ticket_histories` TO `Ticket_histories`,
    `ticket_attachments` TO `Ticket_attachments`,
    `KnowledgeArticle` TO `Knowledge_articles`,
    `notifications` TO `Notifications`,
    `Asset` TO `Assets`,
    `AssetAssignment` TO `Asset_assignments`;
