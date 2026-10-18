import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, RefreshCw } from "lucide-react";
import React, { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorCount: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Error caught by boundary:", error);
      console.error("Error info:", errorInfo);
    }
    
    this.logErrorToServer(error, errorInfo);

    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));
  }

  private logErrorToServer = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // 可以在这里发送错误到后端服务
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to log error to server:", err);
      }
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          onReset={this.handleReset}
          onRefresh={this.handleRefresh}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  onReset: () => void;
  onRefresh: () => void;
}

function ErrorFallback({ onReset, onRefresh }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-red-200 dark:border-red-800 overflow-hidden">
          {/* Header */}
          <div className="bg-red-100 dark:bg-red-900 px-6 py-4 border-b border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <h2 className="text-xl font-bold text-red-900 dark:text-red-100">应用程序出错</h2>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              应用程序遇到了一个意外错误。请尝试以下操作：
            </p>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                💡 <strong>提示：</strong>您可以尝试重新加载页面或返回首页。如果问题持续存在，请刷新浏览器。
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
            <button
              onClick={onReset}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg flex-1",
                "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100",
                "hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              )}
            >
              <RefreshCw size={16} />
              重试
            </button>
            <button
              onClick={onRefresh}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg flex-1",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 transition-opacity"
              )}
            >
              <RotateCcw size={16} />
              刷新页面
            </button>
          </div>
        </div>

        {/* Home Button */}
        <button
          onClick={() => (window.location.href = "/")}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg",
            "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100",
            "border border-slate-200 dark:border-slate-700",
            "hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          )}
        >
          <Home size={16} />
          返回首页
        </button>
      </div>
    </div>
  );
}

export default ErrorBoundary;
