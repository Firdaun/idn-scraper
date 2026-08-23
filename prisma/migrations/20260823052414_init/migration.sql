-- CreateTable
CREATE TABLE "Livestream" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "streamerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "liveAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "avgViewers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Livestream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestreamViewerStat" (
    "id" SERIAL NOT NULL,
    "viewCount" INTEGER NOT NULL,
    "uniqueViewCount" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "livestreamId" TEXT NOT NULL,

    CONSTRAINT "LivestreamViewerStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Livestream_slug_key" ON "Livestream"("slug");

-- CreateIndex
CREATE INDEX "LivestreamViewerStat_livestreamId_recordedAt_idx" ON "LivestreamViewerStat"("livestreamId", "recordedAt");

-- AddForeignKey
ALTER TABLE "LivestreamViewerStat" ADD CONSTRAINT "LivestreamViewerStat_livestreamId_fkey" FOREIGN KEY ("livestreamId") REFERENCES "Livestream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
