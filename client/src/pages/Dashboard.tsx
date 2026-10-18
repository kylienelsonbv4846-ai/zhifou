import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Users, BookOpen, PlayCircle, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: classes, isLoading: classesLoading } = trpc.classes.list.useQuery();
  const { data: questionSets, isLoading: setsLoading } = trpc.questionSets.list.useQuery();
  const { data: sessions, isLoading: sessionsLoading } = trpc.sessions.list.useQuery();

  const stats = [
    {
      title: "班级数量",
      value: classes?.length || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      href: "/classes",
    },
    {
      title: "题目集",
      value: questionSets?.length || 0,
      icon: BookOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      href: "/question-sets",
    },
    {
      title: "课堂会话",
      value: sessions?.length || 0,
      icon: PlayCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
      href: "/sessions",
    },
    {
      title: "活跃会话",
      value: sessions?.filter(s => s.status === "active").length || 0,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      href: "/sessions",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">仪表盘</h1>
          <p className="text-muted-foreground">欢迎回来！这是您的课堂数据概览</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
              onClick={() => setLocation(stat.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>快速开始您的课堂活动</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setLocation("/classes")}
            >
              <Users className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">创建班级</div>
                <div className="text-xs text-muted-foreground">添加新的班级和学生</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setLocation("/question-sets")}
            >
              <BookOpen className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">创建题目集</div>
                <div className="text-xs text-muted-foreground">准备课堂问题</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setLocation("/sessions")}
            >
              <PlayCircle className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">开始会话</div>
                <div className="text-xs text-muted-foreground">启动课堂答题</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>最近的班级</CardTitle>
              <CardDescription>您最近创建的班级</CardDescription>
            </CardHeader>
            <CardContent>
              {classesLoading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : classes && classes.length > 0 ? (
                <div className="space-y-3">
                  {classes.slice(0, 5).map((cls) => (
                    <div
                      key={cls.id}
                      className="block p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => setLocation(`/classes/${cls.id}`)}
                    >
                      <div className="font-medium">{cls.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {cls.description || "暂无描述"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">还没有班级</p>
                  <Button onClick={() => setLocation("/classes")}>创建第一个班级</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最近的题目集</CardTitle>
              <CardDescription>您最近创建的题目集</CardDescription>
            </CardHeader>
            <CardContent>
              {setsLoading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : questionSets && questionSets.length > 0 ? (
                <div className="space-y-3">
                  {questionSets.slice(0, 5).map((set) => (
                    <div
                      key={set.id}
                      className="block p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => setLocation(`/question-sets/${set.id}`)}
                    >
                      <div className="font-medium">{set.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {set.description || "暂无描述"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">还没有题目集</p>
                  <Button onClick={() => setLocation("/question-sets")}>创建第一个题目集</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
