# QQ和抖音OAuth快速开始指南

## 5分钟快速集成

### 第一步：获取OAuth凭证

#### QQ OAuth凭证获取

1. 访问 [QQ互联官网](https://connect.qq.com/)
2. 注册开发者账户 → 创建应用 → 选择"网站应用"
3. 填写应用信息，设置回调地址为：
   ```
   https://your-domain.com/api/oauth/qq/callback
   ```
4. 应用审核通过后，获得：
   - **AppID**: 例如 `123456789`
   - **AppKey**: 例如 `abcdef1234567890`

#### 抖音OAuth凭证获取

1. 访问 [抖音开放平台](https://open.douyin.com/)
2. 注册开发者账户 → 创建应用 → 选择"网站应用"
3. 填写应用信息，设置回调地址为：
   ```
   https://your-domain.com/api/oauth/douyin/callback
   ```
4. 应用审核通过后，获得：
   - **Client Key**: 例如 `aw123456789`
   - **Client Secret**: 例如 `xyz987654321`

### 第二步：配置环境变量

在项目根目录的 `.env` 文件中添加：

```env
# QQ OAuth
QQ_APP_ID=your_qq_app_id
QQ_APP_KEY=your_qq_app_key
QQ_REDIRECT_URI=https://your-domain.com/api/oauth/qq/callback

# 抖音OAuth
DOUYIN_CLIENT_KEY=your_douyin_client_key
DOUYIN_CLIENT_SECRET=your_douyin_client_secret
DOUYIN_REDIRECT_URI=https://your-domain.com/api/oauth/douyin/callback
```

### 第三步：创建数据库列

执行以下SQL命令创建必要的数据库列：

```sql
-- 如果还没有这些列，执行以下命令
ALTER TABLE users ADD COLUMN qqId VARCHAR(128) UNIQUE NULL AFTER wechatId;
ALTER TABLE users ADD COLUMN douyinId VARCHAR(128) UNIQUE NULL AFTER qqId;
ALTER TABLE users ADD COLUMN loginMethod VARCHAR(64) DEFAULT 'local';
```

### 第四步：复制代码文件

将以下文件复制到项目中：

```bash
# OAuth服务文件
cp docs/oauth/qq.ts server/oauth/qq.ts
cp docs/oauth/douyin.ts server/oauth/douyin.ts

# OAuth路由文件
cp docs/oauth/oauth-qq.ts server/routers/oauth-qq.ts
cp docs/oauth/oauth-douyin.ts server/routers/oauth-douyin.ts

# 前端组件
cp docs/oauth/OAuthLoginButtons.tsx client/src/components/OAuthLoginButtons.tsx
cp docs/oauth/OAuthCallback.tsx client/src/pages/OAuthCallback.tsx
```

### 第五步：集成到主路由

编辑 `server/routers.ts`，在 `appRouter` 中添加：

```typescript
import { qqOAuthRouter } from './routers/oauth-qq';
import { douyinOAuthRouter } from './routers/oauth-douyin';

export const appRouter = router({
  // ... 其他路由
  oauth: router({
    qq: qqOAuthRouter,
    douyin: douyinOAuthRouter,
  }),
});
```

### 第六步：在登录页面添加OAuth按钮

编辑 `client/src/pages/Login.tsx`：

```typescript
import OAuthLoginButtons from '@/components/OAuthLoginButtons';

export default function Login() {
  return (
    <div className="space-y-6">
      {/* 现有登录表单 */}
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">或使用社交账号登录</span>
        </div>
      </div>

      <OAuthLoginButtons />
    </div>
  );
}
```

### 第七步：添加回调路由

在 `client/src/App.tsx` 中添加回调页面路由：

```typescript
import OAuthCallback from '@/pages/OAuthCallback';

export default function App() {
  return (
    <Switch>
      {/* 其他路由 */}
      <Route path="/oauth/callback" component={OAuthCallback} />
    </Switch>
  );
}
```

### 第八步：测试

1. 启动开发服务器：
   ```bash
   pnpm dev
   ```

2. 访问登录页面，点击"使用QQ登录"或"使用抖音登录"

3. 完成授权流程，验证用户是否成功登录

## 常见问题排查

### 问题1：回调时收到 `Invalid state parameter` 错误

**原因**: State参数验证失败

**解决**:
- 确保前端正确保存了state到localStorage
- 确保后端正确验证了state参数
- 检查浏览器的localStorage是否被清空

### 问题2：获取用户信息时返回 `API error`

**原因**: 可能是AppKey或AppSecret配置错误

**解决**:
- 检查 `.env` 文件中的凭证是否正确
- 确保凭证没有被意外修改
- 在QQ互联或抖音开放平台重新验证凭证

### 问题3：回调地址不匹配错误

**原因**: 配置的回调地址与OAuth平台设置不一致

**解决**:
- 在QQ互联或抖音开放平台检查回调地址设置
- 确保 `.env` 中的 `REDIRECT_URI` 与平台设置完全一致
- 注意HTTP vs HTTPS的区别

### 问题4：用户信息获取失败

**原因**: 可能是access_token已过期或权限不足

**解决**:
- 确保请求了正确的权限范围（scope）
- 检查access_token是否已过期
- 使用refresh_token刷新access_token

## 下一步

- 阅读完整的 [OAuth集成指南](./OAUTH_INTEGRATION_GUIDE.md)
- 了解 [安全最佳实践](./OAUTH_INTEGRATION_GUIDE.md#安全最佳实践)
- 查看 [测试指南](./OAUTH_INTEGRATION_GUIDE.md#测试)

## 支持

如有问题，请参考：
- [QQ互联文档](https://wiki.connect.qq.com/)
- [抖音开放平台文档](https://open.douyin.com/platform/resource/docs)
- [OAuth 2.0标准](https://tools.ietf.org/html/rfc6749)

