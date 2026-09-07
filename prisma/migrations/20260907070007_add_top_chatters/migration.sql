-- CreateTable
CREATE TABLE "ChatTopUser" (
    "id" SERIAL NOT NULL,
    "userUuid" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "livestreamId" TEXT NOT NULL,

    CONSTRAINT "ChatTopUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatTopUser_livestreamId_idx" ON "ChatTopUser"("livestreamId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTopUser_livestreamId_userUuid_key" ON "ChatTopUser"("livestreamId", "userUuid");

-- AddForeignKey
ALTER TABLE "ChatTopUser" ADD CONSTRAINT "ChatTopUser_livestreamId_fkey" FOREIGN KEY ("livestreamId") REFERENCES "Livestream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
