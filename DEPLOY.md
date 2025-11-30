# 部署指南（超简单版）

## 📋 部署前准备

你需要准备：
1. GitHub 账号（如果没有，去 https://github.com 注册一个，免费）
2. Railway 账号（如果没有，去 https://railway.app 注册一个，免费）
3. Vercel 账号（如果没有，去 https://vercel.com 注册一个，免费）

---

## 🚀 第一步：把代码上传到 GitHub

### 1.1 在 GitHub 创建新仓库
1. 登录 GitHub
2. 点击右上角 "+" → "New repository"
3. 仓库名填写：`my-ai-app`（或你喜欢的名字）
4. 选择 "Public"（公开）
5. 点击 "Create repository"

### 1.2 上传代码到 GitHub
打开终端（在 Cursor 中），输入以下命令：

```bash
cd /Users/lian/Documents/my-ai-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/my-ai-app.git
git push -u origin main
```

**注意**：把 `你的用户名` 替换成你的 GitHub 用户名。

---

## 🔧 第二步：部署后端服务（Railway）

### 2.1 登录 Railway
1. 访问 https://railway.app
2. 点击 "Login" → 选择 "Login with GitHub"
3. 授权 Railway 访问你的 GitHub

### 2.2 创建新项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的 `my-ai-app` 仓库
4. 选择 `backend` 文件夹作为根目录

### 2.3 配置环境变量
1. 在项目设置中找到 "Variables"
2. 添加环境变量（暂时不需要，保持默认即可）

### 2.4 获取后端地址
部署完成后，Railway 会给你一个地址，类似：`https://xxx.railway.app`
**记住这个地址，后面要用！**

---

## 🤖 第三步：部署 AI 服务（Railway）

### 3.1 在同一个 Railway 项目中添加新服务
1. 在 Railway 项目中，点击 "+ New"
2. 选择 "GitHub Repo"
3. 选择同一个仓库，但这次选择 `ai-service` 文件夹

### 3.2 配置 Python 环境
Railway 会自动检测到这是 Python 项目，会自动安装依赖。

### 3.3 获取 AI 服务地址
部署完成后，记住 AI 服务的地址，类似：`https://yyy.railway.app`

---

## 🎨 第四步：部署前端（Vercel）

### 4.1 登录 Vercel
1. 访问 https://vercel.com
2. 点击 "Sign Up" → 选择 "Continue with GitHub"
3. 授权 Vercel 访问你的 GitHub

### 4.2 导入项目
1. 点击 "Add New..." → "Project"
2. 选择你的 `my-ai-app` 仓库
3. 在 "Root Directory" 中选择 `frontend` 文件夹

### 4.3 配置环境变量
在 "Environment Variables" 中添加：
- `VITE_API_URL` = 你的后端地址（第二步获取的）
- `VITE_AI_URL` = 你的 AI 服务地址（第三步获取的）

### 4.4 部署
点击 "Deploy"，等待几分钟，Vercel 会自动部署。

### 4.5 获取前端地址
部署完成后，Vercel 会给你一个地址，类似：`https://xxx.vercel.app`
**这个地址就是你的网页地址，可以分享给朋友了！**

---

## ✅ 完成！

现在你的软件已经部署到网络上了！

### 分享给朋友
把 Vercel 给你的地址发给朋友，他们就可以访问你的软件了。

### 注意事项
1. 后端和 AI 服务需要保持运行（Railway 免费版会自动休眠，首次访问会慢一点）
2. 如果遇到问题，检查环境变量是否正确配置
3. 数据库文件（app.db）在 Railway 上，每次重启可能会重置（这是免费版的限制）

---

## 🆘 遇到问题？

如果部署过程中遇到任何问题，告诉我具体的错误信息，我会帮你解决！

