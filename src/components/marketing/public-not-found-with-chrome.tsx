import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PublicNotFoundMain } from "@/components/marketing/public-not-found";

/** The public 404 with the shared header and footer (see PublicNotFoundMain for why it is a separate file). */
export function PublicNotFoundWithChrome() {
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      <PublicNotFoundMain />
      <Footer />
    </div>
  );
}
