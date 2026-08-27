import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/research-radar/theme-toggle";
import { cn } from "@/lib/utils";

export function SiteHeader({ active }: { active: "home" | "papers" | "repos" }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold">
        <Image src="/icon.svg" alt="" width={24} height={24} className="size-6" />
        Research Radar
      </Link>
      <nav className="hidden items-center gap-1 sm:flex">
        <Button
          variant="ghost"
          className={cn("text-muted-foreground", active === "home" && "text-foreground")}
          render={<Link href="/">Home</Link>}
          nativeButton={false}
        />
        <Button
          variant="ghost"
          className={cn("text-muted-foreground", active === "papers" && "text-foreground")}
          render={<Link href="/papers">Papers</Link>}
          nativeButton={false}
        />
        <Button
          variant="ghost"
          className={cn("text-muted-foreground", active === "repos" && "text-foreground")}
          render={<Link href="/repos">Repos</Link>}
          nativeButton={false}
        />
      </nav>
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-40 sm:hidden">
            <Button
              variant="ghost"
              className={cn("justify-start text-muted-foreground", active === "home" && "text-foreground")}
              render={<Link href="/">Home</Link>}
              nativeButton={false}
            />
            <Button
              variant="ghost"
              className={cn("justify-start text-muted-foreground", active === "papers" && "text-foreground")}
              render={<Link href="/papers">Papers</Link>}
              nativeButton={false}
            />
            <Button
              variant="ghost"
              className={cn("justify-start text-muted-foreground", active === "repos" && "text-foreground")}
              render={<Link href="/repos">Repos</Link>}
              nativeButton={false}
            />
          </PopoverContent>
        </Popover>
        <ThemeToggle />
        <Show when="signed-out">
          <SignInButton>
            <Button variant="outline">Sign in</Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
