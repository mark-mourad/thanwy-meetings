import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const classesTable = pgTable("thanwy_classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  schoolYear: text("school_year").notNull(),
});

export const usersTable = pgTable("thanwy_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  schoolYear: text("school_year").notNull(),
  classId: text("class_id").notNull(),
  qrToken: text("qr_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("thanwy_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const invitationsTable = pgTable("thanwy_invitations", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
});

export const eventsTable = pgTable("thanwy_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  day: text("day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location").notNull(),
  schoolYear: text("school_year").notNull(),
  classId: text("class_id").notNull(),
  createdBy: text("created_by").notNull(),
});

export const attendanceTable = pgTable(
  "thanwy_attendance",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    studentId: text("student_id").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: text("checked_in_by"),
  },
  (table) => ({
    eventStudentUnique: uniqueIndex("thanwy_attendance_event_student_unique").on(
      table.eventId,
      table.studentId,
    ),
  }),
);

export const spiritualRecordsTable = pgTable("thanwy_spiritual_records", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  morningPrayer: boolean("morning_prayer").notNull().default(false),
  vespersPrayer: boolean("vespers_prayer").notNull().default(false),
  sleepPrayer: boolean("sleep_prayer").notNull().default(false),
  spontaneousPrayer: boolean("spontaneous_prayer").notNull().default(false),
  communion: boolean("communion").notNull().default(false),
  confessionDate: date("confession_date", { mode: "string" }),
});

export const bibleReadingsTable = pgTable("thanwy_bible_readings", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  testament: text("testament").notNull(),
  book: text("book").notNull(),
  chapter: integer("chapter").notNull(),
  note: text("note"),
});

export const bibleStudiesTable = pgTable("thanwy_bible_studies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  testament: text("testament").notNull(),
  book: text("book").notNull(),
  chapter: integer("chapter").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  deadline: date("deadline", { mode: "string" }).notNull(),
  createdBy: text("created_by").notNull(),
});

export const bibleStudyQuestionsTable = pgTable("thanwy_bible_study_questions", {
  id: text("id").primaryKey(),
  studyId: text("study_id").notNull(),
  question: text("question").notNull(),
  type: text("type").notNull(),
  options: text("options").array().notNull().default([]),
  order: integer("order").notNull(),
});

export const bibleStudySubmissionsTable = pgTable("thanwy_bible_study_submissions", {
  id: text("id").primaryKey(),
  studyId: text("study_id").notNull(),
  studentId: text("student_id").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("submitted"),
});

export const bibleStudyAnswersTable = pgTable("thanwy_bible_study_answers", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  questionId: text("question_id").notNull(),
  answer: text("answer").notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Class = typeof classesTable.$inferSelect;
export type Event = typeof eventsTable.$inferSelect;