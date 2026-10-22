import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed right-3 top-3 z-40"><ThemeToggle /></div>
      {children}
    </>
  );
}
