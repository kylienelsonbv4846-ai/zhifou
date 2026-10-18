import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Download, TrendingUp, User, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { toast } from "sonner";

// 注册 Chart.js 组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function StudentReports() {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // 获取所有班级
  const { data: classes } = trpc.classes.list.useQuery();

  // 获取班级学生
  const { data: students } = trpc.students.list.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId }
  );

  // 获取学生答题记录
  const { data: studentAnswers } = trpc.answers.getStudentAnswers.useQuery(
    { studentId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  // 计算学生统计数据
  const studentStats = useMemo(() => {
    if (!studentAnswers || studentAnswers.length === 0) {
      return {
        totalAnswered: 0,
        totalCorrect: 0,
        correctRate: 0,
        bySession: {} as Record<number, { answered: number; correct: number }>,
      };
    }

    let totalCorrect = 0;
    const bySession: Record<number, { answered: number; correct: number }> = {};

    for (const answer of studentAnswers) {
      if (answer.isCorrect) totalCorrect++;
      
      if (!bySession[answer.sessionId]) {
        bySession[answer.sessionId] = { answered: 0, correct: 0 };
      }
      bySession[answer.sessionId].answered++;
      if (answer.isCorrect) {
        bySession[answer.sessionId].correct++;
      }
    }

    const correctRate = studentAnswers.length > 0 
      ? Math.round((totalCorrect / studentAnswers.length) * 100)
      : 0;

    return {
      totalAnswered: studentAnswers.length,
      totalCorrect,
      correctRate,
      bySession,
    };
  }, [studentAnswers]);

  // 准备进度趋势图表数据
  const progressChartData = useMemo(() => {
    if (!studentAnswers || studentAnswers.length === 0) return null;

    // 按时间排序答案
    const sortedAnswers = [...studentAnswers].sort(
      (a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime()
    );

    // 计算累积正确率
    let cumulativeCorrect = 0;
    const labels: string[] = [];
    const correctRates: number[] = [];

    sortedAnswers.forEach((answer, index) => {
      if (answer.isCorrect) cumulativeCorrect++;
      const rate = Math.round((cumulativeCorrect / (index + 1)) * 100);
      labels.push(`第 ${index + 1} 题`);
      correctRates.push(rate);
    });

    return {
      labels,
      datasets: [
        {
          label: "累积正确率 (%)",
          data: correctRates,
          borderColor: "rgba(147, 51, 234, 1)",
          backgroundColor: "rgba(147, 51, 234, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "rgba(147, 51, 234, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [studentAnswers]);

  // 处理数据导出为Excel
  const handleExportExcel = async () => {
    if (!studentAnswers || !students) return;

    const student = students.find((s: any) => s.id === selectedStudentId);
    if (!student) return;

    try {
      // 计算学生参与的有效会话数
      const uniqueSessions = new Set(studentAnswers.map((answer: any) => answer.sessionId));
      const totalSessions = uniqueSessions.size;

      // 调用后端 API 来生成 Excel 文件
      const response = await fetch('/api/export-student-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: selectedStudentId,
          studentName: student.name,
          studentAnswers: studentAnswers,
          studentStats: {
            totalAnswered: studentStats.totalAnswered,
            totalCorrect: studentStats.totalCorrect,
            correctRate: studentStats.correctRate,
          },
          totalSessions: totalSessions,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 获取 blob 并下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-report-${student.name}-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出Excel失败:', error);
      toast.error("导出 Excel 失败: " + (error instanceof Error ? error.message : "请稍后重试"));
    }
  };

  // 处理班级数据导出
  const handleExportClassData = async () => {
    if (!selectedClassId) return;

    try {
      // 调用后端 API 来生成班级 Excel 文件
      const response = await fetch('/api/export-class-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: selectedClassId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 获取 blob 并下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const selectedClass = classes?.find((c: any) => c.id === selectedClassId);
      link.download = `class-report-${selectedClass?.name || 'class'}-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出班级数据失败:', error);
      toast.error("导出班级数据失败: " + (error instanceof Error ? error.message : "请稍后重试"));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">学生个人报告</h1>

        {/* 班级选择 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>选择班级</CardTitle>
            {selectedClassId && (
              <Button
                onClick={() => handleExportClassData()}
                size="sm"
                className="gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                导出班级数据
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {classes && classes.length > 0 ? (
                classes.map((cls: any) => (
                  <Button
                    key={cls.id}
                    variant={selectedClassId === cls.id ? "default" : "outline"}
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setSelectedStudentId(null);
                    }}
                    className="text-sm"
                  >
                    {cls.name}
                  </Button>
                ))
              ) : (
                <p className="text-muted-foreground">暂无班级数据</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 学生选择 */}
        {selectedClassId && students && students.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>选择学生</CardTitle>
              {selectedStudentId && (
                <Button onClick={handleExportExcel} className="gap-2" variant="default" size="sm">
                  <FileSpreadsheet className="w-4 h-4" />
                  导出为 Excel
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {students.map((student: any) => (
                  <Button
                    key={student.id}
                    variant={selectedStudentId === student.id ? "default" : "outline"}
                    onClick={() => setSelectedStudentId(student.id)}
                    className="text-sm"
                  >
                    {student.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 学生统计 */}
        {selectedStudentId && studentAnswers ? (
          <>
            {/* 总体统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    总答题数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {studentStats.totalAnswered}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    正确数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {studentStats.totalCorrect}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    正确率
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {studentStats.correctRate}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 进度趋势图 */}
            {progressChartData && (
              <Card>
                <CardHeader>
                  <CardTitle>答题进度趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <Line
                      data={progressChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: true,
                          },
                          title: {
                            display: true,
                            text: "累积正确率趋势",
                            font: {
                              size: 16,
                            },
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                              callback: function (value) {
                                return value + "%";
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 答题详情 */}
            <Card>
              <CardHeader>
                <CardTitle>答题详情</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">题号</th>
                        <th className="text-left py-2 px-3">会话</th>
                        <th className="text-left py-2 px-3">答案</th>
                        <th className="text-left py-2 px-3">结果</th>
                        <th className="text-left py-2 px-3">提交时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentAnswers.map((answer: any, index: number) => (
                        <tr key={answer.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3">{index + 1}</td>
                          <td className="py-2 px-3">#{answer.sessionId}</td>
                          <td className="py-2 px-3 font-semibold">
                            {answer.answer.toUpperCase()}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              {answer.isCorrect ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-green-600">正确</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 text-red-600" />
                                  <span className="text-red-600">错误</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {new Date(answer.answeredAt).toLocaleString("zh-CN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>


          </>
        ) : selectedClassId && students && students.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>选择一个学生查看详细的答题报告</p>
              </div>
            </CardContent>
          </Card>
        ) : selectedClassId ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <p>该班级暂无学生数据</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>选择一个班级查看学生报告</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
