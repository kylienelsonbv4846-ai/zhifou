import { useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Now Playing 投影界面
 * 全屏展示题目、选项和答题统计
 */
export default function NowPlaying() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id || '0');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 获取会话数据
  const { data: session, isLoading: sessionLoading } = trpc.sessions.get.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // 获取题目队列
  const { data: queue, isLoading: queueLoading } = trpc.sessions.getQueue.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
  const setActiveQuestionMutation = trpc.sessions.setActiveQuestion.useMutation({
    onError: (error) => {
      toast.error('切换题目失败: ' + error.message);
    },
  });

  // 获取当前题目的答题统计
  const currentQueueItem = queue?.[currentQuestionIndex];
  const { data: statistics } = trpc.answers.getStatistics.useQuery(
    { sessionId, questionId: currentQueueItem?.questionId || 0 },
    { enabled: !!sessionId && !!currentQueueItem?.questionId, refetchInterval: autoRefresh ? 1000 : undefined }
  );

  // 获取当前题目详情
  const { data: currentQuestion } = trpc.questions.get.useQuery(
    { questionId: currentQueueItem?.questionId || 0 },
    { enabled: !!currentQueueItem?.questionId }
  );

  // 处理全屏
  const handleFullscreen = async () => {
    const elem = document.documentElement;
    if (!isFullscreen) {
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          setIsFullscreen(true);
        } else {
          // 浏览器不支持全屏或权限被拒绝，仅更新 UI 状态
          console.warn('Fullscreen API not available or permission denied');
          setIsFullscreen(true);
        }
      } catch (err) {
        // 权限被拒绝或其他错误，仅更新 UI 状态而不中断用户操作
        console.warn('Fullscreen request failed:', err);
        setIsFullscreen(true);
      }
    } else {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
      setIsFullscreen(false);
    }
  };

  // 服务端切换成功后再更新本地题目，避免界面与投影状态不一致。
  const changeQuestion = (nextIndex: number) => {
    const nextQuestion = queue?.[nextIndex];
    if (!nextQuestion || nextIndex === currentQuestionIndex) return;

    setActiveQuestionMutation.mutate(
      { sessionId, questionId: nextQuestion.questionId },
      {
        onSuccess: () => {
          setCurrentQuestionIndex(nextIndex);
          setShowAnswer(false);
        },
      }
    );
  };

  // 处理题目切换
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      changeQuestion(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (queue && currentQuestionIndex < queue.length - 1) {
      changeQuestion(currentQuestionIndex + 1);
    }
  };

  if (sessionLoading || queueLoading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  if (!session || !queue || queue.length === 0) {
    return <div className="flex items-center justify-center h-screen">无效的会话或题目队列为空</div>;
  }

  const queueItem = currentQueueItem;
  if (!queueItem) {
    return <div className="flex items-center justify-center h-screen">题目加载失败</div>;
  }

  // 准备图表数据
  const chartData = [
    { name: 'A', value: (statistics as any)?.a || 0 },
    { name: 'B', value: (statistics as any)?.b || 0 },
    { name: 'C', value: (statistics as any)?.c || 0 },
    { name: 'D', value: (statistics as any)?.d || 0 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  
  // 获取选项文本的辅助函数
  const getOptionText = (option: string): string => {
    if (!currentQuestion) return '';
    const key = `option${option}` as keyof typeof currentQuestion;
    return (currentQuestion[key] as string) || '';
  };
  
  // 获取选项媒体 URL 的辅助函数
  const getOptionMediaUrl = (option: string): string | undefined => {
    if (!currentQuestion) return undefined;
    const key = `option${option}MediaUrl` as keyof typeof currentQuestion;
    return (currentQuestion[key] as string) || undefined;
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden flex flex-col">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="text-lg font-semibold">
          {session.class?.name} - 题目 {currentQuestionIndex + 1}/{queue.length}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-white border-white hover:bg-white hover:text-slate-900 gap-2"
          >
            {autoRefresh ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {autoRefresh ? '自动刷新' : '暂停刷新'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnswer(!showAnswer)}
            className="text-white border-white hover:bg-white hover:text-slate-900"
          >
            {showAnswer ? '隐藏答案' : '显示答案'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFullscreen}
            className="text-white border-white hover:bg-white hover:text-slate-900"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 overflow-y-auto">
        {/* 题目区域 */}
        <div className="w-full max-w-5xl">
          <h2 className="text-4xl font-bold mb-4 text-center">
            题目 {currentQuestionIndex + 1}
          </h2>
          
          {/* 题目文本 */}
          <p className="text-2xl text-center text-gray-300 mb-4">
            {currentQuestion?.questionText || '题目内容将在这里显示'}
          </p>
          
          {/* 题目媒体（图片或视频） */}
          {currentQuestion?.questionMediaUrl && (
            <div className="mb-6 flex justify-center">
              {currentQuestion.questionMediaType === 'video' ? (
                <video 
                  src={currentQuestion.questionMediaUrl} 
                  className="max-w-full max-h-96 rounded-lg border border-slate-600"
                  controls
                />
              ) : (
                <img 
                  src={currentQuestion.questionMediaUrl} 
                  alt="题目图片" 
                  className="max-w-full h-auto rounded-lg border border-slate-600"
                />
              )}
            </div>
          )}
          
          {/* 选项区域 */}
          {currentQuestion?.questionType !== 'true_false' && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {['A', 'B', 'C', 'D'].map((option) => {
                const optionText = currentQuestion?.[`option${option}` as keyof typeof currentQuestion] as string | undefined;
                const optionMediaUrl = currentQuestion?.[`option${option}MediaUrl` as keyof typeof currentQuestion] as string | undefined;
                
                return (
                  <div key={option} className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                    <div className="text-lg font-semibold text-blue-400 mb-2">{option}</div>
                    {optionText && <p className="text-gray-300 mb-2">{optionText}</p>}
                    {optionMediaUrl && (
                      <img 
                        src={optionMediaUrl} 
                        alt={`选项 ${option}`} 
                        className="w-full h-auto max-h-48 rounded border border-slate-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {showAnswer && (
            <div className="text-center bg-green-900 bg-opacity-50 p-4 rounded-lg border border-green-700">
              <p className="text-lg">正确答案: <span className="text-2xl font-bold text-green-400">{currentQuestion?.correctAnswer?.toUpperCase()}</span></p>
            </div>
          )}
        </div>

        {/* 图表区域 - 柱状图和饼图 */}
        <div className="w-full max-w-5xl grid grid-cols-2 gap-6">
          {/* 柱状图 */}
          <div className="bg-slate-700 p-4 rounded-lg">
            <h3 className="text-center text-lg font-semibold mb-4">答题分布（柱状图）</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 饼图 */}
          <div className="bg-slate-700 p-4 rounded-lg">
            <h3 className="text-center text-lg font-semibold mb-4">选择比例（饼图）</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 答题统计 */}
        <div className="w-full max-w-5xl grid grid-cols-4 gap-4">
          <div className="bg-slate-700 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-blue-400">{statistics?.answered || 0}</div>
            <div className="text-gray-300 text-sm mt-2">已答题</div>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-yellow-400">{statistics?.unanswered || 0}</div>
            <div className="text-gray-300 text-sm mt-2">未答题</div>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-green-400">{statistics?.correctRate || 0}%</div>
            <div className="text-gray-300 text-sm mt-2">正确率</div>
          </div>
          <div className="bg-slate-700 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-purple-400">{statistics?.answered || 0}</div>
            <div className="text-gray-300 text-sm mt-2">班级参与人数</div>
          </div>
        </div>
      </div>

      {/* 底部导航栏 */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-t border-slate-700">
        <Button
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0 || setActiveQuestionMutation.isPending}
          className="px-6 py-2"
        >
          ← 上一题
        </Button>

        <div className="flex gap-2 flex-wrap justify-center">
          {queue.map((_: any, index: number) => (
            <button
              key={index}
              onClick={() => changeQuestion(index)}
              disabled={setActiveQuestionMutation.isPending}
              className={`w-8 h-8 rounded text-sm font-semibold transition-all ${
                index === currentQuestionIndex
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <Button
          onClick={handleNextQuestion}
          disabled={currentQuestionIndex === queue.length - 1 || setActiveQuestionMutation.isPending}
          className="px-6 py-2"
        >
          下一题 →
        </Button>
      </div>
    </div>
  );
}
