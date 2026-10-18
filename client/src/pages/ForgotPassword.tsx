import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { PASSWORD_MAX_LENGTH, PASSWORD_POLICY_PATTERN, passwordPolicySchema } from "@shared/passwordPolicy";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordResetCode.useMutation();
  const verifyResetMutation = trpc.auth.verifyPasswordResetCode.useMutation();

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("邮箱不能为空");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("邮箱格式不正确");
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestResetMutation.mutateAsync({
        email: email.toLowerCase().trim(),
      });
      toast.success(result.message);
      setStep("code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      toast.error("请输入6位验证码");
      return;
    }

    const passwordResult = passwordPolicySchema.safeParse(newPassword);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.issues[0]?.message || "密码格式不符合要求");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);
    try {
      await verifyResetMutation.mutateAsync({
        email: email.toLowerCase().trim(),
        code,
        newPassword,
      });
      toast.success("密码重置成功，请使用新密码登录");
      setLocation("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "code") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">重置密码</CardTitle>
            <CardDescription>
              输入验证码；新密码需 8–128 位，且包含大小写字母、数字和特殊字符。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyReset} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-700">
                  如果该邮箱已注册且邮件服务正常，验证码会发送到 <strong>{email}</strong>；如未收到，请检查垃圾邮件或稍后重试
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  验证码
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="输入6位验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  新密码
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="8–128位，含大小写字母/数字/特殊字符"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    minLength={8}
                    maxLength={PASSWORD_MAX_LENGTH}
                    pattern={PASSWORD_POLICY_PATTERN.source}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium">
                  确认密码
                </label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="确认新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    maxLength={PASSWORD_MAX_LENGTH}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    重置中...
                  </>
                ) : (
                  "重置密码"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-1" />
                  返回
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">忘记密码</CardTitle>
          <CardDescription>
              输入邮箱地址；如果该邮箱已注册，我们会发送验证码
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequestReset} className="space-y-4">
            {/* 邮箱输入框 */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱地址
              </label>
              <Input
                id="email"
                type="email"
                placeholder="请输入您的邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  发送中...
                </>
              ) : (
                "发送验证码"
              )}
            </Button>

            {/* 返回登录链接 */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                返回登录
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
