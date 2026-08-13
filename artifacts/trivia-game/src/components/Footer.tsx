import { Link } from "wouter";

export function Footer() {
    return (
     <footer className="py-5 px-6 text-center border-t border-border/20 mt-8">
         <p className="text-xs text-muted-foreground/50 tracking-wide">
         All trivia questions are sourced from verified real-world facts.{" "}
         No AI-generated content.
         </p>
         <p className="mt-2 flex items-center justify-center gap-3 flex-wrap">
           <Link href="/privacy" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
             Privacy Policy
           </Link>
           <span className="text-xs text-muted-foreground/30">·</span>
           <Link href="/terms" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
             Terms of Service
           </Link>
           <span className="text-xs text-muted-foreground/30">·</span>
           <Link href="/support" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
             Support
           </Link>
         </p>
     </footer>
    );
}
