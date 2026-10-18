'use client';

import { useState } from 'react';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Clock, Play, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function Sessions() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [selectedSetForSession, setSelectedSetForSession] = useState<any>(null);
  const [selectedClassForSession, setSelectedClassForSession] = useState<number | null>(null);

  // 获取数据
  const { data: sessions } = trpc.sessions.list.useQuery();
  const { data: classes } = trpc.classes.list.useQuery();
  const { data: questionSets } = trpc.questionSets.list.useQuery();

  // 删除会话
  const deleteSessionMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      void utils.sessions.invalidate();
      setSelectedSessionId(null);
    },
  });

  const startSessionMutation = trpc.sessions.start.useMutation();

  // 创建会话
  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: (data) => {
      void utils.sessions.invalidate();
      setIsClassDialogOpen(false);
      setSelectedSetForSession(null);
      setSelectedClassForSession(null);
      startSessionMutation.mutate({ sessionId: data.sessionId }, {
        onSuccess: () => {
          void utils.sessions.invalidate();
          setLocation(`/sessions/${data.sessionId}/play`);
        },
      });
    },
  });

  const getQuestionSetName = (setId: number) => {
    return questionSets?.find(s => s.id === setId)?.title || `题集 ${setId}`;
  };

  const getClassName = (classId: number) => {
    return classes?.find(c => c.id === classId)?.name || `班级 ${classId}`;
  };

  const handleStartClick = (setId: number) => {
    setSelectedSetForSession(questionSets?.find(s => s.id === setId));
    setIsClassDialogOpen(true);
  };

  const handleCreateSession = () => {
    if (!selectedSetForSession || !selectedClassForSession) return;
    createSessionMutation.mutate({
      setId: selectedSetForSession.id,
      classId: selectedClassForSession,
    });
  };

  const handleDeleteSession = (sessionId: number) => {
    if (confirm('确定要删除这个会话吗？')) {
      deleteSessionMutation.mutate({ sessionId });
    }
  };

  const selectedSession = sessions?.find(s => s.id === selectedSessionId);
  const { data: selectedSessionQuestions } = trpc.questions.list.useQuery(
    { setId: selectedSession?.setId! },
    { enabled: selectedSession?.setId !== undefined }
  );
  
  // 获取选中题集的班级列表
  const { data: classesForSetData } = trpc.questionSets.getClassesForSet.useQuery(
    { setId: selectedSession?.setId! },
    { enabled: selectedSession?.setId !== undefined }
  );
  
  const classesForSet = classesForSetData?.map((item: any) => {
    const classItem = classes?.find((c: any) => c.id === item.classId);
    return classItem ? { ...classItem, lastSessionTime: item.lastSessionTime } : null;
  }).filter(Boolean) || [];

  const firstQuestion = selectedSessionQuestions?.[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">最近的</h1>
          <p className="text-muted-foreground mt-2">按题集分组显示最近发起的会话</p>
        </div>

        {/* 两栏布局 */}
        <div className="flex gap-6 flex-1 min-h-[600px]">
          {/* 左侧列表 */}
          <div className="flex-1 min-w-0">
            {sessions && sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => {
                  return (
                    <Card
                      key={session.id}
                      className={`hover:shadow-lg transition-all duration-300 group cursor-pointer ${
                        selectedSessionId === session.id ? "ring-2 ring-primary shadow-lg" : ""
                      }`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-semibold">{getQuestionSetName(session.setId)}</p>
                                <p className="text-sm text-muted-foreground">{getClassName(session.classId)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{new Date(session.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartClick(session.setId);
                              }}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              开始
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <div className="text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">暂无会话</p>
                  <p className="text-sm mt-1">从题库管理中选择题目集并点击开始按钮来发起会话</p>
                </div>
              </Card>
            )}
          </div>

          {/* 右侧预览区域 */}
          <div className="w-96 flex-shrink-0 flex flex-col gap-4">
            {selectedSessionId && selectedSession && firstQuestion ? (
              <>
              <Card className="flex flex-col h-48">
                <CardContent className="overflow-y-auto space-y-1 flex-1 p-3">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">第1题</p>
                      <p className="text-xs text-muted-foreground">{firstQuestion.questionText}</p>
                      {firstQuestion.questionMediaUrl && (
                        <img
                          src={firstQuestion.questionMediaUrl}
                          alt="题目图片"
                          className="mt-2 max-w-full h-auto rounded"
                        />
                      )}
                    </div>
                    <div>
                      <div className="space-y-1">
                        {firstQuestion.questionType === "multiple_choice" || firstQuestion.questionType === "single_choice" ? (
                          ["A", "B", "C", "D"].map((option) => {
                            const optionContent =
                              firstQuestion[`option${option}` as keyof typeof firstQuestion];
                            const optionImage =
                              firstQuestion[`option${option}MediaUrl` as keyof typeof firstQuestion];
                            return optionContent ? (
                              <div key={option} className="text-xs p-1 bg-muted rounded">
                                <div className="font-medium text-xs">{option}</div>
                                <div className="text-muted-foreground text-xs">{String(optionContent)}</div>
                                {optionImage && (
                                  <img
                                    src={String(optionImage)}
                                    alt={`选项 ${option}`}
                                    className="mt-1 max-w-full h-auto rounded"
                                  />
                                )}
                              </div>
                            ) : null;
                          })
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs p-1 bg-muted rounded">
                              <div className="font-medium text-xs">是</div>
                            </div>
                            <div className="text-xs p-1 bg-muted rounded">
                              <div className="font-medium text-xs">否</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-medium">
                        {firstQuestion.questionType === "true_false"
                          ? firstQuestion.correctAnswer === "A"
                            ? "是"
                            : "否"
                          : firstQuestion.correctAnswer}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* 班级列表卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">参与过的班级</CardTitle>
                </CardHeader>
                <CardContent className="overflow-y-auto">
                  {classesForSet && classesForSet.length > 0 ? (
                    <div className="space-y-2">
                      {classesForSet.map((classItem: any) => (
                        <div
                          key={classItem?.id}
                          className="p-3 border rounded-md bg-muted/50"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{classItem?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {classItem?.lastSessionTime ? new Date(classItem.lastSessionTime).toLocaleString() : '未使用'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">暂无参与过的班级</p>
                  )}
                </CardContent>
              </Card>
              </>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>选择一个会话查看预览</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 班级选择对话框 */}
        <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>选择班级</DialogTitle>
              <DialogDescription></DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">班级</label>
                <Select value={selectedClassForSession?.toString() || ''} onValueChange={(value) => setSelectedClassForSession(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择班级" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsClassDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateSession} disabled={!selectedClassForSession || createSessionMutation.isPending}>
                {createSessionMutation.isPending ? '创建中...' : '开始会话'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
