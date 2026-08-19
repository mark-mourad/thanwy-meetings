import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  AuthUser,
  CheckInStudentBody,
  CreateBibleReadingBody,
  CreateBibleStudyBody,
  CreateSpiritualRecordBody,
  GetAttendanceQueryParams,
  GetBibleStudyParams,
  GetCurrentUserResponse,
  GetServantDashboardResponse,
  GetStudentDashboardResponse,
  GetStudentProfileParams,
  ListBibleReadingsQueryParams,
  ListBibleReadingsResponse,
  ListBibleStudiesResponse,
  ListClassStudentsResponse,
  ListEventsResponse,
  ListSpiritualRecordsQueryParams,
  ListSpiritualRecordsResponse,
  LoginBody,
  LoginResponse,
  SignupBody,
  SignupResponse,
  SubmitBibleStudyBody,
  SubmitBibleStudyParams,
  SubmitBibleStudyResponse,
  UpdateBibleReadingBody,
  UpdateBibleReadingParams,
} from "@workspace/api-zod";
import {
  attendanceTable,
  bibleReadingsTable,
  bibleStudiesTable,
  bibleStudyAnswersTable,
  bibleStudyQuestionsTable,
  bibleStudySubmissionsTable,
  classesTable,
  db,
  eventsTable,
  spiritualRecordsTable,
  usersTable,
} from "@workspace/db";
import {
  clearSession,
  getClassName,
  hashPassword,
  hashQrToken,
  requireAuth,
  requireRole,
  serializeUser,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

const oldTestament = [
  ["التكوين", 50],
  ["الخروج", 40],
  ["اللاويين", 27],
  ["العدد", 36],
  ["التثنية", 34],
  ["يشوع", 24],
  ["القضاة", 21],
  ["راعوث", 4],
  ["صموئيل الأول", 31],
  ["صموئيل الثاني", 24],
  ["الملوك الأول", 22],
  ["الملوك الثاني", 25],
  ["المزامير", 150],
  ["الأمثال", 31],
  ["إشعياء", 66],
  ["إرميا", 52],
] as const;
const newTestament = [
  ["إنجيل متى", 28],
  ["إنجيل مرقس", 16],
  ["إنجيل لوقا", 24],
  ["إنجيل يوحنا", 21],
  ["أعمال الرسل", 28],
  ["رومية", 16],
  ["كورنثوس الأولى", 16],
  ["كورنثوس الثانية", 13],
  ["غلاطية", 6],
  ["أفسس", 6],
  ["فيلبي", 4],
  ["كولوسي", 4],
  ["يعقوب", 5],
  ["بطرس الأولى", 5],
  ["يوحنا الأولى", 5],
] as const;

type UserRow = typeof usersTable.$inferSelect;

async function userResponse(user: UserRow) {
  return serializeUser(user);
}

async function eventResponse(event: typeof eventsTable.$inferSelect) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    date: event.date,
    day: event.day,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    status: event.date === "2026-08-23" ? "قريباً" : null,
  };
}

async function eventsForUser(user: UserRow) {
  const rows = await db
    .select()
    .from(eventsTable)
    .where(
      and(
        eq(eventsTable.schoolYear, user.schoolYear),
        eq(eventsTable.classId, user.classId),
      ),
    )
    .orderBy(eventsTable.date);
  return Promise.all(rows.map(eventResponse));
}

async function attendanceFor(studentId: string, classId: string) {
  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.classId, classId))
    .orderBy(eventsTable.date);
  const checkIns = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, studentId));
  const checkInMap = new Map(checkIns.map((item) => [item.eventId, item]));
  const records = events.map((event) => {
    const checkIn = checkInMap.get(event.id);
    return {
      id: checkIn?.id ?? `absent-${event.id}-${studentId}`,
      eventId: event.id,
      eventTitle: event.title,
      studentId,
      studentName: "",
      status: checkIn ? "present" : "absent",
      date: event.date,
      checkedInAt: checkIn?.checkedInAt?.toISOString() ?? null,
    } as const;
  });
  const attended = records.filter((record) => record.status === "present").length;
  return {
    percentage: records.length ? Math.round((attended / records.length) * 100) : 0,
    attended,
    missed: records.length - attended,
    total: records.length,
    records,
  };
}

