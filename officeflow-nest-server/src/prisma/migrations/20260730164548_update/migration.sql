/*
  Warnings:

  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_actorId_fkey`;

-- DropTable
DROP TABLE `AuditLog`;

-- CreateTable
CREATE TABLE `Audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NULL,
    `entity` ENUM('USER', 'DEPARTMENT', 'TICKET', 'KNOWLEDGE_ARTICLE', 'ASSET') NOT NULL,
    `entityId` INTEGER NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETED', 'ASSIGNED', 'RETURNED', 'STATUS_CHANGED', 'ACTIVATED', 'DEACTIVATED', 'PUBLISHED', 'UNPUBLISHED', 'LINKED', 'UNLINKED') NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Audit_logs_actorId_idx`(`actorId`),
    INDEX `Audit_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `Audit_logs_action_idx`(`action`),
    INDEX `Audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Audit_logs` ADD CONSTRAINT `Audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
