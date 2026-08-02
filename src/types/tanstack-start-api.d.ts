// Type shim for TanStack Start's Vite-virtual API module.
// The actual runtime is provided by the bundler; tsc needs a type-only declaration.
declare module "@tanstack/react-start/api" {
  type APIHandler = (ctx: { request: Request }) => Response | Promise<Response>;

  export function createAPIFileRoute(
    path: string,
  ): (handlers: Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS", APIHandler>>) => {
    methods: Record<string, APIHandler>;
  };
}
