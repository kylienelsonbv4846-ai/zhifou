import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

/**
 * 学生答题界面。页面只接受教师签发的、绑定会话和学生身份的短期链接。
 */
export default function StudentAnswer() {
  const { sessionId, studentId } = useParams<{ sessionId: string; studentId: string }>();
  const sessionNumber = Number(sessionId || 0);
  const studentNumber = Number(studentId || 0);
  const [token] = useState(() =>
    new URLSearchParams(window.location.search).get('access_token') || ''
  );
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 将 bearer token 从地址栏移除，后续请求只在当前页面内存中携带。
  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('access_token');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [token]);

  const sessionQuery = trpc.studentAccess.getSession.useQuery(
    { sessionId: sessionNumber, studentId: studentNumber, token },
    {
      enabled: Boolean(token && sessionNumber > 0 && studentNumber > 0),
      refetchInterval: 3000,
      retry: false,
    }
  );

  const submitMutation = trpc.studentAccess.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setFeedback('答案已收到，请等待老师公布结果。');
      toast.success('答案已提交');
      void sessionQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || '答案提交失败，请重试');
    },
  });

  useEffect(() => {
    const data = sessionQuery.data;
    if (!data) return;
    setSelectedAnswer(data.submittedAnswer);
    setSubmitted(Boolean(data.submittedAnswer));
    setFeedback(data.submittedAnswer ? '答案已提交，请等待老师公布结果。' : null);
  }, [sessionQuery.data?.question.id, sessionQuery.data?.submittedAnswer]);

  const handleSubmit = () => {
    const question = sessionQuery.data?.question;
    if (!question || !selectedAnswer || submitted) {
      if (!selectedAnswer) toast.error('请至少选择一个选项');
      return;
    }
    submitMutation.mutate({
      sessionId: sessionNumber,
      studentId: studentNumber,
      questionId: question.id,
      token,
      answer: selectedAnswer,
    });
  };

  if (!token || sessionNumber <= 0 || studentNumber <= 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 text-center">
        <p>答题链接无效，请联系老师获取新的学生链接。</p>
      </div>
    );
  }

  if (sessionQuery.isLoading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 text-center">
        <p>{sessionQuery.error?.message || '答题链接无效或已过期，请联系老师。'}</p>
      </div>
    );
  }

  const { className, studentName, question, questionNumber, questionCount } = sessionQuery.data;
  const options = question.questionType === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
  const optionValue = (option: string) => question[`option${option}` as 'optionA' | 'optionB' | 'optionC' | 'optionD'];
  const optionMedia = (option: string) => question[`option${option}MediaUrl` as 'optionAMediaUrl' | 'optionBMediaUrl' | 'optionCMediaUrl' | 'optionDMediaUrl'];

  const renderMedia = (url: string | null | undefined, kind?: 'image' | 'video' | null) => {
    if (!url) return null;
    if (kind === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
      return <video src={url} controls playsInline className="mt-3 max-h-80 max-w-full rounded-lg" />;
    }
    return <img src={url} alt="题目媒体" className="mt-3 max-h-80 max-w-full rounded-lg object-contain" />;
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{className}</h1>
          <p className="text-gray-600">学生：{studentName}</p>
        </div>

        <Card className="p-6 md:p-8 mb-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{question.questionText}</h2>
            {question.questionType === 'multiple_choice' && (
              <p className="mb-3 text-sm font-medium text-blue-700">多选题：请选择所有正确选项</p>
            )}
            {renderMedia(question.questionMediaUrl, question.questionMediaType)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {options.map((option) => {
              const mediaUrl = optionMedia(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    if (submitted) return;
                    if (question.questionType !== 'multiple_choice') {
                      setSelectedAnswer(option);
                      return;
                    }
                    setSelectedAnswer((current) => {
                      const selected = new Set(current || '');
                      if (selected.has(option)) selected.delete(option);
                      else selected.add(option);
                      const normalized = Array.from(selected).sort().join('');
                      return normalized || null;
                    });
                  }}
                  disabled={submitted}
                  aria-pressed={Boolean(selectedAnswer?.includes(option))}
                  className={`p-5 rounded-lg text-left transition-all ${
                    selectedAnswer?.includes(option)
                      ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-700'
                      : submitted
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-white text-gray-900 border-2 border-gray-200 hover:border-blue-500 hover:shadow-md'
                  }`}
                >
                  <span className="font-bold text-xl">{option}</span>
                  {optionValue(option) && <span className="ml-3">{optionValue(option)}</span>}
                  {renderMedia(mediaUrl)}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className="p-4 rounded-lg text-center font-semibold mb-6 bg-blue-50 text-blue-800">
              {feedback}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitted || submitMutation.isPending || !selectedAnswer}
            className="w-full py-3 text-lg font-semibold"
          >
            {submitMutation.isPending ? '提交中...' : submitted ? '已提交' : '提交答案'}
          </Button>
        </Card>

        <div className="text-center text-gray-600">
          <p>题目 {questionNumber} / {questionCount}</p>
        </div>
      </div>
    </div>
  );
}
