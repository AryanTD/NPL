import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { DefaultSession } from "@auth/core/types";

// Augment the core types that useSession() and the JWT callback actually use
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      hasSeenLobbyTour: boolean;
      hasSeenAuctionTour: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    username?: string | null;
    hasSeenLobbyTour?: boolean;
    hasSeenAuctionTour?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    username: string | null;
    hasSeenLobbyTour: boolean;
    hasSeenAuctionTour: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [Google],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = user.username ?? null;
        token.hasSeenLobbyTour = user.hasSeenLobbyTour ?? false;
        token.hasSeenAuctionTour = user.hasSeenAuctionTour ?? false;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.hasSeenLobbyTour = token.hasSeenLobbyTour;
      session.user.hasSeenAuctionTour = token.hasSeenAuctionTour;
      return session;
    },
  },
});
