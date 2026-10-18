import type { ErrorInfo, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

type BoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
};

type ErrorFallbackElement = ReactElement<{ onReset: () => void }>;

const uniqueErrorMessage = "UNIQUE_TEST_EXCEPTION_DO_NOT_RENDER";
const uniqueComponentStack = "UNIQUE_TEST_COMPONENT_STACK_DO_NOT_RENDER";

function createErroredBoundary() {
  const boundary = new ErrorBoundary({ children: "正常内容" });
  const mutableBoundary = boundary as unknown as { state: BoundaryState };

  mutableBoundary.state = {
    hasError: true,
    error: new Error(uniqueErrorMessage),
    errorInfo: { componentStack: uniqueComponentStack } as ErrorInfo,
    errorCount: 1,
  };

  return boundary;
}

describe("ErrorBoundary fallback", () => {
  it("renders generic recovery content without the exception message or component stack", () => {
    const boundary = createErroredBoundary();
    const markup = renderToStaticMarkup(boundary.render() as ErrorFallbackElement);

    expect(markup).toContain("应用程序出错");
    expect(markup).toContain("应用程序遇到了一个意外错误");
    expect(markup).toContain("重试");
    expect(markup).toContain("刷新页面");
    expect(markup).toContain("返回首页");
    expect(markup).not.toContain(uniqueErrorMessage);
    expect(markup).not.toContain(uniqueComponentStack);
    expect(markup).not.toContain("错误信息：");
    expect(markup).not.toContain("技术详情");
  });

  it("clears the error state when the fallback retry callback runs", () => {
    const boundary = createErroredBoundary();
    const mutableBoundary = boundary as unknown as {
      state: BoundaryState;
      setState: (
        update:
          | Partial<BoundaryState>
          | ((previousState: BoundaryState) => Partial<BoundaryState>),
      ) => void;
    };
    const setState = vi.fn((update: Parameters<typeof mutableBoundary.setState>[0]) => {
      const nextState =
        typeof update === "function"
          ? update(mutableBoundary.state)
          : update;

      mutableBoundary.state = { ...mutableBoundary.state, ...nextState };
    });
    mutableBoundary.setState = setState;

    const fallback = boundary.render() as ErrorFallbackElement;
    fallback.props.onReset();

    expect(setState).toHaveBeenCalledWith({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    expect(mutableBoundary.state).toEqual({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 1,
    });
    expect(renderToStaticMarkup(boundary.render())).toBe("正常内容");
  });
});
