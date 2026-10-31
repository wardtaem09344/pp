import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private DeepSeek Harness",
  description: "Private control panel for your DeepSeek Harness runtime"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
