import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users,
  classes, InsertClass,
  students, InsertStudent,
  questionFolders, InsertQuestionFolder,
  questionSets, InsertQuestionSet,
  questions, InsertQuestion,
  sessions, InsertSession,
  sessionQueue, InsertSessionQueueItem,
  answers, InsertAnswer,
  localAccounts, InsertLocalAccount,
  emailVerificationTokens, InsertEmailVerificationToken,
  emailVerificationCodes, InsertEmailVerificationCode,
  emailSendingRateLimits, InsertEmailSendingRateLimit,
  passwordResetTokens, InsertPasswordResetToken,
  passwordResetCodes, InsertPasswordResetCode,
  answerCardsMetadata, InsertAnswerCardMetadata,
  answerCardGenerationLocks
} from "../drizzle/schema";
import { eq, and, desc, asc, count, isNull, lte, gt, lt, sql } from "drizzle-orm";
import { MAX_VERIFICATION_CODE_ATTEMPTS } from "./emailVerificationCode";

function getDatabaseErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

export function isDuplicateDatabaseEntry(error: unknown): boolean {
  return getDatabaseErrorCode(error) === "ER_DUP_ENTRY";
}

export class StudentCardNumberCapacityError extends Error {
  constructor() {
    super("All card numbers (1-40) are already assigned");
    this.name = "StudentCardNumberCapacityError";
  }
}

export class StudentCardNumberConflictError extends Error {
  constructor(cardNumber: number) {
    super(`Card number ${cardNumber} is already in use`);
    this.name = "StudentCardNumberConflictError";
  }
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("DATABASE_URL must be configured");
    try {
      _db = drizzle(databaseUrl);
    } catch (error) {
      console.error("[Database] Failed to initialize:", error);
      throw error;
    }
  }
  return _db;
}

/** Verify that the database is reachable and the application schema is present. */
export async function checkDatabaseReadiness() {
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");

  await Promise.all([
    database.select({ id: users.id }).from(users).limit(0),
    database.select({ id: localAccounts.id }).from(localAccounts).limit(0),
    database.select({ id: emailVerificationTokens.id }).from(emailVerificationTokens).limit(0),
    database.select({ id: emailVerificationCodes.id }).from(emailVerificationCodes).limit(0),
    database.select({ id: emailSendingRateLimits.id }).from(emailSendingRateLimits).limit(0),
    database.select({ id: passwordResetTokens.id }).from(passwordResetTokens).limit(0),
    database.select({ id: passwordResetCodes.id }).from(passwordResetCodes).limit(0),
    database.select({ id: classes.id }).from(classes).limit(0),
    database.select({ id: students.id }).from(students).limit(0),
    database.select({ id: questionFolders.id }).from(questionFolders).limit(0),
    database.select({ id: questionSets.id }).from(questionSets).limit(0),
    database.select({ id: questions.id }).from(questions).limit(0),
    database.select({ id: sessions.id }).from(sessions).limit(0),
    database.select({ id: sessionQueue.id }).from(sessionQueue).limit(0),
    database.select({ id: answers.id }).from(answers).limit(0),
    database.select({ id: answerCardsMetadata.id }).from(answerCardsMetadata).limit(0),
    database.select({ lockName: answerCardGenerationLocks.lockName }).from(answerCardGenerationLocks).limit(0),
  ]);
}

// ============ User Functions ============

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 通过邮箱获取用户（用于本地账户登录）
 * @param email 邮箱地址
 * @returns 用户对象或undefined
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 检查邮箱是否已被使用
 * @param email 邮箱地址
 * @returns 邮箱是否已被使用
 */
export async function isEmailTaken(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.select().from(localAccounts).where(eq(localAccounts.email, email)).limit(1);
    return result.length > 0;
  } catch (error) {
    console.error("[Database] Failed to check email:", error);
    throw error;
  }
}

/**
 * 获取未验证的用户
 * @param email 邮箱地址
 * @returns 未验证的用户对象，如果不存在或已验证则返回undefined
 */
export async function getUnverifiedUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.select().from(users)
      .where(and(
        eq(users.email, email),
        eq(users.isEmailVerified, false)
      ))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get unverified user:", error);
    throw error;
  }
}

/**
 * 删除未验证的用户及其所有相关数据
 * @param userId 用户ID
 */
export async function deleteUnverifiedUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    // 删除邮箱验证令牌
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

    // 删除验证码和邮件发送限流记录，避免未验证账户被覆盖后留下脏数据
    await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId));
    await db.delete(emailSendingRateLimits).where(eq(emailSendingRateLimits.userId, userId));
    
    // 删除密码重置令牌
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    
    // 删除本地账户
    await db.delete(localAccounts).where(eq(localAccounts.userId, userId));
    
    // 删除用户
    await db.delete(users).where(eq(users.id, userId));
    
    console.log('[Database] Unverified user deleted successfully for userId:', userId);
  } catch (error) {
    console.error("[Database] Failed to delete unverified user:", error);
    throw error;
  }
}

/**
 * 创建本地账户
 * @param email 邮箱地址
 * @param passwordHash 哈希后的密码
 * @param name 用户名
 * @returns 创建的用户对象
 */
export async function createLocalAccount(
  email: string,
  passwordHash: string,
  name: string
): Promise<{ id: number; email: string; name: string }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    // 首先检查邮箱是否已被使用
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      // 如果用户已验证邮箱，不允许重新注册
      if (existingUser.isEmailVerified) {
        throw new Error('邮箱已被使用');
      }
      // 如果用户未验证邮箱，删除旧账户
      console.log('[Database] Found unverified user with email:', email, 'userId:', existingUser.id);
      await deleteUnverifiedUser(existingUser.id);
      console.log('[Database] Deleted unverified user, now creating new account');
    }

    // 为本地账户生成虚拟openId（格式：local_emailHash）
    // 这样本地账户也能使用会话系统
    const emailHash = createHash('sha256').update(email).digest('hex').substring(0, 32);
    const virtualOpenId = `local_${emailHash}`;

    // 创建用户
    const userResult = await db.insert(users).values({
      email,
      passwordHash,
      name,
      openId: virtualOpenId,
      loginMethod: "local",
      role: "user",
      isEmailVerified: false,
      lastSignedIn: new Date(),
    });

    console.log('[Database] userResult:', userResult);
    const userId = (userResult as any)[0]?.insertId || (userResult as any).insertId;
    console.log('[Database] userId:', userId);

    // 创建本地账户记录
    if (!userId) {
      throw new Error('Failed to get userId from insert result');
    }
    await db.insert(localAccounts).values({
      userId,
      email,
      createdAt: new Date(),
    });

    console.log('[Database] Local account created successfully for userId:', userId, 'openId:', virtualOpenId);
    return {
      id: userId,
      email,
      name,
    };
  } catch (error) {
    console.error("[Database] Failed to create local account:", error);
    throw error;
  }
}

