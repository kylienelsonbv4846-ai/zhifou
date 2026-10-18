import { TRPCError } from "@trpc/server";
import * as db from "./db";

function inaccessible(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "资源不存在或无权访问" });
}

export async function requireOwnedClass(teacherId: number, classId: number) {
  const classRecord = await db.getClassById(classId);
  if (!classRecord || classRecord.teacherId !== teacherId) inaccessible();
  return classRecord;
}

export async function getOwnedClassOrUndefined(teacherId: number, classId: number) {
  const classRecord = await db.getClassById(classId);
  if (classRecord && classRecord.teacherId !== teacherId) inaccessible();
  return classRecord;
}

export async function requireOwnedStudent(teacherId: number, studentId: number) {
  const student = await db.getStudentById(studentId);
  if (!student) inaccessible();
  await requireOwnedClass(teacherId, student.classId);
  return student;
}

export async function requireOwnedFolder(teacherId: number, folderId: number | null | undefined) {
  if (folderId == null) return null;
  const folder = await db.getQuestionFolderById(folderId);
  if (!folder || folder.teacherId !== teacherId) inaccessible();
  return folder;
}

export async function requireOwnedQuestionSet(teacherId: number, setId: number) {
  const set = await db.getQuestionSetById(setId);
  if (!set || set.teacherId !== teacherId) inaccessible();
  await requireOwnedFolder(teacherId, set.folderId);
  return set;
}

export async function requireOwnedQuestion(teacherId: number, questionId: number) {
  const question = await db.getQuestionById(questionId);
  if (!question) inaccessible();
  await requireOwnedQuestionSet(teacherId, question.setId);
  return question;
}

export async function requireOwnedSession(teacherId: number, sessionId: number) {
  const session = await db.getSessionById(sessionId);
  if (!session || session.teacherId !== teacherId) inaccessible();
  const classRecord = await db.getClassById(session.classId);
  const questionSet = await db.getQuestionSetById(session.setId);
  if (
    !classRecord ||
    classRecord.teacherId !== teacherId ||
    !questionSet ||
    questionSet.teacherId !== teacherId
  ) {
    inaccessible();
  }
  return session;
}

export async function requireQuestionInOwnedSession(
  teacherId: number,
  sessionId: number,
  questionId: number
) {
  const session = await requireOwnedSession(teacherId, sessionId);
  const queue = await db.getSessionQueue(sessionId);
  if (!queue.some(item => item.questionId === questionId)) inaccessible();
  const question = await requireOwnedQuestion(teacherId, questionId);
  if (question.setId !== session.setId) inaccessible();
  return { session, question, queue };
}
