-- AlterTable
ALTER TABLE `Tickets` ADD COLUMN `firstRespondedAt` DATETIME(3) NULL,
    ADD COLUMN `firstResponseDueAt` DATETIME(3) NULL,
    ADD COLUMN `firstResponseOverdue` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resolutionWarningAt` DATETIME(3) NULL,
    ADD COLUMN `responseWarningAt` DATETIME(3) NULL,
    ADD COLUMN `slaPolicy` JSON NULL;

-- Preserve the existing 24-hour visual warning for legacy tickets. Their
-- deadlines are unchanged, and the worker sends warnings only for SLA snapshots.
UPDATE `Tickets` SET `resolutionWarningAt` = DATE_SUB(`dueAt`, INTERVAL 1 DAY)
WHERE `dueAt` IS NOT NULL;

-- AlterTable
ALTER TABLE `Notifications` MODIFY `type` ENUM('TICKET_ASSIGNED', 'TICKET_COMMENTED', 'TICKET_STATUS_CHANGED', 'TICKET_OVERDUE', 'TICKET_SLA_WARNING', 'TICKET_RESPONSE_OVERDUE', 'TICKET_SLA_ESCALATED', 'KNOWLEDGE_PUBLISHED', 'ASSET_ASSIGNED', 'ASSET_RETURNED', 'LEAVE_REQUESTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_CANCELLED') NOT NULL;

-- AlterTable
ALTER TABLE `Audit_logs` MODIFY `entity` ENUM('USER', 'DEPARTMENT', 'TICKET', 'KNOWLEDGE_ARTICLE', 'ASSET', 'LEAVE_REQUEST', 'SLA_POLICY') NOT NULL;

-- CreateTable
CREATE TABLE `Sla_policies` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `config` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sla_alerts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `milestone` VARCHAR(16) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `managerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Sla_alerts_ticketId_milestone_kind_key`(`ticketId`, `milestone`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Tickets_status_isOverdue_dueAt_idx` ON `Tickets`(`status`, `isOverdue`, `dueAt`);

-- CreateIndex
CREATE INDEX `Tickets_status_firstRespondedAt_firstResponseDueAt_idx` ON `Tickets`(`status`, `firstRespondedAt`, `firstResponseDueAt`);

-- CreateIndex
CREATE INDEX `Tickets_status_responseWarningAt_idx` ON `Tickets`(`status`, `responseWarningAt`);

-- CreateIndex
CREATE INDEX `Tickets_status_resolutionWarningAt_idx` ON `Tickets`(`status`, `resolutionWarningAt`);

-- AddForeignKey
ALTER TABLE `Sla_alerts` ADD CONSTRAINT `Sla_alerts_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