/**
 * 更新用户最后登录时间
 * @param userId 用户ID
 */
export async function updateUserLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return;
  }

  try {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Failed to update user last signed in:", error);
  }
}

// ============ Class Functions ============

export async function createClass(data: InsertClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(classes).values(data);
  return result[0].insertId;
}

export async function getClassesByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(classes).where(eq(classes.teacherId, teacherId)).orderBy(desc(classes.createdAt));
}

export async function getClassById(classId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateClass(classId: number, data: Partial<InsertClass>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(classes).set(data).where(eq(classes.id, classId));
}

export async function deleteClass(classId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(classes).where(eq(classes.id, classId));
}

// ============ Student Functions ============

export async function getStudentsByClass(classId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(students).where(eq(students.classId, classId)).orderBy(asc(students.cardNumber));
}

export async function getStudentById(studentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStudent(studentId: number, data: Partial<InsertStudent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(students).set(data).where(eq(students.id, studentId));
}

export async function deleteStudent(studentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(students).where(eq(students.id, studentId));
}

export async function getNextAvailableCardNumber(classId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existingStudents = await db.select().from(students).where(eq(students.classId, classId));
  const usedNumbers = new Set(existingStudents.map(s => s.cardNumber));
  
  for (let i = 1; i <= 40; i++) {
    if (!usedNumbers.has(i)) {
      return i;
    }
  }
  
  throw new StudentCardNumberCapacityError();
}

export async function bulkImportStudents(
  classId: number, 
  studentsData: Array<{ name: string; cardNumber?: number }>
): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existingStudents = await db
    .select({ cardNumber: students.cardNumber })
    .from(students)
    .where(eq(students.classId, classId));
  const usedNumbers = new Set<number>(existingStudents.map(student => student.cardNumber));
  const toInsert: InsertStudent[] = [];
  
  for (const student of studentsData) {
    let cardNumber = student.cardNumber;
    
    if (!cardNumber) {
      // Find next available card number
      for (let i = 1; i <= 40; i++) {
        if (!usedNumbers.has(i)) {
          cardNumber = i;
          break;
        }
      }
    }
    
    if (!cardNumber) {
      throw new StudentCardNumberCapacityError();
    }
    
    // 检查是否有重复的卡号
    if (usedNumbers.has(cardNumber)) {
      throw new StudentCardNumberConflictError(cardNumber);
    }
    
    usedNumbers.add(cardNumber);
    toInsert.push({
      classId,
      name: student.name,
      cardNumber,
    });
  }
  
  if (toInsert.length > 0) {
    await db.insert(students).values(toInsert);
    return toInsert;
  }
  return [];
}

export async function createStudent(data: InsertStudent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(students).values(data);
  return result[0].insertId;
}

// ============ Question Folder Functions ============

export async function createQuestionFolder(data: InsertQuestionFolder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(questionFolders).values(data);
  return result[0].insertId;
}

export async function getQuestionFoldersByTeacher(teacherId: number, parentFolderId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  if (parentFolderId === undefined || parentFolderId === null) {
    // Get root level folders
    return await db.select().from(questionFolders)
      .where(and(
        eq(questionFolders.teacherId, teacherId),
        isNull(questionFolders.parentFolderId)
      ))
      .orderBy(desc(questionFolders.createdAt));
  } else {
    // Get subfolders
    return await db.select().from(questionFolders)
      .where(and(
        eq(questionFolders.teacherId, teacherId),
        eq(questionFolders.parentFolderId, parentFolderId)
      ))
      .orderBy(desc(questionFolders.createdAt));
  }
}

export async function getSubFoldersInFolder(parentFolderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(questionFolders)
    .where(eq(questionFolders.parentFolderId, parentFolderId))
    .orderBy(desc(questionFolders.createdAt));
}

export async function getQuestionFolderById(folderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(questionFolders).where(eq(questionFolders.id, folderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateQuestionFolder(folderId: number, data: Partial<InsertQuestionFolder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(questionFolders).set(data).where(eq(questionFolders.id, folderId));
}

export async function deleteQuestionFolder(folderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 首先，将该文件夹内的所有题集移到根目录
  await db.update(questionSets)
    .set({ folderId: null })
    .where(eq(questionSets.folderId, folderId));
  
  // 然后删除文件夹
  await db.delete(questionFolders).where(eq(questionFolders.id, folderId));
}

export async function countQuestionSetsInFolder(folderId: number | null): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  if (folderId === null) {
    // Count question sets in root level
    const result = await db.select({ count: count() })
      .from(questionSets)
      .where(isNull(questionSets.folderId));
    return result[0]?.count || 0;
  } else {
    const result = await db.select({ count: count() })
      .from(questionSets)
      .where(eq(questionSets.folderId, folderId));
    return result[0]?.count || 0;
  }
}

export async function countSubFoldersInFolder(parentFolderId: number | null): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  if (parentFolderId === null) {
    // Count root level folders
    const result = await db.select({ count: count() })
      .from(questionFolders)
      .where(isNull(questionFolders.parentFolderId));
    return result[0]?.count || 0;
  } else {
    const result = await db.select({ count: count() })
      .from(questionFolders)
      .where(eq(questionFolders.parentFolderId, parentFolderId));
    return result[0]?.count || 0;
  }
}

// ============ Question Set Functions ============

export async function createQuestionSet(data: InsertQuestionSet) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(questionSets).values(data);
  return result[0].insertId;
}

export async function getQuestionSetsByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(questionSets).where(eq(questionSets.teacherId, teacherId)).orderBy(desc(questionSets.createdAt));
}

