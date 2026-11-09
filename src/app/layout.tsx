import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import { LoadError } from "@/components/account-status";
import { FinanceProvider } from "@/components/finance-provider";
import { Nav } from "@/components/nav";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Utang Tracker",
  description: "See what you owe, what's left after each payment, and when you'll be debt-free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} ${publicSans.variable} antialiased`}>
        <FinanceProvider>
          <div className="md:flex md:min-h-screen">
            <Nav />
            <main className="flex-1 px-4 pt-6 pb-28 md:px-12 md:py-12">
              <div className="mx-auto max-w-4xl">
                <LoadError />
                {children}
              </div>
            </main>
          </div>
        </FinanceProvider>
      </body>
    </html>
  );
}
