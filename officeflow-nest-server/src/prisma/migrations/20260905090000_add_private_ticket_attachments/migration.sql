-- AlterTable
ALTER TABLE `Ticket_attachments`
    ADD COLUMN `format` VARCHAR(32) NULL,
    ADD COLUMN `deliveryType` VARCHAR(32) NOT NULL DEFAULT 'upload';
