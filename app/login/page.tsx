import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export const dynamic = "force-dynamic";

// Si ya hay sesión, no mostrar el formulario: ir directo al destino.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s) {
    const dest = sp.next && sp.next.startsWith("/") ? sp.next : s.role === "owner" ? "/panel" : "/validar";
    redirect(dest);
  }
  return <LoginForm />;
}
