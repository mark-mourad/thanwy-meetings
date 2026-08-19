import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  attendanceTable,
  bibleReadingsTable,
  bibleStudiesTable,
  bibleStudyQuestionsTable,
  bibleStudySubmissionsTable,
  classesTable,
  db,
  eventsTable,
  spiritualRecordsTable,
  usersTable,
} from "@workspace/db";
import { hashPassword, hashQrToken } from "./auth";
import { logger } from "./logger";

let seeded = false;

export async function seedDemoData(): Promise<void> {
  if (seeded) return;
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing) {
    seeded = true;
    return;
  }

  const classes = [
    ["class-athanasius", "البابا أثناسيوس", "أولى سنوي"],
    ["class-peter", "البابا بطرس", "أولى سنوي"],
    ["class-polycarp", "القديس بوليكاربوس", "تانية سنوي"],
    ["class-titus", "القديس تيتوس", "تانية سنوي"],
    ["class-david", "فصل داود النبي", "تالتة سنوي"],
  ];
  await db.insert(classesTable).values(
    classes.map(([id, name, schoolYear]) => ({ id, name, schoolYear })),
  );

  const studentId = "student-demo";
  const servantId = "servant-demo";
  const passwordHash = await hashPassword("Thanwy123!");
  await db.insert(usersTable).values([
    {
      id: studentId,
      name: "مينا شنودة",
      email: "student@thanwy.app",
      passwordHash,
      role: "STUDENT",
      schoolYear: "تانية سنوي",
      classId: "class-polycarp",
      qrToken: hashQrToken("thanwy-student-demo"),
    },
    {
      id: servantId,
      name: "الخادم مينا",
      email: "servant@thanwy.app",
      passwordHash,
      role: "SERVANT",
      schoolYear: "تانية سنوي",
      classId: "class-polycarp",
      qrToken: hashQrToken("thanwy-servant-demo"),
    },
  ]);

  const events = [
    {
      id: "event-weekly",
      title: "الاجتماع الأسبوعي",
      description: "وقت جميل نلتقي فيه ونكبر مع بعض.",
      type: "اجتماع",
      date: "2026-08-23",
      day: "الأحد",
      startTime: "06:00 م",
      endTime: "08:00 م",
      location: "فصل القديس بوليكاربوس",
      schoolYear: "تانية سنوي",
      classId: "class-polycarp",
      createdBy: servantId,
    },
    {
      id: "event-retreat",
      title: "يوم روحي",
      description: "يوم هادي للتأمل والصلاة والخلوة.",
      type: "نشاط",
      date: "2026-08-29",
      day: "السبت",
      startTime: "09:00 ص",
      endTime: "04:00 م",
      location: "بيت الخلوة",
      schoolYear: "تانية سنوي",
      classId: "class-polycarp",
      createdBy: servantId,
    },
  ];
  await db.insert(eventsTable).values(events);

  await db.insert(attendanceTable).values({
    id: "attendance-demo",
    eventId: "event-weekly",
    studentId,
    checkedInAt: new Date("2026-08-16T18:15:00Z"),
    checkedInBy: servantId,
  });
  await db.insert(spiritualRecordsTable).values({
    id: "spiritual-demo",
    studentId,
    date: "2026-08-16",
    morningPrayer: true,
    vespersPrayer: true,
    sleepPrayer: true,
    spontaneousPrayer: false,
    communion: true,
    confessionDate: "2026-08-15",
  });
  await db.insert(bibleReadingsTable).values([
    {
      id: "reading-demo-1",
      studentId,
      date: "2026-08-18",
      testament: "العهد الجديد",
      book: "إنجيل متى",
      chapter: 5,
      note: "تعلمت إن المحبة هي طريق الملكوت.",
    },
    {
      id: "reading-demo-2",
      studentId,
      date: "2026-08-17",
      testament: "العهد الجديد",
      book: "إنجيل يوحنا",
      chapter: 15,
      note: "اثبتوا فيّ وأنا فيكم.",
    },
  ]);
  await db.insert(bibleStudiesTable).values({
    id: "study-demo",
    title: "الأسبوع الأول",
    description: "اقرأ الإصحاح وأجب عن الأسئلة بهدوء وتأمل.",
    testament: "العهد الجديد",
    book: "إنجيل متى",
    chapter: 5,
    startDate: "2026-08-17",
    deadline: "2026-08-24",
    createdBy: servantId,
  });
  await db.insert(bibleStudyQuestionsTable).values([
    {
      id: "question-demo-1",
      studyId: "study-demo",
      question: "ما الوصية التي لمستك أكثر في الإصحاح؟",
      type: "long",
      options: [],
      order: 1,
    },
    {
      id: "question-demo-2",
      studyId: "study-demo",
      question: "اكتب آية تريد أن تحفظها هذا الأسبوع.",
      type: "short",
      options: [],
      order: 2,
    },
  ]);

  seeded = true;
  logger.info("Thanwy demo data seeded");
}