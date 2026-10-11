# [https://gym-slot-booking-byte.netlify.app](https://gym-slot-booking-byte.netlify.app)

# Design Note
- **Stack**: Next.js 16, Tailwind CSS, DaisyUI, TypeScript.
- **Backend**: Elysia
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Data Model**:
  There are total 4 tables in the database:
  - `users`: Stores user credentials and roles.
  - `sessions`: Stores session details.
  - `bookings`: Stores Reserved slots & check-in codes.
  - `waitlist`: Queue for waitlisted users.
