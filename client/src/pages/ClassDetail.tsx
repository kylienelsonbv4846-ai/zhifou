import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, Trash2, Edit, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";

export default function ClassDetail() {
  const [, params] = useRoute("/classes/:id");
  const [, setLocation] = useLocation();
  const classId = parseInt(params?.id || "0");

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [name, setName] = useState("");
  const [cardNumber, setCardNumber] = useState<number | undefined>();
  const [importText, setImportText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: classInfo, isLoading: classLoading } = trpc.classes.get.useQuery({ classId });
  const { data: students, isLoading: studentsLoading } = trpc.students.list.useQuery({ classId });
  const { data: nextCardNumber } = trpc.students.getNextCardNumber.useQuery({ classId });
  const utils = trpc.useUtils();

  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => {
      utils.students.list.invalidate();
      utils.students.getNextCardNumber.invalidate();
      setOpen(false);
      setName("");
      setCardNumber(undefined);
      toast.success("学生添加成功");
    },
    onError: (error) => {
      toast.error("添加失败: " + error.message);
    },
  });

  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => {
      utils.students.list.invalidate();
      setOpen(false);
      setEditingStudent(null);
      setName("");
      setCardNumber(undefined);
      toast.success("学生信息已更新");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteMutation = trpc.students.delete.useMutation({
    onSuccess: () => {
      utils.students.list.invalidate();
      utils.students.getNextCardNumber.invalidate();
      toast.success("学生已删除");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const bulkImportMutation = trpc.students.bulkImport.useMutation({
    onSuccess: (data) => {
      utils.students.list.invalidate();
      utils.students.getNextCardNumber.invalidate();
      setImportOpen(false);
      setImportText("");
      toast.success(`成功导入 ${data.imported} 名学生`);
    },
    onError: (error) => {
      toast.error("导入失败: " + error.message);
    },
  });

  const handleOpenDialog = (student?: any) => {
    if (student) {
      setEditingStudent(student);
      setName(student.name);
      setCardNumber(student.cardNumber);
    } else {
      setEditingStudent(null);
      setName("");
      setCardNumber(nextCardNumber);
    }
    setOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("请输入学生姓名");
      return;
    }
    if (!cardNumber || cardNumber < 1 || cardNumber > 40) {
      toast.error("卡片编号必须在 1-40 之间");
      return;
    }

    if (editingStudent) {
      updateMutation.mutate({
        studentId: editingStudent.id,
        name,
        cardNumber,
      });
    } else {
      createMutation.mutate({
        classId,
        name,
        cardNumber,
      });
    }
  };

  const handleDelete = (studentId: number, studentName: string) => {
    if (confirm(`确定要删除学生"${studentName}"吗？`)) {
      deleteMutation.mutate({ studentId });
    }
  };

  const parseImportData = (text: string) => {
    const lines = text.trim().split("\n").filter(line => line.trim());
    const students = [];
    
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 1) continue;
      
      const name = parts[0];
      const cardNumber = parts[1] ? parseInt(parts[1]) : undefined;
      
      if (!name) continue;
      students.push({ name, cardNumber });
    }
    
    return students;
  };

  const handleBulkImport = () => {
    if (!importText.trim()) {
      toast.error("请输入学生数据");
      return;
    }

    try {
      const studentsToImport = parseImportData(importText);
      if (studentsToImport.length === 0) {
        toast.error("未能解析任何学生数据");
        return;
      }

      if (studentsToImport.length > 40) {
        toast.error("最多只能导入 40 名学生");
        return;
      }

      bulkImportMutation.mutate({
        classId,
        students: studentsToImport,
      });
    } catch (error) {
      toast.error("解析失败: " + (error instanceof Error ? error.message : "未知错误"));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template = "张三\n李四,5\n王五,10";
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(template));
    element.setAttribute("download", "students_template.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("模板已下载");
  };

  if (classLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!classInfo) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">班级不存在</h2>
          <Button onClick={() => setLocation("/classes")}>返回班级列表</Button>
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
              onClick={() => setLocation("/classes")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{classInfo.name}</h1>
              <p className="text-muted-foreground">{classInfo.description || "暂无描述"}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  批量导入
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>批量导入学生</DialogTitle>
                  <DialogDescription>
                    支持粘贴或上传 CSV/TXT 文件。每行一个学生，格式为：姓名 或 姓名,卡号
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="paste" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paste">粘贴数据</TabsTrigger>
                    <TabsTrigger value="upload">上传文件</TabsTrigger>
                  </TabsList>
                  <TabsContent value="paste" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="import-text">学生数据</Label>
                      <textarea
                        id="import-text"
                        className="w-full h-48 p-3 border border-input rounded-md font-mono text-sm"
                        placeholder="张三\n李四,5\n王五,10"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>示例：</p>
                      <code className="block bg-muted p-2 rounded mt-2">
                        张三<br/>
                        李四,5<br/>
                        王五,10
                      </code>
                    </div>
                  </TabsContent>
                  <TabsContent value="upload" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="file-upload">选择文件</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="file-upload"
                        accept=".csv,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        选择 CSV 或 TXT 文件
                      </Button>
                      {importText && (
                        <div className="text-sm text-green-600">
                          ✓ 已加载 {parseImportData(importText).length} 名学生
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={downloadTemplate}>
                    下载模板
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
                    <Button
                      onClick={handleBulkImport}
                      disabled={bulkImportMutation.isPending || !importText.trim()}
                    >
                      {bulkImportMutation.isPending ? "导入中..." : "导入"}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加学生
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingStudent ? "编辑学生" : "添加学生"}</DialogTitle>
                  <DialogDescription>
                    {editingStudent ? "更新学生信息" : "为班级添加新学生"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">学生姓名 *</Label>
                    <Input
                      id="name"
                      placeholder="输入学生姓名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">卡片编号 (1-40) *</Label>
                    <Input
                      id="cardNumber"
                      type="number"
                      min="1"
                      max="40"
                      placeholder="1-40"
                      value={cardNumber || ""}
                      onChange={(e) => setCardNumber(parseInt(e.target.value) || undefined)}
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

        <Card>
          <CardHeader>
            <CardTitle>学生名单</CardTitle>
            <CardDescription>
              班级共有 {students?.length || 0} 名学生
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : students && students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>卡片编号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">#{student.cardNumber}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(student)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(student.id, student.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">还没有学生</p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加第一个学生
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
