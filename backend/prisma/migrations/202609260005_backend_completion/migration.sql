-- Additive backend completion: bounded payment attempts, durable email and seller teams.
ALTER TABLE "Payment"
  ADD COLUMN "processingExpiresAt" TIMESTAMP(3),
  ADD COLUMN "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Payment_status_processingExpiresAt_idx" ON "Payment"("status", "processingExpiresAt");

CREATE TYPE "SellerTeamRole" AS ENUM ('manager', 'catalog', 'orders', 'finance');
CREATE TYPE "SellerMemberStatus" AS ENUM ('active', 'revoked');
CREATE TYPE "SellerInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "SellerMember" (
  "id" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "role" "SellerTeamRole" NOT NULL, "permissions" TEXT[] NOT NULL,
  "status" "SellerMemberStatus" NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerMember_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerMember_sellerId_userId_key" ON "SellerMember"("sellerId", "userId");
CREATE INDEX "SellerMember_userId_status_idx" ON "SellerMember"("userId", "status");

CREATE TABLE "SellerInvitation" (
  "id" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "email" TEXT NOT NULL,
  "role" "SellerTeamRole" NOT NULL, "permissions" TEXT[] NOT NULL, "tokenHash" TEXT NOT NULL,
  "status" "SellerInvitationStatus" NOT NULL DEFAULT 'pending', "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerInvitation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerInvitation_tokenHash_key" ON "SellerInvitation"("tokenHash");
CREATE INDEX "SellerInvitation_sellerId_email_status_idx" ON "SellerInvitation"("sellerId", "email", "status");
CREATE INDEX "SellerInvitation_expiresAt_status_idx" ON "SellerInvitation"("expiresAt", "status");

CREATE TABLE "SellerNotificationPreference" (
  "id" TEXT NOT NULL, "sellerId" TEXT NOT NULL,
  "newOrder" BOOLEAN NOT NULL DEFAULT true, "newMessage" BOOLEAN NOT NULL DEFAULT true,
  "newReview" BOOLEAN NOT NULL DEFAULT true, "newFollower" BOOLEAN NOT NULL DEFAULT true,
  "lowStock" BOOLEAN NOT NULL DEFAULT true, "payments" BOOLEAN NOT NULL DEFAULT true,
  "marketing" BOOLEAN NOT NULL DEFAULT false, "platformMessages" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerNotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerNotificationPreference_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SellerNotificationPreference_sellerId_key" ON "SellerNotificationPreference"("sellerId");

CREATE TABLE "EmailOutbox" (
  "id" TEXT NOT NULL, "dedupeKey" TEXT, "recipient" TEXT NOT NULL, "template" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3), "messageId" TEXT, "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");
CREATE INDEX "EmailOutbox_status_availableAt_idx" ON "EmailOutbox"("status", "availableAt");
