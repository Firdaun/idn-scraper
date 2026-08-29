-- CreateTable
CREATE TABLE "ChatSnapshot" (
    "id" SERIAL NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "livestreamId" TEXT NOT NULL,

    CONSTRAINT "ChatSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSnapshot_livestreamId_recordedAt_idx" ON "ChatSnapshot"("livestreamId", "recordedAt");

-- AddForeignKey
ALTER TABLE "ChatSnapshot" ADD CONSTRAINT "ChatSnapshot_livestreamId_fkey" FOREIGN KEY ("livestreamId") REFERENCES "Livestream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
