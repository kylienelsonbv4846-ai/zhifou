import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Edit, BookOpen, Play, ArrowUpDown, Folder, FolderPlus, Move, ChevronRight, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function QuestionSets() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSetForSession, setSelectedSetForSession] = useState<any>(null);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [openFolderDialog, setOpenFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [setToMove, setSetToMove] = useState<any>(null);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number | null; name: string }>>([{ id: null, name: '根目录' }]);
  const [draggedItem, setDraggedItem] = useState<{ type: 'set' | 'folder'; id: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'set' | 'folder'; id: number } | null>(null);
  const [selectedMoveTarget, setSelectedMoveTarget] = useState<number | null | undefined>(undefined);
  const { data: sets, isLoading } = trpc.questionSets.list.useQuery();
  const { data: folders, isLoading: foldersLoading } = trpc.questionFolders.list.useQuery();
  const { data: classes } = trpc.classes.list.useQuery();
  const { data: selectedSetQuestions } = trpc.questions.list.useQuery(
    { setId: selectedSetId! },
    { enabled: selectedSetId !== null }
  );
  const utils = trpc.useUtils();

  // 根据选择的排序方式排序题集
  const sortedSets = sets ? [...sets]
    .filter(set => {
      if (currentFolderId === null) {
        return set.folderId === null || set.folderId === undefined;
      }
      return set.folderId === currentFolderId;
    })
    .sort((a, b) => {
    let compareResult = 0;
    if (sortBy === 'time') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      compareResult = timeA - timeB;
    } else {
      compareResult = a.title.localeCompare(b.title);
    }
    return sortOrder === 'asc' ? compareResult : -compareResult;
  }) : [];

  const handleSortChange = (newSortBy: 'time' | 'name') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const handleOpenFolder = (folder: any) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    const breadcrumb = breadcrumbs[index];
    setCurrentFolderId(breadcrumb.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleDragStart = (e: React.DragEvent, item: { type: 'set' | 'folder'; id: number }) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, target: { type: 'set' | 'folder'; id: number } | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(target);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: number | null) => {
    e.preventDefault();
    setDragOverTarget(null);

    if (!draggedItem) return;

    if (draggedItem.type === 'set') {
      moveMutation.mutate({
        setId: draggedItem.id,
        folderId: targetFolderId,
      }, {
        onSuccess: () => {
          setDraggedItem(null);
        },
      });
    }
  };

  const createMutation = trpc.questionSets.create.useMutation({
    onSuccess: () => {
      utils.questionSets.list.invalidate();
      utils.questionFolders.list.invalidate();
      setOpen(false);
      setTitle("");
      setDescription("");
      toast.success("题目集创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });

  const updateMutation = trpc.questionSets.update.useMutation({
    onSuccess: () => {
      utils.questionSets.list.invalidate();
      utils.questionFolders.list.invalidate();
      setOpen(false);
      setEditingSet(null);
      setTitle("");
      setDescription("");
      toast.success("题目集已更新");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteMutation = trpc.questionSets.delete.useMutation({
    onSuccess: () => {
      utils.questionSets.list.invalidate();
      utils.questionFolders.list.invalidate();
      if (selectedSetId === editingSet?.id) {
        setSelectedSetId(null);
      }
      toast.success("题目集已删除");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const moveMutation = trpc.questionSets.move.useMutation({
    onSuccess: () => {
      utils.questionSets.list.invalidate();
      utils.questionFolders.list.invalidate();
      setShowMoveDialog(false);
      setSetToMove(null);
      toast.success("题目集已移动");
    },
    onError: (error) => {
      toast.error("移动失败: " + error.message);
    },
  });

  const handleOpenDialog = (set?: any) => {
    if (set) {
      setEditingSet(set);
      setTitle(set.title);
      setDescription(set.description || "");
    } else {
      setEditingSet(null);
      setTitle("");
      setDescription("");
    }
    setOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("请输入题目集名称");
      return;
    }

    if (editingSet) {
      updateMutation.mutate({
        setId: editingSet.id,
        title,
        description,
      });
    } else {
      createMutation.mutate({
        title,
        description,
        folderId: currentFolderId,
      });
    }
  };

  const handleDelete = (setId: number, setTitle: string) => {
    if (confirm(`确定要删除题目集"${setTitle}"吗？这将同时删除该题目集中的所有题目。`)) {
      deleteMutation.mutate({ setId });
    }
  };

  const createFolderMutation = trpc.questionFolders.create.useMutation({
    onSuccess: () => {
      utils.questionFolders.list.invalidate();
      setOpenFolderDialog(false);
      setFolderName("");
      setFolderDescription("");
      setEditingFolder(null);
      toast.success("文件夹创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });

  const updateFolderMutation = trpc.questionFolders.update.useMutation({
    onSuccess: () => {
      utils.questionFolders.list.invalidate();
      setOpenFolderDialog(false);
      setFolderName("");
      setFolderDescription("");
      setEditingFolder(null);
      toast.success("文件夹已更新");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteFolderMutation = trpc.questionFolders.delete.useMutation({
    onSuccess: () => {
      utils.questionFolders.list.invalidate();
      utils.questionSets.list.invalidate();
      toast.success("文件夹已删除");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const handleOpenFolderDialog = (folder?: any) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderName(folder.name);
      setFolderDescription(folder.description || "");
    } else {
      setEditingFolder(null);
      setFolderName("");
      setFolderDescription("");
    }
    setOpenFolderDialog(true);
  };

  const handleSaveFolder = () => {
    if (!folderName.trim()) {
      toast.error("请输入文件夹名称");
      return;
    }

    if (editingFolder) {
      updateFolderMutation.mutate({
        folderId: editingFolder.id,
        name: folderName,
        description: folderDescription,
      });
    } else {
      createFolderMutation.mutate({
        name: folderName,
        description: folderDescription,
        parentFolderId: currentFolderId,
      });
    }
  };

  const handleDeleteFolder = (folderId: number, folderName: string) => {
    if (confirm(`确定要删除文件夹"${folderName}"吗？该文件夹中的题集将移到根目录。`)) {
      deleteFolderMutation.mutate({ folderId });
    }
  };

  const selectedSet = sortedSets.find((set) => set.id === selectedSetId);
  const firstQuestion = selectedSetQuestions?.[0];
  
  const { data: classesForSetData } = trpc.questionSets.getClassesForSet.useQuery(
    { setId: selectedSetId! },
    { enabled: selectedSetId !== null }
  );
  
  const classesForSet = classesForSetData?.map((item: any) => {
    const classItem = classes?.find((c: any) => c.id === item.classId);
    return classItem ? { ...classItem, lastSessionTime: item.lastSessionTime } : null;
  }).filter(Boolean) || [];
  
  const sessionCreateMutation = trpc.sessions.create.useMutation({
    onSuccess: (data) => {
      toast.success("Session created");
      setLocation(`/sessions/${data.sessionId}/play`);
    },
    onError: (error) => {
      toast.error("Failed to create session: " + error.message);
    },
  });
  
  // 删除了快速发起会话功能，班级列表现在仅用于展示

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">题库管理</h1>
            <p className="text-muted-foreground">创建和管理题目集</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={openFolderDialog} onOpenChange={setOpenFolderDialog}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline" className="shadow-lg" onClick={() => handleOpenFolderDialog()}>
                  <FolderPlus className="w-5 h-5 mr-2" />
                  新建文件夹
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFolder ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
                  <DialogDescription>
                    {editingFolder ? "更新文件夹信息" : "创建一个新的文件夹来组织题目集"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="folderName">文件夹名称 *</Label>
                    <Input
                      id="folderName"
                      placeholder="例如：第一章"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="folderDescription">描述（可选）</Label>
                    <Textarea
                      id="folderDescription"
                      placeholder="文件夹描述或备注"
                      value={folderDescription}
                      onChange={(e) => setFolderDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenFolderDialog(false)}>取消</Button>
                  <Button onClick={handleSaveFolder} disabled={createFolderMutation.isPending || updateFolderMutation.isPending}>
                    {createFolderMutation.isPending || updateFolderMutation.isPending ? "保存中..." : "保存"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="shadow-lg">
                  <Plus className="w-5 h-5 mr-2" />
                  创建题目集
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSet ? "编辑题目集" : "创建新题目集"}</DialogTitle>
                <DialogDescription>
                  {editingSet ? "更新题目集信息" : "创建一个新的题目集，然后为其添加题目"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">题目集名称 *</Label>
                  <Input
                    id="title"
                    placeholder="例如：第一章测试"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述（可选）</Label>
                  <Textarea
                    id="description"
                    placeholder="题目集描述或备注"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
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
        </div>

        {/* 两栏布局 */}
        {/* 两栏布局 */}
        <div className="flex gap-6 flex-1 min-h-[600px]">
          {/* 左侧列表 */}
          <div className="flex-1 min-w-0">
            {/* 面包屑导航 */}
            {breadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 mb-4 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleNavigateToBreadcrumb(index)}
                    >
                      {crumb.name}
                    </Button>
                    {index < breadcrumbs.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* 排序选项 */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">排序方式：</span>
              <Button
                variant={sortBy === 'time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('time')}
              >
                <ArrowUpDown className={`w-4 h-4 mr-1 transition-transform ${sortBy === 'time' && sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                创建时间
              </Button>
              <Button
                variant={sortBy === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('name')}
              >
                <ArrowUpDown className={`w-4 h-4 mr-1 transition-transform ${sortBy === 'name' && sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                题集名字
              </Button>
            </div>
            {/* 文件夹列表 */}
            {!foldersLoading && folders && folders.length > 0 && (
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">文件夹</h3>
                <div className="space-y-2">
                  {folders.filter(f => f.parentFolderId === currentFolderId).map((folder) => (
                    <Card
                      key={folder.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, { type: 'folder', id: folder.id })}
                      onDragOver={(e) => handleDragOver(e, { type: 'folder', id: folder.id })}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folder.id)}
                      className={`hover:shadow-lg transition-all duration-300 group cursor-move ${
                        draggedItem?.type === 'folder' && draggedItem?.id === folder.id ? 'opacity-50' : ''
                      } ${
                        dragOverTarget?.type === 'folder' && dragOverTarget?.id === folder.id ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onDoubleClick={() => handleOpenFolder(folder)}
                    >
                      <CardHeader className="py-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 flex items-center gap-2">
                            <Folder className="w-5 h-5 text-amber-500" />
                            <div>
                              <CardTitle className="text-sm group-hover:text-primary transition-colors">
                                {folder.name}
                              </CardTitle>
                              {folder.description && (
                                <CardDescription className="text-xs mt-1">
                                  {folder.description}
                                </CardDescription>
                              )}
                              <div className="text-xs text-muted-foreground mt-2">
                                {folder.questionSetCount !== undefined && folder.subFolderCount !== undefined && (
                                  <>
                                    {folder.questionSetCount > 0 && <span>{folder.questionSetCount} 个题集</span>}
                                    {folder.questionSetCount > 0 && folder.subFolderCount > 0 && <span> · </span>}
                                    {folder.subFolderCount > 0 && <span>{folder.subFolderCount} 个文件夹</span>}
                                    {folder.questionSetCount === 0 && folder.subFolderCount === 0 && <span>0 个题集 · 0 个文件夹</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFolderDialog(folder);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id, folder.name);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
                    </CardHeader>
                  </Card>
                      ))}
                    </div>
            ) : sortedSets && sortedSets.length > 0 ? (
              <div className="space-y-4">
                {sortedSets.map((set) => (
                  <Card
                    key={set.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'set', id: set.id })}
                    onDragOver={(e) => handleDragOver(e, { type: 'set', id: set.id })}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, currentFolderId)}
                    className={`hover:shadow-lg transition-all duration-300 group cursor-move ${
                      selectedSetId === set.id ? "ring-2 ring-primary shadow-lg" : ""
                    } ${
                      draggedItem?.type === 'set' && draggedItem?.id === set.id ? 'opacity-50' : ''
                    } ${
                      dragOverTarget?.type === 'set' && dragOverTarget?.id === set.id ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedSetId(set.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="group-hover:text-primary transition-colors flex items-center gap-2">
                            <BookOpen className="w-5 h-5" />
                            {set.title}
                          </CardTitle>
                          <CardDescription className="mt-2">{set.description || "暂无描述"}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(set.id, set.title);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(set);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">编辑</span>
                          <span className="sm:hidden">编</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/question-sets/${set.id}`);
                          }}
                        >
                          <BookOpen className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">管理题目</span>
                          <span className="sm:hidden">题</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSetToMove(set);
                            setShowMoveDialog(true);
                          }}
                        >
                          <Move className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">移动</span>
                          <span className="sm:hidden">移</span>
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSetForSession(set);
                            setShowClassSelector(true);
                          }}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">开始</span>
                          <span className="sm:hidden">开</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <BookOpen className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">还没有题目集</h3>
                  <p className="text-muted-foreground mb-6 text-center">创建您的第一个题目集，开始添加题目</p>
                  <Button onClick={() => handleOpenDialog()} size="lg">
                    <Plus className="w-5 h-5 mr-2" />
                    创建第一个题目集
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧预览面板 */}
          <div className="w-96 flex-shrink-0 flex flex-col gap-4">
            {selectedSetId && selectedSet ? (
              <>
              <Card className="flex flex-col h-48">
                <CardContent className="overflow-y-auto space-y-1 flex-1 p-3">
                  {firstQuestion ? (
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
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p className="text-xs">该题集暂无题目</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">参与过的班级</CardTitle>
                </CardHeader>
                <CardContent>
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
                  <p>选择一个题集查看预览</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 题集移动对话框 */}
        <Dialog open={showMoveDialog} onOpenChange={(open) => {
          setShowMoveDialog(open);
          if (!open) {
            setSelectedMoveTarget(undefined);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>移动题集</DialogTitle>
              <DialogDescription>
                选择要将"{setToMove?.title}"移动到的位置
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <Button
                variant={selectedMoveTarget === null ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setSelectedMoveTarget(null);
                }}
              >
                根目录
              </Button>
              {folders && folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant={selectedMoveTarget === folder.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedMoveTarget(folder.id);
                  }}
                >
                  <Folder className="w-4 h-4 mr-2" />
                  {folder.name}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowMoveDialog(false);
                setSelectedMoveTarget(undefined);
              }}>
                取消
              </Button>
              <Button
                disabled={selectedMoveTarget === undefined}
                onClick={() => {
                  if (setToMove && selectedMoveTarget !== undefined) {
                    moveMutation.mutate({ setId: setToMove.id, folderId: selectedMoveTarget });
                    setShowMoveDialog(false);
                    setSelectedMoveTarget(undefined);
                  }
                }}
              >
                确认
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 班级选择弹窗 */}
        <Dialog open={showClassSelector} onOpenChange={setShowClassSelector}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>选择班级</DialogTitle>
              <DialogDescription>
                选择一个班级以开始课堂会话
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {classes && classes.length > 0 ? (
                classes.map((cls) => (
                  <Button
                    key={cls.id}
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => {
                      if (selectedSetForSession) {
                        setLocation(`/sessions/start?setId=${selectedSetForSession.id}&classId=${cls.id}`);
                        setShowClassSelector(false);
                      }
                    }}
                  >
                    {cls.name}
                  </Button>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">还没有班级，请先创建班级</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