export async function getQuestionSetById(setId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(questionSets).where(eq(questionSets.id, setId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateQuestionSet(setId: number, data: Partial<InsertQuestionSet>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(questionSets).set(data).where(eq(questionSets.id, setId));
}

export async function deleteQuestionSet(setId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(questionSets).where(eq(questionSets.id, setId));
}

// ============ Question Functions ============

export async function createQuestion(data: InsertQuestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(questions).values(data);
  return result[0].insertId;
}

export async function getQuestionsBySet(setId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(questions).where(eq(questions.setId, setId)).orderBy(asc(questions.orderIndex));
}

export async function getQuestionById(questionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateQuestion(questionId: number, data: Partial<InsertQuestion>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(questions).set(data).where(eq(questions.id, questionId));
}

export async function deleteQuestion(questionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(questions).where(eq(questions.id, questionId));
}

// ============ Session Functions ============

export async function createSession(data: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sessions).values(data);
  return result[0].insertId;
}

export async function getSessionsByTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(sessions).where(eq(sessions.teacherId, teacherId)).orderBy(desc(sessions.createdAt));
}

export async function getRecentSessionsByQuestionSet(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const allSessions = await db.select().from(sessions).where(eq(sessions.teacherId, teacherId)).orderBy(desc(sessions.createdAt));
  
  const recentBySet = new Map();
  for (const session of allSessions) {
    if (!recentBySet.has(session.setId)) {
      recentBySet.set(session.setId, session);
    }
  }
  
  return Array.from(recentBySet.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getClassesByQuestionSet(teacherId: number, setId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    classId: sessions.classId,
    lastSessionTime: sessions.createdAt,
  }).from(sessions)
    .where(and(eq(sessions.teacherId, teacherId), eq(sessions.setId, setId)));
  
  // 按班级分组，获取每个班级的最新会话时间
  const classMap = new Map();
  for (const row of result) {
    if (!classMap.has(row.classId)) {
      classMap.set(row.classId, row.lastSessionTime);
    }
  }
  
  // 转换为数组并按时间排序
  const classesWithTime = Array.from(classMap.entries()).map(([classId, lastSessionTime]) => ({
    classId,
    lastSessionTime,
  })).sort((a, b) => (b.lastSessionTime?.getTime() || 0) - (a.lastSessionTime?.getTime() || 0));
  
  return classesWithTime;
}

export async function getValidSessions(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取有答案的会话 ID
  const sessionsWithAnswers = await db.select({
    sessionId: answers.sessionId,
  }).from(answers).groupBy(answers.sessionId);
  
  const sessionIds = sessionsWithAnswers.map(s => s.sessionId);
  
  if (sessionIds.length === 0) return [];
  
  // 获取这些会话的详细信息
  const result = await db.select().from(sessions)
    .where(and(
      eq(sessions.teacherId, teacherId),
    ))
    .orderBy(desc(sessions.createdAt), desc(sessions.id));
  
  return result.filter(s => sessionIds.includes(s.id));
}

export async function getSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSession(sessionId: number, data: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessions).set(data).where(eq(sessions.id, sessionId));
}

export async function deleteSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// ============ Session Queue Functions ============

export async function addToSessionQueue(data: InsertSessionQueueItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sessionQueue).values(data);
  return result[0].insertId;
}

export async function getSessionQueue(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(sessionQueue).where(eq(sessionQueue.sessionId, sessionId)).orderBy(asc(sessionQueue.orderIndex));
}

export async function updateSessionQueueItem(queueId: number, data: Partial<InsertSessionQueueItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessionQueue).set(data).where(eq(sessionQueue.id, queueId));
}

export async function setActiveQuestion(sessionId: number, questionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async transaction => {
    const queueItems = await transaction
      .select({ id: sessionQueue.id, questionId: sessionQueue.questionId })
      .from(sessionQueue)
      .where(eq(sessionQueue.sessionId, sessionId));
    const targetItem = queueItems.find(item => item.questionId === questionId);
    if (!targetItem) throw new Error("Question is not present in the session queue");

    await transaction
      .update(sessionQueue)
      .set({ isActive: false })
      .where(eq(sessionQueue.sessionId, sessionId));
    await transaction
      .update(sessionQueue)
      .set({ isActive: true })
      .where(eq(sessionQueue.id, targetItem.id));
  });
}

// ============ Answer Functions ============

export async function recordAnswer(data: InsertAnswer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(answers).values(data);
  return result[0].insertId;
}

export async function getAnswersBySessionAndQuestion(sessionId: number, questionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: answers.id,
    sessionId: answers.sessionId,
    questionId: answers.questionId,
    studentId: answers.studentId,
    answer: answers.answer,
    isCorrect: answers.isCorrect,
    answeredAt: answers.answeredAt,
    createdAt: answers.createdAt,
    studentName: students.name,
  }).from(answers)
    .leftJoin(students, eq(answers.studentId, students.id))
    .where(and(eq(answers.sessionId, sessionId), eq(answers.questionId, questionId)))
    .orderBy(asc(answers.answeredAt));
}

export async function getAnswersBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(answers)
    .where(eq(answers.sessionId, sessionId))
    .orderBy(asc(answers.answeredAt));
}

export async function getQuestionStatistics(sessionId: number, questionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const answerList = await db.select().from(answers)
    .where(and(eq(answers.sessionId, sessionId), eq(answers.questionId, questionId)));
  
  if (answerList.length === 0) {
    return {
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      answered: 0,
      unanswered: 0,
      correctRate: 0,
    };
  }
  
  const stats = {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    answered: answerList.length,
    unanswered: 0,
    correctCount: 0,
  };
  
  for (const answer of answerList) {
    if (answer.answer.includes('A')) stats.a++;
    if (answer.answer.includes('B')) stats.b++;
    if (answer.answer.includes('C')) stats.c++;
    if (answer.answer.includes('D')) stats.d++;
    if (answer.isCorrect) stats.correctCount++;
  }
  
  const correctRate = Math.round((stats.correctCount / stats.answered) * 100);
  
  return {
    a: stats.a,
    b: stats.b,
    c: stats.c,
    d: stats.d,
    answered: stats.answered,
    unanswered: stats.unanswered,
    correctRate,
  };
}

export async function getSessionQueueWithQuestions(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const queue = await db.select().from(sessionQueue)
    .where(eq(sessionQueue.sessionId, sessionId))
    .orderBy(asc(sessionQueue.orderIndex));
  
  const result = [];
  for (const item of queue) {
    const question = await getQuestionById(item.questionId);
    if (question) {
      result.push({
        ...item,
        question,
      });
    }
  }
  
  return result;
}


// 获取会话中所有题目的统计数据
export async function getAllSessionQuestionsStatistics(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取会话的所有题目队列
  const queue = await db
    .select()
    .from(sessionQueue)
    .where(eq(sessionQueue.sessionId, sessionId))
    .orderBy(asc(sessionQueue.orderIndex));
  
  // 为每个题目获取统计数据
  const result = [];
  for (const item of queue) {
    const stats = await getQuestionStatistics(sessionId, item.questionId);
    const question = await getQuestionById(item.questionId);
    
    if (stats && question) {
      result.push({
        questionId: item.questionId,
        orderIndex: item.orderIndex,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        ...stats,
      });
    }
  }
  
  return result;
}


