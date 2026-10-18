import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ArrowLeft, Loader, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { shouldLogQueryErrorCode } from "@/lib/apiQueryErrorPolicy";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

function logUnexpectedDownloadError(error: unknown) {
  const errorCode =
    error instanceof TRPCClientError ? error.data?.code : undefined;

  if (shouldLogQueryErrorCode(errorCode)) {
    console.error("下载失败：", error);
  }
}

export default function DownloadCards() {
  const [, setLocation] = useLocation();
  const [downloading, setDownloading] = useState(false);

  // 查询答题卡列表
  const cardsListQuery = trpc.answerCards.list.useQuery();
  
  // 检查答题卡是否已初始化
  const initCheckQuery = trpc.answerCards.isInitialized.useQuery();

  // 下载所有答题卡的查询（禁用自动运行）
  const downloadAllQuery = trpc.answerCards.downloadAll.useQuery(
    undefined,
    { enabled: false }
  );

  // 获取tRPC工具函数（在组件顶层调用）
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const initializeMutation = trpc.system.generateAnswerCards.useMutation({
    onSuccess: async (result) => {
      if (result.totalErrors > 0) {
        toast.error(`答题卡初始化完成，但有 ${result.totalErrors} 张生成失败`);
      } else {
        const alreadyInitialized = "alreadyInitialized" in result && result.alreadyInitialized;
        toast.success(alreadyInitialized ? "答题卡已初始化" : `已生成 ${result.totalGenerated} 张答题卡`);
      }
      await Promise.all([
        utils.answerCards.list.invalidate(),
        utils.answerCards.isInitialized.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message || "答题卡初始化失败"),
  });
  const prepareAllMutation = trpc.answerCards.prepareDownloadAll.useMutation();

  const handleDownloadAll = async () => {
    if (!cardsListQuery.data?.cards || cardsListQuery.data.cards.length === 0) {
      alert("答题卡未初始化，请稍后重试");
      return;
    }

    setDownloading(true);
    try {
      // Public route serves an existing cache only; an authenticated teacher may create it.
      const cachedResult = await downloadAllQuery.refetch();
      let downloadResult = cachedResult.data;
      if (!downloadResult?.downloadUrl && meQuery.data) {
        downloadResult = await prepareAllMutation.mutateAsync();
      }

      if (downloadResult?.downloadUrl) {
        // 通过后端返回的预签名URL下载
        const link = document.createElement("a");
        link.href = downloadResult.downloadUrl;
        link.download = downloadResult.fileName || "answer-cards-all.zip";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        if (!meQuery.data && cachedResult.error) {
          toast.error("该下载尚未缓存，请教师登录后生成全部答题卡");
          setLocation("/login");
        } else {
          alert("获取下载链接失败");
        }
      }
    } catch (error) {
      logUnexpectedDownloadError(error);
      alert("下载失败，请重试");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSingle = async (cardNumber: number) => {
    setDownloading(true);
    try {
      // 通过tRPC调用后端API获取单张卡片的下载URL
      const result = await utils.answerCards.downloadSingle.fetch({ cardNumber });
      
      if (result?.downloadUrl) {
        const link = document.createElement("a");
        link.href = result.downloadUrl;
        link.download = result.fileName || `answer-card-${cardNumber}.pdf`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(`答题卡 ${cardNumber} 下载失败`);
      }
    } catch (error) {
      logUnexpectedDownloadError(error);
      alert("下载失败，请重试");
    } finally {
      setDownloading(false);
    }
  };

  const isLoading = cardsListQuery.isLoading || initCheckQuery.isLoading || meQuery.isLoading;
  const isInitialized = initCheckQuery.data?.initialized;
  const cards = cardsListQuery.data?.cards || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            下载答题卡
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            下载Plickers风格的答题卡（1-80）
          </p>
        </div>

        {/* Status Card */}
        {!isInitialized && (
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 p-4 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-amber-900 dark:text-amber-200">
                <p>
                  <strong>首次使用提示：</strong>
                  答题卡尚未初始化。教师登录后可一次性生成 1–80 号答题卡；完成后可下载单张或全部卡片。
                </p>
                {meQuery.data ? (
                  <Button
                    onClick={() => initializeMutation.mutate()}
                    disabled={initializeMutation.isPending || isLoading}
                    className="whitespace-nowrap"
                  >
                    {initializeMutation.isPending ? "初始化中…" : "初始化答题卡"}
                  </Button>
                ) : (
                  <Button onClick={() => setLocation("/login")} className="whitespace-nowrap">
                    教师登录
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Download All Button */}
        <Card className="bg-white dark:bg-slate-800 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                下载全部答题卡（1-80）
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {isInitialized 
                  ? `已准备好 ${cards.length} 张答题卡，点击下载全部为ZIP文件`
                  : "正在准备答题卡..."}
              </p>
            </div>
            <Button
              onClick={handleDownloadAll}
              disabled={!isInitialized || isLoading || downloading || prepareAllMutation.isPending || cards.length === 0}
              className="bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
            >
              {isLoading || downloading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  准备中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  下载全部
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 p-4 mb-8">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            💡 <strong>提示：</strong>
            答题卡采用Plickers标准设计，中间5×5网格用于编码卡号。建议一次性下载全部80张卡片，然后打印使用。
          </p>
        </Card>

        {/* Individual Cards Grid */}
        {isInitialized && cards.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              单个卡片下载
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((card) => (
                <Card key={card.cardNumber} className="bg-white dark:bg-slate-800 p-4">
                  <div className="flex flex-col items-center justify-between h-full">
                    <div className="text-center mb-4">
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {card.cardNumber}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        答题卡
                      </p>
                    </div>
                    <Button
                      onClick={() => handleDownloadSingle(card.cardNumber)}
                      disabled={downloading}
                      size="sm"
                      className="w-full"
                      variant="outline"
                    >
                      {downloading ? (
                        <>
                          <Loader className="w-3 h-3 mr-1 animate-spin" />
                          下载中
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 mr-1" />
                          下载
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                正在加载答题卡...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
