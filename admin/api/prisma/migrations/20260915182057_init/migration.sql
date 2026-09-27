-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collection" TEXT NOT NULL,
    "recordKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedByEmail" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DataRecord_collection_idx" ON "DataRecord"("collection");

-- CreateIndex
CREATE UNIQUE INDEX "DataRecord_collection_recordKey_key" ON "DataRecord"("collection", "recordKey");
