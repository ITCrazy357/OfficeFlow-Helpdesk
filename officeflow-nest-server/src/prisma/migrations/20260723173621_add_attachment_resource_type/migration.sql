-- AlterTable
ALTER TABLE `ticket_attachments`
    ADD COLUMN `resourceType` VARCHAR(191) NULL,
    MODIFY `fileUrl` TEXT NOT NULL;

-- Create the replacement first because MySQL requires an index whose leading
-- column is `ticketId` while the foreign key constraint is active.
CREATE INDEX `ticket_attachments_ticketId_createdAt_id_idx`
    ON `ticket_attachments`(`ticketId`, `createdAt`, `id`);
DROP INDEX `ticket_attachments_ticketId_idx` ON `ticket_attachments`;
