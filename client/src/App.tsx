import { Switch, Route } from "wouter";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import QuestionSets from "./pages/QuestionSets";
import QuestionSetDetail from "./pages/QuestionSetDetail";
import Sessions from "./pages/Sessions";
import { SessionDetail } from "./pages/SessionDetail";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import SessionPlay from "./pages/SessionPlay";
import SessionStart from "./pages/SessionStart";
import NowPlaying from "./pages/NowPlaying";
import StudentAnswer from "./pages/StudentAnswer";
import DownloadCards from "./pages/DownloadCards";
import Reports from "./pages/Reports";
import StudentReports from "./pages/StudentReports";
import Register from "./pages/Register";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailPending from "./pages/VerifyEmailPending";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";
import { Toaster } from "./components/ui/sonner";

function Routes() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/register"} component={Register} />
      <Route path={"/login"} component={Login} />
      <Route path={"/verify-email"} component={VerifyEmail} />
      <Route path={"/verify-email-pending"} component={VerifyEmailPending} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/profile"} component={UserProfile} />
      <Route path={"/download-cards"} component={DownloadCards} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/classes"} component={Classes} />
      <Route path={"/classes/:id"} component={ClassDetail} />
      <Route path={"/question-sets"} component={QuestionSets} />
      <Route path={"/question-sets/:id"} component={QuestionSetDetail} />
      <Route path={"/sessions"} component={Sessions} />
      <Route path={"/sessions/start"} component={SessionStart} />
      <Route path={"/sessions/:id/play"} component={SessionPlay} />
      <Route path={"/sessions/:id/now-playing"} component={NowPlaying} />
      <Route path={"/:sessionId/answer/:studentId"} component={StudentAnswer} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/student-reports"} component={StudentReports} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Routes />
      <Toaster />
    </div>
  );
}

export default App;
