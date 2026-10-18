import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";


interface StudentData {
  studentId: number;
  studentName: string;
  cardNumber: number | null;
  answered: number;
  correct: number;
  correctRate: number;
  rank: number;
}

interface StudentOverviewProps {
  students: StudentData[];
  sessionId: number;
  onSelectStudent?: (studentId: number, studentName: string) => void;
}

export function StudentOverview({ students, sessionId, onSelectStudent }: StudentOverviewProps) {
  const [sortBy, setSortBy] = useState<"cardNumber" | "correctRate">("cardNumber");


  // 根据排序方式对学生进行排序
  const sortedStudents = useMemo(() => {
    const sorted = [...students];
    if (sortBy === "cardNumber") {
      sorted.sort((a, b) => (a.cardNumber || 0) - (b.cardNumber || 0));
    } else {
      sorted.sort((a, b) => b.correctRate - a.correctRate);
    }
    return sorted;
  }, [students, sortBy]);

  // 获取正确率对应的背景色和文字色
  const getCorrectRateStyles = (rate: number) => {
    if (rate === 100) return "bg-emerald-100 text-emerald-700";
    if (rate >= 80) return "bg-green-100 text-green-700";
    if (rate >= 60) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  // 计算竖排布局所需的行数和列配置
  const COLS = 4;
  const totalStudents = sortedStudents.length;
  const quotient = Math.floor(totalStudents / COLS);
  const remainder = totalStudents % COLS;
  
  // 行数计算
  const rows = remainder === 0 ? quotient : quotient + 1;
  
  // 确定每列是否显示最后一行
  // remainder=0: 所有列都显示最后一行
  // remainder=1: 只有第1列显示最后一行
  // remainder=2: 第1,2列显示最后一行
  // remainder=3: 第1,2,3列显示最后一行
  const showLastRowInColumn = (colIndex: number) => {
    if (remainder === 0) return true;
    return colIndex < remainder;
  };

  // 按竖排方式排列学生
  const studentsByColumn = useMemo(() => {
    const result: (StudentData | null)[][] = [];
    
    // 初始化4列
    for (let col = 0; col < COLS; col++) {
      result[col] = [];
    }
    
    // 按竖排方式填充学生
    for (let i = 0; i < sortedStudents.length; i++) {
      const col = Math.floor(i / rows); // 确定列
      const row = i % rows; // 确定行
      result[col][row] = sortedStudents[i];
    }
    
    // 填充空位（null）
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < rows; row++) {
        if (result[col][row] === undefined) {
          result[col][row] = null;
        }
      }
    }
    
    return result;
  }, [sortedStudents, rows]);

  // 按行显示学生
  const studentsByRow = useMemo(() => {
    const result: (StudentData | null)[][] = [];
    
    for (let row = 0; row < rows; row++) {
      result[row] = [];
      for (let col = 0; col < COLS; col++) {
        // 检查该列是否在最后一行显示数据
        if (row === rows - 1 && !showLastRowInColumn(col)) {
          result[row].push(null);
        } else {
          result[row].push(studentsByColumn[col][row] || null);
        }
      }
    }
    
    return result;
  }, [studentsByColumn, rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>学生概览</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={sortBy === "cardNumber" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("cardNumber")}
            className="flex items-center gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            按学生编号
          </Button>
          <Button
            variant={sortBy === "correctRate" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("correctRate")}
            className="flex items-center gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            按正确率
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {studentsByRow.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-8">
              {row.map((student, colIndex) => (
                <div
                  key={colIndex}
                  className="flex-1 flex flex-col min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    if (student && onSelectStudent) {
                      onSelectStudent(student.studentId, student.studentName);
                    }
                  }}
                >
                  {student ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{student.studentName}</span>
                        <span className={`ml-2 px-2 py-1 rounded font-semibold text-xs whitespace-nowrap ${getCorrectRateStyles(student.correctRate)}`}>
                          {student.correctRate}%
                        </span>
                      </div>
                      <div className="border-b border-gray-300 mt-1"></div>
                    </>
                  ) : (
                    <div />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>


    </Card>
  );
}
