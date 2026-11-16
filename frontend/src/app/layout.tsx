import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/themes.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";

export const metadata: Metadata = {
  title: "ProWise — Project Delivery Management SaaS",
  description: "Modern, Google Workspace-inspired Project Delivery SaaS frontend based on Blueprint V1.1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-app-bg text-app-text-primary antialiased">
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
