-- AlterTable
ALTER TABLE `Notifications`
    ADD COLUMN `sourceEventId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `Outbox_events` (
    `id` CHAR(36) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `payload` JSON NOT NULL,
    `deduplicationKey` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(100) NULL,
    `processedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Outbox_events_deduplicationKey_key`(`deduplicationKey`),
    INDEX `Outbox_events_status_availableAt_createdAt_idx`(`status`, `availableAt`, `createdAt`),
    INDEX `Outbox_events_lockedAt_idx`(`lockedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Notifications_sourceEventId_userId_type_key`
    ON `Notifications`(`sourceEventId`, `userId`, `type`);
