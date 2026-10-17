-- AlterTable
ALTER TABLE `Notifications` MODIFY `type` ENUM('TICKET_ASSIGNED', 'TICKET_COMMENTED', 'TICKET_STATUS_CHANGED', 'TICKET_OVERDUE', 'TICKET_SLA_WARNING', 'TICKET_RESPONSE_OVERDUE', 'TICKET_SLA_ESCALATED', 'KNOWLEDGE_PUBLISHED', 'ASSET_ASSIGNED', 'ASSET_RETURNED', 'ASSET_WARRANTY_EXPIRING', 'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_CANCELLED') NOT NULL;

-- AlterTable
ALTER TABLE `Assets` ADD COLUMN `supplierContact` VARCHAR(250) NULL,
    ADD COLUMN `supplierName` VARCHAR(150) NULL;

-- CreateTable
CREATE TABLE `Asset_maintenances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `kind` ENUM('MAINTENANCE', 'REPAIR', 'WARRANTY') NOT NULL DEFAULT 'MAINTENANCE',
    `status` ENUM('PLANNED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `scheduledFor` DATE NOT NULL,
    `performedOn` DATE NULL,
    `vendor` VARCHAR(150) NULL,
    `cost` DECIMAL(12, 0) NULL,
    `notes` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdById` INTEGER NOT NULL,
    `completedById` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Asset_maintenances_assetId_scheduledFor_id_idx`(`assetId`, `scheduledFor`, `id`),
    INDEX `Asset_maintenances_status_scheduledFor_idx`(`status`, `scheduledFor`),
    INDEX `Asset_maintenances_createdById_idx`(`createdById`),
    INDEX `Asset_maintenances_completedById_idx`(`completedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset_warranty_reminders` (
    `assetId` INTEGER NOT NULL,
    `warrantyDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`assetId`, `warrantyDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Assets_warrantyUntil_status_idx` ON `Assets`(`warrantyUntil`, `status`);

-- AddForeignKey
ALTER TABLE `Asset_maintenances` ADD CONSTRAINT `Asset_maintenances_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset_maintenances` ADD CONSTRAINT `Asset_maintenances_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset_maintenances` ADD CONSTRAINT `Asset_maintenances_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset_warranty_reminders` ADD CONSTRAINT `Asset_warranty_reminders_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

