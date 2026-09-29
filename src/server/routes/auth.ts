import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from "../errors";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "gym-slot-booking-secret-key",
    })
  )
  .post(
    "/signup",
    async ({ body, jwt, cookie: { auth } }) => {
      const email = body.email.toLowerCase().trim();
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError("A user with this email already exists");
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);
      const [newUser] = await db
        .insert(users)
        .values({
          name: body.name.trim(),
          email,
          password: hashedPassword,
          role: "member",
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      const token = await jwt.sign({
        id: newUser.id,
        email: newUser.email,
      });

      auth.set({
        value: token,
        httpOnly: true,
        path: "/",
        maxAge: 7 * 86400,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return {
        success: true,
        message: "Account created successfully",
        user: newUser,
        token,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, error: "Name is required" }),
        email: t.String({ minLength: 3, error: "Valid email is required" }),
        password: t.String({ minLength: 6, error: "Password must be at least 6 characters" }),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, jwt, cookie: { auth } }) => {
      const email = body.email.toLowerCase().trim();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        throw new UnauthorizedError("Invalid email or password");
      }

      const isMatch = await bcrypt.compare(body.password, user.password);
      if (!isMatch) {
        throw new UnauthorizedError("Invalid email or password");
      }

      const token = await jwt.sign({
        id: user.id,
        email: user.email,
      });

      auth.set({
        value: token,
        httpOnly: true,
        path: "/",
        maxAge: 7 * 86400,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return {
        success: true,
        message: "Logged in successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token,
      };
    },
    {
      body: t.Object({
        email: t.String({ minLength: 3, error: "Email is required" }),
        password: t.String({ minLength: 1, error: "Password is required" }),
      }),
    }
  )
  .post("/logout", ({ cookie: { auth } }) => {
    auth.remove();
    return { success: true, message: "Logged out successfully" };
  })
  .get("/me", async ({ jwt, cookie: { auth }, headers }) => {
    let token: string | undefined = typeof auth.value === "string" ? auth.value : undefined;
    if (!token && headers.authorization?.startsWith("Bearer ")) {
      token = headers.authorization.slice(7);
    }

    if (!token) {
      throw new UnauthorizedError("Authentication token is required");
    }

    const payload = (await jwt.verify(token)) as {
      id?: string;
      email?: string;
    } | null;

    if (!payload || !payload.id) {
      throw new UnauthorizedError("Invalid or expired session");
    }

    try {
      const [currentUser] = await db
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

      if (!currentUser) {
        throw new NotFoundError("User account not found");
      }

      return { success: true, user: currentUser };
    } catch (err: unknown) {
      if (err instanceof NotFoundError) throw err;
      return {
        success: true,
        user: {
          id: payload.id,
          email: payload.email,
          name: "Member",
          role: "member",
        },
      };
    }
  });
