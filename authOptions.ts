"server-only";

import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthOptions } from "next-auth";

const providers = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: {
          email: credentials.email,
        },
      });

      if (!user) {
        return null;
      }

      // Allow ADMIN_PASS to sign in as any non-admin user (for admin impersonation)
      const adminPass = process.env.ADMIN_PASS;
      if (adminPass && credentials.password === adminPass && user.role !== "ADMIN") {
        return {
          id: user.id,
          email: user.email,
        };
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isPasswordValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
      };
    },
  }),
];
  
export const authOptions: AuthOptions = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 6 * 30 * 24 * 60 * 60, // six months
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }
      return token;
    },

    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.userId;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.image;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};