// 获取会话中每个题目的每个选项的学生名单
export async function getSessionQuestionsWithStudentAnswers(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取会话的所有题目队列
  const queue = await db
    .select()
    .from(sessionQueue)
    .where(eq(sessionQueue.sessionId, sessionId))
    .orderBy(asc(sessionQueue.orderIndex));
  
  // 为每个题目获取学生名单
  const result = [];
  for (const item of queue) {
    const question = await getQuestionById(item.questionId);
    const questionAnswers = await db
      .select({
        answer: answers.answer,
        studentId: answers.studentId,
        studentName: students.name,
      })
      .from(answers)
      .leftJoin(students, eq(answers.studentId, students.id))
      .where(and(eq(answers.sessionId, sessionId), eq(answers.questionId, item.questionId)));
    
    // Group by option
    const studentsByOption: Record<string, any[]> = {
      A: [],
      B: [],
      C: [],
      D: [],
    };
    const studentsByAnswer = questionAnswers.map(answer => ({
      answer: answer.answer,
      studentId: answer.studentId,
      studentName: answer.studentName,
    }));
    
    for (const answer of questionAnswers) {
      if (answer.answer.includes('A')) {
        studentsByOption.A.push({
          studentId: answer.studentId,
          studentName: answer.studentName,
        });
      }
      if (answer.answer.includes('B')) {
        studentsByOption.B.push({
          studentId: answer.studentId,
          studentName: answer.studentName,
        });
      }
      if (answer.answer.includes('C')) {
        studentsByOption.C.push({
          studentId: answer.studentId,
          studentName: answer.studentName,
        });
      }
      if (answer.answer.includes('D')) {
        studentsByOption.D.push({
          studentId: answer.studentId,
          studentName: answer.studentName,
        });
      }
    }
    
    if (question) {
      result.push({
        questionId: item.questionId,
        orderIndex: item.orderIndex,
        questionText: question.questionText,
        questionType: question.questionType,
        correctAnswer: question.correctAnswer,
        studentsByOption,
        studentsByAnswer,
      });
    }
  }
  
  return result;
}

export async function getSessionOverallStatistics(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get all answers for this session
  const allAnswers = await db
    .select({
      sessionId: answers.sessionId,
      studentId: answers.studentId,
      isCorrect: answers.isCorrect,
    })
    .from(answers)
    .where(eq(answers.sessionId, sessionId));
  
  if (allAnswers.length === 0) {
    return {
      totalAnswers: 0,
      correctAnswers: 0,
      accuracy: 0,
      uniqueStudents: 0,
    };
  }
  
  const uniqueStudents = new Set(allAnswers.map(a => a.studentId));
  const correctAnswers = allAnswers.filter(a => a.isCorrect).length;
  const accuracy = Math.round((correctAnswers / allAnswers.length) * 100);
  
  return {
    totalAnswers: allAnswers.length,
    correctAnswers,
    accuracy,
    uniqueStudents: uniqueStudents.size,
  };
}

export async function getSessionStudentScoreCards(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all answers for this session
  const allAnswers = await db
    .select({
      sessionId: answers.sessionId,
      studentId: answers.studentId,
      questionId: answers.questionId,
      isCorrect: answers.isCorrect,
    })
    .from(answers)
    .where(eq(answers.sessionId, sessionId));
  
  // Group by student
  const studentAnswersMap = new Map<number, any[]>();
  for (const answer of allAnswers) {
    if (!studentAnswersMap.has(answer.studentId)) {
      studentAnswersMap.set(answer.studentId, []);
    }
    studentAnswersMap.get(answer.studentId)!.push(answer);
  }
  
  // Get all students in this session
  const session = await getSessionById(sessionId);
  if (!session) return [];
  
  const classStudents = await getStudentsByClass(session.classId);
  
  // Calculate scores for each student
  const scoreCards = [];
  let rank = 1;
  
  // Sort by correct count descending, then by answered count descending
  const sortedStudents = Array.from(studentAnswersMap.entries())
    .map(([studentId, studentAnswers]) => {
      const correct = studentAnswers.filter(a => a.isCorrect).length;
      const answered = studentAnswers.length;
      const correctRate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return { studentId, correct, answered, correctRate };
    })
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return b.answered - a.answered;
    });
  
  for (const { studentId, correct, answered, correctRate } of sortedStudents) {
    const student = classStudents.find(s => s.id === studentId);
    if (!student) continue;
    
    const studentAnswers = studentAnswersMap.get(studentId) || [];
    
    scoreCards.push({
      rank: rank++,
      studentId,
      studentName: student.name,
      cardNumber: student.cardNumber,
      answered,
      correct,
      correctRate,
      answers: studentAnswers.map(a => ({
        questionId: a.questionId,
        isCorrect: a.isCorrect,
      })),
    });
  }
  
  return scoreCards;
}

export async function getStudentAnswers(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const studentAnswers = await db
    .select({
      id: answers.id,
      sessionId: answers.sessionId,
      questionId: answers.questionId,
      studentId: answers.studentId,
      answer: answers.answer,
      isCorrect: answers.isCorrect,
      answeredAt: answers.answeredAt,
      createdAt: answers.createdAt,
      correctAnswer: questions.correctAnswer,
    })
    .from(answers)
    .leftJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.studentId, studentId))
    .orderBy(asc(answers.answeredAt));
  
  return studentAnswers;
}

// ============ Class Data Export Functions ============

/**
 * 获取班级所有学生在所有会话中的答题数据
 */
export async function getClassSessionsData(classId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取班级的所有会话
  const classSessions = await db.select().from(sessions)
    .where(eq(sessions.classId, classId))
    .orderBy(asc(sessions.createdAt));
  
  const result = [];
  
  for (const session of classSessions) {
    // 获取该会话的所有答案
    const sessionAnswers = await db
      .select({
        studentId: answers.studentId,
        questionId: answers.questionId,
        answer: answers.answer,
        isCorrect: answers.isCorrect,
        answeredAt: answers.answeredAt,
      })
      .from(answers)
      .where(eq(answers.sessionId, session.id));
    
    // 获取该会话的所有题目
    const sessionQuestions = await db
      .select({
        questionId: sessionQueue.questionId,
        orderIndex: sessionQueue.orderIndex,
        questionText: questions.questionText,
        correctAnswer: questions.correctAnswer,
      })
      .from(sessionQueue)
      .leftJoin(questions, eq(sessionQueue.questionId, questions.id))
      .where(eq(sessionQueue.sessionId, session.id))
      .orderBy(asc(sessionQueue.orderIndex));
    
    result.push({
      sessionId: session.id,
      createdAt: session.createdAt,
      answers: sessionAnswers,
      questions: sessionQuestions,
    });
  }
  
  return result;
}

