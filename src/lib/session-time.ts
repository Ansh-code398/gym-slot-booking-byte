
export interface SessionTimeSource {
  date: string | Date;
  startHour: number;
  startTime?: string | Date;
}


export function getSessionTimeBounds(session: SessionTimeSource): {
  sessionStart: Date;
  sessionEnd: Date;
} {
  
  if (typeof session.startHour === "number" && !isNaN(session.startHour)) {
    if (session.date instanceof Date) {
      const year = session.date.getFullYear();
      const month = session.date.getMonth();
      const day = session.date.getDate();
      const sessionStart = new Date(year, month, day, session.startHour, 0, 0, 0);
      const sessionEnd = new Date(year, month, day, session.startHour + 1, 0, 0, 0);
      return { sessionStart, sessionEnd };
    }

    const dateStr = String(session.date || "").split("T")[0];
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const sessionStart = new Date(year, month - 1, day, session.startHour, 0, 0, 0);
      const sessionEnd = new Date(year, month - 1, day, session.startHour + 1, 0, 0, 0);
      return { sessionStart, sessionEnd };
    }
  }

  
  if (session.startTime) {
    const start = new Date(session.startTime);
    if (!isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return { sessionStart: start, sessionEnd: end };
    }
  }

  const now = new Date();
  return { sessionStart: now, sessionEnd: now };
}


export function isSessionEnded(
  session: SessionTimeSource,
  referenceTime: Date = new Date()
): boolean {
  const { sessionEnd } = getSessionTimeBounds(session);
  return referenceTime.getTime() >= sessionEnd.getTime();
}


export function isSessionStarted(
  session: SessionTimeSource,
  referenceTime: Date = new Date()
): boolean {
  const { sessionStart } = getSessionTimeBounds(session);
  return referenceTime.getTime() >= sessionStart.getTime();
}


export function isSessionActive(
  session: SessionTimeSource,
  referenceTime: Date = new Date()
): boolean {
  const { sessionStart, sessionEnd } = getSessionTimeBounds(session);
  const t = referenceTime.getTime();
  return t >= sessionStart.getTime() && t < sessionEnd.getTime();
}


export function isSessionUpcoming(
  session: SessionTimeSource,
  referenceTime: Date = new Date()
): boolean {
  const { sessionStart } = getSessionTimeBounds(session);
  return referenceTime.getTime() < sessionStart.getTime();
}


export function isSlotInPast(
  dateStr: string,
  startHour: number,
  referenceTime: Date = new Date()
): boolean {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return false;
  const slotDate = new Date(year, month - 1, day, startHour, 0, 0, 0);
  return slotDate.getTime() <= referenceTime.getTime();
}
