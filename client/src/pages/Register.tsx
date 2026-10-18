'use client';

import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useRegistration } from '@/contexts/RegistrationContext';
import { toast } from 'sonner';
import { PASSWORD_MAX_LENGTH, PASSWORD_POLICY_PATTERN } from '@shared/passwordPolicy';

export default function Register() {
  const [, setLocation] = useLocation();
  const { setRegistrationData } = useRegistration();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const registerMutation = trpc.auth.register.useMutation();

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 处理注册
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 验证表单
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      // 显示浏览器的原生验证错误
      form.reportValidity();
      return;
    }

    // 检查密码是否一致
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      // 注册账户
      const result = await registerMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      // 注册成功
      if (result) {
        setRegistrationData({ email: result.email });
        toast.success(result.message);
        setLocation('/verify-email');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '注册失败，请重试';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">创建账户</h1>
        <p className="text-center text-gray-600 mb-6">注册一个新的ClassClicker账户</p>

        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          {/* 名字输入框 */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              名字 <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="请输入您的名字"
              value={formData.name}
              onChange={handleInputChange}
              disabled={isLoading}
              required
              minLength={2}
              maxLength={50}
              title="名字长度必须在2-50个字符之间"
            />
          </div>

          {/* 邮箱输入框 */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              邮箱 <span className="text-red-500">*</span>
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="请输入您的邮箱"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
              required
              title="请输入有效的邮箱地址"
            />
          </div>

          {/* 密码输入框 */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              密码 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-600">
              至少8个字符，包含大小写字母、数字和特殊字符(!@#$%^&*)
            </p>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="至少8个字符，包含大小写、数字和特殊字符"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                required
                minLength={8}
                maxLength={PASSWORD_MAX_LENGTH}
                pattern={PASSWORD_POLICY_PATTERN.source}
                title="密码必须至少8个字符，包含大小写字母、数字和特殊字符(!@#$%^&*)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 确认密码输入框 */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              确认密码 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="请再次输入密码"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                required
                minLength={8}
                title="请再次输入密码"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 注册按钮 */}
          <Button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
            {isLoading ? '注册中...' : '注册'}
          </Button>
        </form>

        {/* 登录链接 */}
        <p className="text-center text-sm text-gray-600 mt-4">
          已有账户？
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            登录
          </a>
        </p>
      </div>
    </div>
  );
}
