-- Additive migration. No existing data is modified. Roll back application code
-- first if needed; retain receipts so a retry does not resend completed mail.
CREATE TABLE `Email_deliveries` (
    `outboxEventId` CHAR(36) NOT NULL,
    `recipientId` INTEGER NOT NULL,
    `deliveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`outboxEventId`, `recipientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
