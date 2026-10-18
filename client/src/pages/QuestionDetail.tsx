import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BarChart3, PieChart } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

interface QuestionDetailProps {
  sessionId: string;
  questionId: number;
  questionNumber: number;
  totalQuestions: number;
  currentQuestionIndex: number;
  onBack: () => void;
  onNavigateQuestion: (questionNumber: number) => void;
}

export function QuestionDetail({ sessionId, questionId, questionNumber, totalQuestions, currentQuestionIndex, onBack, onNavigateQuestion }: QuestionDetailProps) {
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // 获取当前选中题目的统计数据
  const { data: sessionStats } = trpc.answers.getStatistics.useQuery({
    sessionId: parseInt(sessionId),
    questionId: questionId,
  });

  // 获取当前选中题目的答题详情
  const { data: answerDetails } = trpc.answers.getAnswerDetails.useQuery({
    sessionId: parseInt(sessionId),
    questionId: questionId,
  });

  // 获取当前选中题目的详情
  const { data: questionDetail } = trpc.questions.get.useQuery({
    questionId: questionId,
  });

  const chartData = useMemo(() => {
    if (!sessionStats) return null;
    const stats = sessionStats as any;

    // Determine which option is correct
    const correctAnswer = questionDetail?.correctAnswer;
    const getColor = (option: string, isBackground: boolean) => {
      const isCorrect = questionDetail?.questionType === "multiple_choice"
        ? correctAnswer?.toUpperCase().includes(option)
        : correctAnswer === option;
      const alpha = isBackground ? "0.8" : "1";
      
      if (isCorrect) {
        return `rgba(34, 197, 94, ${alpha})`; // 绿色
      }
      
      const colors: Record<string, string> = {
        A: `rgba(239, 68, 68, ${alpha})`,    // 橙红色
        B: `rgba(147, 51, 234, ${alpha})`,    // 紫色
        C: `rgba(249, 115, 22, ${alpha})`,    // 橙色
        D: `rgba(6, 182, 212, ${alpha})`,     // 青色
      };
      return colors[option] || colors.A;
    };

    return {
      labels: ["选项 A", "选项 B", "选项 C", "选项 D"],
      datasets: [
        {
          label: "答题人数",
          data: [stats.a || 0, stats.b || 0, stats.c || 0, stats.d || 0],
          backgroundColor: [
            getColor("A", true),
            getColor("B", true),
            getColor("C", true),
            getColor("D", true),
          ],
          borderColor: [
            getColor("A", false),
            getColor("B", false),
            getColor("C", false),
            getColor("D", false),
          ],
          borderWidth: 2,
        },
      ],
    };
  }, [sessionStats, questionDetail?.correctAnswer, questionDetail?.questionType]);

  return (
    <div className="space-y-4">
      {/* 返回按钮、标题和题目导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">第{questionNumber}题</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => onNavigateQuestion(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
          >
            上一题
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentQuestionIndex + 1} / {totalQuestions}
          </span>
          <Button
            variant="outline"
            onClick={() => onNavigateQuestion(currentQuestionIndex + 1)}
            disabled={currentQuestionIndex === totalQuestions - 1}
          >
            下一题
          </Button>
        </div>
      </div>

      {/* 主容器：题目内容（2/3）+ 统计数据（1/3） */}
      <div className="grid grid-cols-3 gap-4">
        {/* 题目内容 - 占据左侧 2/3 */}
        <div className="col-span-2 space-y-4">
          {questionDetail ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">题目内容</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* 题目文本 */}
                <div>
                  <p className="text-base text-gray-700 dark:text-gray-300">
                    {questionDetail.questionText}
                  </p>
                </div>

                {/* 题目图片 */}
                {questionDetail.questionMediaUrl && (
                  <div className="mb-4">
                    <img
                      src={questionDetail.questionMediaUrl}
                      alt="题目图片"
                      className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-80"
                      onClick={(e) => {
                        const img = e.currentTarget;
                        if (img.style.transform === "scale(2)") {
                          img.style.transform = "scale(1)";
                          img.style.cursor = "pointer";
                        } else {
                          img.style.transform = "scale(2)";
                          img.style.cursor = "pointer";
                          img.style.transformOrigin = "top center";
                        }
                      }}
                    />
                  </div>
                )}

                {/* 选项 */}
                <div>
                  <h3 className="font-semibold mb-3">选项</h3>
                  <div className="space-y-2">
                    {["A", "B", "C", "D"].map((option) => {
                      const optionContent = questionDetail[`option${option}` as keyof typeof questionDetail];
                      const optionImage = questionDetail[`option${option}MediaUrl` as keyof typeof questionDetail];
                      const isCorrect = questionDetail.questionType === "multiple_choice"
                        ? questionDetail.correctAnswer.toUpperCase().includes(option)
                        : questionDetail.correctAnswer === option;

                      return optionContent ? (
                        <div
                          key={option}
                          className={`p-3 rounded-lg border-2 ${
                            isCorrect
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <div className="font-medium">
                            {option}. {String(optionContent)}
                            {isCorrect && <span className="ml-2 text-green-600">✓ 正确答案</span>}
                          </div>
                          {optionImage && (
                            <img
                              src={String(optionImage)}
                              alt={`选项 ${option}`}
                              className="mt-2 max-w-full h-auto rounded cursor-pointer hover:opacity-80"
                              onClick={(e) => {
                                const img = e.currentTarget;
                                if (img.style.transform === "scale(2)") {
                                  img.style.transform = "scale(1)";
                                } else {
                                  img.style.transform = "scale(2)";
                                  img.style.transformOrigin = "top center";
                                }
                              }}
                            />
                          )}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                加载中...
              </CardContent>
            </Card>
          )}
        </div>

        {/* 统计数据 - 占据右侧 1/3 */}
        <div className="col-span-1 space-y-4">
          {sessionStats && answerDetails ? (
            <>
              {/* 统计数据卡片 - 显示已答题、未答题、正确率 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">统计数据</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex justify-around items-center gap-2">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-blue-600">
                        {(sessionStats as any).answered}
                      </div>
                      <div className="text-xs text-muted-foreground">已答题</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-red-600">
                        {(sessionStats as any).unanswered}
                      </div>
                      <div className="text-xs text-muted-foreground">未答题</div>
                    </div>
                    <div className="text-center flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                      <div className="text-2xl font-bold text-purple-600">
                        {(sessionStats as any).correctRate}%
                      </div>
                      <div className="text-xs text-muted-foreground">正确率</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 备选答案分布 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">备选答案分布</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {["A", "B", "C", "D"].map((option) => {
                    const count = (answerDetails as any)[option]?.length || 0;
                    const students = (answerDetails as any)[option]?.map((s: any) => s.studentName).join("、") || "-";
                    const isCorrect = questionDetail?.questionType === "multiple_choice"
                      ? questionDetail.correctAnswer?.toUpperCase().includes(option)
                      : questionDetail?.correctAnswer === option;
                    
                    const optionColors: Record<string, { bg: string; text: string; label: string }> = {
                      A: isCorrect 
                        ? { bg: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", label: "选项 A" }
                        : { bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300", label: "选项 A" },
                      B: isCorrect 
                        ? { bg: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", label: "选项 B" }
                        : { bg: "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", label: "选项 B" },
                      C: isCorrect 
                        ? { bg: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", label: "选项 C" }
                        : { bg: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", label: "选项 C" },
                      D: isCorrect 
                        ? { bg: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", label: "选项 D" }
                        : { bg: "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300", label: "选项 D" },
                    };

                    const colors = optionColors[option];
                    return (
                      <div key={option} className={`border rounded-lg p-3 ${colors.bg}`}>
                        <div className={`font-bold text-sm ${colors.text} mb-1`}>
                          {colors.label}
                        </div>
                        <div className="text-sm font-semibold text-foreground mb-1">
                          {count} 人
                        </div>
                        <div className="text-xs text-muted-foreground break-words">
                          {students}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* 图表切换按钮 */}
              <div className="flex gap-2">
                <Button
                  variant={chartType === "bar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartType("bar")}
                  className="flex-1"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  柱状图
                </Button>
                <Button
                  variant={chartType === "pie" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChartType("pie")}
                  className="flex-1"
                >
                  <PieChart className="h-4 w-4 mr-1" />
                  饼图
                </Button>
              </div>

              {/* 答题分布表 */}
              {chartData && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">答题分布表</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartType === "bar" ? (
                      <Bar
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          plugins: {
                            legend: {
                              display: false,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: Math.max(
                                (sessionStats as any).a || 0,
                                (sessionStats as any).b || 0,
                                (sessionStats as any).c || 0,
                                (sessionStats as any).d || 0
                              ) * 1.2,
                            },
                          },
                        }}
                      />
                    ) : (
                      <Pie
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          plugins: {
                            legend: {
                              position: "bottom" as const,
                            },
                          },
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground text-sm">
                加载统计数据中...
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
