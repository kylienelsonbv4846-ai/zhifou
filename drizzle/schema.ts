import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // nullable for local accounts
  name: text("name"),
  email: varchar("email", { length: 320 }), // nullable, unique only for local accounts
  loginMethod: varchar("loginMethod", { length: 64 }), // 'oauth' or 'local'
  passwordHash: varchar("passwordHash", { length: 255 }), // hashed password for local accounts
  avatarUrl: varchar("avatarUrl", { length: 500 }), // user avatar URL
  wechatId: varchar("wechatId", { length: 128 }).unique(), // WeChat OpenID for social login
  qqId: varchar("qqId", { length: 128 }).unique(), // QQ ID for social login
  douyinId: varchar("douyinId", { length: 128 }).unique(), // Douyin ID for social login
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isEmailVerified: boolean("isEmailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Local accounts table - for tracking local account registrations
 * This helps enforce unique email constraint only for local accounts
 */
export const localAccounts = mysqlTable("localAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // references users.id
  email: varchar("email", { length: 320 }).notNull().unique(), // unique email for local accounts
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocalAccount = typeof localAccounts.$inferSelect;
export type InsertLocalAccount = typeof localAccounts.$inferInsert;

/**
 * Email verification tokens table - for email verification flow
 */
export const emailVerificationTokens = mysqlTable("emailVerificationTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // references users.id
  token: varchar("token", { length: 255 }).notNull().unique(), // secure random token
  email: varchar("email", { length: 320 }).notNull(), // email to verify
  expiresAt: timestamp("expiresAt").notNull(), // token expiration time (24 hours)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

/**
 * Email sending rate limit table - for tracking email send attempts
 */
export const emailSendingRateLimits = mysqlTable("emailSendingRateLimits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // references users.id
  email: varchar("email", { length: 320 }).notNull(), // email address
  lastSentAt: timestamp("lastSentAt").notNull(), // last email send time
  sendCount: int("sendCount").default(1).notNull(), // number of sends in current window
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("email_sending_rate_limits_user_email_unique").on(table.userId, table.email),
]);

export type EmailSendingRateLimit = typeof emailSendingRateLimits.$inferSelect;
export type InsertEmailSendingRateLimit = typeof emailSendingRateLimits.$inferInsert;

/**
 * Email verification codes table - for OTP-based email verification
 */
export const emailVerificationCodes = mysqlTable("emailVerificationCodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // references users.id
  code: varchar("code", { length: 10 }).notNull(), // 6-digit or alphanumeric code
  email: varchar("email", { length: 320 }).notNull(), // email to verify
  name: varchar("name", { length: 255 }), // pending local registration only
  passwordHash: varchar("passwordHash", { length: 255 }), // bcrypt hash; never store a plaintext password
  expiresAt: timestamp("expiresAt").notNull(), // code expiration time (10 minutes)
  attempts: int("attempts").default(0).notNull(), // number of verification attempts
  verified: boolean("verified").default(false).notNull(), // whether code has been used
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("email_verification_codes_user_email_unique").on(table.userId, table.email),
]);

export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;
export type InsertEmailVerificationCode = typeof emailVerificationCodes.$inferInsert;

/**
 * Password reset tokens table - for password reset flow
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Password reset codes table - for OTP-based password reset
 */
export const passwordResetCodes = mysqlTable("passwordResetCodes", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(), // email to reset password for
  code: varchar("code", { length: 10 }).notNull(), // 6-digit or alphanumeric code
  expiresAt: timestamp("expiresAt").notNull(), // code expiration time (10 minutes)
  attempts: int("attempts").default(0).notNull(), // number of verification attempts
  verified: boolean("verified").default(false).notNull(), // whether code has been used
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("password_reset_codes_email_unique").on(table.email),
]);

export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;
export type InsertPasswordResetCode = typeof passwordResetCodes.$inferInsert;

/**
 * Classes table - represents a classroom/class
 */
export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(), // references users.id
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

/**
 * Students table - students in a class
 * Each student gets a unique card number (1-40) within their class
 */
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // references classes.id
  name: varchar("name", { length: 255 }).notNull(),
  cardNumber: int("cardNumber").notNull(), // 1-40
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("students_class_card_unique").on(table.classId, table.cardNumber),
]);

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

/**
 * Question Folders table - folders for organizing question sets
 */
