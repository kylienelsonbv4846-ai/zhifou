import { useState } from "react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { User, Settings, LogOut } from "lucide-react";

export function UserMenu() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleProfileClick = () => {
    setIsOpen(false);
    setLocation("/profile");
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  const userInitial = user.name?.charAt(0).toUpperCase() || "U";
  const displayName = user.name || "用户";
  const displayEmail = user.email || "";

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="用户菜单"
        >
          <Avatar className="h-8 w-8 border border-primary/20">
            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-400 to-indigo-600 text-white">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start min-w-0">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate">
              {displayEmail}
            </span>
          </div>
          <div className="hidden sm:block text-muted-foreground">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* 用户信息头 */}
        <div className="px-2 py-2 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-blue-400 to-indigo-600 text-white">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {displayEmail}
              </p>
            </div>
          </div>
        </div>

        {/* 菜单项 */}
        <DropdownMenuItem
          onClick={handleProfileClick}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          <span>个人资料</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>登出</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
