import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you are looking for does not exist or you cannot access it.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-4")}>
        Go home
      </Link>
    </div>
  );
}
