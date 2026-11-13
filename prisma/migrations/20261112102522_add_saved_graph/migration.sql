-- CreateTable
CREATE TABLE "SavedGraph" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedGraph_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedGraph_userId_idx" ON "SavedGraph"("userId");

-- CreateIndex
CREATE INDEX "SavedGraph_userId_updatedAt_idx" ON "SavedGraph"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "SavedGraph" ADD CONSTRAINT "SavedGraph_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