async function spiritualRows(studentId: string) {
  return db
    .select()
    .from(spiritualRecordsTable)
    .where(eq(spiritualRecordsTable.studentId, studentId))
    .orderBy(desc(spiritualRecordsTable.date));
}

async function readingRows(studentId: string) {
  return db
    .select()
    .from(bibleReadingsTable)
    .where(eq(bibleReadingsTable.studentId, studentId))
    .orderBy(desc(bibleReadingsTable.date));
}

async function studyRows(user: UserRow) {
  const studies = await db.select().from(bibleStudiesTable).orderBy(desc(bibleStudiesTable.deadline));
  const students = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.role, "STUDENT"), eq(usersTable.classId, user.classId)));
  const submissions = await db.select().from(bibleStudySubmissionsTable);
  return studies.map((study) => {
    const totalStudents = user.role === "SERVANT" ? students.length : 1;
    const submittedCount =
      user.role === "SERVANT"
        ? submissions.filter((item) => item.studyId === study.id).length
        : submissions.filter(
            (item) => item.studyId === study.id && item.studentId === user.id,
          ).length;
    return {
      id: study.id,
      title: study.title,
      description: study.description,
      testament: study.testament,
      book: study.book,
      chapter: study.chapter,
      startDate: study.startDate,
      deadline: study.deadline,
      status:
        submittedCount > 0
          ? "تم التسليم"
          : study.deadline < "2026-08-19"
            ? "متأخر"
            : "قيد الانتظار",
      submittedCount,
      totalStudents,
      submissionStatus: user.role === "STUDENT" && submittedCount > 0 ? "تم التسليم" : null,
    };
  });
}

async function getStudentInClass(id: string, servant: UserRow) {
  const [student] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.id, id),
        eq(usersTable.role, "STUDENT"),
        eq(usersTable.classId, servant.classId),
      ),
    )
    .limit(1);
  return student;
}

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const data = await userResponse(req.thanwyUser!);
  res.json(GetCurrentUserResponse.parse(data));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الدخول غير صحيحة." });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
    .limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
    return;
  }
  await setSessionCookie(res, user.id);
  res.json(LoginResponse.parse(await userResponse(user)));
});

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "راجع البيانات المطلوبة وحاول تاني." });
    return;
  }
  const [classRecord] = await db
    .select()
    .from(classesTable)
    .where(
      and(
        eq(classesTable.id, parsed.data.classId),
        eq(classesTable.schoolYear, parsed.data.schoolYear),
      ),
    )
    .limit(1);
  if (!classRecord) {
    res.status(400).json({ error: "الفصل لا يناسب المرحلة المختارة." });
    return;
  }
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "البريد الإلكتروني مستخدم بالفعل." });
    return;
  }
  const user = {
    id: randomUUID(),
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash: await hashPassword(parsed.data.password),
    role: "STUDENT",
    schoolYear: parsed.data.schoolYear,
    classId: parsed.data.classId,
    qrToken: hashQrToken(randomUUID()),
  };
  const [created] = await db.insert(usersTable).values(user).returning();
  await setSessionCookie(res, created.id);
  res.status(201).json(SignupResponse.parse(await userResponse(created)));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await clearSession(req, res);
  res.sendStatus(204);
});

router.get("/events", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  res.json(ListEventsResponse.parse(await eventsForUser(req.thanwyUser!)));
});

router.get("/dashboard/student", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "STUDENT")) return;
  const user = req.thanwyUser!;
  const [spiritual, readings, studies, attendance] = await Promise.all([
    spiritualRows(user.id),
    readingRows(user.id),
    studyRows(user),
    attendanceFor(user.id, user.classId),
  ]);
  const latest = spiritual[0] ?? {
    id: "empty",
    studentId: user.id,
    date: "2026-08-19",
    morningPrayer: false,
    vespersPrayer: false,
    sleepPrayer: false,
    spontaneousPrayer: false,
    communion: false,
    confessionDate: null,
  };
  const spiritualCompleted = [
    latest.morningPrayer,
    latest.vespersPrayer,
    latest.sleepPrayer,
    latest.spontaneousPrayer,
    latest.communion,
  ].filter(Boolean).length;
  const data = {
    user: await userResponse(user),
    events: await eventsForUser(user),
    spiritual: {
      completed: spiritualCompleted,
      total: 5,
      lastConfession: latest.confessionDate,
      latest,
    },
    readings: readings.slice(0, 4),
    studies,
    attendance: {
      ...attendance,
      records: attendance.records.map((record) => ({
        ...record,
        studentName: user.name,
      })),
    },
  };
  res.json(GetStudentDashboardResponse.parse(data));
});

