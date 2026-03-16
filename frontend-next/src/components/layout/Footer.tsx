import Link from "next/link";

export default function Footer() {
  return (
    <footer className="glass border-t border-border py-12 md:py-16 px-6 sm:px-8 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12">
          <div>
            <h3 className="text-2xl font-black mb-4 gradient-text">
              NeuroLex
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Making education accessible for everyone, one lecture at a time.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-lg text-foreground">Company</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <Link
                  href="/about"
                  className="hover:text-foreground transition"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-8 text-center text-muted-foreground text-sm">
          <p>&copy; 2026 Code Lunatics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
