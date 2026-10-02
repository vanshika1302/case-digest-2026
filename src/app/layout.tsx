import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Case Digest",
  description: "A case digest for personal-injury firms and the medical providers treating their clients.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
