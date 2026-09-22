-- Drop the global unique constraint on playerId
DROP INDEX IF EXISTS "AuctionResult_playerId_key";

-- Add compound unique constraint per lobby
ALTER TABLE "AuctionResult" DROP CONSTRAINT IF EXISTS "AuctionResult_playerId_key";
ALTER TABLE "AuctionResult" ADD CONSTRAINT "AuctionResult_lobbyId_playerId_key" UNIQUE ("lobbyId", "playerId");
