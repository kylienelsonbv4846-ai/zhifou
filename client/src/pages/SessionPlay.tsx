'use client';

import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  SkipForward, 
  SkipBack,
  ArrowLeft,
  Users,
  Maximize2
} from "lucide-react";

export default function SessionPlay() {
  const [, params] = useRoute("/sessions/:id/play");
  const sessionId = parseInt(params?.id || "0");
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [showStudentLinks, setShowStudentLinks] = useState(false);

  const studentLinksQuery = trpc.sessions.getStudentAccessLinks.useQuery(
    { sessionId },
    { enabled: showStudentLinks && Boolean(sessionId), staleTime: 5 * 60 * 1000 }
  );
  const setActiveQuestionMutation = trpc.sessions.setActiveQuestion.useMutation({
    onError: error => toast.error(error.message || "切换当前题目失败"),
  });

  // 计算图片放大倍数
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const containerWidth = window.innerWidth * 0.95 - 32; // 95vw - padding
    const containerHeight = window.innerHeight * 0.95 - 32; // 95vh - padding
    
    // 计算图片需要放大的倍数
    const scaleX = containerWidth / img.naturalWidth;
    const scaleY = containerHeight / img.naturalHeight;
    const scale = Math.min(scaleX, scaleY, 3); // 最大放大 3 倍
    
    setImageScale(Math.max(scale, 1)); // 至少 1 倍（不缩小）
  };

  // 获取会话数据
  const { data: session, isLoading: sessionLoading } = trpc.sessions.get.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // 获取题目队列
  const { data: queue, isLoading: queueLoading, refetch: refetchQueue } = trpc.sessions.getQueue.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // 获取当前题目的统计数据
  const currentQueueItem = queue?.[currentQuestionIndex];
  const { data: statistics, refetch: refetchStats } = trpc.answers.getStatistics.useQuery(
    { 
      sessionId, 
      questionId: currentQueueItem?.questionId || 0 
    },
    { 
      enabled: !!currentQueueItem?.questionId,
      refetchInterval: 1000 // 每秒刷新统计数据
    }
  );

  // 获取当前题目详情
  const { data: currentQuestion } = trpc.questions.get.useQuery(
    { questionId: currentQueueItem?.questionId || 0 },
    { enabled: !!currentQueueItem?.questionId }
  );

  // 获取班级学生及其答题状态
  const { data: studentsWithStatus } = trpc.sessions.getStudentsWithAnswerStatus.useQuery(
    { 
      sessionId, 
      questionId: currentQueueItem?.questionId || 0 
    },
    { 
      enabled: !!currentQueueItem?.questionId,
      refetchInterval: 1000 // 每秒刷新学生状态
    }
  );

  // 下一题
  const nextQuestion = () => {
    if (queue && currentQuestionIndex < queue.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setShowAnswer(false);
      setActiveQuestionMutation.mutate({ sessionId, questionId: queue[nextIndex]!.questionId });
    } else {
      toast.info("已经是最后一题了");
    }
  };

  // 上一题
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const previousIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(previousIndex);
      setShowAnswer(false);
      setActiveQuestionMutation.mutate({ sessionId, questionId: queue![previousIndex]!.questionId });
    }
  };

  const copyStudentLink = async (studentId: number, token: string) => {
    const link = new URL(`/${sessionId}/answer/${studentId}`, window.location.origin);
    link.searchParams.set("access_token", token);
    try {
      await navigator.clipboard.writeText(link.toString());
      toast.success("学生答题链接已复制");
    } catch {
      toast.error("无法访问剪贴板，请检查浏览器权限");
    }
  };

  // 计算答题进度
  const totalStudents = studentsWithStatus?.length || 0;
  const answeredStudents = studentsWithStatus?.filter(s => s.hasAnswered).length || 0;
  const progressPercent = totalStudents > 0 ? (answeredStudents / totalStudents) * 100 : 0;
  
  // 判断是否有学生已答题
  const hasAnswers = answeredStudents > 0;

  // 图片放大处理
  const handleImageClick = (imageUrl: string) => {
    setEnlargedImage(imageUrl);
  };

  // 全屏处理
  const handleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      toast.error("无法进入全屏模式");
    }
  };

  if (sessionLoading || queueLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  if (!session || !queue || queue.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>会话不存在或无题目队列</p>
      </div>
    );
  }

  return (
    <>
      {/* 图片放大模态框 */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[9999] flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div 
            className="relative w-[95vw] h-[95vh] bg-white rounded-lg overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={enlargedImage} 
              alt="放大图片"
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `scale(${imageScale})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-out'
              }}
              onLoad={handleImageLoad}
            />
            <button
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-all"
              onClick={() => setEnlargedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showStudentLinks && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setShowStudentLinks(false)}
        >
          <Card
            className="w-full max-w-xl max-h-[85vh] overflow-hidden bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-links-title"
            onClick={event => event.stopPropagation()}
          >
            <CardHeader className="border-b">
              <CardTitle id="student-links-title">学生答题入口</CardTitle>
              <p className="text-sm text-muted-foreground">
                链接绑定到本会话中的单名学生，有效期 6 小时；请只发送给对应学生。
              </p>
            </CardHeader>
            <CardContent className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              {studentLinksQuery.isLoading && <p className="text-sm text-muted-foreground">正在生成学生链接…</p>}
              {studentLinksQuery.error && <p className="text-sm text-destructive">{studentLinksQuery.error.message}</p>}
              {studentLinksQuery.data?.length === 0 && !studentLinksQuery.isLoading && (
                <p className="text-sm text-muted-foreground">该班级尚无学生，请先添加学生。</p>
              )}
              {studentLinksQuery.data?.map(student => (
                <div key={student.studentId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <span className="min-w-0 truncate font-medium">{student.studentName}</span>
                  <Button size="sm" variant="outline" onClick={() => void copyStudentLink(student.studentId, student.token)}>
                    复制链接
                  </Button>
                </div>
              ))}
            </CardContent>
            <div className="flex justify-end border-t p-3">
              <Button variant="ghost" onClick={() => setShowStudentLinks(false)}>关闭</Button>
            </div>
          </Card>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* 顶部导航栏 */}
        <div className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/sessions">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold">会话 #{session.id}</h1>
                <p className="text-sm text-muted-foreground">
                  题目 {currentQuestionIndex + 1} / {queue.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowStudentLinks(true)}>
                <Users className="w-4 h-4 mr-2" />学生链接
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFullscreen}
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                {isFullscreen ? "退出全屏" : "全屏"}
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className={`grid gap-6 transition-all duration-300 ${
            hasAnswers ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"
          }`}>
            {/* 左侧：题目内容 */}
            <div className={`space-y-4 transition-all duration-300 ${
              hasAnswers ? "lg:col-span-3" : "lg:col-span-full"
            }`}>
              {/* 题目卡片 */}
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                  <CardTitle className="flex items-center justify-between">
                    <span>第 {currentQuestionIndex + 1} 题</span>
                    <Badge variant="outline">
                      {currentQuestion?.questionType === "single_choice" ? "单选题" : 
                       currentQuestion?.questionType === "multiple_choice" ? "多选题" : "判断题"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* 题目文本 */}
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {currentQuestion?.questionText || "加载中..."}
                    </p>
                    
                    {/* 题目图片 */}
                    {currentQuestion?.questionMediaUrl && (
                      <div className="mt-4">
                        <img 
                          src={currentQuestion.questionMediaUrl} 
                          alt="题目图片"
                          className="max-w-full h-auto rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => currentQuestion.questionMediaUrl && handleImageClick(currentQuestion.questionMediaUrl)}
                        />
                      </div>
                    )}
                  </div>

                  {/* 选项 */}
                  <div className="grid grid-cols-2 gap-4">
                    {["A", "B", "C", "D"].map((option) => {
                      const optionText = currentQuestion?.[`option${option}` as keyof typeof currentQuestion] as string;
                      const optionMediaUrl = currentQuestion?.[`option${option}MediaUrl` as keyof typeof currentQuestion] as string;
                      const isCorrect = currentQuestion?.correctAnswer?.includes(option);
                      const count = statistics?.[option.toLowerCase() as keyof typeof statistics] || 0;
                      
                      return (
                        <div
                          key={option}
                          className={`p-6 rounded-lg border-2 transition-all ${
                            showAnswer && isCorrect
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 bg-white hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-2xl text-gray-700">{option}</span>
                          </div>
                          
                          {/* 选项文本 */}
                          <p className="text-base text-gray-600 mb-3">
                            {optionText || `选项 ${option}`}
                          </p>

                          {/* 选项图片 */}
                          {optionMediaUrl && (
                            <div className="mb-3">
                              <img 
                                src={optionMediaUrl} 
                                alt={`选项 ${option}`}
                                className="max-w-full h-auto rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => optionMediaUrl && handleImageClick(optionMediaUrl)}
                              />
                            </div>
                          )}

                          {/* 答题统计 */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{
                                  width: `${statistics?.answered && statistics.answered > 0 ? ((count as number) / statistics.answered) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 font-semibold">{count as number}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 控制按钮 */}
                  <div className="flex items-center justify-center gap-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={prevQuestion}
                      disabled={currentQuestionIndex === 0}
                    >
                      <SkipBack className="w-5 h-5 mr-2" />
                      上一题
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowAnswer(!showAnswer)}
                    >
                      {showAnswer ? "隐藏答案" : "显示答案"}
                    </Button>
                    
                    <Button
                      size="lg"
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === queue.length - 1}
                    >
                      下一题
                      <SkipForward className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：答题统计区块（条件显示） */}
            {answeredStudents > 0 && (
              <div className="transition-all duration-300">
                {/* 学生网格 */}
                <Card className="h-full flex flex-col">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-20 z-40 shrink-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {session?.class?.name || '班级学生'} ({totalStudents})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1 overflow-y-auto">
                    {studentsWithStatus && studentsWithStatus.length > 0 ? (
                      <div className="grid grid-cols-5 gap-2">
                        {studentsWithStatus.map((student) => (
                          <div
                            key={student.id}
                            className={`p-2 rounded text-center text-sm font-medium transition-all cursor-default ${
                              student.hasAnswered
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                            title={student.name}
                          >
                            <div className="truncate leading-tight">{student.name}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        暂无学生数据
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