router.get("/dashboard/servant", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "SERVANT")) return;
  const user = req.thanwyUser!;
  const [students, events, studies] = await Promise.all([
    db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, "STUDENT"), eq(usersTable.classId, user.classId))),
    eventsForUser(user),
    studyRows(user),
  ]);
  const studentSummaries = await Promise.all(
    students.map(async (student) => {
      const attendance = await attendanceFor(student.id, student.classId);
      const spiritual = await spiritualRows(student.id);
      const latest = spiritual[0];
      const spiritualPercentage = latest
        ? Math.round(
            ([latest.morningPrayer, latest.vespersPrayer, latest.sleepPrayer, latest.spontaneousPrayer, latest.communion].filter(Boolean).length / 5) * 100,
          )
        : 0;
      return {
        id: student.id,
        name: student.name,
        schoolYear: student.schoolYear,
        className: await getClassName(student.classId),
        attendancePercentage: attendance.percentage,
        spiritualPercentage,
        lastActivity: latest?.date ?? "لا يوجد نشاط بعد",
        avatarUrl: null,
      };
    }),
  );
  const totalAttendance = studentSummaries.reduce(
    (sum, student) => sum + student.attendancePercentage,
    0,
  );
  const data = {
    user: await userResponse(user),
    events,
    students: studentSummaries,
    attendance: {
      percentage: studentSummaries.length
        ? Math.round(totalAttendance / studentSummaries.length)
        : 0,
      attended: 0,
      missed: 0,
      total: 0,
      records: [],
    },
    studies,
    recentActivity: [
      {
        id: "activity-1",
        title: "تم تسجيل قراءة جديدة",
        description: "مينا شنودة أضاف قراءة من إنجيل متى",
        time: "منذ ساعتين",
      },
      {
        id: "activity-2",
        title: "موعد الدراسة يقترب",
        description: "الأسبوع الأول موعده يوم 24 أغسطس",
        time: "منذ 5 ساعات",
      },
    ],
  };
  res.json(GetServantDashboardResponse.parse(data));
});

router.get("/spiritual-records", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parsed = ListSpiritualRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "الفلاتر غير صحيحة." });
    return;
  }
  const user = req.thanwyUser!;
  let studentId = user.id;
  if (user.role === "SERVANT" && parsed.data.studentId) {
    const student = await getStudentInClass(parsed.data.studentId, user);
    if (!student) {
      res.status(404).json({ error: "المخدوم غير موجود." });
      return;
    }
    studentId = student.id;
  }
  res.json(ListSpiritualRecordsResponse.parse(await spiritualRows(studentId)));
});

router.post("/spiritual-records", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "STUDENT")) return;
  const parsed = CreateSpiritualRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "راجع بيانات النقطة الروحية." });
    return;
  }
  const [record] = await db
    .insert(spiritualRecordsTable)
    .values({ ...parsed.data, id: randomUUID(), studentId: req.thanwyUser!.id })
    .returning();
  res.status(201).json(record);
});

router.get("/bible-readings", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parsed = ListBibleReadingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "الفلاتر غير صحيحة." });
    return;
  }
  const user = req.thanwyUser!;
  let studentId = user.id;
  if (user.role === "SERVANT" && parsed.data.studentId) {
    const student = await getStudentInClass(parsed.data.studentId, user);
    if (!student) {
      res.status(404).json({ error: "المخدوم غير موجود." });
      return;
    }
    studentId = student.id;
  }
  const rows = await readingRows(studentId);
  const filtered =
    parsed.data.filter === "old"
      ? rows.filter((row) => row.testament === "العهد القديم")
      : parsed.data.filter === "new"
        ? rows.filter((row) => row.testament === "العهد الجديد")
        : rows;
  res.json(ListBibleReadingsResponse.parse(filtered));
});

router.post("/bible-readings", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "STUDENT")) return;
  const parsed = CreateBibleReadingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "راجع بيانات القراءة." });
    return;
  }
  const books = parsed.data.testament === "العهد القديم" ? oldTestament : newTestament;
  const selected = books.find(([name]) => name === parsed.data.book);
  if (!selected || parsed.data.chapter > selected[1]) {
    res.status(400).json({ error: "السفر أو الإصحاح غير صحيح." });
    return;
  }
  const [reading] = await db
    .insert(bibleReadingsTable)
    .values({ ...parsed.data, id: randomUUID(), studentId: req.thanwyUser!.id })
    .returning();
  res.status(201).json(reading);
});