/**
 * 获取班级统计数据
 */
export async function getClassStatistics(classId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // 获取班级学生
  const classStudents = await getStudentsByClass(classId);
  
  // 获取班级的所有会话
  const classSessions = await db.select().from(sessions)
    .where(eq(sessions.classId, classId));
  
  // 获取班级的所有答案
  const classAnswers = await db
    .select({
      studentId: answers.studentId,
      isCorrect: answers.isCorrect,
      sessionId: answers.sessionId,
    })
    .from(answers)
    .innerJoin(sessions, eq(answers.sessionId, sessions.id))
    .where(eq(sessions.classId, classId));
  
  const totalAnswers = classAnswers.length;
  const correctAnswers = classAnswers.filter(a => a.isCorrect).length;
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  
  // 计算每个学生的准确率
  const studentStats = new Map<number, { correct: number; total: number }>();
  for (const answer of classAnswers) {
    if (!studentStats.has(answer.studentId)) {
      studentStats.set(answer.studentId, { correct: 0, total: 0 });
    }
    const stat = studentStats.get(answer.studentId)!;
    stat.total++;
    if (answer.isCorrect) stat.correct++;
  }
  
  // 找出最高和最低准确率的学生
  let topStudent = null;
  let bottomStudent = null;
  let topAccuracy = -1;
  let bottomAccuracy = 101;
  
  const studentStatsArray = Array.from(studentStats.entries());
  for (let i = 0; i < studentStatsArray.length; i++) {
    const [studentId, stat] = studentStatsArray[i];
    const studentAccuracy = Math.round((stat.correct / stat.total) * 100);
    if (studentAccuracy > topAccuracy) {
      topAccuracy = studentAccuracy;
      topStudent = classStudents.find(s => s.id === studentId);
    }
    if (studentAccuracy < bottomAccuracy) {
      bottomAccuracy = studentAccuracy;
      bottomStudent = classStudents.find(s => s.id === studentId);
    }
  }
  
  return {
    className: (await getClassById(classId))?.name || '未知班级',
    studentCount: classStudents.length,
    sessionCount: classSessions.length,
    totalAnswers,
    correctAnswers,
    accuracy,
    topStudent: topStudent ? { name: topStudent.name, accuracy: topAccuracy } : null,
    bottomStudent: bottomStudent ? { name: bottomStudent.name, accuracy: bottomAccuracy } : null,
  };
}


/**
 * 获取指定文件夹中的题集
 */
export async function getQuestionSetsByFolder(teacherId: number, folderId: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  if (folderId === null) {
    // Get root level question sets (only those without a folder)
    return await db.select().from(questionSets)
      .where(and(
        eq(questionSets.teacherId, teacherId),
        isNull(questionSets.folderId)
      ))
      .orderBy(desc(questionSets.createdAt));
  } else {
    // Get question sets in a specific folder
    return await db.select().from(questionSets)
      .where(and(
        eq(questionSets.teacherId, teacherId),
        eq(questionSets.folderId, folderId)
      ))
      .orderBy(desc(questionSets.createdAt));
  }
}

/**
 * 提交学生答案
 */
export async function submitAnswer(data: InsertAnswer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .insert(answers)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        answer: data.answer,
        isCorrect: data.isCorrect,
        answeredAt: new Date(),
      },
    });
  const saved = await db
    .select({ id: answers.id })
    .from(answers)
    .where(and(
      eq(answers.sessionId, data.sessionId),
      eq(answers.questionId, data.questionId),
      eq(answers.studentId, data.studentId)
    ))
    .limit(1);
  return saved[0]?.id ?? result[0].insertId;
}


/**
 * 创建邮箱验证令牌
 */
export async function createEmailVerificationToken(data: InsertEmailVerificationToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emailVerificationTokens).values(data);
  return result[0].insertId;
}

/**
 * 根据令牌获取邮箱验证记录
 */
export async function getEmailVerificationTokenByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 删除邮箱验证令牌
 */
export async function deleteEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token));
}

/**
 * 删除用户的所有邮箱验证令牌
 */
export async function deleteUserEmailVerificationTokens(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
}

/**
 * 更新用户的邮箱验证状态
 */
export async function markEmailAsVerified(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(users)
    .set({ isEmailVerified: true })
    .where(eq(users.id, userId));
}


/**
 * 获取用户的邮件发送速率限制记录
 */
export async function getEmailSendingRateLimit(userId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(emailSendingRateLimits)
    .where(and(
      eq(emailSendingRateLimits.userId, userId),
      eq(emailSendingRateLimits.email, email)
    ))
    .limit(1);
  
  return result[0] || null;
}

/** Atomically claim one email send slot for the configured cooldown window. */
export async function claimEmailSendingRateLimit(
  userId: number,
  email: string,
  now: Date,
  cooldownMinutes: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cutoff = new Date(now.getTime() - cooldownMinutes * 60_000);

  const claim = () => db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(emailSendingRateLimits)
        .where(and(
          eq(emailSendingRateLimits.userId, userId),
          eq(emailSendingRateLimits.email, email)
        ))
        .limit(1)
        .for("update");
      const record = current[0];

      if (record && record.lastSentAt.getTime() > cutoff.getTime()) return false;

      if (record) {
        await tx
          .update(emailSendingRateLimits)
          .set({ lastSentAt: now, sendCount: record.sendCount + 1, updatedAt: now })
          .where(eq(emailSendingRateLimits.id, record.id));
      } else {
        await tx.insert(emailSendingRateLimits).values({
          userId,
          email,
          lastSentAt: now,
          sendCount: 1,
        });
      }

      return true;
    });

  const maxRetries = 4;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await claim();
    } catch (error) {
      const code = getDatabaseErrorCode(error);
      if (code === "ER_DUP_ENTRY") return false;
      if (code !== "ER_LOCK_DEADLOCK" && code !== "ER_LOCK_WAIT_TIMEOUT") throw error;
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
    }
  }

  return false;
}

/**
 * 创建邮件发送速率限制记录
 */
export async function createEmailSendingRateLimit(data: InsertEmailSendingRateLimit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(emailSendingRateLimits).values(data);
  return result[0].insertId;
}

/**
 * 原子创建或更新邮件发送限流记录。
 */
export async function upsertEmailSendingRateLimit(
  userId: number,
  email: string,
  lastSentAt: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(emailSendingRateLimits)
    .values({ userId, email, lastSentAt, sendCount: 1 })
    .onDuplicateKeyUpdate({
      set: { lastSentAt, sendCount: 1, updatedAt: lastSentAt },
    });
}

