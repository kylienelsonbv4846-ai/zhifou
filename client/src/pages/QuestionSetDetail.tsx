import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { shouldLogMutationErrorCode } from "@/lib/apiMutationErrorPolicy";
import { TRPCClientError } from "@trpc/client";
import { ArrowLeft, Plus, Trash2, Edit, HelpCircle, Upload, X } from "lucide-react";
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";

type QuestionType = "multiple_choice" | "single_choice" | "true_false";

function logUnexpectedUploadError(error: unknown) {
  const errorCode =
    error instanceof TRPCClientError ? error.data?.code : undefined;

  if (shouldLogMutationErrorCode(errorCode)) {
    console.error("Upload error:", error);
  }
}

export default function QuestionSetDetail() {
  const [, params] = useRoute("/question-sets/:id");
  const [, setLocation] = useLocation();
  const setId = parseInt(params?.id || "0");

  const [open, setOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("single_choice");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(["A"]); // For multiple choice
  const [questionMediaUrl, setQuestionMediaUrl] = useState("");
  const [questionMediaType, setQuestionMediaType] = useState<"image" | "video">("image");
  const [optionMediaUrls, setOptionMediaUrls] = useState({ A: "", B: "", C: "", D: "" });

  const { data: set, isLoading: setLoading } = trpc.questionSets.get.useQuery({ setId });
  const { data: questions, isLoading: questionsLoading } = trpc.questions.list.useQuery({ setId });
  const utils = trpc.useUtils();

  const createMutation = trpc.questions.create.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      setOpen(false);
      resetForm();
      toast.success("题目添加成功");
    },
    onError: (error) => {
      toast.error("添加失败: " + error.message);
    },
  });

  const updateMutation = trpc.questions.update.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      setOpen(false);
      setEditingQuestion(null);
      resetForm();
      toast.success("题目已更新");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteMutation = trpc.questions.delete.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      toast.success("题目已删除");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const resetForm = () => {
    setQuestionText("");
    setQuestionType("single_choice");
    setOptionA("");
    setOptionB("");
    setOptionC("");
    setOptionD("");
    setCorrectAnswers(["A"]);
    setQuestionMediaUrl("");
    setQuestionMediaType("image");
    setOptionMediaUrls({ A: "", B: "", C: "", D: "" });
  };

  const handleOpenDialog = (question?: any) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionText(question.questionText);
      setQuestionType(question.questionType);
      setOptionA(question.optionA || "");
      setOptionB(question.optionB || "");
      setOptionC(question.optionC || "");
      setOptionD(question.optionD || "");
      setCorrectAnswers(question.correctAnswer.split(""));
      setQuestionMediaUrl(question.questionMediaUrl || "");
      setQuestionMediaType(question.questionMediaType || "image");
      setOptionMediaUrls({
        A: question.optionAMediaUrl || "",
        B: question.optionBMediaUrl || "",
        C: question.optionCMediaUrl || "",
        D: question.optionDMediaUrl || "",
      });
    } else {
      setEditingQuestion(null);
      resetForm();
    }
    setOpen(true);
  };

  const handleCorrectAnswerChange = (answer: string) => {
    if (questionType === "multiple_choice") {
      setCorrectAnswers((prev) =>
        prev.includes(answer)
          ? prev.filter((a) => a !== answer)
          : [...prev, answer].sort()
      );
    } else {
      setCorrectAnswers([answer]);
    }
  };

  const uploadMutation = trpc.upload.image.useMutation();

  const handleMediaUpload = (file: File, isQuestionMedia: boolean, optionKey?: string) => {
    const supportedTypes = [
      "image/avif", "image/gif", "image/jpeg", "image/png", "image/webp",
      "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
    ] as const;
    if (!supportedTypes.includes(file.type as (typeof supportedTypes)[number])) {
      toast.error("仅支持常见图片或视频格式");
      return;
    }
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const fileData = reader.result;
          if (typeof fileData !== "string") {
            toast.error("文件读取失败");
            return;
          }

          const separatorIndex = fileData.indexOf(",");
          const base64 = fileData.slice(separatorIndex + 1);
          if (separatorIndex === -1 || !base64) {
            toast.error("文件读取失败");
            return;
          }

          uploadMutation
            .mutateAsync({
            fileName: file.name,
            fileData: base64,
            contentType: file.type as (typeof supportedTypes)[number],
            })
            .then(result => {
              if (isQuestionMedia) {
                setQuestionMediaUrl(result.url);
              } else if (optionKey) {
                setOptionMediaUrls((prev) => ({ ...prev, [optionKey]: result.url }));
              }
              toast.success("图片上传成功");
            })
            .catch(error => {
              logUnexpectedUploadError(error);
              toast.error("图片上传失败");
            });
        } catch (error) {
          logUnexpectedUploadError(error);
          toast.error("图片上传失败");
        }
      };
      reader.onerror = () => {
        toast.error("文件读取失败");
      };
      reader.onabort = () => {
        toast.error("文件读取已取消");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File read error:', error);
      toast.error("文件处理失败");
    }
  };

  const handleSave = () => {
    if (!questionText.trim()) {
      toast.error("请输入题目");
      return;
    }

    if (questionType !== "true_false") {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        toast.error("必须填写所有选项");
        return;
      }
    }

    if (correctAnswers.length === 0) {
      toast.error("请选择正确答案");
      return;
    }

    const data = {
      setId,
      questionText,
      questionType,
      optionA: questionType !== "true_false" ? optionA : undefined,
      optionB: questionType !== "true_false" ? optionB : undefined,
      optionC: questionType !== "true_false" ? optionC : undefined,
      optionD: questionType !== "true_false" ? optionD : undefined,
      optionAMediaUrl: optionMediaUrls.A || undefined,
      optionBMediaUrl: optionMediaUrls.B || undefined,
      optionCMediaUrl: optionMediaUrls.C || undefined,
      optionDMediaUrl: optionMediaUrls.D || undefined,
      questionMediaUrl: questionMediaUrl || undefined,
      questionMediaType: questionMediaUrl ? questionMediaType : undefined,
      correctAnswer: correctAnswers.join(""),
      orderIndex: editingQuestion?.orderIndex || 0,
    };

    if (editingQuestion) {
      updateMutation.mutate({
        questionId: editingQuestion.id,
        ...data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (questionId: number) => {
    if (confirm("确定要删除这道题目吗？")) {
      deleteMutation.mutate({ questionId });
    }
  };

  if (setLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!set) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">题目集不存在</h2>
          <Button onClick={() => setLocation("/question-sets")}>返回题库</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/question-sets")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{set.title}</h1>
              <p className="text-muted-foreground">{set.description || "暂无描述"}</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg">
                <Plus className="w-5 h-5 mr-2" />
                添加题目
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? "编辑题目" : "添加新题目"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="question-text">题目 *</Label>
                  <Textarea
                    id="question-text"
                    placeholder="输入题目"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>题目类型 *</Label>
                  <RadioGroup value={questionType} onValueChange={(v) => setQuestionType(v as QuestionType)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single_choice" id="single" />
                      <Label htmlFor="single" className="font-normal cursor-pointer">单选题</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true_false" id="truefalse" />
                      <Label htmlFor="truefalse" className="font-normal cursor-pointer">是非题</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>题目媒体（可选）</Label>
                  <div className="flex gap-2">
                    <Select value={questionMediaType} onValueChange={(v) => setQuestionMediaType(v as "image" | "video")}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="bottom" align="start" sideOffset={4}>
                        <SelectItem value="image">图片</SelectItem>
                        <SelectItem value="video">视频</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="flex-1">
                      <Input
                        type="file"
                        accept={questionMediaType === "image" ? "image/*" : "video/*"}
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleMediaUpload(e.target.files[0], true);
                          }
                        }}
                        className="hidden"
                      />
                      <Button variant="outline" className="w-full cursor-pointer" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          上传{questionMediaType === "image" ? "图片" : "视频"}
                        </span>
                      </Button>
                    </label>
                  </div>
                  {questionMediaUrl && (
                    <div className="relative w-full h-32 bg-muted rounded">
                      {questionMediaType === "image" ? (
                        <img src={questionMediaUrl} alt="题目" className="w-full h-full object-cover rounded" />
                      ) : (
                        <video src={questionMediaUrl} className="w-full h-full object-cover rounded" />
                      )}
                      <button
                        onClick={() => setQuestionMediaUrl("")}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {questionType !== "true_false" ? (
                  <div className="space-y-3">
                    {["A", "B", "C", "D"].map((opt) => (
                      <div key={opt} className="space-y-2">
                        <Label htmlFor={`option${opt}`}>选项 {opt} *</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`option${opt}`}
                            placeholder={`选项 ${opt}`}
                            value={opt === "A" ? optionA : opt === "B" ? optionB : opt === "C" ? optionC : optionD}
                            onChange={(e) => {
                              if (opt === "A") setOptionA(e.target.value);
                              else if (opt === "B") setOptionB(e.target.value);
                              else if (opt === "C") setOptionC(e.target.value);
                              else setOptionD(e.target.value);
                            }}
                          />
                          <label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleMediaUpload(e.target.files[0], false, opt);
                                }
                              }}
                              className="hidden"
                            />
                            <Button variant="outline" size="icon" asChild>
                              <span>
                                <Upload className="w-4 h-4" />
                              </span>
                            </Button>
                          </label>
                        </div>
                        {optionMediaUrls[opt as keyof typeof optionMediaUrls] && (
                          <div className="relative w-20 h-20 bg-muted rounded">
                            <img
                              src={optionMediaUrls[opt as keyof typeof optionMediaUrls]}
                              alt={`选项 ${opt}`}
                              className="w-full h-full object-cover rounded"
                            />
                            <button
                              onClick={() =>
                                setOptionMediaUrls((prev) => ({ ...prev, [opt]: "" }))
                              }
                              className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm">
                    <p className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                      <HelpCircle className="w-4 h-4" />
                      是非题的正确答案为 "A"（是）或 "B"（否）
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>正确答案 *</Label>
                  {questionType === "multiple_choice" ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">可选择多个正确答案</p>
                      {["A", "B", "C", "D"].map((opt) => (
                        <div key={opt} className="flex items-center space-x-2">
                          <Checkbox
                            id={`correct-${opt}`}
                            checked={correctAnswers.includes(opt)}
                            onCheckedChange={() => handleCorrectAnswerChange(opt)}
                          />
                          <Label htmlFor={`correct-${opt}`} className="font-normal cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Select value={correctAnswers[0] || "A"} onValueChange={(v) => handleCorrectAnswerChange(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="bottom" align="start" sideOffset={4}>
                        {questionType === "true_false" ? (
                          <>
                            <SelectItem value="A">是</SelectItem>
                            <SelectItem value="B">否</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>题目列表</CardTitle>
            <CardDescription>
              共有 {questions?.length || 0} 道题目
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : questions && questions.length > 0 ? (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <Card key={question.id} className="bg-muted/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm bg-primary text-primary-foreground px-2 py-1 rounded">
                              第 {index + 1} 题
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {question.questionType === "multiple_choice" ? "多选题" : question.questionType === "single_choice" ? "单选题" : "是非题"}
                            </span>
                          </div>
                          <p className="font-medium mb-3">{question.questionText}</p>
                          {question.questionMediaUrl && (
                            <div className="mb-3 w-32 h-24 rounded overflow-hidden">
                              {question.questionMediaType === "image" ? (
                                <img src={question.questionMediaUrl} alt="题目" className="w-full h-full object-cover" />
                              ) : (
                                <video src={question.questionMediaUrl} className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                          {question.questionType !== "true_false" ? (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {["A", "B", "C", "D"].map((opt) => {
                                const optionKey = `option${opt}` as keyof typeof question;
                                const optionValue = question[optionKey];
                                const mediaKey = `option${opt}MediaUrl` as keyof typeof question;
                                const mediaUrl = question[mediaKey];
                                const isCorrect = question.correctAnswer.includes(opt);
                                return (
                                  <div key={opt} className="flex items-start gap-2">
                                    <span className={`font-semibold flex-shrink-0 ${isCorrect ? "text-green-600" : ""}`}>
                                      {opt}.
                                    </span>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1">
                                        <span>{String(optionValue) || "-"}</span>
                                        {isCorrect && (
                                          <span className="text-green-600 text-xs">✓</span>
                                        )}
                                      </div>
                                      {mediaUrl && (
                                        <img src={String(mediaUrl)} alt={`选项 ${opt}`} className="w-12 h-12 object-cover rounded mt-1" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm">
                              <p>正确答案：{question.correctAnswer === "A" ? "是" : "否"}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(question)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(question.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">还没有题目</p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加第一道题目
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
