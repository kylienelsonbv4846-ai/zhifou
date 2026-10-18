import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, BookOpen, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleDownloadCards = async () => {
    // 打开下载页面，列出所有 80 张答题卡
    setLocation("/download-cards");
  };

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // 刷新页面以重新加载认证状态
      window.location.href = "/";
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ClassClicker</h1>
          </div>
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">{user?.name}</span>
              <Button
                variant="outline"
                onClick={handleLogout}
              >
                登出
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                onClick={() => setLocation("/register")}
              >
                注册
              </Button>
              <Button onClick={() => setLocation("/login")}>
                登录
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            课堂即时反馈系统
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
            实时学生反馈收集和分析
          </p>
        </div>

        {/* Answer Cards Download Section */}
        <Card className="bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-900 p-8 mb-12">
          <div className="flex items-start gap-6">
            <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-lg">
              <Download className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                下载答题卡
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                下载完整的答题卡集合（1-80）。这些卡片是通用的，可以在所有班级中使用。一次打印，永久使用。
              </p>
              <div className="flex gap-4">
                <Button
                  onClick={handleDownloadCards}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载全部答题卡（1-80）
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Features Grid */}
        {isAuthenticated && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card
              className="bg-white dark:bg-slate-800 p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleNavigate("/classes")}
            >
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                管理班级
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                创建和管理您的班级，添加学生，组织您的教学。
              </p>
            </Card>

            <Card
              className="bg-white dark:bg-slate-800 p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleNavigate("/question-sets")}
            >
              <BookOpen className="w-8 h-8 text-green-600 dark:text-green-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                题库
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                创建和管理包含多选题、单选题和判断题的题目集合。
              </p>
            </Card>

            <Card
              className="bg-white dark:bg-slate-800 p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleNavigate("/sessions")}
            >
              <div className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-3">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                直播课堂
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                启动直播课堂会话并实时收集学生反馈。
              </p>
            </Card>
          </div>
        )}

        {/* Call to Action */}
        {!isAuthenticated && (
          <div className="text-center">
            <Button
              onClick={() => setLocation("/login")}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-lg px-8 py-6"
            >
              开始使用
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
