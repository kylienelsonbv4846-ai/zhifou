import { Card } from "@/components/ui/card";

interface Option {
  label: string;
  content: string;
  image?: string;
  isCorrect?: boolean;
}

interface QuestionPreviewCardProps {
  questionNumber: number;
  questionContent: string;
  questionImage?: string;
  options: Option[];
  onClick: () => void;
}

export function QuestionPreviewCard({
  questionNumber,
  questionContent,
  questionImage,
  options,
  onClick,
}: QuestionPreviewCardProps) {
  return (
    <Card
      className="p-2 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50 h-full flex flex-col overflow-hidden"
      onClick={onClick}
    >
      <div className="flex flex-col overflow-hidden h-full">
        {/* 题号 */}
        {questionNumber > 0 && (
          <h3 className="font-semibold text-xs shrink-0 mb-1">第 {questionNumber} 题</h3>
        )}

        {/* 题干内容 */}
        <div className="flex-shrink-0 mb-1">
          {questionImage && (
            <img
              src={questionImage}
              alt="题目图片"
              className="w-full h-auto object-contain max-h-10"
            />
          )}
          <p className="text-xs text-muted-foreground line-clamp-1 leading-tight">
            {questionContent}
          </p>
        </div>

        {/* 选项显示 */}
        <div className="space-y-0.5 flex-1 overflow-hidden">
          {options.map((option) => {
            const colors: Record<string, { bg: string; text: string; border: string }> = {
              A: {
                bg: option.isCorrect ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20",
                text: option.isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300",
                border: option.isCorrect ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800",
              },
              B: {
                bg: option.isCorrect ? "bg-green-50 dark:bg-green-900/20" : "bg-purple-50 dark:bg-purple-900/20",
                text: option.isCorrect ? "text-green-700 dark:text-green-300" : "text-purple-700 dark:text-purple-300",
                border: option.isCorrect ? "border-green-200 dark:border-green-800" : "border-purple-200 dark:border-purple-800",
              },
              C: {
                bg: option.isCorrect ? "bg-green-50 dark:bg-green-900/20" : "bg-orange-50 dark:bg-orange-900/20",
                text: option.isCorrect ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300",
                border: option.isCorrect ? "border-green-200 dark:border-green-800" : "border-orange-200 dark:border-orange-800",
              },
              D: {
                bg: option.isCorrect ? "bg-green-50 dark:bg-green-900/20" : "bg-cyan-50 dark:bg-cyan-900/20",
                text: option.isCorrect ? "text-green-700 dark:text-green-300" : "text-cyan-700 dark:text-cyan-300",
                border: option.isCorrect ? "border-green-200 dark:border-green-800" : "border-cyan-200 dark:border-cyan-800",
              },
            };

            const color = colors[option.label];

            return (
              <div
                key={option.label}
                className={`${color.bg} border ${color.border} rounded p-1 flex items-start gap-1`}
              >
                <div className={`text-xs font-bold ${color.text} shrink-0 w-4 text-center`}>
                  {option.label}
                </div>
                <div className="flex-1 min-w-0">
                  {option.image && (
                    <img
                      src={option.image}
                      alt={`选项 ${option.label}`}
                      className="w-full h-auto object-contain max-h-6 mb-0.5"
                    />
                  )}
                  <p className="text-xs text-foreground line-clamp-1 leading-tight">
                    {option.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
