-- AlterTable: Add lobbySeatId as nullable first
ALTER TABLE "SquadSlot" ADD COLUMN "lobbySeatId" TEXT;

-- Backfill: Populate lobbySeatId by joining with LobbySeat
UPDATE "SquadSlot" ss
SET "lobbySeatId" = ls.id
FROM "LobbySeat" ls
WHERE ss."lobbyId" = ls."lobbyId" AND ss."franchiseId" = ls."franchiseId";

-- AlterTable: Make lobbySeatId NOT NULL
ALTER TABLE "SquadSlot" ALTER COLUMN "lobbySeatId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SquadSlot_lobbySeatId_idx" ON "SquadSlot"("lobbySeatId");

-- AddForeignKey
ALTER TABLE "SquadSlot" ADD CONSTRAINT "SquadSlot_lobbySeatId_fkey" FOREIGN KEY ("lobbySeatId") REFERENCES "LobbySeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
