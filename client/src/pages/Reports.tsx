import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { SessionDetail } from "./SessionDetail";
import { QuestionDetail } from "./QuestionDetail";
import { StudentDetailPage } from "./StudentDetailPage";

export default function Reports() {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);

  // 获取所有有效会话
  const { data: sessions } = trpc.sessions.validSessions.list.useQuery();

  // 获取选中会话的题目列表（在条件语句外调用，使用 enabled 控制）
  const { data: sessionQueue } = trpc.sessions.getQueueWithQuestions.useQuery(
    { sessionId: selectedSessionId || 0 },
    { enabled: !!selectedSessionId && !!selectedQuestionId }
  );

  // 按月份分组会话
  const groupedSessions = sessions ? sessions.reduce((acc: Record<string, any[]>, session: any) => {
    const date = new Date(session.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthKey = `${year}-${month}`;
    const monthLabel = `${year}年${month + 1}月`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push({ ...session, monthLabel });
    return acc;
  }, {}) : {};

  // 获取排序后的月份列表（从新到旧）
  const sortedMonths = Object.keys(groupedSessions).sort().reverse();

  // 如果选中了学生，显示学生详情页
  if (selectedSessionId && selectedStudentId && selectedStudentName) {
    return (
      <DashboardLayout>
        <StudentDetailPage
          sessionId={selectedSessionId}
          studentId={selectedStudentId}
          studentName={selectedStudentName}
          onBack={() => {
            setSelectedStudentId(null);
            setSelectedStudentName(null);
          }}
        />
      </DashboardLayout>
    );
  }

  // 如果选中了题目，显示题目详情页
  if (selectedSessionId && selectedQuestionId && selectedQuestionNumber) {
    const totalQuestions = sessionQueue?.length || 0;
    const currentQuestionIndex = sessionQueue?.findIndex(q => q.questionId === selectedQuestionId) || 0;
    
    return (
      <DashboardLayout>
        <QuestionDetail
          sessionId={String(selectedSessionId)}
          questionId={selectedQuestionId}
          questionNumber={selectedQuestionNumber}
          totalQuestions={totalQuestions}
          currentQuestionIndex={currentQuestionIndex}
          onBack={() => {
            setSelectedQuestionId(null);
            setSelectedQuestionNumber(null);
          }}
          onNavigateQuestion={(index) => {
            if (sessionQueue && sessionQueue[index]) {
              setSelectedQuestionId(sessionQueue[index].questionId);
              setSelectedQuestionNumber(index + 1);
            }
          }}
        />
      </DashboardLayout>
    );
  }

  // 如果选中了会话，显示详细页
  if (selectedSessionId) {
    return (
      <DashboardLayout>
        <SessionDetail
          sessionId={String(selectedSessionId)}
          onBack={() => setSelectedSessionId(null)}
          onSelectQuestion={(questionId, questionNumber) => {
            setSelectedQuestionId(questionId);
            setSelectedQuestionNumber(questionNumber);
          }}
          onSelectStudent={(studentId, studentName) => {
            setSelectedStudentId(studentId);
            setSelectedStudentName(studentName);
          }}
        />
      </DashboardLayout>
    );
  }

  // 否则显示列表页 - 与题库管理相同的两栏布局
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">会话分析报告</h1>

        {/* 两栏布局：左侧会话列表自动填充，右侧留空 */}
        <div className="flex gap-6 flex-1 min-h-[600px]">
          {/* 左侧：会话列表 - 自动填充可用空间 */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>有效会话</CardTitle>
                <CardDescription>至少有一张答题卡被扫描</CardDescription>
              </CardHeader>
              <CardContent>
                {sessions && sessions.length > 0 ? (
                  <div className="space-y-4">
                    {sortedMonths.map((monthKey) => (
                      <div key={monthKey}>
                        {/* 月份标题 */}
                        <div className="mb-2">
                          <h3 className="text-sm font-semibold text-muted-foreground">
                            {groupedSessions[monthKey][0]?.monthLabel}
                          </h3>
                        </div>
                        
                        {/* 该月份的会话列表 */}
                        <div className="space-y-2">
                          {groupedSessions[monthKey].map((session: any) => (
                            <Button
                              key={session.id}
                              variant="outline"
                              onClick={() => setSelectedSessionId(session.id)}
                              className="w-full justify-start text-left h-auto py-3"
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">会话 #{session.id}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(session.createdAt).toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  题集 #{session.setId} | 班级 #{session.classId}
                                </span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">暂无有效会话</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：留空用于后续新增内容 - 固定宽度 */}
          <div className="w-96 flex-shrink-0" />
        </div>
      </div>
    </DashboardLayout>
  );
}
