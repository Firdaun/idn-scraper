-- AlterTable
ALTER TABLE "ChatSnapshot" ADD COLUMN     "negativeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "neutralCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "positiveCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ChatTopWord" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "livestreamId" TEXT NOT NULL,

    CONSTRAINT "ChatTopWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatTopWord_livestreamId_idx" ON "ChatTopWord"("livestreamId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTopWord_livestreamId_word_key" ON "ChatTopWord"("livestreamId", "word");

-- AddForeignKey
ALTER TABLE "ChatTopWord" ADD CONSTRAINT "ChatTopWord_livestreamId_fkey" FOREIGN KEY ("livestreamId") REFERENCES "Livestream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
