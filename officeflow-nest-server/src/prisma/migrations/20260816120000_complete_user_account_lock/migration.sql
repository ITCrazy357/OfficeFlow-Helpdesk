-- AlterTable
ALTER TABLE `Users`
    MODIFY `lockedById` INTEGER NULL,
    ADD COLUMN `unlockedAt` DATETIME(3) NULL,
    ADD COLUMN `unlockedById` INTEGER NULL;
