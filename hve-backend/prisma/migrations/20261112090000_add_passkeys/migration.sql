-- Đăng nhập bằng vân tay / khuôn mặt (passkey / WebAuthn).
CREATE TABLE "UserPasskey" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" JSONB,
  "deviceLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPasskey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPasskey_credentialId_key" ON "UserPasskey"("credentialId");
CREATE INDEX "UserPasskey_userId_idx" ON "UserPasskey"("userId");
ALTER TABLE "UserPasskey" ADD CONSTRAINT "UserPasskey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasskeyChallenge" (
  "id" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "userId" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasskeyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasskeyChallenge_expiresAt_idx" ON "PasskeyChallenge"("expiresAt");
CREATE INDEX "PasskeyChallenge_userId_purpose_idx" ON "PasskeyChallenge"("userId", "purpose");
