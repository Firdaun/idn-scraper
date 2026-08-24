/*
  Warnings:

  - You are about to drop the `LivestreamViewerStat` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LivestreamViewerStat" DROP CONSTRAINT "LivestreamViewerStat_livestreamId_fkey";

-- DropTable
DROP TABLE "LivestreamViewerStat";

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" SERIAL NOT NULL,
    "viewCount" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "livestreamId" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_livestreamId_recordedAt_idx" ON "Snapshot"("livestreamId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_livestreamId_fkey" FOREIGN KEY ("livestreamId") REFERENCES "Livestream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
