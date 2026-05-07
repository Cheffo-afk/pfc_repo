-- CreateTable
CREATE TABLE `userData` (
    `userId` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `Username` VARCHAR(80) NOT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `subscribed` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `userData_email_key`(`email`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anagraphics` (
    `anagraphicsId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `Nome` VARCHAR(120) NOT NULL,
    `Cognome` VARCHAR(120) NOT NULL,
    `Telefono` VARCHAR(30) NULL,
    `Indirizzo` VARCHAR(255) NULL,
    `FotoProfilo` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `anagraphics_userId_key`(`userId`),
    PRIMARY KEY (`anagraphicsId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `userState` (
    `stateId` INTEGER NOT NULL AUTO_INCREMENT,
    `userID` INTEGER NOT NULL,
    `userState` ENUM('online', 'offline', 'non al computer') NOT NULL DEFAULT 'offline',
    `lastOnline` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `userState_userID_key`(`userID`),
    PRIMARY KEY (`stateId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chatRoom` (
    `roomId` INTEGER NOT NULL AUTO_INCREMENT,
    `roomType` ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`roomId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roomParticipant` (
    `roomParticipantId` INTEGER NOT NULL AUTO_INCREMENT,
    `roomId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `roomParticipant_userId_idx`(`userId`),
    UNIQUE INDEX `roomParticipant_roomId_userId_key`(`roomId`, `userId`),
    PRIMARY KEY (`roomParticipantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roomMessage` (
    `messageId` INTEGER NOT NULL AUTO_INCREMENT,
    `roomId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `roomMessage_roomId_sentAt_idx`(`roomId`, `sentAt`),
    INDEX `roomMessage_senderId_sentAt_idx`(`senderId`, `sentAt`),
    PRIMARY KEY (`messageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `anagraphics` ADD CONSTRAINT `anagraphics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `userData`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `userState` ADD CONSTRAINT `userState_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `userData`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomParticipant` ADD CONSTRAINT `roomParticipant_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `chatRoom`(`roomId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomParticipant` ADD CONSTRAINT `roomParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `userData`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomMessage` ADD CONSTRAINT `roomMessage_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `chatRoom`(`roomId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomMessage` ADD CONSTRAINT `roomMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `userData`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;
