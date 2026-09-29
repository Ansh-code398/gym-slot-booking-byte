import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { authRoutes } from "./routes/auth";
import { sessionsRoutes } from "./routes/sessions";
import { AppError, formatApiError } from "./errors";

export const app = new Elysia({ prefix: "/api" })
  .use(cors())
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "gym-slot-booking-secret-key",
    })
  )
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return formatApiError(error.statusCode, error.code, error.message, error.details);
    }

    if (code === "VALIDATION") {
      set.status = 422;
      let userFriendlyMessage = "Validation error: invalid request payload";
      let details: unknown = undefined;

      try {
        const parsed = JSON.parse(error.message);
        userFriendlyMessage = parsed.summary || parsed.message || userFriendlyMessage;
        details = parsed.errors;
      } catch {
        userFriendlyMessage = error.message || userFriendlyMessage;
      }

      return formatApiError(422, "VALIDATION_ERROR", userFriendlyMessage, details);
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return formatApiError(404, "NOT_FOUND", "The requested API route was not found.");
    }

    if (code === "PARSE") {
      set.status = 400;
      return formatApiError(400, "BAD_REQUEST", "Malformed JSON in request body.");
    }

    console.error("Unhandled Server Error:", error);
    set.status = 500;
    return formatApiError(
      500,
      "INTERNAL_SERVER_ERROR",
      "An unexpected server error occurred. Please try again later."
    );
  })
  .get("/", () => ({
    success: true,
    message: "Welcome to the Gym Slot Booking API",
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(sessionsRoutes);

export type App = typeof app;