export const questionFolders = mysqlTable("questionFolders", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(), // references users.id
  parentFolderId: int("parentFolderId"), // optional: references questionFolders.id, null means root level
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestionFolder = typeof questionFolders.$inferSelect;
export type InsertQuestionFolder = typeof questionFolders.$inferInsert;

/**
 * Question Sets table - collection of questions
 */
export const questionSets = mysqlTable("questionSets", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(), // references users.id
  folderId: int("folderId"), // optional: references questionFolders.id, null means root level
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestionSet = typeof questionSets.$inferSelect;
export type InsertQuestionSet = typeof questionSets.$inferInsert;

/**
 * Questions table - individual questions
 * questionType: 'multiple_choice' (A/B/C/D), 'single_choice' (A/B/C/D), or 'true_false'
 * For multiple_choice: correctAnswers can be multiple (e.g., "AB", "ABC")
 * For single_choice: correctAnswer is single (e.g., "A")
 * For true_false: correctAnswer is "A" (true) or "B" (false)
 */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  setId: int("setId").notNull(), // references questionSets.id
  questionText: text("questionText").notNull(),
  questionMediaUrl: varchar("questionMediaUrl", { length: 512 }), // URL to image or video
  questionMediaType: mysqlEnum("questionMediaType", ["image", "video"]), // type of media
  questionType: mysqlEnum("questionType", ["multiple_choice", "single_choice", "true_false"]).notNull(),
  optionA: text("optionA"), // for multiple/single choice
  optionB: text("optionB"),
  optionC: text("optionC"),
  optionD: text("optionD"),
  optionAMediaUrl: varchar("optionAMediaUrl", { length: 512 }), // image URL for option A
  optionBMediaUrl: varchar("optionBMediaUrl", { length: 512 }), // image URL for option B
  optionCMediaUrl: varchar("optionCMediaUrl", { length: 512 }), // image URL for option C
  optionDMediaUrl: varchar("optionDMediaUrl", { length: 512 }), // image URL for option D
  correctAnswer: varchar("correctAnswer", { length: 10 }).notNull(), // 'A', 'B', 'C', 'D', 'AB', 'ABC', etc. for multiple choice
  orderIndex: int("orderIndex").notNull().default(0), // order within the set
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Sessions table - represents a classroom session/quiz session
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull(), // references users.id
  classId: int("classId").notNull(), // references classes.id
  setId: int("setId").notNull(), // references questionSets.id
  status: mysqlEnum("status", ["pending", "active", "completed"]).default("pending").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Session Queue table - questions queued for a session
 */
export const sessionQueue = mysqlTable("sessionQueue", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // references sessions.id
  questionId: int("questionId").notNull(), // references questions.id
  orderIndex: int("orderIndex").notNull(), // order in the queue
  isActive: boolean("isActive").default(false).notNull(), // currently displaying
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SessionQueueItem = typeof sessionQueue.$inferSelect;
export type InsertSessionQueueItem = typeof sessionQueue.$inferInsert;

/**
 * Answers table - student answers for questions in a session
 * For multiple_choice: answer can be multiple (e.g., "AB", "ABC")
 * For single_choice/true_false: answer is single (e.g., "A")
 */
export const answers = mysqlTable("answers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(), // references sessions.id
  questionId: int("questionId").notNull(), // references questions.id
  studentId: int("studentId").notNull(), // references students.id
  answer: varchar("answer", { length: 10 }).notNull(), // 'A', 'B', 'C', 'D', 'AB', 'ABC', etc.
  isCorrect: boolean("isCorrect").notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("answers_session_question_student_unique").on(
    table.sessionId,
    table.questionId,
    table.studentId
  ),
]);

export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = typeof answers.$inferInsert;


/**
 * Answer Cards Metadata table - stores metadata for permanently generated answer cards
 * 
 * 用途：存储一次性生成的80张答题卡的元数据
 * 答题卡在项目初始化时生成一次，然后永久存储在本地持久化目录中
 * 用户可以随时下载这些预生成的答题卡
 */
export const answerCardsMetadata = mysqlTable("answerCardsMetadata", {
  id: int("id").autoincrement().primaryKey(),
  cardNumber: int("cardNumber").notNull().unique(), // 1-80
  // Preserve existing SQL column names for compatibility; use neutral TS properties.
  storageKey: varchar("s3Key", { length: 512 }).notNull(),
  storageUrl: varchar("s3Url", { length: 512 }).notNull(),
  generatedAt: timestamp("generatedAt").notNull(), // when the card was generated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnswerCardMetadata = typeof answerCardsMetadata.$inferSelect;
export type InsertAnswerCardMetadata = typeof answerCardsMetadata.$inferInsert;

/** Persistent leases prevent expensive global card generation across instances. */
export const answerCardGenerationLocks = mysqlTable("answerCardGenerationLocks", {
  lockName: varchar("lockName", { length: 64 }).primaryKey(),
  ownerToken: varchar("ownerToken", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnswerCardGenerationLock = typeof answerCardGenerationLocks.$inferSelect;
