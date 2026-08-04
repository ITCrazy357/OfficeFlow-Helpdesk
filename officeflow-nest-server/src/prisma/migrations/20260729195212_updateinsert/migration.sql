/*
  Warnings:

  - You are about to drop the `Asset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssetAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KnowledgeArticle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ticket_histories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tickets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Asset` DROP FOREIGN KEY `Asset_assignedToId_fkey`;

-- DropForeignKey
ALTER TABLE `AssetAssignment` DROP FOREIGN KEY `AssetAssignment_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `AssetAssignment` DROP FOREIGN KEY `AssetAssignment_assignedById_fkey`;

-- DropForeignKey
ALTER TABLE `AssetAssignment` DROP FOREIGN KEY `AssetAssignment_assignedToId_fkey`;

-- DropForeignKey
ALTER TABLE `KnowledgeArticle` DROP FOREIGN KEY `KnowledgeArticle_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_userId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_attachments` DROP FOREIGN KEY `ticket_attachments_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_attachments` DROP FOREIGN KEY `ticket_attachments_uploadedById_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_comments` DROP FOREIGN KEY `ticket_comments_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_comments` DROP FOREIGN KEY `ticket_comments_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_histories` DROP FOREIGN KEY `ticket_histories_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket_histories` DROP FOREIGN KEY `ticket_histories_userId_fkey`;

-- DropForeignKey
ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_assetId_fkey`;

-- DropForeignKey
ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_assignedToId_fkey`;

-- DropForeignKey
ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_departmentId_fkey`;

-- DropTable
DROP TABLE `Asset`;

-- DropTable
DROP TABLE `AssetAssignment`;

-- DropTable
DROP TABLE `KnowledgeArticle`;

-- DropTable
DROP TABLE `departments`;

-- DropTable
DROP TABLE `notifications`;

-- DropTable
DROP TABLE `ticket_attachments`;

-- DropTable
DROP TABLE `ticket_categories`;

-- DropTable
DROP TABLE `ticket_comments`;

-- DropTable
DROP TABLE `ticket_histories`;

-- DropTable
DROP TABLE `tickets`;

-- DropTable
DROP TABLE `users`;

-- CreateTable
CREATE TABLE `Departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Departments_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'IT_STAFF', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `departmentId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Users_email_key`(`email`),
    INDEX `Users_departmentId_idx`(`departmentId`),
    INDEX `Users_role_idx`(`role`),
    INDEX `Users_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ticket_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `dueAt` DATETIME(3) NULL,
    `resolveAt` DATETIME(3) NULL,
    `isOverdue` BOOLEAN NOT NULL DEFAULT false,
    `createdById` INTEGER NOT NULL,
    `assignedToId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `assetId` INTEGER NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Tickets_status_idx`(`status`),
    INDEX `Tickets_priority_idx`(`priority`),
    INDEX `Tickets_createdAt_idx`(`createdAt`),
    INDEX `Tickets_assignedToId_idx`(`assignedToId`),
    INDEX `Tickets_createdById_idx`(`createdById`),
    INDEX `Tickets_categoryId_idx`(`categoryId`),
    INDEX `Tickets_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `ticketId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Ticket_comments_ticketId_idx`(`ticketId`),
    INDEX `Ticket_comments_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` ENUM('CREATE', 'UPDATE', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENTED', 'ATTACHMENT_ADDED', 'ATTACHMENT_DELETED', 'DELETED') NOT NULL,
    `oldValue` VARCHAR(191) NULL,
    `newValue` VARCHAR(191) NULL,
    `ticketId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Ticket_histories_ticketId_idx`(`ticketId`),
    INDEX `Ticket_histories_userId_idx`(`userId`),
    INDEX `Ticket_histories_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` TEXT NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `publicId` VARCHAR(191) NULL,
    `resourceType` VARCHAR(191) NULL,
    `ticketId` INTEGER NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Ticket_attachments_ticketId_createdAt_id_idx`(`ticketId`, `createdAt`, `id`),
    INDEX `Ticket_attachments_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Knowledge_articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `content` TEXT NOT NULL,
    `tags` TEXT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Knowledge_articles_slug_key`(`slug`),
    INDEX `Knowledge_articles_createdById_idx`(`createdById`),
    INDEX `Knowledge_articles_isPublished_idx`(`isPublished`),
    INDEX `Knowledge_articles_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('TICKET_ASSIGNED', 'TICKET_COMMENTED', 'TICKET_STATUS_CHANGED', 'TICKET_OVERDUE', 'KNOWLEDGE_PUBLISHED', 'ASSET_ASSIGNED', 'ASSET_RETURNED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `targetUrl` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notifications_userId_idx`(`userId`),
    INDEX `Notifications_isRead_idx`(`isRead`),
    INDEX `Notifications_type_idx`(`type`),
    INDEX `Notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assets` (
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

    UNIQUE INDEX `Assets_assetTag_key`(`assetTag`),
    UNIQUE INDEX `Assets_serialNumber_key`(`serialNumber`),
    INDEX `Assets_type_idx`(`type`),
    INDEX `Assets_status_idx`(`status`),
    INDEX `Assets_assignedToId_idx`(`assignedToId`),
    INDEX `Assets_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assetId` INTEGER NOT NULL,
    `assignedToId` INTEGER NOT NULL,
    `assignedById` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `returnedAt` DATETIME(3) NULL,
    `returnNotes` TEXT NULL,

    INDEX `Asset_assignments_assetId_idx`(`assetId`),
    INDEX `Asset_assignments_assignedToId_idx`(`assignedToId`),
    INDEX `Asset_assignments_assignedById_idx`(`assignedById`),
    INDEX `Asset_assignments_returnedAt_idx`(`returnedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Users` ADD CONSTRAINT `Users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tickets` ADD CONSTRAINT `Tickets_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tickets` ADD CONSTRAINT `Tickets_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tickets` ADD CONSTRAINT `Tickets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Ticket_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tickets` ADD CONSTRAINT `Tickets_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_comments` ADD CONSTRAINT `Ticket_comments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_comments` ADD CONSTRAINT `Ticket_comments_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_histories` ADD CONSTRAINT `Ticket_histories_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_histories` ADD CONSTRAINT `Ticket_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_attachments` ADD CONSTRAINT `Ticket_attachments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket_attachments` ADD CONSTRAINT `Ticket_attachments_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Knowledge_articles` ADD CONSTRAINT `Knowledge_articles_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notifications` ADD CONSTRAINT `Notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assets` ADD CONSTRAINT `Assets_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset_assignments` ADD CONSTRAINT `Asset_assignments_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset_assignments` ADD CONSTRAINT `Asset_assignments_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset_assignments` ADD CONSTRAINT `Asset_assignments_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
