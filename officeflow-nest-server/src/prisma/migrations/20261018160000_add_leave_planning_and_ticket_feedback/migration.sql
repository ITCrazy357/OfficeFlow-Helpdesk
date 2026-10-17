-- AlterTable
ALTER TABLE `Leave_requests` ADD COLUMN `calendarSnapshot` JSON NULL,
    ADD COLUMN `period` ENUM('FULL_DAY', 'MORNING', 'AFTERNOON') NOT NULL DEFAULT 'FULL_DAY',
    ADD COLUMN `type` ENUM('LEGACY', 'ANNUAL', 'UNPAID', 'SICK') NOT NULL DEFAULT 'LEGACY';

-- AlterTable
ALTER TABLE `Tickets` ADD COLUMN `confirmedAt` DATETIME(3) NULL,
    ADD COLUMN `resolutionVersion` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Leave_days` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `halfDays` INTEGER NOT NULL,

    INDEX `Leave_days_date_idx`(`date`),
    UNIQUE INDEX `Leave_days_requestId_date_key`(`requestId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Leave_entitlements` (
    `userId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `halfDays` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket_feedbacks` (
    `ticketId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `assignedToId` INTEGER NULL,
    `score` INTEGER NOT NULL,
    `comment` VARCHAR(2000) NULL,
    `resolutionVersion` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Ticket_feedbacks_authorId_idx`(`authorId`),
    INDEX `Ticket_feedbacks_assignedToId_createdAt_idx`(`assignedToId`, `createdAt`),
    INDEX `Ticket_feedbacks_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`ticketId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Leave_requests_status_startDate_endDate_idx` ON `Leave_requests`(`status`, `startDate`, `endDate`);

-- AddForeignKey
ALTER TABLE `Leave_days` ADD CONSTRAINT `Leave_days_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `Leave_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave_entitlements` ADD CONSTRAINT `Leave_entitlements_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_feedbacks` ADD CONSTRAINT `Ticket_feedbacks_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_feedbacks` ADD CONSTRAINT `Ticket_feedbacks_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_feedbacks` ADD CONSTRAINT `Ticket_feedbacks_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

