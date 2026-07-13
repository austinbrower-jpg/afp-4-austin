import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "Battle Bound Branding Client Reporting Portal",
  description: "Battle Bound Branding's client reporting and invoicing portal - reads hours, work, and invoices synced from Notion to produce professional client deliverables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppSidebar />
          <SidebarInset>
            <TopBar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </SidebarInset>
        </Providers>
      </body>
    </html>
  );
}
