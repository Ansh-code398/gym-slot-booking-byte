# [Gym Slot Booking](https://gym-slot-booking-byte.netlify.app)

## Design Note
- **Stack**: Next.js 16, Tailwind CSS, DaisyUI, TypeScript.
- **Backend**: Elysia
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Data Model**:
  There are total 4 tables in the database:
  - `users`: Stores user credentials and roles.
  - `sessions`: Stores session details.
  - `bookings`: Stores Reserved slots & check-in codes.
  - `waitlist`: Queue for waitlisted users.

## Setup Instructions

### 1. Prerequisites
- [Bun](https://bun.sh/) (recommended) or Node.js (v18+)
- PostgreSQL database (e.g., [Neon](https://neon.tech))

### 2. Clone & Install
```bash
git clone https://github.com/Ansh-code398/gym-slot-booking-byte.git
cd gym-slot-booking-byte
bun install
```
*(or `npm install`)*

### 3. Environment Variables
Create a `.env` file by copying `.env.example`:
```bash
cp .env.example .env
```
Configure your environment variables:
- `DATABASE_URL`: PostgreSQL connection URL (e.g. from Neon)
- `JWT_SECRET`: Secret key for authentication token signing

### 4. Database Migration
Push the schema to your database using Drizzle Kit:
```bash
bun run db:push
```

### 5. Run Development Server
```bash
bun run dev
```
Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Test Accounts
Pre-configured test accounts for testing admin management and member booking flows are documented in [`test_mails.md`](./test_mails.md).
