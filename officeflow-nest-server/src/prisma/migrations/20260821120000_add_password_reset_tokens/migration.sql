-- CreateTable
CREATE TABLE `Password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Password_reset_tokens_userId_key`(`userId`),
    UNIQUE INDEX `Password_reset_tokens_tokenHash_key`(`tokenHash`),
    INDEX `Password_reset_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Password_reset_tokens`
    ADD CONSTRAINT `Password_reset_tokens_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
