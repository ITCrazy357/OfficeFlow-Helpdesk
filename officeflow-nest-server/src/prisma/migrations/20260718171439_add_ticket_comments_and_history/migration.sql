/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `ticket_comments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ticket_comments` table. All the data in the column will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_attachments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `authorId` to the `ticket_comments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_userId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_attachments` DROP FOREIGN KEY `ticket_attachments_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_attachments` DROP FOREIGN KEY `ticket_attachments_uploadedById_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_comments` DROP FOREIGN KEY `ticket_comments_userId_fkey`;

-- DropIndex
DROP INDEX `ticket_comments_userId_idx` ON `ticket_comments`;

-- AlterTable
ALTER TABLE `ticket_comments` DROP COLUMN `updatedAt`,
    DROP COLUMN `userId`,
    ADD COLUMN `authorId` INTEGER NOT NULL;

-- DropTable
DROP TABLE `audit_logs`;

-- DropTable
DROP TABLE `ticket_attachments`;

-- CreateTable
CREATE TABLE `ticket_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` ENUM('CREATE', 'UPDATE', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENTED', 'DELETED') NOT NULL,
    `oldValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `ticketId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_histories_ticketId_idx`(`ticketId`),
    INDEX `ticket_histories_userId_idx`(`userId`),
    INDEX `ticket_histories_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ticket_comments_authorId_idx` ON `ticket_comments`(`authorId`);

-- AddForeignKey
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_histories` ADD CONSTRAINT `ticket_histories_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_histories` ADD CONSTRAINT `ticket_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