/**
 * 更新邮件发送速率限制记录
 */
export async function updateEmailSendingRateLimit(userId: number, email: string, lastSentAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(emailSendingRateLimits)
    .set({ 
      lastSentAt,
      sendCount: 1,
      updatedAt: new Date(),
    })
    .where(and(
      eq(emailSendingRateLimits.userId, userId),
      eq(emailSendingRateLimits.email, email)
    ));
}

/**
 * 删除邮件发送速率限制记录
 */
export async function deleteEmailSendingRateLimit(userId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(emailSendingRateLimits)
    .where(and(
      eq(emailSendingRateLimits.userId, userId),
      eq(emailSendingRateLimits.email, email)
    ));
}


/**
 * 获取密码重置令牌
 */
export async function getPasswordResetTokenByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 创建密码重置令牌
 */
export async function createPasswordResetToken(data: InsertPasswordResetToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(passwordResetTokens).values(data);
  return result[0].insertId;
}

/**
 * 删除用户的所有密码重置令牌
 */
export async function deleteUserPasswordResetTokens(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId));
}

/**
 * 删除密码重置令牌
 */
export async function deletePasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));
}

/**
 * 标记密码重置令牌为已使用
 */
export async function markPasswordResetTokenAsUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const result = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(
      eq(passwordResetTokens.token, token),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now)
    ));
  const header = (Array.isArray(result) ? result[0] : undefined) as { affectedRows?: number } | undefined;
  return Number(header?.affectedRows ?? 0) === 1;
}

/** Atomically consume a legacy reset token and update its account password once. */
export async function completePasswordResetWithToken(
  token: string,
  userId: number,
  passwordHash: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  return db.transaction(async (tx) => {
    const tokenResult = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now)
      ));
    const tokenHeader = (Array.isArray(tokenResult) ? tokenResult[0] : undefined) as { affectedRows?: number } | undefined;
    if (Number(tokenHeader?.affectedRows ?? 0) !== 1) return false;

    const userResult = await tx
      .update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
    const userHeader = (Array.isArray(userResult) ? userResult[0] : undefined) as { affectedRows?: number } | undefined;
    if (Number(userHeader?.affectedRows ?? 0) !== 1) {
      return false;
    }

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt)
      ));

    return true;
  });
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(users)
    .set({ 
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}


// ============ Email Verification Code Functions ============

/**
 * 创建邮箱验证码
 */
export async function createEmailVerificationCode(data: InsertEmailVerificationCode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(emailVerificationCodes)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        code: data.code,
        name: data.name ?? null,
        passwordHash: data.passwordHash ?? null,
        expiresAt: data.expiresAt,
        attempts: 0,
        verified: false,
        updatedAt: new Date(),
      },
    });
  return result[0].insertId;
}

/**
 * 获取尚未验证的临时注册验证码；临时注册记录使用 userId=0。
 */
export async function getPendingRegistrationVerificationCode(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(emailVerificationCodes)
    .where(and(
      eq(emailVerificationCodes.userId, 0),
      eq(emailVerificationCodes.email, email),
      eq(emailVerificationCodes.verified, false)
    ))
    .orderBy(desc(emailVerificationCodes.createdAt))
      .limit(1);

  return result[0] || null;
}

/** Consume a pending registration OTP and create/verify its local account atomically. */
export async function completePendingRegistrationVerification(
  email: string,
  codeId: number,
  code: string
): Promise<{ id: number; email: string; name: string } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  return db.transaction(async (tx) => {
    const pendingRows = await tx
      .select()
      .from(emailVerificationCodes)
      .where(and(
        eq(emailVerificationCodes.id, codeId),
        eq(emailVerificationCodes.userId, 0),
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.code, code),
        eq(emailVerificationCodes.verified, false),
        lt(emailVerificationCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
        gt(emailVerificationCodes.expiresAt, now)
      ))
      .limit(1)
      .for("update");
    const pending = pendingRows[0];
    if (!pending?.passwordHash || !pending.name) return null;

    const existingRows = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .for("update");
    const existingUser = existingRows[0];
    if (existingUser && (existingUser.isEmailVerified || existingUser.loginMethod !== "local")) {
      return null;
    }

    const consumed = await tx
      .delete(emailVerificationCodes)
      .where(and(
        eq(emailVerificationCodes.id, codeId),
        eq(emailVerificationCodes.userId, 0),
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.code, code),
        eq(emailVerificationCodes.verified, false),
        lt(emailVerificationCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
        gt(emailVerificationCodes.expiresAt, now)
      ));
    const consumedHeader = (Array.isArray(consumed) ? consumed[0] : undefined) as { affectedRows?: number } | undefined;
    if (Number(consumedHeader?.affectedRows ?? 0) !== 1) return null;

    let userId: number;
    if (existingUser) {
      userId = existingUser.id;
      await tx
        .update(users)
        .set({
          name: pending.name,
          passwordHash: pending.passwordHash,
          isEmailVerified: true,
          lastSignedIn: now,
          updatedAt: now,
        })
        .where(and(
          eq(users.id, existingUser.id),
          eq(users.loginMethod, "local"),
          eq(users.isEmailVerified, false)
        ));

      const localRows = await tx
        .select()
        .from(localAccounts)
        .where(eq(localAccounts.email, email))
        .limit(1)
        .for("update");
      if (localRows[0] && localRows[0].userId !== userId) {
        throw new Error("Local account email is already linked to another user");
      }
      if (!localRows[0]) await tx.insert(localAccounts).values({ userId, email });
    } else {
      const emailHash = createHash("sha256").update(email).digest("hex").substring(0, 32);
      const virtualOpenId = `local_${emailHash}`;
      const userResult = await tx.insert(users).values({
        email,
        passwordHash: pending.passwordHash,
        name: pending.name,
        openId: virtualOpenId,
        loginMethod: "local",
        role: "user",
        isEmailVerified: true,
        lastSignedIn: now,
      });
      const userHeader = (Array.isArray(userResult) ? userResult[0] : undefined) as { insertId?: number } | undefined;
      userId = Number(userHeader?.insertId ?? (userResult as any).insertId ?? 0);
      if (!userId) throw new Error("Failed to create verified local account");
      await tx.insert(localAccounts).values({ userId, email, createdAt: now });
    }

    await tx.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.delete(emailSendingRateLimits).where(and(
      eq(emailSendingRateLimits.userId, 0),
      eq(emailSendingRateLimits.email, email)
    ));
    if (userId !== 0) {
      await tx.delete(emailSendingRateLimits).where(and(
        eq(emailSendingRateLimits.userId, userId),
        eq(emailSendingRateLimits.email, email)
      ));
    }
    return { id: userId, email, name: pending.name };
  });
}

