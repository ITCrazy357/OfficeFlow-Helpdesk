-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('TICKET_ASSIGNED', 'TICKET_COMMENTED', 'TICKET_STATUS_CHANGED', 'TICKET_OVERDUE', 'KNOWLEDGE_PUBLISHED', 'ASSET_ASSIGNED', 'ASSET_RETURNED') NOT NULL;

-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `assetId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Asset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetTag` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER', 'PHONE', 'TABLET', 'NETWORK_DEVICE', 'ACCESSORY', 'OTHER') NOT NULL,
    `status` ENUM('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED', 'LOST') NOT NULL DEFAULT 'AVAILABLE',
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `purchaseDate` DATETIME(3) NULL,
    `warrantyUntil` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `assignedToId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Asset_assetTag_key`(`assetTag`),
    UNIQUE INDEX `Asset_serialNumber_key`(`serialNumber`),
    INDEX `Asset_type_idx`(`type`),
    INDEX `Asset_status_idx`(`status`),
    INDEX `Asset_assignedToId_idx`(`assignedToId`),
    INDEX `Asset_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `assignedToId` INTEGER NOT NULL,
    `assignedById` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `returnedAt` DATETIME(3) NULL,
    `returnNotes` TEXT NULL,

    INDEX `AssetAssignment_assetId_idx`(`assetId`),
    INDEX `AssetAssignment_assignedToId_idx`(`assignedToId`),
    INDEX `AssetAssignment_assignedById_idx`(`assignedById`),
    INDEX `AssetAssignment_returnedAt_idx`(`returnedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `tickets_assetId_idx` ON `tickets`(`assetId`);

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetAssignment` ADD CONSTRAINT `AssetAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
