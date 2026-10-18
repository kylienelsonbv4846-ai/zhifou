import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface StudentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  studentName: string;
  sessionId: number;
}

interface StudentAnswer {
  questionId: number;
  orderIndex: number;
  questionText: string;
  questionType: string;
  correctAnswer: string;
  studentAnswer?: string;
  isCorrect?: boolean;
}

export function StudentDetailDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  sessionId,
}: StudentDetailDialogProps) {
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 获取会话中所有题目的学生答案
  const { data: questionsWithAnswers } = trpc.answers.getSessionQuestionsWithStudentAnswers.useQuery(
    { sessionId },
    { enabled: open }
  );

  useEffect(() => {
    if (!questionsWithAnswers || !open) return;

    setIsLoading(true);
    try {
      // 从 questionsWithAnswers 中提取该学生的答案
      const answers: StudentAnswer[] = [];

      for (const question of questionsWithAnswers) {
        const studentRecord = (question.studentsByAnswer || []).find(
          (answer: any) => answer.studentId === studentId
        );
        const foundAnswer: string | null = studentRecord?.answer ?? null;
        const normalize = (answer: string) => question.questionType === "multiple_choice"
          ? answer.toUpperCase().split("").sort().join("")
          : answer.toUpperCase();

        answers.push({
          questionId: question.questionId,
          orderIndex: question.orderIndex,
          questionText: question.questionText,
          questionType: question.questionType,
          correctAnswer: question.correctAnswer,
          studentAnswer: foundAnswer || undefined,
          isCorrect: foundAnswer ? normalize(foundAnswer) === normalize(question.correctAnswer) : undefined,
        });
      }

      setStudentAnswers(answers);
    } finally {
      setIsLoading(false);
    }
  }, [questionsWithAnswers, studentId, open]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>{studentName} 的答题记录</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              正确率: {correctCount}/{totalCount} ({correctRate}%)
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : studentAnswers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无答题记录
          </div>
        ) : (
          <div className="space-y-3">
            {studentAnswers.map((answer) => (
              <Card key={answer.questionId} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-2">
                      第 {answer.orderIndex + 1} 题: {answer.questionText}
                    </p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>
                        <span className="font-semibold">正确答案:</span> {answer.correctAnswer}
                      </p>
                      <p>
                        <span className="font-semibold">学生答案:</span>{" "}
                        {answer.studentAnswer || "未答"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex-shrink-0 px-3 py-1 rounded text-xs font-semibold whitespace-nowrap ${getAnswerStatusColor(
                      answer.isCorrect
                    )}`}
                  >
                    {getAnswerStatusText(answer.isCorrect)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
