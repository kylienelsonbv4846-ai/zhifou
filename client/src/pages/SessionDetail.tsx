import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Download, ArrowLeft, BarChart3, PieChart, FileDown } from "lucide-react";
import { QuestionPreviewCard } from "@/components/QuestionPreviewCard";
import { StudentOverview } from "@/components/StudentOverview";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
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
import { useState, useMemo } from "react";

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

interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
  onSelectQuestion?: (questionId: number, questionNumber: number) => void;
  onSelectStudent?: (studentId: number, studentName: string) => void;
}

export function SessionDetail({ sessionId, onBack, onSelectQuestion, onSelectStudent }: SessionDetailProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // 获取会话详情
  const { data: session } = trpc.sessions.get.useQuery({ sessionId: parseInt(sessionId) });

  // 获取会话队列
  const { data: sessionQueue } = trpc.sessions.getQueueWithQuestions.useQuery({ sessionId: parseInt(sessionId) });

  // 获取当前选中题目的统计数据
  const { data: sessionStats } = trpc.answers.getStatistics.useQuery(
    {
      sessionId: parseInt(sessionId),
      questionId: selectedQuestionId || 0,
    },
    { enabled: selectedQuestionId !== null }
  );

  // 获取当前选中题目的答题详情
  const { data: answerDetails } = trpc.answers.getAnswerDetails.useQuery(
    {
      sessionId: parseInt(sessionId),
      questionId: selectedQuestionId || 0,
    },
    { enabled: selectedQuestionId !== null }
  );

  // 获取当前选中题目的详情
  const { data: questionDetail } = trpc.questions.get.useQuery(
    { questionId: selectedQuestionId || 0 },
    { enabled: selectedQuestionId !== null }
  );

  // 初始化选中第一题
  useMemo(() => {
    if (sessionQueue && sessionQueue.length > 0 && !selectedQuestionId) {
      setSelectedQuestionId(sessionQueue[0]!.questionId);
    }
  }, [sessionQueue, selectedQuestionId]);

  // 处理数据导出为Excel
  // 获取所有题目的统计数据
  const { data: allQuestionsStats } = trpc.answers.getAllSessionQuestionsStatistics.useQuery({
    sessionId: parseInt(sessionId),
  });

  const { data: questionsWithStudents } = trpc.answers.getSessionQuestionsWithStudentAnswers.useQuery({
    sessionId: parseInt(sessionId),
  });

  const { data: overallStats } = trpc.answers.getSessionOverallStatistics.useQuery({
    sessionId: parseInt(sessionId),
  });

  const { data: studentScoreCards } = trpc.answers.getSessionStudentScoreCards.useQuery({
    sessionId: parseInt(sessionId),
  });

  const handleExportExcel = async () => {
    if (!sessionQueue || !allQuestionsStats || !overallStats || !studentScoreCards) return;

    try {

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 第一个工作表：会话概览
      const summaryData = [
        ["会话报告", `会话 #${sessionId}`],
        ["生成时间", new Date().toLocaleString("zh-CN")],
        [],
        ["题目总数", sessionQueue.length],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "会话概览");

      // 第二个工作表：详细数据
      const detailData: any[] = [
        ["题号", "题目内容", "选项A人数", "选项B人数", "选项C人数", "选项D人数", "已答题", "未答题", "正确率"],
      ];

      // 为每个题目添加数据行
      allQuestionsStats.forEach((stat: any) => {
        detailData.push([
          stat.orderIndex + 1,
          stat.questionText || "未标题",
          stat.a || 0,
          stat.b || 0,
          stat.c || 0,
          stat.d || 0,
          stat.answered || 0,
          stat.unanswered || 0,
          (stat.correctRate || 0) + "%",
        ]);
      });

      const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
      // 设置列宽
      detailSheet["!cols"] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(workbook, detailSheet, "题目正确率");

      // 为所有题目合并学生名单到一个表格
      if (questionsWithStudents && questionsWithStudents.length > 0) {
        const optionNames = ['A', 'B', 'C', 'D'];
        
        // 创建表格标题：第一行是选项，第一列是题目
        const studentListData: any[] = [
          ["", ...optionNames.map(opt => `选项${opt}`)]
        ];
        
        // 为每个题目添加一行
        questionsWithStudents.forEach((question: any) => {
          const row = [`第${question.orderIndex + 1}题`];
          
          optionNames.forEach(option => {
            const students = question.studentsByOption[option] || [];
            const studentNames = students.map((s: any) => s.studentName).join(", ");
            row.push(studentNames || "");
          });
          
          studentListData.push(row);
        });
        
        const studentListSheet = XLSX.utils.aoa_to_sheet(studentListData);
        // 设置列宽
        studentListSheet["!cols"] = [
          { wch: 10 },
          { wch: 40 },
          { wch: 40 },
          { wch: 40 },
          { wch: 40 },
        ];
        
        XLSX.utils.book_append_sheet(workbook, studentListSheet, "具体选项名单");
      }

      // 第四个工作表：学生正确率
      if (studentScoreCards && studentScoreCards.length > 0) {
        const scoreCardData: any[] = [];
        
        // 添加标题
        scoreCardData.push(["学生正确率"]);
        scoreCardData.push([]);
        
        // 构建表头：基础列 + 题目列
        const headers = ["排名", "学生编号", "学生名字", "答题数", "正确数", "正确率"];
        
        // 获取题目数量
        const questionCount = studentScoreCards[0]?.answers?.length || 0;
        for (let i = 1; i <= questionCount; i++) {
          headers.push(`第${i}题`);
        }
        
        scoreCardData.push(headers);
        
        // 添加每个学生的数据
        studentScoreCards.forEach((student: any) => {
          const row = [
            student.rank,
            student.cardNumber || "-",
            student.studentName,
            student.answered,
            student.correct,
            student.correctRate + "%"
          ];
          
          // 添加每道题的答题情况
          if (student.answers && student.answers.length > 0) {
            student.answers.forEach((answer: any) => {
              row.push(answer.isCorrect ? "✓" : "✗");
            });
          }
          
          scoreCardData.push(row);
        });
        
        const scoreCardSheet = XLSX.utils.aoa_to_sheet(scoreCardData);
        
        // 为错误答案的叉设置红色字体
        for (let rowIndex = 3; rowIndex < scoreCardData.length; rowIndex++) {
          const row = scoreCardData[rowIndex];
          for (let colIndex = 6; colIndex < row.length; colIndex++) {
            if (row[colIndex] === "✗") {
              const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
              if (!scoreCardSheet[cellRef]) {
                scoreCardSheet[cellRef] = { t: "s", v: "✗" };
              }
            }
          }
        }
        
        // 设置列宽
        const colWidths = [
          { wch: 8 },
          { wch: 10 },
          { wch: 15 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
        ];
        // 为题目列添加列宽
        for (let i = 0; i < questionCount; i++) {
          colWidths.push({ wch: 8 });
        }
        scoreCardSheet["!cols"] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, scoreCardSheet, "学生正确率");
      }

      // 使用 exceljs 重新生成带有红色字体的 Excel 文件
      const excelWorkbook = new ExcelJS.Workbook();
      
      // 复制所有工作表
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const newSheet = excelWorkbook.addWorksheet(sheetName);
        newSheet.addRows(data as any[]);
      }
      
      // 为学生正确率表格中的错误答案设置红色字体
      const scoreCardSheet2 = excelWorkbook.getWorksheet("学生正确率");
      if (scoreCardSheet2) {
        scoreCardSheet2.eachRow((row, rowNumber) => {
          if (rowNumber >= 4) {
            row.eachCell((cell, colNumber) => {
              if (colNumber >= 7 && cell.value === "✗") {
                cell.font = { color: { argb: "FFFF0000" }, bold: true };
              }
            });
          }
        });
      }
      
      // 导出文件（使用 writeBuffer 在浏览器中下载）
      const buffer = await excelWorkbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `会话报告_${sessionId}_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("导出Excel失败:", error);
    }
  };

  // 处理数据导出
  const handleExportCSV = () => {
    if (!sessionStats) return;

    const stats = sessionStats as any;
    const headers = ["统计项", "数值"];
    const rows = [
      ["选项 A", stats.a || 0],
      ["选项 B", stats.b || 0],
      ["选项 C", stats.c || 0],
      ["选项 D", stats.d || 0],
      ["已答题", stats.answered],
      ["未答题", stats.unanswered],
      ["总数", stats.total],
      ["正确率", stats.correctRate + "%"],
    ];

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-session-${sessionId}-q${selectedQuestionId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };



  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
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
          <div>
            <h1 className="text-3xl font-bold">会话 #{sessionId}</h1>
          </div>
        </div>
        {/* 右上角导出按钮 */}
        <Button
          onClick={handleExportExcel}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <FileDown className="h-4 w-4 mr-2" />
          导出报告
        </Button>
      </div>

      {/* 学生概览 */}
      {studentScoreCards && studentScoreCards.length > 0 && (
        <StudentOverview students={studentScoreCards} sessionId={parseInt(sessionId)} onSelectStudent={onSelectStudent} />
      )}

      {/* 题目选择和详情 */}
      <div className="space-y-4">
          {/* 题目选择 - 预览卡片 */}
          <div>
            <h2 className="text-lg font-semibold mb-4">选择题目</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessionQueue?.map((item: any, index: number) => {
                const questionStats = allQuestionsStats?.find((q: any) => q.questionId === item.questionId);
                const question = item.question;
                return (
                  <QuestionPreviewCard
                    key={item.questionId}
                    questionNumber={index + 1}
                    questionContent={question?.questionText || ""}
                    questionImage={question?.questionImage}
                    options={[
                      { label: "A", content: question?.optionA || "", image: question?.optionAImage, isCorrect: question?.correctAnswer === "A" },
                      { label: "B", content: question?.optionB || "", image: question?.optionBImage, isCorrect: question?.correctAnswer === "B" },
                      { label: "C", content: question?.optionC || "", image: question?.optionCImage, isCorrect: question?.correctAnswer === "C" },
                      { label: "D", content: question?.optionD || "", image: question?.optionDImage, isCorrect: question?.correctAnswer === "D" },
                    ]}
                    onClick={() => {
                      setSelectedQuestionId(item.questionId);
                      onSelectQuestion?.(item.questionId, index + 1);
                    }}
                  />
                );
              })}
            </div>
          </div>


        </div>
    </div>
  );
}