/**
 * 删除指定邮箱所有未完成的临时注册验证码。
 */
export async function deletePendingRegistrationVerificationCodes(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(emailVerificationCodes)
    .where(and(
      eq(emailVerificationCodes.userId, 0),
      eq(emailVerificationCodes.email, email),
      eq(emailVerificationCodes.verified, false)
    ));
}

/**
 * 根据用户ID和邮箱获取最新的邮箱验证码
 */
export async function getEmailVerificationCodeByUserAndEmail(userId: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(emailVerificationCodes)
    .where(and(
      eq(emailVerificationCodes.userId, userId),
      eq(emailVerificationCodes.email, email),
      eq(emailVerificationCodes.verified, false)
    ))
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);
  
  return result[0] || null;
}

/** Atomically consume a legacy code and verify its existing local account. */
export async function completeExistingEmailVerification(
  userId: number,
  email: string,
  codeId: number,
  code: string
): Promise<{ id: number; email: string; name: string | null } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  return db.transaction(async (tx) => {
    const codeRows = await tx
      .select()
      .from(emailVerificationCodes)
      .where(and(
        eq(emailVerificationCodes.id, codeId),
        eq(emailVerificationCodes.userId, userId),
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.code, code),
        eq(emailVerificationCodes.verified, false),
        lt(emailVerificationCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
        gt(emailVerificationCodes.expiresAt, now)
      ))
      .limit(1)
      .for("update");
    if (!codeRows[0]) return null;

    const userRows = await tx
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.email, email),
        eq(users.loginMethod, "local"),
        eq(users.isEmailVerified, false)
      ))
      .limit(1)
      .for("update");
    const user = userRows[0];
    if (!user) return null;

    const consumed = await tx
      .delete(emailVerificationCodes)
      .where(and(
        eq(emailVerificationCodes.id, codeId),
        eq(emailVerificationCodes.userId, userId),
        eq(emailVerificationCodes.email, email),
        eq(emailVerificationCodes.code, code),
        eq(emailVerificationCodes.verified, false),
        lt(emailVerificationCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
        gt(emailVerificationCodes.expiresAt, now)
      ));
    const consumedHeader = (Array.isArray(consumed) ? consumed[0] : undefined) as { affectedRows?: number } | undefined;
    if (Number(consumedHeader?.affectedRows ?? 0) !== 1) return null;

    await tx.update(users)
      .set({ isEmailVerified: true, updatedAt: now })
      .where(and(eq(users.id, userId), eq(users.isEmailVerified, false)));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.delete(emailSendingRateLimits).where(and(
      eq(emailSendingRateLimits.userId, userId),
      eq(emailSendingRateLimits.email, email)
    ));
    return { id: user.id, email, name: user.name };
  });
}

/**
 * 根据验证码查询记录
 */
export async function getEmailVerificationCodeByCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(emailVerificationCodes)
    .where(eq(emailVerificationCodes.code, code))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 删除未投递的邮箱验证码
 */
export async function deleteEmailVerificationCodeByCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.code, code));
}

/**
 * 更新验证码的尝试次数
 */
export async function incrementVerificationCodeAttempts(codeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(emailVerificationCodes)
    .set({ attempts: sql`${emailVerificationCodes.attempts} + 1` })
    .where(and(
      eq(emailVerificationCodes.id, codeId),
      eq(emailVerificationCodes.verified, false),
      lt(emailVerificationCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
      gt(emailVerificationCodes.expiresAt, new Date())
    ));
}

/**
 * 标记验证码为已使用
 */
export async function markVerificationCodeAsUsed(codeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(emailVerificationCodes)
    .set({ 
      verified: true,
      updatedAt: new Date(),
    })
    .where(eq(emailVerificationCodes.id, codeId));
}

/**
 * 删除用户的所有邮箱验证码
 */
export async function deleteUserEmailVerificationCodes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, userId));
}

/**
 * 删除过期的验证码
 */
export async function deleteExpiredVerificationCodes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(emailVerificationCodes)
    .where(and(
      eq(emailVerificationCodes.verified, false),
      lte(emailVerificationCodes.expiresAt, new Date())
    ));
}


/**
 * 创建密码重置验证码
 */
export async function createPasswordResetCode(
  email: string,
  code: string,
  expiresAt: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const result = await db
    .insert(passwordResetCodes)
    .values({ email, code, expiresAt, attempts: 0, verified: false })
    .onDuplicateKeyUpdate({
      set: { code, expiresAt, attempts: 0, verified: false, updatedAt: now },
    });

  return result;
}

/**
 * 获取密码重置验证码
 */
export async function getPasswordResetCode(email: string, code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.email, email),
        eq(passwordResetCodes.code, code)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * 验证密码重置验证码
 */
