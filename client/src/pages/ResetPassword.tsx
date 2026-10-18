import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { PASSWORD_MAX_LENGTH, passwordPolicySchema } from "@shared/passwordPolicy";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("无效的重置链接");
      setLocation("/login");
    }
  }, [token, setLocation]);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsSuccess(true);
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || "重置失败，请重试");
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const passwordResult = passwordPolicySchema.safeParse(formData.password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.issues[0]?.message || "密码格式不正确";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "确认密码不能为空";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "两次输入的密码不一致";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!token) {
      toast.error("重置令牌缺失");
      return;
    }

    setIsLoading(true);
    resetMutation.mutate({
      token,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });
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

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-center">重置成功</CardTitle>
            <CardDescription className="text-center">
              您的密码已成功重置，即将跳转到登录页面
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-center">无效链接</CardTitle>
            <CardDescription className="text-center">
              重置链接无效或已过期
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full"
            >
              返回登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">重置密码</CardTitle>
          <CardDescription>
            请输入您的新密码
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 新密码输入框 */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                新密码
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="至少8个字符，包含大小写、数字和特殊字符"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                maxLength={PASSWORD_MAX_LENGTH}
                className={errors.password ? "border-red-500" : ""}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
              <p className="text-xs text-gray-500">
                密码要求：至少8个字符，包含大小写字母、数字和特殊字符(!@#$%^&*)
              </p>
            </div>

            {/* 确认密码输入框 */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                确认密码
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                className={errors.confirmPassword ? "border-red-500" : ""}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword}</p>
              )}
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
                  重置中...
                </>
              ) : (
                "重置密码"
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
