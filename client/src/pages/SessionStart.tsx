import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SessionStart() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const setId = searchParams.get("setId");
  const classId = searchParams.get("classId");
  const creationStarted = useRef(false);

  const startSessionMutation = trpc.sessions.start.useMutation({
    onError: (error) => {
      toast.error("启动会话失败: " + error.message);
      setLocation("/sessions");
    },
  });

  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: (response) => {
      startSessionMutation.mutate({ sessionId: response.sessionId }, {
        onSuccess: () => setLocation(`/sessions/${response.sessionId}/play`),
      });
    },
    onError: (error) => {
      toast.error("创建会话失败: " + error.message);
      setLocation("/question-sets");
    },
  });

  useEffect(() => {
    if (creationStarted.current) return;
    creationStarted.current = true;
    if (setId && classId) {
      // 创建会话
      createSessionMutation.mutate({
        classId: parseInt(classId),
        setId: parseInt(setId),
      });
    } else {
      toast.error("缺少必要参数");
      setLocation("/question-sets");
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">正在创建并启动课堂会话...</p>
      </div>
    </div>
  );
}
