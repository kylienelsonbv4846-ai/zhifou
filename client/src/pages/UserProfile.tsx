import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Loader2, ArrowLeft, Link2, Unlink2, CheckCircle2, AlertCircle, MessageCircle, Music } from "lucide-react";

export default function UserProfile() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isLoadingUser } = trpc.auth.me.useQuery();
  
  const [formData, setFormData] = useState({
    name: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // 微信绑定状态
  const [wechatBindingCode, setWechatBindingCode] = useState("");
  const [showWechatInput, setShowWechatInput] = useState(false);
  
  // QQ绑定状态
  const [qqBindingCode, setQQBindingCode] = useState("");
  const [showQQInput, setShowQQInput] = useState(false);
  
  // 抖音绑定状态
  const [douyinBindingCode, setDouyinBindingCode] = useState("");
  const [showDouyinInput, setShowDouyinInput] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
      });
    }
  }, [user]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (updatedUser) => {
      toast.success("✓ 资料更新成功", {
        description: "您的个人信息已更新",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      setFormData({
        name: updatedUser.name || "",
      });
    },
    onError: (error) => {
      toast.error("✗ 更新失败", {
        description: error.message || "请重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  // 微信绑定
  const bindWeChatMutation = trpc.auth.bindWeChat.useMutation({
    onSuccess: () => {
      toast.success("✓ 微信账号绑定成功", {
        description: "您可以使用微信账号登录",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      setWechatBindingCode("");
      setShowWechatInput(false);
    },
    onError: (error) => {
      toast.error("✗ 微信绑定失败", {
        description: error.message || "请检查输入后重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
  });

  const unbindWeChatMutation = trpc.auth.unbindWeChat.useMutation({
    onSuccess: () => {
      toast.success("✓ 微信账号已解绑", {
        description: "您将无法使用微信账号登录",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
    },
    onError: (error) => {
      toast.error("✗ 解绑失败", {
        description: error.message || "请重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
  });

  // QQ绑定
  const bindQQMutation = trpc.auth.bindQQ.useMutation({
    onSuccess: () => {
      toast.success("✓ QQ账号绑定成功", {
        description: "您可以使用QQ账号登录",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      setQQBindingCode("");
      setShowQQInput(false);
    },
    onError: (error) => {
      toast.error("✗ QQ绑定失败", {
        description: error.message || "请检查输入后重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
  });

  const unbindQQMutation = trpc.auth.unbindQQ.useMutation({
    onSuccess: () => {
      toast.success("✓ QQ账号已解绑", {
        description: "您将无法使用QQ账号登录",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
    },
    onError: (error) => {
      toast.error("✗ 解绑失败", {
        description: error.message || "请重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
  });

  // 抖音绑定
  const bindDouyinMutation = trpc.auth.bindDouyin.useMutation({
    onSuccess: () => {
      toast.success("✓ 抖音账号绑定成功", {
        description: "您可以使用抖音账号登录",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      setDouyinBindingCode("");
      setShowDouyinInput(false);
    },
    onError: (error) => {
      toast.error("✗ 抖音绑定失败", {
        description: error.message || "请检查输入后重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
  });

  const unbindDouyinMutation = trpc.auth.unbindDouyin.useMutation({
    onSuccess: () => {
      toast.success("✓ 抖音账号已解绑", {
        description: "您将无法使用抖音账号登录",
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
    },
    onError: (error) => {
      toast.error("✗ 解绑失败", {
        description: error.message || "请重试",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "昵称不能为空";
    } else if (formData.name.length > 100) {
      newErrors.name = "昵称过长（最多100个字符）";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("✗ 请选择图片文件", {
        description: "仅支持图片格式",
        icon: <AlertCircle className="w-4 h-4" />,
      });
      return;
    }

    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error("✗ 图片大小过大", {
        description: "请选择小于5MB的图片",
        icon: <AlertCircle className="w-4 h-4" />,
      });
      return;
    }

    // 创建本地预览
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewUrl(dataUrl);
      setFormData((prev) => ({
        ...prev,
        avatarUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    updateProfileMutation.mutate({
      name: formData.name.trim(),
    });
  };

  // 微信处理函数
  const handleBindWeChat = async () => {
    if (!wechatBindingCode.trim()) {
      toast.error("✗ 请输入微信ID", {
        icon: <AlertCircle className="w-4 h-4" />,
      });
      return;
    }

    try {
      await bindWeChatMutation.mutateAsync({
        wechatId: wechatBindingCode.trim(),
      });
    } catch {}
  };

  const handleUnbindWeChat = async () => {
    try {
      await unbindWeChatMutation.mutateAsync();
    } catch {}
  };

  // QQ处理函数
  const handleBindQQ = async () => {
    if (!qqBindingCode.trim()) {
      toast.error("✗ 请输入QQ ID", {
        icon: <AlertCircle className="w-4 h-4" />,
      });
      return;
    }

    try {
      await bindQQMutation.mutateAsync({
        qqId: qqBindingCode.trim(),
      });
    } catch {}
  };

  const handleUnbindQQ = async () => {
    try {
      await unbindQQMutation.mutateAsync();
    } catch {}
  };

  // 抖音处理函数
  const handleBindDouyin = async () => {
    if (!douyinBindingCode.trim()) {
      toast.error("✗ 请输入抖音ID", {
        icon: <AlertCircle className="w-4 h-4" />,
      });
      return;
    }

    try {
      await bindDouyinMutation.mutateAsync({
        douyinId: douyinBindingCode.trim(),
      });
    } catch {}
  };

  const handleUnbindDouyin = async () => {
    try {
      await unbindDouyinMutation.mutateAsync();
    } catch {}
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">请先登录</p>
            <Button onClick={() => setLocation("/login")}>
              返回登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回仪表板
        </button>

        <Card className="shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">编辑个人资料</CardTitle>
            <CardDescription>
              更新您的昵称、头像和社交媒体链接
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 头像预览和上传 */}
              <div className="space-y-4">
                <label className="text-sm font-medium">头像</label>
                
                {/* 头像预览 */}
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-blue-200">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="头像预览"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 text-center">
                        <div className="text-4xl mb-1">👤</div>
                        <div className="text-xs">无头像</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 文件上传按钮 */}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    上传图片
                  </Button>
                </div>
              </div>

              {/* 昵称输入框 */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  昵称
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="请输入昵称"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* 邮箱显示（只读） */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  value={user.email || ""}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">邮箱不能修改</p>
              </div>

              {/* 社交媒体链接区域 */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">社交媒体链接</h3>
                <div className="space-y-3">
                  
                  {/* 微信绑定卡片 */}
                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                            微
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">微信账号</p>
                            {user.wechatId ? (
                              <p className="text-sm text-gray-600">已绑定: {user.wechatId}</p>
                            ) : (
                              <p className="text-sm text-gray-500">未绑定</p>
                            )}
                          </div>
                        </div>
                        {user.wechatId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUnbindWeChat}
                            disabled={unbindWeChatMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Unlink2 className="w-4 h-4 mr-1" />
                            解绑
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setShowWechatInput(!showWechatInput)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Link2 className="w-4 h-4 mr-1" />
                            绑定
                          </Button>
                        )}
                      </div>

                      {/* 微信绑定输入框 */}
                      {showWechatInput && !user.wechatId && (
                        <div className="mt-4 space-y-3 border-t pt-4">
                          <div className="space-y-2">
                            <label htmlFor="wechatId" className="text-sm font-medium">
                              微信OpenID
                            </label>
                            <Input
                              id="wechatId"
                              type="text"
                              placeholder="请输入您的微信OpenID"
                              value={wechatBindingCode}
                              onChange={(e) => setWechatBindingCode(e.target.value)}
                              disabled={bindWeChatMutation.isPending}
                            />
                            <p className="text-xs text-gray-500">
                              您可以在微信开放平台获取您的OpenID
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleBindWeChat}
                              disabled={bindWeChatMutation.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {bindWeChatMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  绑定中...
                                </>
                              ) : (
                                "确认绑定"
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowWechatInput(false);
                                setWechatBindingCode("");
                              }}
                              disabled={bindWeChatMutation.isPending}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* QQ绑定卡片 */}
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                            <MessageCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">QQ账号</p>
                            {user.qqId ? (
                              <p className="text-sm text-gray-600">已绑定: {user.qqId}</p>
                            ) : (
                              <p className="text-sm text-gray-500">未绑定</p>
                            )}
                          </div>
                        </div>
                        {user.qqId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUnbindQQ}
                            disabled={unbindQQMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Unlink2 className="w-4 h-4 mr-1" />
                            解绑
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setShowQQInput(!showQQInput)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Link2 className="w-4 h-4 mr-1" />
                            绑定
                          </Button>
                        )}
                      </div>

                      {/* QQ绑定输入框 */}
                      {showQQInput && !user.qqId && (
                        <div className="mt-4 space-y-3 border-t pt-4">
                          <div className="space-y-2">
                            <label htmlFor="qqId" className="text-sm font-medium">
                              QQ ID
                            </label>
                            <Input
                              id="qqId"
                              type="text"
                              placeholder="请输入您的QQ ID"
                              value={qqBindingCode}
                              onChange={(e) => setQQBindingCode(e.target.value)}
                              disabled={bindQQMutation.isPending}
                            />
                            <p className="text-xs text-gray-500">
                              您可以在QQ互联平台获取您的QQ ID
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleBindQQ}
                              disabled={bindQQMutation.isPending}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              {bindQQMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  绑定中...
                                </>
                              ) : (
                                "确认绑定"
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowQQInput(false);
                                setQQBindingCode("");
                              }}
                              disabled={bindQQMutation.isPending}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 抖音绑定卡片 */}
                  <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-300 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                            <Music className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">抖音账号</p>
                            {user.douyinId ? (
                              <p className="text-sm text-gray-600">已绑定: {user.douyinId}</p>
                            ) : (
                              <p className="text-sm text-gray-500">未绑定</p>
                            )}
                          </div>
                        </div>
                        {user.douyinId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUnbindDouyin}
                            disabled={unbindDouyinMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Unlink2 className="w-4 h-4 mr-1" />
                            解绑
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setShowDouyinInput(!showDouyinInput)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Link2 className="w-4 h-4 mr-1" />
                            绑定
                          </Button>
                        )}
                      </div>

                      {/* 抖音绑定输入框 */}
                      {showDouyinInput && !user.douyinId && (
                        <div className="mt-4 space-y-3 border-t pt-4">
                          <div className="space-y-2">
                            <label htmlFor="douyinId" className="text-sm font-medium">
                              抖音ID
                            </label>
                            <Input
                              id="douyinId"
                              type="text"
                              placeholder="请输入您的抖音ID"
                              value={douyinBindingCode}
                              onChange={(e) => setDouyinBindingCode(e.target.value)}
                              disabled={bindDouyinMutation.isPending}
                            />
                            <p className="text-xs text-gray-500">
                              您可以在抖音开放平台获取您的抖音ID
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleBindDouyin}
                              disabled={bindDouyinMutation.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700"
                            >
                              {bindDouyinMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  绑定中...
                                </>
                              ) : (
                                "确认绑定"
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowDouyinInput(false);
                                setDouyinBindingCode("");
                              }}
                              disabled={bindDouyinMutation.isPending}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存更改"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
