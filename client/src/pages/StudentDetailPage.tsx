import { useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { QuestionPreviewCard } from "@/components/QuestionPreviewCard";

interface StudentDetailPageProps {
  sessionId: number;
  studentId: number;
  studentName: string;
  onBack: () => void;
}

interface StudentAnswerDetail {
  questionId: number;
  orderIndex: number;
  questionText: string;
  correctAnswer: string;
  studentAnswer?: string;
  isCorrect?: boolean;
}

export function StudentDetailPage({
  sessionId,
  studentId,
  studentName,
  onBack,
}: StudentDetailPageProps) {
  // 获取会话队列（包含题目）
  const { data: sessionQueue } = trpc.sessions.getQueueWithQuestions.useQuery({
    sessionId,
  });

  // 获取会话中所有题目的学生答案
  const { data: questionsWithAnswers } = trpc.answers.getSessionQuestionsWithStudentAnswers.useQuery({
    sessionId,
  });

  // 处理数据，提取该学生的答题记录
  const studentAnswers = useMemo(() => {
    if (!questionsWithAnswers) return [];

    const answers: StudentAnswerDetail[] = [];

    for (const question of questionsWithAnswers) {
      // 遍历所有选项，找到该学生的答案
      let foundAnswer: string | null = null;

      for (const [option, students] of Object.entries(question.studentsByOption || {})) {
        const studentFound = (students as any[]).find((s: any) => s.studentId === studentId);
        if (studentFound) {
          foundAnswer = option;
          break;
        }
      }

      answers.push({
        questionId: question.questionId,
        orderIndex: question.orderIndex,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        studentAnswer: foundAnswer || undefined,
        isCorrect: foundAnswer === question.correctAnswer,
      });
    }

    return answers;
  }, [questionsWithAnswers, studentId]);

  const correctCount = studentAnswers.filter((a) => a.isCorrect).length;
  const totalCount = studentAnswers.length;
  const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  const getAnswerStatusColor = (isCorrect?: boolean) => {
    if (isCorrect === undefined) return "bg-gray-100 text-gray-700";
    return isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  };

  const getAnswerStatusText = (isCorrect?: boolean) => {
    if (isCorrect === undefined) return "未答";
    return isCorrect ? "正确" : "错误";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{studentName} 的答题详情</h1>
              <p className="text-sm text-gray-600 mt-1">
                正确率: {correctCount}/{totalCount} ({correctRate}%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {studentAnswers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            暂无答题记录
          </div>
        ) : (
          <div className="space-y-6">
            {studentAnswers.map((answer) => {
              // 从 sessionQueue 中找到对应的题目详情
              const questionDetail = sessionQueue?.find(
                (q) => q.questionId === answer.questionId
              );

              return (
                <Card key={answer.questionId} className="p-6">
                  <div className="space-y-4">
                    {/* 题号和正确率标签 */}
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold">
                        第 {answer.orderIndex + 1} 题
                      </h3>
                      <div
                        className={`flex-shrink-0 px-3 py-1 rounded text-sm font-semibold whitespace-nowrap ${getAnswerStatusColor(
                          answer.isCorrect
                        )}`}
                      >
                        {getAnswerStatusText(answer.isCorrect)}
                      </div>
                    </div>

                    {/* 题目预览 */}
                    {questionDetail && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <QuestionPreviewCard
                          questionNumber={0}
                          questionContent={answer.questionText}
                          questionImage={questionDetail.question?.questionMediaUrl || undefined}
                          options={[
                            { label: 'A', content: questionDetail.question?.optionA || '', image: questionDetail.question?.optionAMediaUrl || undefined, isCorrect: 'A' === answer.correctAnswer },
                            { label: 'B', content: questionDetail.question?.optionB || '', image: questionDetail.question?.optionBMediaUrl || undefined, isCorrect: 'B' === answer.correctAnswer },
                            { label: 'C', content: questionDetail.question?.optionC || '', image: questionDetail.question?.optionCMediaUrl || undefined, isCorrect: 'C' === answer.correctAnswer },
                            { label: 'D', content: questionDetail.question?.optionD || '', image: questionDetail.question?.optionDMediaUrl || undefined, isCorrect: 'D' === answer.correctAnswer },
                          ]}
                          onClick={() => {}}
                        />
                      </div>
                    )}

                    {/* 答题情况 */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 font-medium">正确答案</p>
                        <p className="text-gray-900 font-semibold mt-1">
                          {answer.correctAnswer}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">学生答案</p>
                        <p className="text-gray-900 font-semibold mt-1">
                          {answer.studentAnswer || "未答"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
