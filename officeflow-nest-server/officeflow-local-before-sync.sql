-- MySQL dump 10.13  Distrib 8.4.10, for Linux (x86_64)
--
-- Host: localhost    Database: officeflow_helpdesk
-- ------------------------------------------------------
-- Server version	8.4.10

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Asset_assignments`
--

DROP TABLE IF EXISTS `Asset_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Asset_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assetId` int NOT NULL,
  `assignedToId` int NOT NULL,
  `assignedById` int NOT NULL,
  `assignedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `returnedAt` datetime(3) DEFAULT NULL,
  `returnNotes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `AssetAssignment_assetId_idx` (`assetId`),
  KEY `AssetAssignment_assignedToId_idx` (`assignedToId`),
  KEY `AssetAssignment_assignedById_idx` (`assignedById`),
  KEY `AssetAssignment_returnedAt_idx` (`returnedAt`),
  CONSTRAINT `AssetAssignment_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AssetAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AssetAssignment_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Asset_assignments`
--

LOCK TABLES `Asset_assignments` WRITE;
/*!40000 ALTER TABLE `Asset_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `Asset_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Assets`
--

DROP TABLE IF EXISTS `Assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assetTag` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('LAPTOP','DESKTOP','MONITOR','PRINTER','PHONE','TABLET','NETWORK_DEVICE','ACCESSORY','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('AVAILABLE','ASSIGNED','MAINTENANCE','RETIRED','LOST') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  `brand` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serialNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchaseDate` datetime(3) DEFAULT NULL,
  `warrantyUntil` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `assignedToId` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Asset_assetTag_key` (`assetTag`),
  UNIQUE KEY `Asset_serialNumber_key` (`serialNumber`),
  KEY `Asset_type_idx` (`type`),
  KEY `Asset_status_idx` (`status`),
  KEY `Asset_assignedToId_idx` (`assignedToId`),
  KEY `Asset_createdAt_idx` (`createdAt`),
  CONSTRAINT `Asset_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Assets`
--

LOCK TABLES `Assets` WRITE;
/*!40000 ALTER TABLE `Assets` DISABLE KEYS */;
/*!40000 ALTER TABLE `Assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Audit_logs`
--

DROP TABLE IF EXISTS `Audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actorId` int DEFAULT NULL,
  `entity` enum('USER','DEPARTMENT','TICKET','KNOWLEDGE_ARTICLE','ASSET','LEAVE_REQUEST') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` int DEFAULT NULL,
  `action` enum('CREATE','UPDATE','DELETED','ASSIGNED','RETURNED','STATUS_CHANGED','ACTIVATED','DEACTIVATED','PUBLISHED','UNPUBLISHED','LINKED','UNLINKED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `oldValues` json DEFAULT NULL,
  `newValues` json DEFAULT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Audit_logs_actorId_idx` (`actorId`),
  KEY `Audit_logs_entity_entityId_idx` (`entity`,`entityId`),
  KEY `Audit_logs_action_idx` (`action`),
  KEY `Audit_logs_createdAt_idx` (`createdAt`),
  CONSTRAINT `Audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `Users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Audit_logs`
--

LOCK TABLES `Audit_logs` WRITE;
/*!40000 ALTER TABLE `Audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `Audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Departments`
--

DROP TABLE IF EXISTS `Departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `departments_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Departments`
--

LOCK TABLES `Departments` WRITE;
/*!40000 ALTER TABLE `Departments` DISABLE KEYS */;
INSERT INTO `Departments` VALUES (1,'IT','2026-07-06 20:00:45.475','2026-07-06 20:00:45.475'),(2,'HR','2026-07-06 20:00:45.500','2026-07-06 20:00:45.500'),(3,'Finance','2026-07-06 20:00:45.512','2026-07-06 20:00:45.512'),(4,'Marketing','2026-07-06 20:00:45.522','2026-07-06 20:00:45.522');
/*!40000 ALTER TABLE `Departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Knowledge_articles`
--

DROP TABLE IF EXISTS `Knowledge_articles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Knowledge_articles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tags` text COLLATE utf8mb4_unicode_ci,
  `isPublished` tinyint(1) NOT NULL DEFAULT '0',
  `viewCount` int NOT NULL DEFAULT '0',
  `createdById` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `KnowledgeArticle_slug_key` (`slug`),
  KEY `KnowledgeArticle_createdById_idx` (`createdById`),
  KEY `KnowledgeArticle_isPublished_idx` (`isPublished`),
  KEY `KnowledgeArticle_createdAt_idx` (`createdAt`),
  CONSTRAINT `KnowledgeArticle_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Knowledge_articles`
--

LOCK TABLES `Knowledge_articles` WRITE;
/*!40000 ALTER TABLE `Knowledge_articles` DISABLE KEYS */;
/*!40000 ALTER TABLE `Knowledge_articles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Leave_requests`
--

DROP TABLE IF EXISTS `Leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Leave_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requesterId` int NOT NULL,
  `approverId` int NOT NULL,
  `reviewedById` int DEFAULT NULL,
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `reviewNote` text COLLATE utf8mb4_unicode_ci,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Leave_requests_requesterId_createdAt_idx` (`requesterId`,`createdAt`),
  KEY `Leave_requests_approverId_status_createdAt_idx` (`approverId`,`status`,`createdAt`),
  KEY `Leave_requests_requesterId_status_startDate_idx` (`requesterId`,`status`,`startDate`),
  KEY `Leave_requests_reviewedById_reviewedAt_idx` (`reviewedById`,`reviewedAt`),
  CONSTRAINT `Leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Leave_requests_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Leave_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Leave_requests`
--

LOCK TABLES `Leave_requests` WRITE;
/*!40000 ALTER TABLE `Leave_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `Leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Notifications`
--

DROP TABLE IF EXISTS `Notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('TICKET_ASSIGNED','TICKET_COMMENTED','TICKET_STATUS_CHANGED','TICKET_OVERDUE','KNOWLEDGE_PUBLISHED','ASSET_ASSIGNED','ASSET_RETURNED','LEAVE_REQUESTED','LEAVE_APPROVED','LEAVE_REJECTED','LEAVE_CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT '0',
  `targetUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_userId_idx` (`userId`),
  KEY `notifications_isRead_idx` (`isRead`),
  KEY `notifications_type_idx` (`type`),
  KEY `notifications_createdAt_idx` (`createdAt`),
  CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notifications`
--

LOCK TABLES `Notifications` WRITE;
/*!40000 ALTER TABLE `Notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `Notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Password_reset_tokens`
--

DROP TABLE IF EXISTS `Password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Password_reset_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Password_reset_tokens_userId_key` (`userId`),
  UNIQUE KEY `Password_reset_tokens_tokenHash_key` (`tokenHash`),
  KEY `Password_reset_tokens_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `Password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Password_reset_tokens`
--

LOCK TABLES `Password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `Password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `Password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Refresh_tokens`
--

DROP TABLE IF EXISTS `Refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Refresh_tokens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `familyId` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` int NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `replacedById` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ipAddress` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Refresh_tokens_tokenHash_key` (`tokenHash`),
  KEY `Refresh_tokens_userId_revokedAt_idx` (`userId`,`revokedAt`),
  KEY `Refresh_tokens_familyId_idx` (`familyId`),
  KEY `Refresh_tokens_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `Refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Refresh_tokens`
--

LOCK TABLES `Refresh_tokens` WRITE;
/*!40000 ALTER TABLE `Refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `Refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Ticket_attachments`
--

DROP TABLE IF EXISTS `Ticket_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Ticket_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fileName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileUrl` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fileSize` int DEFAULT NULL,
  `publicId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticketId` int NOT NULL,
  `uploadedById` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resourceType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ticket_attachments_uploadedById_idx` (`uploadedById`),
  KEY `ticket_attachments_ticketId_createdAt_id_idx` (`ticketId`,`createdAt`,`id`),
  CONSTRAINT `ticket_attachments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ticket_attachments_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Ticket_attachments`
--

LOCK TABLES `Ticket_attachments` WRITE;
/*!40000 ALTER TABLE `Ticket_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `Ticket_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Ticket_categories`
--

DROP TABLE IF EXISTS `Ticket_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Ticket_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_categories_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Ticket_categories`
--

LOCK TABLES `Ticket_categories` WRITE;
/*!40000 ALTER TABLE `Ticket_categories` DISABLE KEYS */;
INSERT INTO `Ticket_categories` VALUES (1,'Hardware','2026-07-06 20:00:45.640','2026-07-06 20:00:45.640'),(2,'Software','2026-07-06 20:00:45.650','2026-07-06 20:00:45.650'),(3,'Network','2026-07-06 20:00:45.660','2026-07-06 20:00:45.660'),(4,'Account','2026-07-06 20:00:45.724','2026-07-06 20:00:45.724'),(5,'Other','2026-07-06 20:00:45.739','2026-07-06 20:00:45.739');
/*!40000 ALTER TABLE `Ticket_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Ticket_comments`
--

DROP TABLE IF EXISTS `Ticket_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Ticket_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ticketId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `authorId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ticket_comments_ticketId_idx` (`ticketId`),
  KEY `ticket_comments_authorId_idx` (`authorId`),
  CONSTRAINT `ticket_comments_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ticket_comments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Ticket_comments`
--

LOCK TABLES `Ticket_comments` WRITE;
/*!40000 ALTER TABLE `Ticket_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `Ticket_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Ticket_histories`
--

DROP TABLE IF EXISTS `Ticket_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Ticket_histories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action` enum('CREATE','UPDATE','STATUS_CHANGED','ASSIGNED','COMMENTED','ATTACHMENT_ADDED','ATTACHMENT_DELETED','DELETED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `oldValue` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `newValue` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticketId` int NOT NULL,
  `userId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ticket_histories_ticketId_idx` (`ticketId`),
  KEY `ticket_histories_userId_idx` (`userId`),
  KEY `ticket_histories_action_idx` (`action`),
  CONSTRAINT `ticket_histories_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ticket_histories_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Ticket_histories`
--

LOCK TABLES `Ticket_histories` WRITE;
/*!40000 ALTER TABLE `Ticket_histories` DISABLE KEYS */;
/*!40000 ALTER TABLE `Ticket_histories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Tickets`
--

DROP TABLE IF EXISTS `Tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('OPEN','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `priority` enum('LOW','MEDIUM','HIGH','URGENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEDIUM',
  `createdById` int NOT NULL,
  `assignedToId` int DEFAULT NULL,
  `categoryId` int DEFAULT NULL,
  `dueDate` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `dueAt` datetime(3) DEFAULT NULL,
  `isOverdue` tinyint(1) NOT NULL DEFAULT '0',
  `resolveAt` datetime(3) DEFAULT NULL,
  `assetId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tickets_status_idx` (`status`),
  KEY `tickets_priority_idx` (`priority`),
  KEY `tickets_createdAt_idx` (`createdAt`),
  KEY `tickets_assignedToId_idx` (`assignedToId`),
  KEY `tickets_createdById_idx` (`createdById`),
  KEY `tickets_categoryId_idx` (`categoryId`),
  KEY `tickets_assetId_idx` (`assetId`),
  CONSTRAINT `tickets_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tickets_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tickets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Ticket_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tickets_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Tickets`
--

LOCK TABLES `Tickets` WRITE;
/*!40000 ALTER TABLE `Tickets` DISABLE KEYS */;
INSERT INTO `Tickets` VALUES (4,'Không kết nối được VPN','Máy tính không thể kết nối VPN công ty, báo lỗi authentication failed.','IN_PROGRESS','HIGH',2,3,3,NULL,'2026-07-07 17:21:14.100','2026-07-07 17:24:40.182',NULL,0,NULL,NULL),(5,'Không truy cập được hệ thống chấm công','Khi truy cập hệ thống chấm công, trình duyệt hiển thị lỗi 500 Internal Server Error','IN_PROGRESS','URGENT',4,3,2,NULL,'2026-07-07 17:44:46.478','2026-07-07 17:45:41.869',NULL,0,NULL,NULL),(6,'Quên mật khẩu email công ty','Nhân viên không đăng nhập được email công ty và cần reset mật khẩu.','OPEN','LOW',4,1,4,NULL,'2026-07-07 17:49:37.442','2026-07-07 17:49:56.799',NULL,0,NULL,NULL),(7,'Cannot connect to VPN','I cannot connect to company VPN from my laptop.','OPEN','HIGH',2,NULL,3,NULL,'2026-07-15 10:08:40.558','2026-07-15 10:08:40.558',NULL,0,NULL,NULL);
/*!40000 ALTER TABLE `Tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('ADMIN','MANAGER','IT_STAFF','EMPLOYEE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EMPLOYEE',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `departmentId` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isLocked` tinyint(1) NOT NULL DEFAULT '0',
  `lockedAt` datetime(3) DEFAULT NULL,
  `lockedById` int DEFAULT NULL,
  `unlockedAt` datetime(3) DEFAULT NULL,
  `unlockedById` int DEFAULT NULL,
  `managerId` int DEFAULT NULL,
  `mustChangePassword` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_departmentId_idx` (`departmentId`),
  KEY `users_role_idx` (`role`),
  KEY `users_isActive_idx` (`isActive`),
  KEY `Users_managerId_idx` (`managerId`),
  CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Users_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `Users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES (1,'System Admin','admin@gmail.com','$2b$10$0qdd95ltZeta8L/zyf7Tp./82Q8Mb9knDs/adloTntrf.efa9pj4W','ADMIN',1,1,'2026-07-06 20:00:45.611','2026-07-06 20:00:45.611',0,NULL,NULL,NULL,NULL,NULL,0),(2,'Lê Văn A','levana@gmail.com','$2b$10$0qdd95ltZeta8L/zyf7Tp./82Q8Mb9knDs/adloTntrf.efa9pj4W','EMPLOYEE',1,2,'2026-07-06 20:00:45.629','2026-07-06 20:00:45.629',0,NULL,NULL,NULL,NULL,NULL,0),(3,'Lê Văn B','levanb@gmail.com','$2b$10$Rs4TikrYQBKksSWKS0mT9OgL0/y.CRYrrMEzsgolK2TE9I6mT.UJy','IT_STAFF',1,1,'2026-07-07 17:16:14.187','2026-07-07 17:16:14.187',0,NULL,NULL,NULL,NULL,NULL,0),(4,'Lê Văn C','levanc@gmail.com','$2b$10$PBAlyuidjB2OEGkV6BzQzOi9M2YNLd6UpuyzdC3VE1GdOSsTTFu6a','EMPLOYEE',1,3,'2026-07-07 17:29:12.451','2026-07-07 17:29:12.451',0,NULL,NULL,NULL,NULL,NULL,0),(5,'Lê Văn D','levand@gmail.com','$2b$10$F5cZ74St.rqtWiDaNcuJaOE9DvAR7kXl4xoGnYkfQ0lnD6.D9dbw.','EMPLOYEE',1,2,'2026-07-11 18:52:14.200','2026-07-11 18:52:14.200',0,NULL,NULL,NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('0b324d82-5214-4b4c-88c9-6f2dc05e075d','ace6b90b27d84e43db85b40a1507139ac4e05663d7821687401e5f0b7ad0ad2a','2026-07-18 17:14:39.837','20260718171439_add_ticket_comments_and_history',NULL,NULL,'2026-07-18 17:14:39.549',1),('41b06d49-343f-4e46-952c-a847c25aa608','3bd2d89d8dc8fa952e6ee1ffe93e404d01f308f929c737627f2487785641ed17','2026-08-23 18:33:13.093','20260802185002_add_refresh_tokens',NULL,NULL,'2026-08-23 18:33:12.966',1),('464dd8e1-5013-49dc-9ba7-4dfddbdee77b','4bd8bbc72d1fcdfc3a277d1b40438aff19d7884bb6995e3d63cd823dcf2901d8','2026-08-23 18:33:08.566','20260727183030_add_asset_management','',NULL,'2026-08-23 18:33:08.566',0),('47146d42-c451-48f7-b9e3-4510213d6d4c','fb69b0d3766ce5483118dce3fc004609348f82cf63073246822da8337d5e06bc','2026-07-06 15:53:04.303','20260706155304',NULL,NULL,'2026-07-06 15:53:04.238',1),('496247b3-bb66-4401-be0c-634668b8d50e','a55389ca37c0b8e0520bf6654a037934d29f034788e1f3f0d39b9fe0b7194c15','2026-07-06 15:51:17.317','20260626172215_init',NULL,NULL,'2026-07-06 15:51:16.515',1),('8459d9ec-5cc1-45d0-bd12-d3ac1677971b','a2bdbba6e26f9f1a3f237ad3f99c042c756b3cde1a4e7caa9b04b8e0d197ba70','2026-08-23 18:33:14.006','20260821120000_add_password_reset_tokens',NULL,NULL,'2026-08-23 18:33:13.894',1),('8683d8ec-4d17-4992-a528-e31de386527e','06998796730ef9616fdb6af02832daa450759826fe968cf07a5fbad56348f66b','2026-08-23 18:32:54.654','20260720180229','',NULL,'2026-08-23 18:32:54.654',0),('8a5b3bf0-3fc5-486f-9f00-78597f2084d8','a0ad664596593b3bca50bc5a9e2fee67fa868d5fcbce3e3996bd7f615b1bf150','2026-08-23 18:33:12.802','20260730164354_add_audit_logs',NULL,NULL,'2026-08-23 18:33:12.668',1),('92b23947-46f2-4fc5-b8d3-6f921d3e1953','dae9afc834ba9ca0fa2d737c5cd99504be69111092d7dfc4544720c67f0b2968','2026-08-23 18:33:13.836','20260819090000_add_leave_request_audit_notifications',NULL,NULL,'2026-08-23 18:33:13.806',1),('9745371f-6915-49c1-92c4-fe74c1b61d98','1c8a0b29f8d11b1179645ac201914645af1cdeaf0d3fb8f41b098a372a81a000','2026-08-23 18:33:05.567','20260725170348_add_notifications','',NULL,'2026-08-23 18:33:05.567',0),('9748bf78-6e15-4b29-be4b-0cd237a0b44a','655734c74e000792d5203ddbdeaee89f234ef16985a18c5ca6e2658c6d626813','2026-08-23 18:33:13.269','20260816120000_complete_user_account_lock',NULL,NULL,'2026-08-23 18:33:13.162',1),('a4646f15-2e91-407a-8bbc-b75af0e1cc7b','48e2db7249eb9d6ce93b3e5b55959cca3a3135437f3b404ceab0bfe8f218aed1','2026-08-23 18:33:13.158','20260815175911_add_user_account_lock',NULL,NULL,'2026-08-23 18:33:13.099',1),('aabce559-ba21-4c6f-8a6d-50a056ce69d0','194fbb037a16f8db7c243f4949294de26dc23b7e1ecffcd2b3a481e29247bf15','2026-08-23 18:32:58.351','20260723085726_add_ticket_attachments','',NULL,'2026-08-23 18:32:58.351',0),('ba45fa91-9beb-40ca-a3f7-5a5a252ce859','5a7d537180de267a763fab6c69d08a56fe7acd46d19d24a67b8236191b073715','2026-08-23 18:33:12.961','20260730164548_update',NULL,NULL,'2026-08-23 18:33:12.807',1),('c8c7a262-2753-4f30-b4e4-37b29e0b3600','cebe51a9e921c24672e96469eec67def112b646c8bdd20b6bab8607f9fd1c638','2026-08-23 18:33:13.890','20260820162824_add_must_change_password',NULL,NULL,'2026-08-23 18:33:13.840',1),('cf82c6f2-3c42-474b-a002-3a019a319325','5be89817e2a124c22abeff96a4e647e752bb0dc3935e90aaf03c922851236082','2026-08-23 18:33:00.841','20260723152737_add_knowledge_base','',NULL,'2026-08-23 18:33:00.841',0),('d28ea784-0102-4b19-a11d-a1b46545f9ee','f75fa51585dfa97592dbfa0e44e35d4cdb26f9a1bf2f8e252e24fbe3d16fb664','2026-08-23 18:33:10.697','20260729195212_updateinsert','',NULL,'2026-08-23 18:33:10.697',0),('e823aeee-47f1-4fc5-8b19-73c315108e38','8659583407efded4c4162e4f4f475c9e5ce8c0022dd86672c5de94a13f83af50','2026-08-23 18:33:13.801','20260817155028_add_leave_request_workflow',NULL,NULL,'2026-08-23 18:33:13.274',1),('f8cafb1d-1dd6-4be0-8e6c-7987b447e761','9b1295efe49da6feb1011ee91c874e5bc8c2cdd489493f5be75ee1da6fafcab8','2026-08-23 18:33:03.088','20260723173621_add_attachment_resource_type','',NULL,'2026-08-23 18:33:03.088',0);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'officeflow_helpdesk'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-11 10:04:42
