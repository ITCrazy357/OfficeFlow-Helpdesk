-- AlterTable
ALTER TABLE `Users` ADD COLUMN `managerId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requesterId` INTEGER NOT NULL,
    `approverId` INTEGER NOT NULL,
    `reviewedById` INTEGER NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reviewNote` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Leave_requests_requesterId_createdAt_idx`(`requesterId`, `createdAt`),
    INDEX `Leave_requests_approverId_status_createdAt_idx`(`approverId`, `status`, `createdAt`),
    INDEX `Leave_requests_requesterId_status_startDate_idx`(`requesterId`, `status`, `startDate`),
    INDEX `Leave_requests_reviewedById_reviewedAt_idx`(`reviewedById`, `reviewedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Users_managerId_idx` ON `Users`(`managerId`);

-- AddForeignKey
ALTER TABLE `Users` ADD CONSTRAINT `Users_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave_requests` ADD CONSTRAINT `Leave_requests_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave_requests` ADD CONSTRAINT `Leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Leave_requests` ADD CONSTRAINT `Leave_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
