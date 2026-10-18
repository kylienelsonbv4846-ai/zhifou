import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { 
  createClass, 
  createStudent, 
  createQuestionSet, 
  createQuestion,
  createSession,
  addToSessionQueue,
  recordAnswer,
  getClassStatistics,
  getClassSessionsData,
  getStudentsByClass,
  getDb
} from "./db";

describe("Class Data Export Functions", () => {
  let testClassId: number;
  let testStudentIds: number[] = [];
  let testSessionId: number;
  let testQuestionSetId: number;
  let testQuestionIds: number[] = [];
  
  const teacherId = 1; // Assuming teacher ID 1 exists

  beforeAll(async () => {
    // Create a test class
    testClassId = await createClass({
      teacherId,
      name: "Test Class for Export",
      description: "Test class for export functionality",
    });

    // Create test students
    for (let i = 1; i <= 3; i++) {
      const studentId = await createStudent({
        classId: testClassId,
        name: `Test Student ${i}`,
        cardNumber: i,
      });
      testStudentIds.push(studentId);
    }

    // Create a question set
    testQuestionSetId = await createQuestionSet({
      teacherId,
      title: "Test Question Set",
      description: "Test question set for export",
    });

    // Create test questions
    for (let i = 1; i <= 2; i++) {
      const questionId = await createQuestion({
        setId: testQuestionSetId,
        questionText: `Test Question ${i}`,
        questionType: "single_choice",
        optionA: "Option A",
        optionB: "Option B",
        optionC: "Option C",
        optionD: "Option D",
        correctAnswer: i === 1 ? "A" : "B",
        orderIndex: i - 1,
      });
      testQuestionIds.push(questionId);
    }

    // Create a test session
    testSessionId = await createSession({
      teacherId,
      classId: testClassId,
      setId: testQuestionSetId,
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
    });

    // Add questions to session queue
    for (let i = 0; i < testQuestionIds.length; i++) {
      await addToSessionQueue({
        sessionId: testSessionId,
        questionId: testQuestionIds[i],
        orderIndex: i,
      });
    }

    // Record answers from students
    // Student 1: All correct
    await recordAnswer({
      sessionId: testSessionId,
      questionId: testQuestionIds[0],
      studentId: testStudentIds[0],
      answer: "A",
      isCorrect: true,
    });
    await recordAnswer({
      sessionId: testSessionId,
      questionId: testQuestionIds[1],
      studentId: testStudentIds[0],
      answer: "B",
      isCorrect: true,
    });

    // Student 2: Mixed correct/incorrect
    await recordAnswer({
      sessionId: testSessionId,
      questionId: testQuestionIds[0],
      studentId: testStudentIds[1],
      answer: "B",
      isCorrect: false,
    });
    await recordAnswer({
      sessionId: testSessionId,
      questionId: testQuestionIds[1],
      studentId: testStudentIds[1],
      answer: "B",
      isCorrect: true,
    });

    // Student 3: All incorrect
    await recordAnswer({
      sessionId: testSessionId,
      questionId: testQuestionIds[0],
      studentId: testStudentIds[2],
      answer: "C",
      isCorrect: false,
    });
    await recordAnswer({
      sessionId: testSessionId,
      questionId: testQuestionIds[1],
      studentId: testStudentIds[2],
      answer: "A",
      isCorrect: false,
    });
  });

  it("should get class statistics correctly", async () => {
    const stats = await getClassStatistics(testClassId);
    
    expect(stats).toBeDefined();
    expect(stats?.className).toBe("Test Class for Export");
    expect(stats?.studentCount).toBe(3);
    expect(stats?.sessionCount).toBe(1);
    expect(stats?.totalAnswers).toBe(6); // 3 students * 2 questions
    expect(stats?.correctAnswers).toBe(3); // Student 1: 2 correct, Student 2: 1 correct, Student 3: 0 correct
    expect(stats?.accuracy).toBe(50); // 3/6 = 50%
    expect(stats?.topStudent?.name).toBe("Test Student 1");
    expect(stats?.topStudent?.accuracy).toBe(100);
    expect(stats?.bottomStudent?.name).toBe("Test Student 3");
    expect(stats?.bottomStudent?.accuracy).toBe(0);
  });

  it("should get class sessions data correctly", async () => {
    const sessionsData = await getClassSessionsData(testClassId);
    
    expect(sessionsData).toBeDefined();
    expect(sessionsData.length).toBeGreaterThan(0);
    
    const sessionData = sessionsData[0];
    expect(sessionData.sessionId).toBe(testSessionId);
    expect(sessionData.answers).toBeDefined();
    expect(sessionData.answers.length).toBe(6);
    expect(sessionData.questions).toBeDefined();
    expect(sessionData.questions.length).toBe(2);
  });

  it("should get students by class correctly", async () => {
    const students = await getStudentsByClass(testClassId);
    
    expect(students).toBeDefined();
    expect(students.length).toBe(3);
    expect(students[0].name).toBe("Test Student 1");
    expect(students[0].cardNumber).toBe(1);
  });

  it("should calculate question-level statistics correctly", async () => {
    const sessionsData = await getClassSessionsData(testClassId);
    const sessionData = sessionsData[0];
    
    // Question 1: Student 1 correct, Student 2 incorrect, Student 3 incorrect = 33% correct rate
    const question1Answers = sessionData.answers.filter((a: any) => a.questionId === testQuestionIds[0]);
    const question1Correct = question1Answers.filter((a: any) => a.isCorrect).length;
    expect(question1Correct).toBe(1); // Only Student 1 correct
    expect(Math.round((question1Correct / question1Answers.length) * 100)).toBe(33);
    
    // Question 2: Student 1 correct, Student 2 correct, Student 3 incorrect = 67% correct rate
    const question2Answers = sessionData.answers.filter((a: any) => a.questionId === testQuestionIds[1]);
    const question2Correct = question2Answers.filter((a: any) => a.isCorrect).length;
    expect(question2Correct).toBe(2); // Student 1 and Student 2 correct
    expect(Math.round((question2Correct / question2Answers.length) * 100)).toBe(67);
  });

  afterAll(async () => {
    // Cleanup is handled by the database transaction
    // In a real scenario, you might want to delete test data
  });
});