router.patch("/bible-readings/:id", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "STUDENT")) return;
  const params = UpdateBibleReadingParams.safeParse(req.params);
  const parsed = UpdateBibleReadingBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "بيانات القراءة غير صحيحة." });
    return;
  }
  const [reading] = await db
    .update(bibleReadingsTable)
    .set(parsed.data)
    .where(and(eq(bibleReadingsTable.id, params.data.id), eq(bibleReadingsTable.studentId, req.thanwyUser!.id)))
    .returning();
  if (!reading) {
    res.status(404).json({ error: "القراءة غير موجودة." });
    return;
  }
  res.json(reading);
});

router.delete("/bible-readings/:id", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "STUDENT")) return;
  const params = UpdateBibleReadingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "القراءة غير صحيحة." });
    return;
  }
  await db
    .delete(bibleReadingsTable)
    .where(and(eq(bibleReadingsTable.id, params.data.id), eq(bibleReadingsTable.studentId, req.thanwyUser!.id)));
  res.sendStatus(204);
});

router.get("/bible-studies", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  res.json(ListBibleStudiesResponse.parse(await studyRows(req.thanwyUser!)));
});

router.post("/bible-studies", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "SERVANT")) return;
  const parsed = CreateBibleStudyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "راجع بيانات الدراسة والأسئلة." });
    return;
  }
  const studyId = randomUUID();
  const [study] = await db
    .insert(bibleStudiesTable)
    .values({
      id: studyId,
      title: parsed.data.title,
      description: parsed.data.description,
      testament: parsed.data.testament,
      book: parsed.data.book,
      chapter: parsed.data.chapter,
      startDate: parsed.data.startDate,
      deadline: parsed.data.deadline,
      createdBy: req.thanwyUser!.id,
    })
    .returning();
  if (parsed.data.questions.length) {
    await db.insert(bibleStudyQuestionsTable).values(
      parsed.data.questions.map((question) => ({
        ...question,
        id: randomUUID(),
        studyId,
        options: question.options ?? [],
      })),
    );
  }
  res.status(201).json({
    ...(await studyRows(req.thanwyUser!)).find((item) => item.id === study.id),
  });
});

router.get("/bible-studies/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const params = GetBibleStudyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "الدراسة غير صحيحة." });
    return;
  }
  const [study] = await db
    .select()
    .from(bibleStudiesTable)
    .where(eq(bibleStudiesTable.id, params.data.id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "الدراسة غير موجودة." });
    return;
  }
  const questions = await db
    .select()
    .from(bibleStudyQuestionsTable)
    .where(eq(bibleStudyQuestionsTable.studyId, study.id))
    .orderBy(bibleStudyQuestionsTable.order);
  const summary = (await studyRows(req.thanwyUser!)).find((item) => item.id === study.id);
  res.json({ ...summary, questions });
});

router.post("/bible-studies/:id/submit", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "STUDENT")) return;
  const params = SubmitBibleStudyParams.safeParse(req.params);
  const parsed = SubmitBibleStudyBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "الإجابات غير صحيحة." });
    return;
  }
  const [study] = await db
    .select({ id: bibleStudiesTable.id })
    .from(bibleStudiesTable)
    .where(eq(bibleStudiesTable.id, params.data.id))
    .limit(1);
  if (!study) {
    res.status(404).json({ error: "الدراسة غير موجودة." });
    return;
  }
  const [submission] = await db
    .insert(bibleStudySubmissionsTable)
    .values({
      id: randomUUID(),
      studyId: study.id,
      studentId: req.thanwyUser!.id,
      status: "submitted",
    })
    .returning();
  await db.insert(bibleStudyAnswersTable).values(
    parsed.data.answers.map((answer) => ({
      id: randomUUID(),
      submissionId: submission.id,
      questionId: answer.questionId,
      answer: answer.answer,
    })),
  );
  res.json(
    SubmitBibleStudyResponse.parse({
      id: submission.id,
      studyId: submission.studyId,
      submittedAt: submission.submittedAt.toISOString(),
      status: submission.status,
    }),
  );
});

