import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { UnauthorizedError, ForbiddenError } from "../errors";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export const authMiddleware = new Elysia({ name: "authMiddleware" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "gym-slot-booking-secret-key",
    })
  )
  .derive({ as: "scoped" }, ({ jwt, cookie: { auth }, headers }) => {
    let token: string | undefined = typeof auth.value === "string" ? auth.value : undefined;
    if (!token && headers.authorization?.startsWith("Bearer ")) {
      token = headers.authorization.slice(7);
    }

    const getUser = async (): Promise<AuthenticatedUser | null> => {
      if (!token) return null;
      const payload = (await jwt.verify(token)) as { id?: string } | null;
      if (!payload?.id) return null;

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, payload.id))
        .limit(1);

      return user || null;
    };

    return {
      getCurrentUser: getUser,
      requireAuth: async (): Promise<AuthenticatedUser> => {
        const user = await getUser();
        if (!user) {
          throw new UnauthorizedError("Authentication required. Please sign in.");
        }
        return user;
      },
      requireAdmin: async (): Promise<AuthenticatedUser> => {
        const user = await getUser();
        if (!user) {
          throw new UnauthorizedError("Authentication required. Please sign in.");
        }
        if (user.role !== "admin") {
          throw new ForbiddenError("Admin access required. You do not have permission.");
        }
        return user;
      },
    };
  });
