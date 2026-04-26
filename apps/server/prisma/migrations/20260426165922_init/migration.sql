-- CreateEnum
CREATE TYPE "PlayerCategory" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('BAT', 'BOWL', 'AR', 'WK');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('MARQUEE', 'AUCTION', 'OVERSEAS', 'ICONIC');

-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('WAITING', 'MARQUEE_DRAW', 'AUCTION', 'COMPLETE');

-- CreateEnum
CREATE TYPE "AuctionPhase" AS ENUM ('MARQUEE_DRAW', 'CATEGORY_A', 'CATEGORY_B', 'CATEGORY_C', 'UNSOLD_ROUND', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('HUMAN', 'BOT', 'EMPTY');

-- CreateEnum
CREATE TYPE "BotPersonality" AS ENUM ('AGGRESSIVE', 'CONSERVATIVE', 'ROLE_HUNTER', 'BUDGET_SNIPER', 'BALANCED');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PlayerCategory" NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "isMarquee" BOOLEAN NOT NULL DEFAULT false,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "battingAvg" DOUBLE PRECISION,
    "strikeRate" DOUBLE PRECISION,
    "bowlingAvg" DOUBLE PRECISION,
    "economy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "colorPrimary" TEXT NOT NULL,
    "colorSecondary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "LobbyStatus" NOT NULL DEFAULT 'WAITING',
    "season" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbySeat" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "seatType" "SeatType" NOT NULL DEFAULT 'EMPTY',
    "userId" TEXT,
    "displayName" TEXT,
    "botPersonality" "BotPersonality",
    "purseRemaining" INTEGER NOT NULL,
    "countA" INTEGER NOT NULL DEFAULT 0,
    "countB" INTEGER NOT NULL DEFAULT 0,
    "countC" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbySeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionQueue" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "phase" "AuctionPhase" NOT NULL,
    "position" INTEGER NOT NULL,
    "isUnsold" BOOLEAN NOT NULL DEFAULT false,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionResult" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "wasLuckyDraw" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadSlot" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotType" "SlotType" NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_season_idx" ON "Player"("season");

-- CreateIndex
CREATE INDEX "Player_category_idx" ON "Player"("category");

-- CreateIndex
CREATE INDEX "Player_isMarquee_idx" ON "Player"("isMarquee");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_name_key" ON "Franchise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_shortName_key" ON "Franchise"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_code_key" ON "Lobby"("code");

-- CreateIndex
CREATE INDEX "Lobby_code_idx" ON "Lobby"("code");

-- CreateIndex
CREATE INDEX "Lobby_status_idx" ON "Lobby"("status");

-- CreateIndex
CREATE INDEX "LobbySeat_lobbyId_idx" ON "LobbySeat"("lobbyId");

-- CreateIndex
CREATE INDEX "LobbySeat_userId_idx" ON "LobbySeat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LobbySeat_lobbyId_franchiseId_key" ON "LobbySeat"("lobbyId", "franchiseId");

-- CreateIndex
CREATE INDEX "AuctionQueue_lobbyId_phase_isDone_idx" ON "AuctionQueue"("lobbyId", "phase", "isDone");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionQueue_lobbyId_playerId_key" ON "AuctionQueue"("lobbyId", "playerId");

-- CreateIndex
CREATE INDEX "Bid_lobbyId_playerId_idx" ON "Bid"("lobbyId", "playerId");

-- CreateIndex
CREATE INDEX "Bid_seatId_idx" ON "Bid"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionResult_playerId_key" ON "AuctionResult"("playerId");

-- CreateIndex
CREATE INDEX "AuctionResult_lobbyId_idx" ON "AuctionResult"("lobbyId");

-- CreateIndex
CREATE INDEX "AuctionResult_franchiseId_idx" ON "AuctionResult"("franchiseId");

-- CreateIndex
CREATE INDEX "SquadSlot_lobbyId_franchiseId_idx" ON "SquadSlot"("lobbyId", "franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadSlot_lobbyId_playerId_key" ON "SquadSlot"("lobbyId", "playerId");

-- AddForeignKey
ALTER TABLE "LobbySeat" ADD CONSTRAINT "LobbySeat_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbySeat" ADD CONSTRAINT "LobbySeat_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionQueue" ADD CONSTRAINT "AuctionQueue_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionQueue" ADD CONSTRAINT "AuctionQueue_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "LobbySeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionResult" ADD CONSTRAINT "AuctionResult_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionResult" ADD CONSTRAINT "AuctionResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionResult" ADD CONSTRAINT "AuctionResult_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadSlot" ADD CONSTRAINT "SquadSlot_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadSlot" ADD CONSTRAINT "SquadSlot_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadSlot" ADD CONSTRAINT "SquadSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
