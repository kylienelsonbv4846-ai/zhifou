import { trpc } from "@/lib/trpc";
import { shouldLogMutationErrorCode } from "@/lib/apiMutationErrorPolicy";
import {
  shouldLogQueryErrorCode,
  shouldRedirectToLoginForQueryError,
} from "@/lib/apiQueryErrorPolicy";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { RegistrationProvider } from "./contexts/RegistrationContext";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorizedQuery = (error: unknown): boolean => {
  if (!shouldRedirectToLoginForQueryError(error)) return false;

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }

  return true;
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    const errorCode = error instanceof TRPCClientError ? error.data?.code : undefined;
    if (
      !redirectToLoginIfUnauthorizedQuery(error) &&
      shouldLogQueryErrorCode(errorCode)
    ) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    const errorCode =
      error instanceof TRPCClientError ? error.data?.code : undefined;
    if (shouldLogMutationErrorCode(errorCode)) {
      console.error("[API Mutation Error]", error);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RegistrationProvider>
          <App />
        </RegistrationProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </ErrorBoundary>
);