router.get("/attendance", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const parsed = GetAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الحضور غير صحيحة." });
    return;
  }
  const user = req.thanwyUser!;
  let studentId = user.id;
  if (user.role === "SERVANT" && parsed.data.studentId) {
    const student = await getStudentInClass(parsed.data.studentId, user);
    if (!student) {
      res.status(404).json({ error: "المخدوم غير موجود." });
      return;
    }
    studentId = student.id;
  }
  const summary = await attendanceFor(studentId, user.classId);
  const [student] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, studentId))
    .limit(1);
  res.json({
    ...summary,
    records: summary.records.map((record) => ({ ...record, studentName: student?.name ?? "" })),
  });
});

router.post("/attendance/check-in", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "SERVANT")) return;
  const parsed = CheckInStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات تسجيل الحضور غير صحيحة." });
    return;
  }
  const [student] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.qrToken, hashQrToken(parsed.data.qrToken)), eq(usersTable.role, "STUDENT")))
    .limit(1);
  if (!student || student.classId !== req.thanwyUser!.classId) {
    res.status(403).json({ error: "المخدوم مش تابع لفصلك." });
    return;
  }
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.id, parsed.data.eventId), eq(eventsTable.classId, req.thanwyUser!.classId)))
    .limit(1);
  if (!event) {
    res.status(404).json({ error: "الفعالية غير موجودة." });
    return;
  }
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.eventId, event.id), eq(attendanceTable.studentId, student.id)))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "تم تسجيل الحضور بالفعل." });
    return;
  }
  const [record] = await db
    .insert(attendanceTable)
    .values({
      id: randomUUID(),
      eventId: event.id,
      studentId: student.id,
      checkedInAt: new Date(),
      checkedInBy: req.thanwyUser!.id,
    })
    .returning();
  res.status(201).json({
    id: record.id,
    eventId: event.id,
    eventTitle: event.title,
    studentId: student.id,
    studentName: student.name,
    status: "present",
    date: event.date,
    checkedInAt: record.checkedInAt?.toISOString() ?? null,
  });
});

router.get("/servant/students", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "SERVANT")) return;
  const students = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "STUDENT"), eq(usersTable.classId, req.thanwyUser!.classId)));
  const summaries = await Promise.all(
    students.map(async (student) => {
      const attendance = await attendanceFor(student.id, student.classId);
      const spiritual = await spiritualRows(student.id);
      const latest = spiritual[0];
      return {
        id: student.id,
        name: student.name,
        schoolYear: student.schoolYear,
        className: await getClassName(student.classId),
        attendancePercentage: attendance.percentage,
        spiritualPercentage: latest
          ? Math.round(
              ([latest.morningPrayer, latest.vespersPrayer, latest.sleepPrayer, latest.spontaneousPrayer, latest.communion].filter(Boolean).length / 5) * 100,
            )
          : 0,
        lastActivity: latest?.date ?? "لا يوجد نشاط بعد",
        avatarUrl: null,
      };
    }),
  );
  res.json(ListClassStudentsResponse.parse(summaries));
});

router.get("/servant/students/:id", async (req, res): Promise<void> => {
  if (!requireRole(req, res, "SERVANT")) return;
  const params = GetStudentProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "المخدوم غير صحيح." });
    return;
  }
  const student = await getStudentInClass(params.data.id, req.thanwyUser!);
  if (!student) {
    res.status(404).json({ error: "المخدوم غير موجود." });
    return;
  }
  const [attendance, spiritualRecords, readings, studies] = await Promise.all([
    attendanceFor(student.id, student.classId),
    spiritualRows(student.id),
    readingRows(student.id),
    studyRows(student),
  ]);
  const latest = spiritualRecords[0];
  res.json({
    id: student.id,
    name: student.name,
    schoolYear: student.schoolYear,
    className: await getClassName(student.classId),
    attendancePercentage: attendance.percentage,
    spiritualPercentage: latest
      ? Math.round(
          ([latest.morningPrayer, latest.vespersPrayer, latest.sleepPrayer, latest.spontaneousPrayer, latest.communion].filter(Boolean).length / 5) * 100,
        )
      : 0,
    lastActivity: latest?.date ?? "لا يوجد نشاط بعد",
    avatarUrl: null,
    readings,
    spiritualRecords,
    studies,
  });
});

export default router;