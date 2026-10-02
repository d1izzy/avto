import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import { router } from "@/app/router";
import { Theme } from "@astryxdesign/core/theme";
import { defaultTheme } from "@/app/theme";
import "@/styles/index.css";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } });
registerSW({ immediate: true });
createRoot(document.getElementById("root")!).render(<StrictMode><Theme theme={defaultTheme} mode="dark"><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></Theme></StrictMode>);
