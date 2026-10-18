import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Users as UsersIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Classes() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClass, setSelectedClass] = useState<number | null>(null);

  const { data: classes, isLoading } = trpc.classes.list.useQuery();
  const utils = trpc.useUtils();
  
  const createMutation = trpc.classes.create.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      setOpen(false);
      setName("");
      setDescription("");
      toast.success("班级创建成功");
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });

  const deleteMutation = trpc.classes.delete.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      toast.success("班级已删除");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("请输入班级名称");
      return;
    }
    createMutation.mutate({ name, description });
  };

  const handleDelete = (classId: number, className: string) => {
    if (confirm(`确定要删除班级"${className}"吗？这将同时删除班级中的所有学生。`)) {
      deleteMutation.mutate({ classId });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">班级管理</h1>
            <p className="text-muted-foreground">管理您的班级和学生</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg">
                <Plus className="w-5 h-5 mr-2" />
                创建班级
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新班级</DialogTitle>
                <DialogDescription>添加一个新的班级，然后您可以为其添加学生</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">班级名称 *</Label>
                  <Input id="name" placeholder="例如：高一（3）班" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述（可选）</Label>
                  <Textarea id="description" placeholder="班级描述或备注" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? "创建中..." : "创建"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* 两栏布局 */}
        <div className="grid grid-cols-3 gap-6">
          {/* 左侧：班级列表 */}
          <div className="col-span-2">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
                    </CardHeader>
                    <CardContent><div className="h-4 bg-muted rounded w-full"></div></CardContent>
                  </Card>
                ))}
              </div>
            ) : classes && classes.length > 0 ? (
              <div className="space-y-4">
                {classes.map((cls) => (
                  <Card 
                    key={cls.id} 
                    className={`hover:shadow-lg transition-all duration-300 group cursor-pointer ${selectedClass === cls.id ? 'border-primary border-2' : ''}`}
                    onClick={() => setSelectedClass(cls.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="group-hover:text-primary transition-colors">{cls.name}</CardTitle>
                          <CardDescription className="mt-2">{cls.description || "暂无描述"}</CardDescription>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cls.id, cls.name);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/classes/${cls.id}`);
                        }}
                      >
                        <UsersIcon className="w-4 h-4 mr-2" />
                        管理学生
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <UsersIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">还没有班级</h3>
                  <p className="text-muted-foreground mb-6 text-center">创建您的第一个班级，开始管理学生和进行课堂互动</p>
                  <Button onClick={() => setOpen(true)} size="lg"><Plus className="w-5 h-5 mr-2" />创建第一个班级</Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：预留空白区域 */}
          <div className="col-span-1"></div>
        </div>
      </div>
    </DashboardLayout>
  );
}
