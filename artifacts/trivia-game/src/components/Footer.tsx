import { Link } from "wouter";
import { COPY } from "@workspace/copy";

export function Footer() {
    return (
     <footer className="py-5 px-6 text-center border-t border-border/20 mt-8">
         <p className="mt-2 flex items-center justify-center gap-3 flex-wrap">
           <Link href="/privacy" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
             {COPY.footer.privacyPolicy}
           </Link>
           <span className="text-xs text-muted-foreground/30">·</span>
           <Link href="/terms" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
             {COPY.footer.termsOfService}
           </Link>
           <span className="text-xs text-muted-foreground/30">·</span>
           <Link href="/support" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
             {COPY.footer.support}
           </Link>
         </p>
     </footer>
    );
}