export async function verifyPasswordResetCode(
  email: string,
  code: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(passwordResetCodes)
    .where(eq(passwordResetCodes.email, email))
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(1);
  const resetCode = result[0];
  const now = new Date();

  if (
    !resetCode ||
    resetCode.expiresAt <= now ||
    resetCode.verified ||
    resetCode.attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
  ) {
    return false;
  }

  if (resetCode.code !== code) {
    await incrementPasswordResetCodeAttempts(email);
    return false;
  }

  const updateResult = await db
    .update(passwordResetCodes)
    .set({ verified: true })
    .where(and(
      eq(passwordResetCodes.id, resetCode.id),
      eq(passwordResetCodes.code, code),
      eq(passwordResetCodes.verified, false),
      lt(passwordResetCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
      gt(passwordResetCodes.expiresAt, now)
    ));

  return Number((updateResult[0] as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

/**
 * 增加密码重置验证码尝试次数
 */
export async function incrementPasswordResetCodeAttempts(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(passwordResetCodes)
    .set({ attempts: sql`${passwordResetCodes.attempts} + 1` })
    .where(and(
      eq(passwordResetCodes.email, email),
      eq(passwordResetCodes.verified, false),
      lt(passwordResetCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
      gt(passwordResetCodes.expiresAt, new Date())
    ));
}

/** Validate a reset OTP, count failures and update the account password atomically. */
export async function completePasswordResetWithCode(
  email: string,
  code: string,
  passwordHash: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(passwordResetCodes)
      .where(eq(passwordResetCodes.email, email))
      .limit(1)
      .for("update");
    const resetCode = rows[0];
    if (
      !resetCode ||
      resetCode.expiresAt <= now ||
      resetCode.verified ||
      resetCode.attempts >= MAX_VERIFICATION_CODE_ATTEMPTS
    ) {
      return false;
    }

    if (resetCode.code !== code) {
      await tx
        .update(passwordResetCodes)
        .set({ attempts: sql`${passwordResetCodes.attempts} + 1`, updatedAt: now })
        .where(and(
          eq(passwordResetCodes.id, resetCode.id),
          eq(passwordResetCodes.verified, false),
          lt(passwordResetCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
          gt(passwordResetCodes.expiresAt, now)
        ));
      return false;
    }

    const userRows = await tx
      .select()
      .from(users)
      .where(and(
        eq(users.email, email),
        eq(users.loginMethod, "local"),
        eq(users.isEmailVerified, true)
      ))
      .limit(1)
      .for("update");
    const user = userRows[0];

    const consumed = await tx
      .update(passwordResetCodes)
      .set({ verified: true, updatedAt: now })
      .where(and(
        eq(passwordResetCodes.id, resetCode.id),
        eq(passwordResetCodes.code, code),
        eq(passwordResetCodes.verified, false),
        lt(passwordResetCodes.attempts, MAX_VERIFICATION_CODE_ATTEMPTS),
        gt(passwordResetCodes.expiresAt, now)
      ));
    const consumedHeader = (Array.isArray(consumed) ? consumed[0] : undefined) as { affectedRows?: number } | undefined;
    if (Number(consumedHeader?.affectedRows ?? 0) !== 1) return false;
    if (!user) return false;

    const updated = await tx
      .update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now,
      })
      .where(and(
        eq(users.id, user.id),
        eq(users.loginMethod, "local"),
        eq(users.isEmailVerified, true)
      ));
    const updatedHeader = (Array.isArray(updated) ? updated[0] : undefined) as { affectedRows?: number } | undefined;
    if (Number(updatedHeader?.affectedRows ?? 0) !== 1) {
      return false;
    }

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt)
      ));

    return true;
  });
}

/**
 * 删除密码重置验证码
 */
export async function deletePasswordResetCode(email: string, code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.email, email),
        eq(passwordResetCodes.code, code)
      )
    );
}

/**
 * 删除过期的密码重置验证码
 */
export async function deleteExpiredPasswordResetCodes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.verified, false),
        lte(passwordResetCodes.expiresAt, new Date())
      )
    );
}


// ============ User Profile Update ============

export async function updateUser(userId: number, updates: Record<string, any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 获取更新后的用户
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (result.length === 0) {
      throw new Error("User not found");
    }

    return result[0];
  } catch (error) {
    if (!isDuplicateDatabaseEntry(error)) {
      console.error("[Database] Update user error:", error);
    }
    throw error;
  }
}


/**
 * 通过微信ID获取用户
 * @param wechatId 微信OpenID
 * @returns 用户对象，如果不存在则返回undefined
 */
export async function getUserByWeChatId(wechatId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.select().from(users).where(eq(users.wechatId, wechatId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get user by WeChat ID:", error);
    throw error;
  }
}

export async function getUserByQQId(qqId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.select().from(users).where(eq(users.qqId, qqId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get user by QQ ID:", error);
    throw error;
  }
}

export async function getUserByDouyinId(douyinId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db.select().from(users).where(eq(users.douyinId, douyinId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get user by Douyin ID:", error);
    throw error;
  }
}


// ============ Answer Cards Functions ============

export async function upsertAnswerCardMetadata(
  cardNumber: number,
  storageKey: string,
  storageUrl: string,
  generatedAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.insert(answerCardsMetadata).values({
      cardNumber,
      storageKey,
      storageUrl,
      generatedAt,
    }).onDuplicateKeyUpdate({
      set: {
        storageKey,
        storageUrl,
        generatedAt,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert answer card metadata:", error);
    throw error;
  }
}

export async function getAnswerCardMetadata(cardNumber: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db
      .select()
      .from(answerCardsMetadata)
      .where(eq(answerCardsMetadata.cardNumber, cardNumber))
      .limit(1);
    
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get answer card metadata:", error);
    throw error;
  }
}

export async function getAllAnswerCardsMetadata() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db
      .select()
      .from(answerCardsMetadata)
      .orderBy(asc(answerCardsMetadata.cardNumber));
    
    return result;
  } catch (error) {
    console.error("[Database] Failed to get all answer cards metadata:", error);
    throw error;
  }
}

export async function isAnswerCardsInitialized(): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const result = await db
      .select({ count: count() })
      .from(answerCardsMetadata);
    
    return (result[0]?.count || 0) === 80;
  } catch (error) {
    console.error("[Database] Failed to check answer cards initialization:", error);
    throw error;
  }
}

/** Atomically acquire or reclaim an expired cross-instance generation lease. */
export async function acquireAnswerCardGenerationLock(
  lockName: string,
  ownerToken: string,
  leaseMilliseconds = 15 * 60 * 1000
): Promise<boolean> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  if (!/^[a-z0-9:-]{1,64}$/.test(lockName) || !/^[a-zA-Z0-9-]{16,64}$/.test(ownerToken)) {
    throw new Error("Invalid answer-card generation lock identity");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMilliseconds);
  try {
    await database.insert(answerCardGenerationLocks).values({ lockName, ownerToken, expiresAt });
    return true;
  } catch (error) {
    let current = error as { code?: string; errno?: number; cause?: unknown } | null;
    let duplicateKey = false;
    while (current) {
      if (current.code === "ER_DUP_ENTRY" || current.errno === 1062) {
        duplicateKey = true;
        break;
      }
      current = current.cause as typeof current;
    }
    if (!duplicateKey) throw error;
  }

  await database
    .update(answerCardGenerationLocks)
    .set({ ownerToken, expiresAt })
    .where(and(
      eq(answerCardGenerationLocks.lockName, lockName),
      lte(answerCardGenerationLocks.expiresAt, now)
    ));

  const claimed = await database
    .select({ ownerToken: answerCardGenerationLocks.ownerToken })
    .from(answerCardGenerationLocks)
    .where(and(
      eq(answerCardGenerationLocks.lockName, lockName),
      eq(answerCardGenerationLocks.ownerToken, ownerToken)
    ))
    .limit(1);
  return claimed.length > 0;
}

/** Release only the lease owned by this generator; never delete a successor's lock. */
export async function releaseAnswerCardGenerationLock(
  lockName: string,
  ownerToken: string
): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database
    .delete(answerCardGenerationLocks)
    .where(and(
      eq(answerCardGenerationLocks.lockName, lockName),
      eq(answerCardGenerationLocks.ownerToken, ownerToken)
    ));
}
